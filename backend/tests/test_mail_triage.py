"""Tests du tri des mails (Round 006) : pré-filtre pur, orchestrateur en
mode fallback heuristique (chemin nominal - aucune clé ANTHROPIC_API_KEY),
idempotence, plafond LLM, notifications plafonnées, RLS, dégradation
gracieuse du client LLM.

Les tests d'orchestrateur tournent contre Postgres réel (comme
test_google_gmail_branch.py) : chaque appel s'exécute dans un event loop
dédié avec son propre pool asyncpg app_rls (isolation, pas de fuite
inter-loop). Aucun appel LLM réel n'est testé (clé absente = fallback).
"""

from __future__ import annotations

import asyncio
from datetime import datetime

import asyncpg
import pytest

import app.db.client as dbclient
from app.config import settings
from app.services.mail_triage import llm as mail_llm
from app.services.mail_triage.normalize import email_expediteur
from app.services.mail_triage.orchestrator import run_mail_triage
from app.services.mail_triage.prefilter import prefilter_mails

from conftest import create_user, delete_user


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


def admin_exec(query, *args):
    async def _do():
        conn = await asyncpg.connect(settings.database_url)
        try:
            await conn.execute(query, *args)
        finally:
            await conn.close()

    return asyncio.new_event_loop().run_until_complete(_do())


def insert_mail(user_id, gmail_id, expediteur, sujet="Sujet", extrait="Extrait") -> str:
    return admin_val(
        """
        INSERT INTO mails (user_id, gmail_id, expediteur, sujet, extrait, statut, date_reception)
        VALUES ($1, $2, $3, $4, $5, 'pending_triage', now())
        RETURNING id::text
        """,
        user_id, gmail_id, expediteur, sujet, extrait,
    )


def insert_sender_pref(user_id, email, statut) -> None:
    admin_exec(
        "INSERT INTO sender_preferences (user_id, email, statut) VALUES ($1, $2, $3)",
        user_id, email, statut,
    )


def mail_row(mail_id) -> asyncpg.Record:
    async def _do():
        conn = await asyncpg.connect(settings.database_url)
        try:
            return await conn.fetchrow(
                "SELECT statut, score, raison_score, resume_ia FROM mails WHERE id = $1::uuid",
                mail_id,
            )
        finally:
            await conn.close()

    return asyncio.new_event_loop().run_until_complete(_do())


def count_notifications(user_id) -> int:
    return admin_val(
        "SELECT count(*) FROM notifications WHERE user_id = $1 AND type = 'mail_important'",
        user_id,
    )


def notification_contenu(user_id, ref_id) -> str | None:
    return admin_val(
        "SELECT contenu FROM notifications WHERE user_id = $1 AND ref_id = $2::uuid",
        user_id, ref_id,
    )


@pytest.fixture
def user_id():
    uid = create_user(f"mail-triage-{datetime.now().timestamp()}@test.local")
    yield uid
    delete_user(uid)


# --- Pré-filtre (pur, sans BDD) ----------------------------------------------


def test_email_expediteur_normalise():
    assert email_expediteur("Manon Test <Manon@Exemple.COM>") == "manon@exemple.com"
    assert email_expediteur("brut@exemple.com") == "brut@exemple.com"
    assert email_expediteur(None) == ""


def test_prefilter_muet_prioritaire_sur_action_keywords():
    mails = [{"mail_id": "m1", "expediteur": "a@b.com", "sujet": "Facture urgente", "extrait": ""}]
    prefs = {"a@b.com": "muet"}
    result = prefilter_mails(mails, prefs)
    assert result["auto_scored"] == [
        {"mail_id": "m1", "score": 5, "reason": "Expéditeur en sourdine", "source": "prefilter"}
    ]
    assert result["candidates"] == []


def test_prefilter_important():
    mails = [{"mail_id": "m1", "expediteur": "boss@corp.com", "sujet": "RAS", "extrait": ""}]
    prefs = {"boss@corp.com": "important"}
    result = prefilter_mails(mails, prefs)
    assert result["auto_scored"][0]["score"] == 85
    assert result["auto_scored"][0]["reason"] == "Expéditeur marqué important"


def test_prefilter_newsletter_detectee():
    mails = [
        {"mail_id": "m1", "expediteur": "Newsletter <no-reply@shop.com>", "sujet": "Promo", "extrait": ""}
    ]
    result = prefilter_mails(mails, {})
    assert result["auto_scored"][0]["score"] == 15
    assert result["candidates"] == []


def test_prefilter_action_keywords_et_known_sender():
    mails = [
        {"mail_id": "m1", "expediteur": "x@y.com", "sujet": "Merci de confirmer", "extrait": ""},
        {"mail_id": "m2", "expediteur": "x@y.com", "sujet": "Salut", "extrait": "on se voit ?"},
    ]
    result = prefilter_mails(mails, {})
    assert len(result["candidates"]) == 2
    # Le meme expediteur apparait 2 fois dans le lot -> known_sender vrai pour les deux.
    assert all(c["known_sender"] for c in result["candidates"])
    assert result["candidates"][0]["action_keywords"] == ["merci de", "confirme"]


# --- Client LLM : dégradation gracieuse -------------------------------------


