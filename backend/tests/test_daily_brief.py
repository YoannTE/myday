"""Tests du brief IA quotidien (Round 007) : brief dégradé nominal (chemin
nominal — aucune clé `ANTHROPIC_API_KEY`), journée calme, upsert idempotent
des runs planifiés, notifications (respect de `notif_brief_ready`, jamais
pour `manual`), alerte de synchronisation en retard, anti-spam manuel (429),
RLS cross-utilisateur, journal d'usage `brief_generated`.

Les tests d'orchestrateur tournent contre Postgres réel (comme
`test_mail_triage.py`) : chaque appel s'exécute dans un event loop dédié avec
son propre pool asyncpg `app_rls`. Aucun appel LLM réel (clé absente = brief
dégradé, chemin nominal de ce round).
"""

from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import asyncpg
import pytest

import app.db.client as dbclient
from app.auth.cookie import COOKIE_NAME
from app.config import settings
from app.db.client import scoped_connection
from app.services.daily_brief.orchestrator import run_daily_brief

from conftest import create_user, delete_user, make_session_for, sign_token

_TZ = ZoneInfo(settings.app_timezone)


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


def today_str() -> str:
    return datetime.now(_TZ).date().isoformat()


def insert_event(user_id, titre, debut, fin) -> str:
    return admin_val(
        "INSERT INTO events (user_id, titre, debut, fin) VALUES ($1, $2, $3, $4) "
        "RETURNING id::text",
        user_id, titre, debut, fin,
    )


def insert_task(user_id, titre, echeance, priorite="haute") -> str:
    return admin_val(
        "INSERT INTO tasks (user_id, titre, statut, priorite, echeance) "
        "VALUES ($1, $2, 'a_faire', $3, $4) RETURNING id::text",
        user_id, titre, priorite, echeance,
    )


def insert_triaged_mail(user_id, gmail_id, expediteur, sujet, score, date_reception) -> str:
    return admin_val(
        "INSERT INTO mails (user_id, gmail_id, expediteur, sujet, extrait, statut, "
        "score, repondu, date_reception) "
        "VALUES ($1, $2, $3, $4, 'Extrait', 'triaged', $5, false, $6) RETURNING id::text",
        user_id, gmail_id, expediteur, sujet, score, date_reception,
    )


def upsert_google_sync(user_id, calendar_synced_at, gmail_synced_at) -> None:
    admin_exec(
        "INSERT INTO google_connections (user_id, calendar_synced_at, gmail_synced_at) "
        "VALUES ($1, $2, $3) "
        "ON CONFLICT (user_id) DO UPDATE SET calendar_synced_at = $2, gmail_synced_at = $3",
        user_id, calendar_synced_at, gmail_synced_at,
    )


def insert_preferences(user_id, **fields) -> None:
    columns = ", ".join(fields.keys())
    placeholders = ", ".join(f"${i + 2}" for i in range(len(fields)))
    admin_exec(
        f"INSERT INTO user_preferences (user_id, {columns}) VALUES ($1, {placeholders})",
        user_id, *fields.values(),
    )


def get_brief_contenu(brief_id) -> dict:
    raw = admin_val("SELECT contenu FROM briefs WHERE id = $1::uuid", brief_id)
    return json.loads(raw)


def count_briefs(user_id, type_) -> int:
    return admin_val(
        "SELECT count(*) FROM briefs WHERE user_id = $1 AND type = $2", user_id, type_
    )


def count_brief_notifications(user_id) -> int:
    return admin_val(
        "SELECT count(*) FROM notifications WHERE user_id = $1 AND type = 'brief_pret'",
        user_id,
    )


def count_usage_events(user_id, type_) -> int:
    return admin_val(
        "SELECT count(*) FROM usage_events WHERE user_id = $1 AND type = $2",
        user_id, type_,
    )


