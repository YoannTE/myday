"""Tests des capacités de modification de l'assistant : vue des données
transmise au planificateur (références courtes), décalage d'une tâche avec
créneau horaire, coche, référence inventée refusée, suppression en deux
temps (demande puis confirmation relue en base). LLM toujours mocké.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import pytest

from app.services.assistant import plan as plan_module
from app.services.assistant import reply as reply_module
from app.services.assistant.orchestrator import run_assistant_message

from conftest import create_user, delete_user
from test_assistant import admin_val, create_conversation, run_in_loop


@pytest.fixture
def user_id():
    uid = create_user(f"assistant-edit-{uuid.uuid4().hex}@test.local")
    yield uid
    delete_user(uid)


def _insert_task(user_id: str, titre: str, echeance: str) -> str:
    return admin_val(
        "INSERT INTO tasks (user_id, titre, echeance) VALUES ($1, $2, $3) RETURNING id::text",
        user_id, titre, datetime.fromisoformat(echeance),
    )


def _plan(actions, prompts: list[str] | None = None, intent="actions"):
    async def _fake(**kwargs):
        if prompts is not None:
            prompts.append(kwargs["user_prompt"])
        return {"intent": intent, "actions": actions, "clarification_question": None}
    return _fake


async def _reply_interdit(**kwargs):
    raise AssertionError("le LLM de rédaction ne devrait pas être appelé")


def _send(user_id, conversation_id, turn, message):
    return run_in_loop(lambda: run_assistant_message(
        user_id, conversation_id, turn, message, None,
    ))


def test_decaler_une_tache_a_jeudi_21h(user_id, monkeypatch):
    task_id = _insert_task(user_id, "RDV médical", "2026-10-06T12:00:00+02:00")
    conversation_id = create_conversation(user_id)
    prompts: list[str] = []
    monkeypatch.setattr(plan_module, "complete_json", _plan([{
        "type": "update_task",
        "params": {"ref": "T1", "due": "2026-10-08", "scheduled_start": "2026-10-08T21:00"},
    }], prompts))
    monkeypatch.setattr(reply_module, "complete_json", _reply_interdit)

    result = _send(user_id, conversation_id, "t1", "décale la tâche rendez-vous médicaux à jeudi 21h")

    assert "T1 | « RDV médical »" in prompts[0]
    assert result["actions_done"][0]["ok"] is True
    assert "planning jeudi 8 octobre à 21h00-22h00" in result["reply"]
    debut = admin_val(
        "SELECT to_char(planifie_debut AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD HH24:MI') "
        "FROM tasks WHERE id = $1::uuid", task_id,
    )
    assert debut == "2026-10-08 21:00"
    jour = admin_val(
        "SELECT to_char(echeance AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD') FROM tasks "
        "WHERE id = $1::uuid", task_id,
    )
    assert jour == "2026-10-08"


def test_cocher_une_tache(user_id, monkeypatch):
    task_id = _insert_task(user_id, "Appeler le garage", "2026-10-07T12:00:00+02:00")
    conversation_id = create_conversation(user_id)
    monkeypatch.setattr(plan_module, "complete_json", _plan([
        {"type": "update_task", "params": {"ref": "T1", "status": "faite"}},
    ]))
    monkeypatch.setattr(reply_module, "complete_json", _reply_interdit)

    _send(user_id, conversation_id, "t1", "j'ai appelé le garage")

    assert admin_val("SELECT statut FROM tasks WHERE id = $1::uuid", task_id) == "faite"


def test_reference_inventee_refusee(user_id, monkeypatch):
    conversation_id = create_conversation(user_id)
    monkeypatch.setattr(plan_module, "complete_json", _plan([
        {"type": "update_task", "params": {"ref": "T42", "status": "faite"}},
    ]))

    async def _reply(**kwargs):
        return {"reply": "Je n'ai pas retrouvé cette tâche."}

    monkeypatch.setattr(reply_module, "complete_json", _reply)

    result = _send(user_id, conversation_id, "t1", "coche la tâche fantôme")

    assert result["actions_done"][0]["ok"] is False


def test_suppression_demande_puis_confirmation(user_id, monkeypatch):
    task_id = _insert_task(user_id, "Vieux rappel", "2026-10-07T12:00:00+02:00")
    conversation_id = create_conversation(user_id)
    monkeypatch.setattr(reply_module, "complete_json", _reply_interdit)

    monkeypatch.setattr(plan_module, "complete_json", _plan([
        {"type": "delete", "params": {"ref": "T1"}},
    ]))
    premier = _send(user_id, conversation_id, "t1", "supprime la tâche vieux rappel")
    assert "Réponds « oui »" in premier["reply"]
    assert admin_val("SELECT count(*) FROM tasks WHERE id = $1::uuid", task_id) == 1

    prompts: list[str] = []
    monkeypatch.setattr(plan_module, "complete_json", _plan([
        {"type": "confirm_delete", "params": {}},
    ], prompts))
    second = _send(user_id, conversation_id, "t2", "oui")

    assert "task « Vieux rappel »" in prompts[0]
    assert second["actions_done"][0]["ok"] is True
    assert admin_val("SELECT count(*) FROM tasks WHERE id = $1::uuid", task_id) == 0


def test_confirmation_sans_suppression_en_attente(user_id, monkeypatch):
    task_id = _insert_task(user_id, "À garder", "2026-10-07T12:00:00+02:00")
    conversation_id = create_conversation(user_id)
    monkeypatch.setattr(plan_module, "complete_json", _plan([
        {"type": "confirm_delete", "params": {}},
    ]))

    async def _reply(**kwargs):
        return {"reply": "Rien n'était en attente."}

    monkeypatch.setattr(reply_module, "complete_json", _reply)

    result = _send(user_id, conversation_id, "t1", "oui")

    assert result["actions_done"][0]["ok"] is False
    assert admin_val("SELECT count(*) FROM tasks WHERE id = $1::uuid", task_id) == 1