def test_llm_cle_absente_zero_appel_reseau(monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    # Poison le module anthropic : si le code tentait de le construire, ça leverait.
    import sys

    monkeypatch.setitem(sys.modules, "anthropic", None)

    async def _call():
        return await mail_llm.complete_json(
            user_id="whatever", agent="test", model="claude-haiku-4-5",
            system="sys", user_prompt="user",
        )

    with pytest.raises(mail_llm.LlmUnavailable):
        asyncio.new_event_loop().run_until_complete(_call())


# --- Orchestrateur : chemin nominal fallback heuristique --------------------


def test_run_mail_triage_happy_path_heuristique(user_id):
    insert_sender_pref(user_id, "boss@corp.com", "important")
    insert_sender_pref(user_id, "spam@corp.com", "muet")

    m_important = insert_mail(user_id, "g1", "Boss <boss@corp.com>", "Réunion demain")
    m_muet = insert_mail(user_id, "g2", "Spam <spam@corp.com>", "Rien")
    m_newsletter = insert_mail(user_id, "g3", "News <no-reply@shop.com>", "Promo -50%")
    m_action = insert_mail(
        user_id, "g4", "inconnu@ext.com", "Facture à payer", "Merci de régler avant le 15"
    )
    m_neutre = insert_mail(user_id, "g5", "ami@ext.com", "Salut", "on se voit quand tu veux")

    mail_ids = [m_important, m_muet, m_newsletter, m_action, m_neutre]
    result = run_in_loop(lambda: run_mail_triage(user_id, mail_ids, "sync"))

    assert result["processed"] == 5
    assert result["skipped_prefilter"] == 3  # important, muet, newsletter
    assert result["llm_calls"] == 0  # aucune cle -> fallback exclusif
    assert result["important_count"] == 2  # important (85) + action (70)

    assert mail_row(m_important)["statut"] == "triaged"
    assert mail_row(m_important)["score"] == 85
    assert mail_row(m_muet)["score"] == 5
    assert mail_row(m_newsletter)["score"] == 15
    assert mail_row(m_action)["score"] == 70
    assert mail_row(m_action)["raison_score"] == "Score automatique (règles)"
    assert mail_row(m_neutre)["score"] == 40
    assert mail_row(m_neutre)["statut"] == "triaged"

    # Pas de résumé (aucune clé) : le mail s'affiche avec l'extrait brut.
    assert mail_row(m_action)["resume_ia"] is None

    # Notifications : contenu jamais nul, replié sur le sujet en fallback.
    assert count_notifications(user_id) == 2
    assert notification_contenu(user_id, m_important) == "Réunion demain"
    assert notification_contenu(user_id, m_action) == "Facture à payer"


def test_run_mail_triage_idempotent_zero_doublon(user_id):
    m1 = insert_mail(user_id, "gi1", "boss@corp.com", "Important")
    insert_sender_pref(user_id, "boss@corp.com", "important")

    first = run_in_loop(lambda: run_mail_triage(user_id, [m1], "sync"))
    assert first["processed"] == 1
    assert count_notifications(user_id) == 1

    # Re-run du meme lot : les mails ne sont plus pending_triage -> rien a faire.
    second = run_in_loop(lambda: run_mail_triage(user_id, [m1], "sync"))
    assert second["processed"] == 0
    assert count_notifications(user_id) == 1  # zero doublon


def test_run_mail_triage_plafond_max_llm(user_id, monkeypatch):
    monkeypatch.setattr(settings, "triage_max_llm_mails_per_run", 2)
    ids = [
        insert_mail(user_id, f"gp{i}", f"inconnu{i}@ext.com", f"Sujet {i}", "sans mot clé")
        for i in range(4)
    ]
    result = run_in_loop(lambda: run_mail_triage(user_id, ids, "manual"))
    assert result["processed"] == 2  # plafond atteint, 2 mails scores
    remaining_pending = sum(1 for m in ids if mail_row(m)["statut"] == "pending_triage")
    assert remaining_pending == 2  # les 2 autres restent pending_triage (deferred)


def test_run_mail_triage_notifications_plafonnees(user_id, monkeypatch):
    monkeypatch.setattr(settings, "triage_max_push_per_hour", 1)
    for i in range(3):
        insert_sender_pref(user_id, f"boss{i}@corp.com", "important")
    ids = [insert_mail(user_id, f"gn{i}", f"boss{i}@corp.com", f"Important {i}") for i in range(3)]

    result = run_in_loop(lambda: run_mail_triage(user_id, ids, "manual"))
    assert result["important_count"] == 3
    assert count_notifications(user_id) == 1  # plafond a 1/heure


def test_run_mail_triage_rls_ignore_mail_autre_utilisateur(user_id):
    other = create_user(f"mail-triage-other-{datetime.now().timestamp()}@test.local")
    try:
        m_other = insert_mail(other, "go1", "x@y.com", "Mail d'un autre utilisateur")
        result = run_in_loop(lambda: run_mail_triage(user_id, [m_other], "manual"))
        assert result == {
            "processed": 0, "important_count": 0, "skipped_prefilter": 0, "llm_calls": 0,
        }
        assert mail_row(m_other)["statut"] == "pending_triage"
    finally:
        delete_user(other)