@pytest.fixture
def user_id():
    uid = create_user(f"daily-brief-{uuid.uuid4().hex}@test.local")
    yield uid
    delete_user(uid)


# --- Brief dégradé nominal (chemin nominal ce round : aucune clé LLM) -------


def test_brief_degrade_nominal_contexte_riche(user_id):
    now = datetime.now(_TZ)
    insert_event(user_id, "Réunion équipe", now + timedelta(hours=1), now + timedelta(hours=2))
    insert_task(user_id, "Payer la facture", now + timedelta(hours=3))
    insert_triaged_mail(
        user_id, "g1", "boss@corp.com", "Contrat à signer", 80, now - timedelta(hours=1)
    )

    result = run_in_loop(lambda: run_daily_brief(user_id, "manual", today_str()))

    assert result["generated"] is True
    assert result["degraded"] is True  # aucune clé Anthropic -> dégradé
    contenu = get_brief_contenu(result["brief_id"])
    assert contenu["headline"]
    assert 1 <= len(contenu["priorities"]) <= 3
    assert any("Payer la facture" in p for p in contenu["priorities"])
    assert contenu["schedule_summary"]
    assert contenu["tasks_summary"]
    assert contenu["mails_summary"]


def test_brief_journee_calme_zero_donnee(user_id):
    result = run_in_loop(lambda: run_daily_brief(user_id, "manual", today_str()))

    assert result["degraded"] is True
    contenu = get_brief_contenu(result["brief_id"])
    assert "calme" in contenu["headline"].lower()
    assert len(contenu["priorities"]) == 1
    assert contenu["schedule_summary"] == "Aucun rendez-vous aujourd'hui."
    assert contenu["tasks_summary"] == "Rien d'urgent aujourd'hui."
    assert contenu["mails_summary"] == "Aucun mail important n'attend de réponse."


# --- Ordre des blocs et blocs vides (Round 014, F5) --------------------------


def test_brief_ordre_des_blocs_source_unique():
    """`BriefContentModel` (chemin IA) et `build_degraded_brief` (chemin
    dégradé) doivent produire les 3 blocs dans le MÊME ordre - rendez-vous,
    tâches, mails - défini une seule fois par `degraded.BRIEF_BLOCK_ORDER`."""
    from app.services.daily_brief.compose import BriefContentModel
    from app.services.daily_brief.degraded import BRIEF_BLOCK_ORDER, build_degraded_brief

    champs_modele = tuple(
        c for c in BriefContentModel.model_fields if c in BRIEF_BLOCK_ORDER
    )
    assert champs_modele == BRIEF_BLOCK_ORDER

    contexte_vide = {"events": [], "tasks_today": [], "important_mails": []}
    contenu = build_degraded_brief(contexte_vide, [], 3)
    ordre_effectif = tuple(c for c in contenu if c in BRIEF_BLOCK_ORDER)
    assert ordre_effectif == BRIEF_BLOCK_ORDER


def test_brief_ordre_des_blocs_contexte_riche(user_id):
    """Contexte riche (évènement + tâche du jour + mail) : les 3 blocs sont
    tous renseignés (aucun bloc fantôme). L'ordre réel (a -> b -> c) est
    garanti au niveau Python par `test_brief_ordre_des_blocs_source_unique` -
    la persistance jsonb de Postgres ne préserve pas l'ordre des clés, donc
    ce test-ci ne vérifie que le contenu, pas l'ordre des clés en BDD."""
    now = datetime.now(_TZ)
    insert_event(user_id, "Point équipe", now + timedelta(hours=1), now + timedelta(hours=2))
    insert_task(user_id, "Relire le devis", now + timedelta(hours=4))
    insert_triaged_mail(
        user_id, "g-ordre", "client@corp.com", "Devis à valider", 75, now - timedelta(hours=2)
    )

    result = run_in_loop(lambda: run_daily_brief(user_id, "manual", today_str()))
    contenu = get_brief_contenu(result["brief_id"])

    assert contenu["schedule_summary"] != "Aucun rendez-vous aujourd'hui."
    assert contenu["tasks_summary"] != "Rien d'urgent aujourd'hui."
    assert contenu["mails_summary"] != "Aucun mail important n'attend de réponse."


