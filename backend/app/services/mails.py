"""Logique metier des mails : liste triee, detail, mise a jour, feedback.

Toutes les requetes passent par `scoped_connection(user_id)` (RLS). Le tri
(score desc puis date de reception desc) et le seuil d'importance viennent de
`settings.triage_importance_threshold` (source UNIQUE du seuil, correction #7
review Round 006 - jamais un litteral en dur).
"""

from __future__ import annotations

from app.config import settings
from app.db.client import scoped_connection

# Colonnes du contrat `mail` fige (plan Round 006), reutilisees par le cockpit
# (BACK-MAILS) pour la section `mails_importants`.
MAIL_SELECT_COLUMNS = (
    "id::text, expediteur, sujet, extrait, resume_ia, score, raison_score, "
    "statut, lu, repondu, date_reception, created_at, updated_at"
)


async def list_mails(user_id: str, filtre: str) -> dict:
    """Liste les mails de l'utilisateur, triee score desc puis date desc.

    `filtre='important'` : uniquement les mails tries au-dessus du seuil.
    `filtre='tous'` (defaut) : tous les mails, tries ou en attente de tri.
    Le compteur `ecartes` (mails tries sous le seuil) est toujours calcule,
    quel que soit le filtre applique.
    """
    seuil = settings.triage_importance_threshold
    async with scoped_connection(user_id) as conn:
        if filtre == "important":
            rows = await conn.fetch(
                f"SELECT {MAIL_SELECT_COLUMNS} FROM mails "
                "WHERE statut = 'triaged' AND score >= $1 "
                "ORDER BY score DESC NULLS LAST, date_reception DESC NULLS LAST",
                seuil,
            )
        else:
            rows = await conn.fetch(
                f"SELECT {MAIL_SELECT_COLUMNS} FROM mails "
                "ORDER BY score DESC NULLS LAST, date_reception DESC NULLS LAST"
            )
        ecartes = await conn.fetchval(
            "SELECT count(*) FROM mails WHERE statut = 'triaged' AND score < $1",
            seuil,
        )
    return {"mails": [dict(r) for r in rows], "ecartes": ecartes}


async def get_mail(user_id: str, mail_id: str) -> dict | None:
    """Recupere le detail d'un mail et le marque lu (idempotent)."""
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            f"UPDATE mails SET lu = true, updated_at = now() "
            f"WHERE id = $1::uuid RETURNING {MAIL_SELECT_COLUMNS}",
            mail_id,
        )
    return dict(row) if row else None


async def update_mail(
    user_id: str, mail_id: str, lu: bool | None, repondu: bool | None
) -> dict | None:
    """Met a jour partiellement `lu`/`repondu` (champs non fournis inchanges)."""
    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            f"UPDATE mails SET "
            "lu = COALESCE($2, lu), "
            "repondu = COALESCE($3, repondu), "
            "updated_at = now() "
            f"WHERE id = $1::uuid RETURNING {MAIL_SELECT_COLUMNS}",
            mail_id,
            lu,
            repondu,
        )
    return dict(row) if row else None


async def apply_feedback(user_id: str, mail_id: str, valeur: str) -> str | None:
    """Enregistre le feedback expediteur et reclasse ses mails deja tries.

    Upsert `sender_preferences` sur l'email normalise de l'expediteur du mail
    (`important` -> statut `important`, `pas_important` -> statut `muet`) PUIS
    ré-applique immediatement la bande de score aux mails deja `triaged` du
    meme expediteur (correction #4 review Round 006) : sinon le compteur
    `ecartes` et la liste des mails importants restent faux apres rechargement.
    """
    from app.services.mail_triage.normalize import email_expediteur

    nouveau_statut = "important" if valeur == "important" else "muet"
    if nouveau_statut == "muet":
        score, raison = 5, "Expéditeur en sourdine"
    else:
        score, raison = 85, "Expéditeur marqué important"

    async with scoped_connection(user_id) as conn:
        mail = await conn.fetchrow(
            "SELECT expediteur FROM mails WHERE id = $1::uuid", mail_id
        )
        if mail is None:
            return None

        email = email_expediteur(mail["expediteur"])

        await conn.execute(
            "INSERT INTO sender_preferences (user_id, email, statut) "
            "VALUES ($1, $2, $3) "
            "ON CONFLICT (user_id, email) DO UPDATE SET statut = $3, updated_at = now()",
            user_id,
            email,
            nouveau_statut,
        )

        candidats = await conn.fetch(
            "SELECT id::text AS id, expediteur FROM mails "
            "WHERE user_id = $1 AND statut = 'triaged'",
            user_id,
        )
        ids_a_reclasser = [
            row["id"]
            for row in candidats
            if email_expediteur(row["expediteur"]) == email
        ]
        if ids_a_reclasser:
            await conn.execute(
                "UPDATE mails SET score = $2, raison_score = $3, updated_at = now() "
                "WHERE id = ANY($1::uuid[])",
                ids_a_reclasser,
                score,
                raison,
            )

    return nouveau_statut
