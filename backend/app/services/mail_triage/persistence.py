"""Accès BDD du tri des mails : chargement, persist par ligne (idempotent),
notifications. Toujours via `scoped_connection` (RLS) - jamais le pool admin.
"""

from __future__ import annotations

from app.config import settings
from app.db.client import scoped_connection
from app.services.push.sender import dispatch_push


async def load_mails(user_id: str, mail_ids: list[str]) -> tuple[list[dict], dict]:
    """Charge les mails `pending_triage` parmi `mail_ids` appartenant à
    `user_id` (RLS filtre naturellement les ids d'un autre utilisateur), plus
    les préférences expéditeur du même utilisateur. Ordre déterministe
    (`created_at`) pour un plafonnement `max_llm_mails_per_run` stable."""
    async with scoped_connection(user_id) as conn:
        mail_rows = await conn.fetch(
            """
            SELECT id::text AS mail_id, expediteur, sujet, extrait
            FROM mails
            WHERE user_id = $1 AND id = ANY($2::uuid[]) AND statut = 'pending_triage'
            ORDER BY created_at ASC
            """,
            user_id, mail_ids,
        )
        pref_rows = await conn.fetch(
            "SELECT email, statut FROM sender_preferences WHERE user_id = $1", user_id
        )
    mails = [dict(r) for r in mail_rows]
    sender_prefs = {r["email"]: r["statut"] for r in pref_rows}
    return mails, sender_prefs


def attach_content(items: list[dict], mails_by_id: dict[str, dict]) -> list[dict]:
    """Rattache sujet/extrait/expéditeur (source des résumés) à des items
    déjà scorés (qui ne portent que mail_id/score/reason/source)."""
    return [
        {**item, **mails_by_id[item["mail_id"]]}
        for item in items
        if item["mail_id"] in mails_by_id
    ]


async def persist_triage(
    user_id: str, all_scored: list[dict], summaries: dict[str, str]
) -> int:
    """UPDATE par ligne en un seul round-trip (correction #6 review Round 006) :
    `FROM (VALUES ...) AS v(id, score, reason, summary)`. Les mails `deferred`
    (plafond LLM atteint) ne sont pas dans `all_scored` et restent inchangés
    (`pending_triage`)."""
    if not all_scored:
        return 0
    rows_sql = []
    params: list = [user_id]
    idx = 2
    for item in all_scored:
        rows_sql.append(
            f"(${idx}::uuid, ${idx + 1}::int, ${idx + 2}::text, ${idx + 3}::text)"
        )
        params.extend(
            [item["mail_id"], item["score"], item["reason"], summaries.get(item["mail_id"])]
        )
        idx += 4
    query = f"""
        UPDATE mails
        SET score = v.score, raison_score = v.reason, resume_ia = v.summary,
            statut = 'triaged', updated_at = now()
        FROM (VALUES {", ".join(rows_sql)}) AS v(id, score, reason, summary)
        WHERE mails.id = v.id AND mails.user_id = $1
        RETURNING mails.id
    """
    async with scoped_connection(user_id) as conn:
        rows = await conn.fetch(query, *params)
    return len(rows)


async def queue_notifications(
    user_id: str,
    important: list[dict],
    summaries: dict[str, str],
    mails_by_id: dict[str, dict],
) -> int:
    """Crée les notifications `mail_important` pour les mails importants,
    plafonnées à `triage_max_push_per_hour` (fenêtre glissante 1h). Contenu
    TOUJOURS non-null (correction #3 review Round 006) : résumé IA sinon
    sujet sinon libellé générique.

    Push (Round 009, correction #3 du plan) : le pont est PUSH-ONLY - la
    logique d'INSERT/plafond ci-dessus n'est PAS dupliquée. Chaque
    notification effectivement créée déclenche, APRÈS la fermeture de la
    connexion BDD (transaction commitée), un `dispatch_push` best-effort."""
    if not important or not settings.triage_notify_important:
        return 0
    created = 0
    to_push: list[dict] = []
    async with scoped_connection(user_id) as conn:
        # Respecte la préférence utilisateur (Round 005) : si l'utilisateur a
        # désactivé « notifications mails importants », ne créer aucune row.
        # Défaut true si aucune ligne de préférences (create-or-default paresseux).
        notif_active = await conn.fetchval(
            "SELECT notif_important_mail FROM user_preferences WHERE user_id = $1",
            user_id,
        )
        if notif_active is False:
            return 0
        already_sent = await conn.fetchval(
            """
            SELECT count(*) FROM notifications
            WHERE user_id = $1 AND type = 'mail_important'
              AND date_envoi > now() - interval '1 hour'
            """,
            user_id,
        )
        budget = max(settings.triage_max_push_per_hour - already_sent, 0)
        for item in important:
            if created >= budget:
                break
            mail = mails_by_id.get(item["mail_id"])
            if mail is None:
                continue
            contenu = (
                summaries.get(item["mail_id"]) or mail.get("sujet") or "Nouveau mail important"
            )
            result = await conn.execute(
                """
                INSERT INTO notifications (user_id, type, contenu, ref_id)
                VALUES ($1, 'mail_important', $2, $3::uuid)
                ON CONFLICT (user_id, ref_id, type) DO NOTHING
                """,
                user_id, contenu, item["mail_id"],
            )
            if result.endswith(" 1"):
                created += 1
                to_push.append({"contenu": contenu})

    for item in to_push:
        try:
            await dispatch_push(
                user_id, "mail_important", "MyDay", item["contenu"], "/mails"
            )
        except Exception:  # best-effort : ne jamais casser le tri des mails
            pass
    return created
