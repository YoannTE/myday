"""Tests d'integration des endpoints Mails (Round 006).

Exigent Postgres migre (RLS active sur `mails`, `sender_preferences`). Les
tests de feedback dependent de `app.services.mail_triage.normalize`
(cree par l'agent BACK-TRIAGE) : s'ils echouent parce que ce module n'existe
pas encore, c'est un probleme de convergence entre agents, pas un bug de ce
fichier (cf. note de coordination du plan Round 006).
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import asyncpg
import pytest

from app.auth.cookie import COOKIE_NAME
from app.config import settings

from conftest import create_user, delete_user, make_session_for, sign_token


def _cookie(value: str) -> dict[str, str]:
    return {"Cookie": f"{COOKIE_NAME}={value}"}


@pytest.fixture
def auth_user(client):
    uid = create_user(f"mails-{uuid.uuid4().hex}@test.local")
    token = "mails-" + uuid.uuid4().hex
    make_session_for(uid, token, datetime.now(timezone.utc) + timedelta(days=1))
    yield uid, sign_token(token)
    delete_user(uid)


async def _admin(fn):
    conn = await asyncpg.connect(settings.database_url)
    try:
        return await fn(conn)
    finally:
        await conn.close()


def admin(fn):
    return asyncio.new_event_loop().run_until_complete(_admin(fn))


def insert_mail(
    user_id: str,
    expediteur: str,
    *,
    sujet: str = "Sujet test",
    extrait: str = "Extrait test",
    resume_ia: str | None = None,
    score: int | None = None,
    raison_score: str | None = None,
    statut: str = "pending_triage",
    lu: bool = False,
    repondu: bool = False,
    date_reception: datetime | None = None,
    gmail_id: str | None = None,
) -> str:
    async def _do(conn):
        return await conn.fetchval(
            "INSERT INTO mails (user_id, gmail_id, expediteur, sujet, extrait, "
            "resume_ia, score, raison_score, statut, lu, repondu, date_reception) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) "
            "RETURNING id::text",
            user_id,
            gmail_id or f"gmail-{uuid.uuid4().hex}",
            expediteur,
            sujet,
            extrait,
            resume_ia,
            score,
            raison_score,
            statut,
            lu,
            repondu,
            date_reception or datetime.now(timezone.utc),
        )

    return admin(_do)


def get_sender_pref_statut(user_id: str, email: str) -> str | None:
    async def _do(conn):
        return await conn.fetchval(
            "SELECT statut FROM sender_preferences WHERE user_id = $1 AND email = $2",
            user_id,
            email,
        )

    return admin(_do)


def get_mail_score(mail_id: str) -> tuple[int | None, str | None]:
    async def _do(conn):
        row = await conn.fetchrow(
            "SELECT score, raison_score FROM mails WHERE id = $1::uuid", mail_id
        )
        return (row["score"], row["raison_score"]) if row else (None, None)

    return admin(_do)


# --- 401 sans cookie ---


def test_list_mails_401_sans_cookie(client):
    resp = client.get("/api/mails")
    assert resp.status_code == 401


def test_get_mail_401_sans_cookie(client):
    resp = client.get(f"/api/mails/{uuid.uuid4()}")
    assert resp.status_code == 401


def test_feedback_401_sans_cookie(client):
    resp = client.post(
        f"/api/mails/{uuid.uuid4()}/feedback", json={"valeur": "important"}
    )
    assert resp.status_code == 401


# --- Liste filtree + ecartes ---


def test_list_mails_filter_important_et_ecartes(client, auth_user):
    uid, cookie = auth_user
    seuil = settings.triage_importance_threshold

    important_id = insert_mail(
        uid, "Boss <boss@ex.com>", statut="triaged", score=seuil + 10
    )
    ecarte_id = insert_mail(
        uid, "Newsletter <news@ex.com>", statut="triaged", score=max(seuil - 20, 0)
    )
    pending_id = insert_mail(uid, "Inconnu <x@ex.com>", statut="pending_triage")

    resp = client.get("/api/mails?filter=important", headers=_cookie(cookie))
    assert resp.status_code == 200
    data = resp.json()["data"]
    ids = [m["id"] for m in data["mails"]]
    assert important_id in ids
    assert ecarte_id not in ids
    assert pending_id not in ids
    assert data["ecartes"] == 1

    resp_tous = client.get("/api/mails?filter=tous", headers=_cookie(cookie))
    ids_tous = [m["id"] for m in resp_tous.json()["data"]["mails"]]
    assert set(ids_tous) == {important_id, ecarte_id, pending_id}


def test_list_mails_tri_score_puis_date(client, auth_user):
    uid, cookie = auth_user
    now = datetime.now(timezone.utc)
    seuil = settings.triage_importance_threshold

    plus_recent = insert_mail(
        uid, "A <a@ex.com>", statut="triaged", score=seuil, date_reception=now
    )
    plus_ancien_meme_score = insert_mail(
        uid,
        "B <b@ex.com>",
        statut="triaged",
        score=seuil,
        date_reception=now - timedelta(hours=1),
    )
    score_plus_haut = insert_mail(
        uid, "C <c@ex.com>", statut="triaged", score=seuil + 30, date_reception=now
    )

    resp = client.get("/api/mails?filter=tous", headers=_cookie(cookie))
    ids = [m["id"] for m in resp.json()["data"]["mails"]]
    assert ids.index(score_plus_haut) < ids.index(plus_recent)
    assert ids.index(plus_recent) < ids.index(plus_ancien_meme_score)


# --- Detail marque lu ---


def test_get_mail_marque_lu(client, auth_user):
    uid, cookie = auth_user
    mail_id = insert_mail(uid, "Quelqu'un <q@ex.com>", lu=False)

    resp = client.get(f"/api/mails/{mail_id}", headers=_cookie(cookie))
    assert resp.status_code == 200
    assert resp.json()["data"]["lu"] is True


def test_get_mail_inconnu_404(client, auth_user):
    _, cookie = auth_user
    resp = client.get(f"/api/mails/{uuid.uuid4()}", headers=_cookie(cookie))
    assert resp.status_code == 404


# --- PATCH ---


def test_patch_mail_repondu(client, auth_user):
    uid, cookie = auth_user
    mail_id = insert_mail(uid, "Quelqu'un <q2@ex.com>")

    resp = client.patch(
        f"/api/mails/{mail_id}", json={"repondu": True}, headers=_cookie(cookie)
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["repondu"] is True


# --- Feedback ---


def test_feedback_pas_important_upsert_et_reclassement(client, auth_user):
    uid, cookie = auth_user
    email = "spam@ex.com"
    mail_id = insert_mail(
        uid,
        f"Spam <{email}>",
        statut="triaged",
        score=90,
        raison_score="Ancien score",
    )
    autre_mail_meme_expediteur = insert_mail(
        uid, f"Spam <{email}>", statut="triaged", score=80
    )
    autre_expediteur = insert_mail(
        uid, "Autre <autre@ex.com>", statut="triaged", score=70
    )

    resp = client.post(
        f"/api/mails/{mail_id}/feedback",
        json={"valeur": "pas_important"},
        headers=_cookie(cookie),
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["statut"] == "muet"

    assert get_sender_pref_statut(uid, email) == "muet"
    score, raison = get_mail_score(mail_id)
    assert score == 5
    assert raison == "Expéditeur en sourdine"
    score2, _ = get_mail_score(autre_mail_meme_expediteur)
    assert score2 == 5
    score3, _ = get_mail_score(autre_expediteur)
    assert score3 == 70  # inchange, expediteur different


def test_feedback_important_upsert(client, auth_user):
    uid, cookie = auth_user
    email = "vip@ex.com"
    mail_id = insert_mail(uid, f"VIP <{email}>", statut="triaged", score=10)

    resp = client.post(
        f"/api/mails/{mail_id}/feedback",
        json={"valeur": "important"},
        headers=_cookie(cookie),
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["statut"] == "important"
    assert get_sender_pref_statut(uid, email) == "important"
    score, raison = get_mail_score(mail_id)
    assert score == 85
    assert raison == "Expéditeur marqué important"


def test_feedback_upsert_pas_de_doublon_sender_preferences(client, auth_user):
    uid, cookie = auth_user
    email = "repeat@ex.com"
    mail1 = insert_mail(uid, f"Repeat <{email}>", statut="triaged", score=50)
    mail2 = insert_mail(uid, f"Repeat <{email}>", statut="triaged", score=50)

    client.post(
        f"/api/mails/{mail1}/feedback",
        json={"valeur": "important"},
        headers=_cookie(cookie),
    )
    resp = client.post(
        f"/api/mails/{mail2}/feedback",
        json={"valeur": "pas_important"},
        headers=_cookie(cookie),
    )
    assert resp.status_code == 200
    # Un seul enregistrement sender_preferences (unicite user_id+email), mis a
    # jour et non duplique.
    assert get_sender_pref_statut(uid, email) == "muet"


# --- RLS cross-utilisateur ---


def test_list_mails_rls_isolation(client, auth_user):
    _, cookie = auth_user
    other_uid = create_user(f"mails-other-{uuid.uuid4().hex}@test.local")
    try:
        insert_mail(other_uid, "Autre user <ou@ex.com>", statut="triaged", score=90)
        resp = client.get("/api/mails?filter=tous", headers=_cookie(cookie))
        assert resp.json()["data"]["mails"] == []
    finally:
        delete_user(other_uid)


def test_get_mail_cross_user_404(client, auth_user):
    _, cookie = auth_user
    other_uid = create_user(f"mails-other2-{uuid.uuid4().hex}@test.local")
    try:
        other_mail_id = insert_mail(other_uid, "Autre <ou2@ex.com>")
        resp = client.get(f"/api/mails/{other_mail_id}", headers=_cookie(cookie))
        assert resp.status_code == 404
    finally:
        delete_user(other_uid)


def test_feedback_cross_user_404(client, auth_user):
    _, cookie = auth_user
    other_uid = create_user(f"mails-other3-{uuid.uuid4().hex}@test.local")
    try:
        other_mail_id = insert_mail(
            other_uid, "Autre <ou3@ex.com>", statut="triaged"
        )
        resp = client.post(
            f"/api/mails/{other_mail_id}/feedback",
            json={"valeur": "important"},
            headers=_cookie(cookie),
        )
        assert resp.status_code == 404
    finally:
        delete_user(other_uid)


# --- Cockpit : mails_importants reel vs placeholder ---


def test_cockpit_mails_importants_placeholder_si_aucun_trie(client, auth_user):
    _, cookie = auth_user
    resp = client.get("/api/cockpit", headers=_cookie(cookie))
    assert resp.status_code == 200
    assert resp.json()["data"]["mails_importants"] == {"placeholder": True}


def test_cockpit_mails_importants_reel(client, auth_user):
    uid, cookie = auth_user
    seuil = settings.triage_importance_threshold
    important_id = insert_mail(
        uid, "Chef <chef@ex.com>", statut="triaged", score=seuil + 5
    )
    insert_mail(
        uid, "Bas score <bas@ex.com>", statut="triaged", score=max(seuil - 30, 0)
    )

    resp = client.get("/api/cockpit", headers=_cookie(cookie))
    assert resp.status_code == 200
    mails_importants = resp.json()["data"]["mails_importants"]
    assert mails_importants["placeholder"] is False
    ids = [m["id"] for m in mails_importants["mails"]]
    assert important_id in ids
