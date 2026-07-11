"""Tests de l'assistant conversationnel (Round 008) : plan d'actions (LLM
mocké - jamais d'appel réseau réel en test, malgré la clé Anthropic présente
en environnement), clarification, dédup `(conversation_id, turn_key)` en tête
(aucune ré-exécution), idempotence `action_key`, anti-spam 429, RLS
cross-utilisateur, persistance idempotente du tour, `context_ref` étranger
ignoré.

Tourne contre Postgres réel (comme `test_mail_triage.py`/`test_daily_brief.py`) :
chaque appel direct à un service passe par un pool `app_rls` dédié à un loop
neuf ; les appels via l'API utilisent le pool du `client` (lifespan).
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import asyncpg
import pytest
from fastapi import HTTPException

import app.db.client as dbclient
from app.auth.cookie import COOKIE_NAME
from app.config import settings
from app.services.assistant import actions as actions_module
from app.services.assistant import plan as plan_module
from app.services.assistant import reply as reply_module
from app.services.assistant.context import load_context
from app.services.assistant.orchestrator import run_assistant_message

from conftest import create_user, delete_user, make_session_for, sign_token


def run_in_loop(coro_factory):
    """Exécute une coroutine avec un pool app_rls dédié à un loop neuf."""

    async def _runner():
        saved = dbclient._pool
        dbclient._pool = await asyncpg.create_pool(
            settings.backend_database_url, min_size=1, max_size=5
        )
        try:
            return await coro_factory()
        finally:
            await dbclient._pool.close()
            dbclient._pool = saved

    return asyncio.new_event_loop().run_until_complete(_runner())


def admin_val(query, *args):
    async def _do():
        conn = await asyncpg.connect(settings.database_url)
        try:
            return await conn.fetchval(query, *args)
        finally:
            await conn.close()

    return asyncio.new_event_loop().run_until_complete(_do())


def create_conversation(user_id: str) -> str:
    return admin_val(
        "INSERT INTO assistant_conversations (user_id) VALUES ($1) RETURNING id::text",
        user_id,
    )


def insert_mail_for(user_id: str, gmail_id: str, expediteur: str, sujet: str) -> str:
    return admin_val(
        "INSERT INTO mails (user_id, gmail_id, expediteur, sujet, extrait, statut, date_reception) "
        "VALUES ($1, $2, $3, $4, 'Extrait', 'triaged', now()) RETURNING id::text",
        user_id, gmail_id, expediteur, sujet,
    )


def count_tasks(user_id: str) -> int:
    return admin_val(
        "SELECT count(*) FROM tasks WHERE user_id = $1 AND origine = 'assistant'", user_id
    )


def count_turns(conversation_id: str) -> int:
    return admin_val(
        "SELECT count(*) FROM assistant_conversation_turns WHERE conversation_id = $1::uuid",
        conversation_id,
    )


@pytest.fixture
def user_id():
    uid = create_user(f"assistant-{uuid.uuid4().hex}@test.local")
    yield uid
    delete_user(uid)


def _mock_plan(intent="actions", actions=None, clarification_question=None):
    async def _fake(**kwargs):
        return {
            "intent": intent,
            "actions": actions or [],
            "clarification_question": clarification_question,
        }
    return _fake


def _mock_reply(text="D'accord, c'est fait."):
    async def _fake(**kwargs):
        return {"reply": text}
    return _fake


# --- plan_actions : cas nominal + params invalides --------------------------


def test_plan_actions_cree_une_action_valide(monkeypatch):
    async def _fake(**kwargs):
        return {
            "intent": "actions",
            "actions": [{"type": "create_task", "params": {"title": "Acheter le pain"}}],
            "clarification_question": None,
        }

    monkeypatch.setattr(plan_module, "complete_json", _fake)

    result = asyncio.new_event_loop().run_until_complete(
        plan_module.plan_actions("uid-test", "ajoute le pain a ma liste", [], {})
    )

    assert result["intent"] == "actions"
    assert result["actions"] == [{"type": "create_task", "params": {
        "title": "Acheter le pain", "priority": "normale", "due": None,
    }}]


def test_plan_actions_params_invalides_ecartees(monkeypatch):
    async def _fake(**kwargs):
        return {
            "intent": "actions",
            "actions": [{"type": "create_task", "params": {}}],  # title manquant
            "clarification_question": None,
        }

    monkeypatch.setattr(plan_module, "complete_json", _fake)

    result = asyncio.new_event_loop().run_until_complete(
        plan_module.plan_actions("uid-test", "message", [], {})
    )

    assert result["intent"] == "clarification"
    assert result["discarded_count"] == 1


# --- Orchestrateur : plan d'actions -> tâche créée --------------------------


def test_run_assistant_message_cree_une_tache(user_id, monkeypatch):
    conversation_id = create_conversation(user_id)
    monkeypatch.setattr(
        plan_module, "complete_json",
        _mock_plan(actions=[{"type": "create_task", "params": {"title": "Acheter le pain"}}]),
    )
    monkeypatch.setattr(reply_module, "complete_json", _mock_reply("Le pain est sur ta liste."))

    result = run_in_loop(lambda: run_assistant_message(
        user_id, conversation_id, "turn-task", "ajoute le pain a ma liste", None,
    ))

    assert result["clarification_needed"] is False
    assert len(result["actions_done"]) == 1
    assert result["actions_done"][0]["ok"] is True
    assert result["reply"] == "Le pain est sur ta liste."
    assert count_tasks(user_id) == 1


# --- Clarification -----------------------------------------------------------


def test_run_assistant_message_clarification(user_id, monkeypatch):
    conversation_id = create_conversation(user_id)
    monkeypatch.setattr(
        plan_module, "complete_json",
        _mock_plan(intent="clarification", clarification_question="Qui est Paul ?"),
    )
    monkeypatch.setattr(reply_module, "complete_json", _mock_reply("Qui est Paul ?"))

    result = run_in_loop(lambda: run_assistant_message(
        user_id, conversation_id, "turn-clarif", "envoie un mail a Paul", None,
    ))

    assert result["clarification_needed"] is True
    assert result["actions_done"] == []
    assert count_tasks(user_id) == 0


# --- Dédup (conversation_id, turn_key) en tête -------------------------------


def test_meme_turn_key_pas_de_reexecution(user_id, monkeypatch):
    calls = {"n": 0}

    async def _fake_plan(**kwargs):
        calls["n"] += 1
        return {
            "intent": "actions",
            "actions": [{"type": "create_task", "params": {"title": "Tache unique"}}],
            "clarification_question": None,
        }

    conversation_id = create_conversation(user_id)
    monkeypatch.setattr(plan_module, "complete_json", _fake_plan)
    monkeypatch.setattr(reply_module, "complete_json", _mock_reply("Fait."))

    first = run_in_loop(lambda: run_assistant_message(
        user_id, conversation_id, "turn-dup", "ajoute une tache", None,
    ))
    second = run_in_loop(lambda: run_assistant_message(
        user_id, conversation_id, "turn-dup", "ajoute une tache", None,
    ))

    assert first == second
    assert calls["n"] == 1  # le plan LLM n'a été appelé qu'une seule fois
    assert count_tasks(user_id) == 1
    assert count_turns(conversation_id) == 2  # 1 user + 1 assistant, jamais 4


# --- Idempotence action_key (appel direct create_task) ----------------------


def test_create_task_idempotent_meme_action_key(user_id):
    params = {"title": "Titre idempotent", "priority": "normale", "due": None}
    first = run_in_loop(lambda: actions_module.create_task(user_id, "action-fixe", params))
    second = run_in_loop(lambda: actions_module.create_task(user_id, "action-fixe", params))

    assert first["task_id"] == second["task_id"]
    assert count_tasks(user_id) == 1


# --- Anti-spam serveur-autoritaire (429) ------------------------------------


def _cookie(value: str) -> dict[str, str]:
    return {"Cookie": f"{COOKIE_NAME}={value}"}


@pytest.fixture
def auth_user(client):
    uid = create_user(f"assistant-api-{uuid.uuid4().hex}@test.local")
    token = "assistant-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, _cookie(sign_token(token))
    delete_user(uid)


def test_post_message_anti_spam_429(client, auth_user, monkeypatch):
    monkeypatch.setattr(settings, "assistant_rate_limit_per_min", 1)
    monkeypatch.setattr(
        plan_module, "complete_json",
        _mock_plan(intent="clarification", clarification_question="Précise ta demande."),
    )
    monkeypatch.setattr(reply_module, "complete_json", _mock_reply("Précise ta demande."))

    _, headers = auth_user
    conv_resp = client.post("/api/assistant/conversations", headers=headers)
    assert conv_resp.status_code == 200
    conversation_id = conv_resp.json()["data"]["conversation_id"]

    first = client.post(
        "/api/assistant/message", headers=headers,
        json={"conversation_id": conversation_id, "message": "Bonjour"},
    )
    assert first.status_code == 200

    second = client.post(
        "/api/assistant/message", headers=headers,
        json={"conversation_id": conversation_id, "message": "Un autre message"},
    )
    assert second.status_code == 429


# --- RLS cross-utilisateur ----------------------------------------------------


def test_conversation_dun_autre_user_refusee(user_id, monkeypatch):
    other = create_user(f"assistant-other-{uuid.uuid4().hex}@test.local")
    try:
        conv_other = create_conversation(other)
        monkeypatch.setattr(plan_module, "complete_json", _mock_plan())
        monkeypatch.setattr(reply_module, "complete_json", _mock_reply())

        with pytest.raises(HTTPException) as exc_info:
            run_in_loop(lambda: run_assistant_message(
                user_id, conv_other, "turn-cross", "message", None,
            ))
        assert exc_info.value.status_code == 404
    finally:
        delete_user(other)


# --- context_ref d'un autre utilisateur ignoré -------------------------------


def test_load_context_mail_dun_autre_user_ignore(user_id):
    other = create_user(f"assistant-mailref-{uuid.uuid4().hex}@test.local")
    try:
        mail_id = insert_mail_for(other, "g1", "exp@test.local", "Sujet")
        conversation_id = create_conversation(user_id)

        ctx = run_in_loop(lambda: load_context(user_id, conversation_id, {"mail_id": mail_id}))

        assert ctx["ref_data"] == {}
    finally:
        delete_user(other)


# --- persist_turn idempotent --------------------------------------------------


def test_persist_turn_idempotent_une_seule_paire_de_lignes(user_id, monkeypatch):
    conversation_id = create_conversation(user_id)
    monkeypatch.setattr(
        plan_module, "complete_json",
        _mock_plan(actions=[{"type": "create_task", "params": {"title": "Une tache"}}]),
    )
    monkeypatch.setattr(reply_module, "complete_json", _mock_reply("Fait."))

    run_in_loop(lambda: run_assistant_message(
        user_id, conversation_id, "turn-persist", "message", None,
    ))
    run_in_loop(lambda: run_assistant_message(
        user_id, conversation_id, "turn-persist", "message", None,
    ))

    assert count_turns(conversation_id) == 2