def test_brief_bloc_rdv_vide_mais_taches_et_mails_presents(user_id):
    """Aucun rendez-vous aujourd'hui mais des tâches/mails : le bloc RDV
    affiche le message vide explicite, les autres blocs restent renseignés."""
    now = datetime.now(_TZ)
    insert_task(user_id, "Relancer le fournisseur", now + timedelta(hours=2))
    insert_triaged_mail(
        user_id, "g-vide-rdv", "fournisseur@corp.com", "Relance", 70, now - timedelta(hours=1)
    )

    result = run_in_loop(lambda: run_daily_brief(user_id, "manual", today_str()))
    contenu = get_brief_contenu(result["brief_id"])

    assert contenu["schedule_summary"] == "Aucun rendez-vous aujourd'hui."
    assert contenu["tasks_summary"] != "Rien d'urgent aujourd'hui."
    assert contenu["mails_summary"] != "Aucun mail important n'attend de réponse."


def test_brief_tache_en_retard_non_incluse_dans_les_taches_du_jour(user_id):
    """Une tâche en retard depuis plusieurs jours n'apparaît plus dans le
    bloc "tâches du jour" (bornes strictement Europe/Paris du jour même,
    Round 014 F5) - seule une échéance d'aujourd'hui compte."""
    now = datetime.now(_TZ)
    insert_task(user_id, "Tâche très en retard", now - timedelta(days=3))

    result = run_in_loop(lambda: run_daily_brief(user_id, "manual", today_str()))
    contenu = get_brief_contenu(result["brief_id"])

    assert contenu["tasks_summary"] == "Rien d'urgent aujourd'hui."
    assert not any("Tâche très en retard" in p for p in contenu["priorities"])


def test_brief_mails_top_3_parmi_plus_de_trois(user_id):
    """Seuls les 3 mails les plus importants (score décroissant) reçus dans
    les 5 derniers jours composent le bloc mails (Round 014 F5) - même si
    davantage de mails importants existent."""
    now = datetime.now(_TZ)
    for i, score in enumerate([90, 65, 60, 95, 80]):  # 5 mails >= seuil (60)
        insert_triaged_mail(
            user_id, f"g-top3-{i}", f"expediteur{i}@corp.com", f"Sujet {i}",
            score, now - timedelta(hours=i + 1),
        )

    result = run_in_loop(lambda: run_daily_brief(user_id, "manual", today_str()))
    contenu = get_brief_contenu(result["brief_id"])

    assert contenu["mails_summary"] == "3 mail(s) important(s) attend(ent) une réponse."


def test_brief_mails_ignore_ceux_recus_il_y_a_plus_de_cinq_jours(user_id):
    now = datetime.now(_TZ)
    insert_triaged_mail(
        user_id, "g-trop-vieux", "vieux@corp.com", "Trop ancien", 90,
        now - timedelta(days=6),
    )

    result = run_in_loop(lambda: run_daily_brief(user_id, "manual", today_str()))
    contenu = get_brief_contenu(result["brief_id"])

    assert contenu["mails_summary"] == "Aucun mail important n'attend de réponse."


# --- Upsert idempotent des runs planifiés -----------------------------------


def test_upsert_scheduled_meme_jour_une_seule_row(user_id):
    brief_date = today_str()
    first = run_in_loop(lambda: run_daily_brief(user_id, "scheduled", brief_date))
    second = run_in_loop(lambda: run_daily_brief(user_id, "scheduled", brief_date))

    assert count_briefs(user_id, "quotidien") == 1
    assert first["brief_id"] == second["brief_id"]


