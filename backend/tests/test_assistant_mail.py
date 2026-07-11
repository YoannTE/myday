"""Tests de l'outillage mail/événement de l'assistant conversationnel (Round
008 - agent BACK-MAIL). Règle testée : AUCUN mail n'est envoyé sans un
`decision=approve` explicite (garantie « au plus un envoi »).

`GmailClient.send_message` n'est JAMAIS appelé réellement : `attempt_send` /
`reconcile_sent` (bas niveau Gmail) sont mockés (monkeypatch) - aucun mail réel
ne part pendant ces tests. `complete_json` (LLM) est également mocké pour un
résultat déterministe (une clé Anthropic réelle est présente dans cet
environnement - round IA actif, cf. `.project/rounds/008/plan.md`).
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import asyncpg
import pytest
from fastapi import HTTPException

import app.db.client as dbclient
from app.config import settings
from app.services import assistant_drafts as drafts_service
from app.services.assistant import draft as draft_module
from app.services.assistant.draft import draft_email
from app.services.assistant.tools_event import create_event_action

from conftest import create_user, delete_user


def run_in_loop(coro_factory):
    """Exécute une coroutine avec un pool `app_rls` dédié à un loop neuf (même
    pattern que `test_events.py`/`test_daily_brief.py`)."""

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


def admin_row(query, *args):
    async def _do():
        conn = await asyncpg.connect(settings.database_url)
        try:
            row = await conn.fetchrow(query, *args)
            return dict(row) if row else None
        finally:
            await conn.close()

    return asyncio.new_event_loop().run_until_complete(_do())


@pytest.fixture
def user_id():
    uid = create_user(f"assistant-mail-{uuid.uuid4().hex}@test.local")
    yield uid
    delete_user(uid)


def insert_mail(user_id: str, expediteur: str) -> str:
    return admin_val(
        "INSERT INTO mails (user_id, gmail_id, expediteur, sujet, extrait, "
        "statut, repondu, date_reception) "
        "VALUES ($1, $2, $3, 'Sujet', 'Extrait', 'triaged', false, now()) "
        "RETURNING id::text",
        user_id, f"gmail-{uuid.uuid4().hex}", expediteur,
    )


def insert_draft(
    user_id: str,
    *,
    destinataire: str = "dest@ex.com",
    objet: str = "Objet",
    corps: str = "Corps",
    statut: str = "pending_review",
    mail_origine_id: str | None = None,
    created_at: datetime | None = None,
) -> str:
    return admin_val(
        "INSERT INTO mail_drafts (user_id, destinataire, objet, corps, statut, "
        "mail_origine_id, created_at, updated_at) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, now()) RETURNING id::text",
        user_id, destinataire, objet, corps, statut, mail_origine_id,
        created_at or datetime.now(timezone.utc),
    )


def get_draft_row(draft_id: str) -> dict | None:
    return admin_row(
        "SELECT statut, sent_gmail_id, mail_origine_id::text FROM mail_drafts "
        "WHERE id = $1::uuid",
        draft_id,
    )


def count_events(user_id: str) -> int:
    return admin_val("SELECT count(*) FROM events WHERE user_id = $1", user_id)


def mail_repondu(mail_id: str) -> bool:
    return admin_val("SELECT repondu FROM mails WHERE id = $1::uuid", mail_id)


def count_usage_events(user_id: str, type_: str) -> int:
    return admin_val(
        "SELECT count(*) FROM usage_events WHERE user_id = $1 AND type = $2",
        user_id, type_,
    )


def _mock_llm(monkeypatch, subject: str = "Re: Question", body: str = "Je suis d'accord."):
    async def fake(**kwargs):
        return {"subject": subject, "body": body}

    monkeypatch.setattr(draft_module, "complete_json", fake)


def _mock_send_ok(monkeypatch, gmail_id="msg-1"):
    async def fake(*args, **kwargs):
        return {"ok": True, "ambiguous": False, "gmail_id": gmail_id, "message": None}

    monkeypatch.setattr(drafts_service, "attempt_send", fake)


# --- create_event_action : idempotence ------------------------------------


def test_create_event_action_idempotent_meme_action_key(user_id):
    params = {
        "title": "Padel",
        "start": "2026-08-01T18:00:00",
        "end": "2026-08-01T19:00:00",
        "location": None,
    }
    action_key = "turn-abc:0"

    first = run_in_loop(lambda: create_event_action(user_id, params, action_key))
    second = run_in_loop(lambda: create_event_action(user_id, params, action_key))

    assert first["event_id"] == second["event_id"]
    assert count_events(user_id) == 1


def test_create_event_action_params_invalides_ecarte(user_id):
    with pytest.raises(HTTPException) as exc_info:
        run_in_loop(lambda: create_event_action(user_id, {"title": ""}, "turn-x:0"))
    assert exc_info.value.status_code == 400


# --- draft_email : brouillon + garde-fou destinataire ----------------------


def test_draft_email_pending_review_to_ecrase(user_id, monkeypatch):
    _mock_llm(monkeypatch)
    mail_id = insert_mail(user_id, "Jean Dupont <jean@ex.com>")
    ref_data = {
        "mail": {
            "id": mail_id, "expediteur": "Jean Dupont <jean@ex.com>",
            "sujet": "Question", "extrait": "...",
        }
    }
    params = {
        "to": "ignore-moi@evil.com", "subject": None,
        "instruction": "Dis que je suis d'accord", "reply_to_ref": True,
    }

    result = run_in_loop(lambda: draft_email(user_id, params, ref_data, "turn-y:0"))

    assert result["to"] == "jean@ex.com"  # jamais "ignore-moi@evil.com" (le "to" du LLM/params ignoré)
    row = get_draft_row(result["draft_id"])
    assert row["statut"] == "pending_review"
    assert row["mail_origine_id"] == mail_id


def test_draft_email_llm_echoue_fallback_minimal(user_id, monkeypatch):
    async def fake_boom(**kwargs):
        raise RuntimeError("LLM indisponible")

    monkeypatch.setattr(draft_module, "complete_json", fake_boom)

    params = {
        "to": "dest@ex.com", "subject": "Objet test",
        "instruction": "Contenu du message", "reply_to_ref": False,
    }
    result = run_in_loop(lambda: draft_email(user_id, params, {}, "turn-z:0"))

    assert result["to"] == "dest@ex.com"
    assert result["subject"] == "Objet test"
    assert result["body"] == "Contenu du message"
    assert get_draft_row(result["draft_id"])["statut"] == "pending_review"


# --- approve / reject -------------------------------------------------------


def test_approve_envoie_puis_double_approve_409(user_id, monkeypatch):
    draft_id = insert_draft(user_id)
    _mock_send_ok(monkeypatch)

    result = run_in_loop(lambda: drafts_service.approve_draft(user_id, draft_id, None))
    assert result == {"statut": "sent", "sent_gmail_id": "msg-1"}
    assert get_draft_row(draft_id)["statut"] == "sent"

    with pytest.raises(HTTPException) as exc_info:
        run_in_loop(lambda: drafts_service.approve_draft(user_id, draft_id, None))
    assert exc_info.value.status_code == 409


def test_reject_draft(user_id):
    draft_id = insert_draft(user_id)
    result = run_in_loop(lambda: drafts_service.reject_draft(user_id, draft_id))
    assert result == {"statut": "rejected"}
    assert get_draft_row(draft_id)["statut"] == "rejected"


def test_approve_edited_body_envoye(user_id, monkeypatch):
    draft_id = insert_draft(
        user_id, destinataire="orig@ex.com", objet="Objet orig", corps="Corps orig"
    )
    captured = {}

    async def fake(user_id_, draft_id_, to, subject, body, origin_gmail_id):
        captured.update(to=to, subject=subject, body=body)
        return {"ok": True, "ambiguous": False, "gmail_id": "msg-edited", "message": None}

    monkeypatch.setattr(drafts_service, "attempt_send", fake)

    edited = {"to": "nouveau@ex.com", "subject": "Nouvel objet", "body": "Nouveau corps"}
    result = run_in_loop(lambda: drafts_service.approve_draft(user_id, draft_id, edited))

    assert result["statut"] == "sent"
    assert captured == {"to": "nouveau@ex.com", "subject": "Nouvel objet", "body": "Nouveau corps"}


def test_approve_echec_ambigu_sending_unconfirmed(user_id, monkeypatch):
    draft_id = insert_draft(user_id)

    async def fake(*args, **kwargs):
        return {"ok": False, "ambiguous": True, "gmail_id": None, "message": "timeout"}

    monkeypatch.setattr(drafts_service, "attempt_send", fake)

    result = run_in_loop(lambda: drafts_service.approve_draft(user_id, draft_id, None))
    assert result["statut"] == "sending_unconfirmed"
    assert get_draft_row(draft_id)["statut"] == "sending_unconfirmed"


def test_reconciliation_rfc822msgid_sent_sans_renvoi(user_id, monkeypatch):
    draft_id = insert_draft(user_id, statut="sending_unconfirmed")

    async def fake_reconcile(user_id_, draft_id_):
        return "msg-found"

    def boom(*args, **kwargs):
        raise AssertionError("attempt_send ne doit PAS être appelé (déjà envoyé)")

    monkeypatch.setattr(drafts_service, "reconcile_sent", fake_reconcile)
    monkeypatch.setattr(drafts_service, "attempt_send", boom)

    result = run_in_loop(lambda: drafts_service.approve_draft(user_id, draft_id, None))
    assert result == {"statut": "sent", "sent_gmail_id": "msg-found"}


def test_reconciliation_absente_autorise_un_renvoi(user_id, monkeypatch):
    draft_id = insert_draft(user_id, statut="sending_unconfirmed")

    async def fake_reconcile(user_id_, draft_id_):
        return None

    monkeypatch.setattr(drafts_service, "reconcile_sent", fake_reconcile)
    _mock_send_ok(monkeypatch, gmail_id="msg-resent")

    result = run_in_loop(lambda: drafts_service.approve_draft(user_id, draft_id, None))
    assert result == {"statut": "sent", "sent_gmail_id": "msg-resent"}


def test_allow_email_send_false_403(user_id, monkeypatch):
    draft_id = insert_draft(user_id)
    monkeypatch.setattr(settings, "assistant_allow_email_send", False)

    with pytest.raises(HTTPException) as exc_info:
        run_in_loop(lambda: drafts_service.approve_draft(user_id, draft_id, None))
    assert exc_info.value.status_code == 403


def test_approve_rls_autre_user_404(user_id):
    other_uid = create_user(f"assistant-mail-other-{uuid.uuid4().hex}@test.local")
    try:
        draft_id = insert_draft(other_uid)
        with pytest.raises(HTTPException) as exc_info:
            run_in_loop(lambda: drafts_service.approve_draft(user_id, draft_id, None))
        assert exc_info.value.status_code == 404
    finally:
        delete_user(other_uid)


def test_expiration_marque_expired(user_id, monkeypatch):
    monkeypatch.setattr(settings, "assistant_hitl_timeout_hours", 1)
    old = datetime.now(timezone.utc) - timedelta(hours=2)
    draft_id = insert_draft(user_id, created_at=old)

    result = run_in_loop(lambda: drafts_service.get_draft(user_id, draft_id))
    assert result["statut"] == "expired"
    assert get_draft_row(draft_id)["statut"] == "expired"


def test_repondu_true_apres_envoi_reponse(user_id, monkeypatch):
    mail_id = insert_mail(user_id, "Contact <contact@ex.com>")
    draft_id = insert_draft(user_id, mail_origine_id=mail_id)
    _mock_send_ok(monkeypatch, gmail_id="msg-reply")

    result = run_in_loop(lambda: drafts_service.approve_draft(user_id, draft_id, None))

    assert result["statut"] == "sent"
    assert mail_repondu(mail_id) is True
    assert count_usage_events(user_id, "mail_replied") == 1