def test_manual_insere_une_nouvelle_row_a_chaque_fois(user_id):
    brief_date = today_str()
    run_in_loop(lambda: run_daily_brief(user_id, "manual", brief_date))
    run_in_loop(lambda: run_daily_brief(user_id, "manual", brief_date))

    assert count_briefs(user_id, "a_la_demande") == 2


# --- Notifications -----------------------------------------------------------


def test_manual_ne_notifie_jamais(user_id):
    run_in_loop(lambda: run_daily_brief(user_id, "manual", today_str()))
    assert count_brief_notifications(user_id) == 0


def test_scheduled_notifie_par_defaut(user_id):
    run_in_loop(lambda: run_daily_brief(user_id, "scheduled", today_str()))
    assert count_brief_notifications(user_id) == 1


def test_scheduled_respecte_notif_brief_ready_desactive(user_id):
    insert_preferences(user_id, notif_brief_ready=False)
    run_in_loop(lambda: run_daily_brief(user_id, "scheduled", today_str()))
    assert count_brief_notifications(user_id) == 0


# --- Alerte de synchronisation en retard ------------------------------------


def test_alerte_sync_en_retard(user_id):
    stale = datetime.now(timezone.utc) - timedelta(hours=5)
    upsert_google_sync(user_id, stale, stale)

    result = run_in_loop(lambda: run_daily_brief(user_id, "manual", today_str()))
    contenu = get_brief_contenu(result["brief_id"])

    assert any("actualisées" in alert for alert in contenu["alerts"])


# --- Journal d'usage ---------------------------------------------------------


def test_usage_event_brief_generated(user_id):
    run_in_loop(lambda: run_daily_brief(user_id, "manual", today_str()))
    assert count_usage_events(user_id, "brief_generated") == 1


# --- RLS cross-utilisateur ----------------------------------------------------


def test_rls_isolation_cross_user(user_id):
    other = create_user(f"daily-brief-other-{uuid.uuid4().hex}@test.local")
    try:
        run_in_loop(lambda: run_daily_brief(user_id, "manual", today_str()))

        async def _count_as_other() -> int:
            async with scoped_connection(other) as conn:
                return await conn.fetchval("SELECT count(*) FROM briefs")

        count = run_in_loop(_count_as_other)
        assert count == 0
    finally:
        delete_user(other)


# --- Anti-spam manuel (429) via l'API ----------------------------------------


def _cookie(value: str) -> dict[str, str]:
    return {"Cookie": f"{COOKIE_NAME}={value}"}


@pytest.fixture
def auth_user(client):
    uid = create_user(f"brief-api-{uuid.uuid4().hex}@test.local")
    token = "brief-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, _cookie(sign_token(token))
    delete_user(uid)


def test_generate_brief_sans_cookie_401(client):
    resp = client.post("/api/brief/generate")
    assert resp.status_code == 401


def test_generate_brief_anti_spam_429(client, auth_user):
    _, headers = auth_user
    first = client.post("/api/brief/generate", headers=headers)
    assert first.status_code == 200
    assert first.json()["data"]["degraded"] is True

    second = client.post("/api/brief/generate", headers=headers)
    assert second.status_code == 429


def test_dedupe_priorities_supprime_doublons_et_complete():
    """Round 014 (correctif) : le garde-fou peut réinjecter fallback[-1]
    plusieurs fois et le LLM répéter la même priorité — on déduplique
    (casefold + strip) puis on complète par des priorités distinctes."""
    from app.services.daily_brief.compose import _dedupe_priorities

    result = _dedupe_priorities(
        ["Répondre à PayPal", "répondre à paypal ", "Répondre à PayPal"],
        ["Répondre à PayPal", "Préparer la réunion", "Confirmer le padel"],
        3,
    )
    assert result == [
        "Répondre à PayPal",
        "Préparer la réunion",
        "Confirmer le padel",
    ]
    assert len(result) == len({p.strip().casefold() for p in result})
