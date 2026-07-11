"""Outil assistant : rédaction d'un brouillon de mail (jamais envoyé ici).

Contrat d'import figé (plan Round 008, coordination BACK-CONV) :
`draft_email(user_id, params, ref_data, action_key)` est importé directement
par `app.services.assistant.orchestrator`. `params` arrive déjà validé par
`action_params.DraftParams` (BACK-CONV) : clés `to`, `subject`, `instruction`,
`reply_to_ref`. `ref_data.get("mail")` (si présent, posé par
`assistant.context.load_context`) a la forme `{"id", "expediteur", "sujet",
"extrait"}`.

Le brouillon est TOUJOURS créé en statut `pending_review` : aucun envoi ne
peut avoir lieu depuis cette fonction (règle métier absolue - seul
`POST /api/assistant/drafts/{id}/decision` avec `decision=approve` envoie un
mail, cf. `app.services.assistant_drafts`).
"""

from __future__ import annotations

import logging
from email.utils import parseaddr

from pydantic import BaseModel, ValidationError

from app.config import settings
from app.db.client import scoped_connection
from app.services.mail_triage.llm import complete_json
from app.utils.errors import bad_request

logger = logging.getLogger("myday.assistant.draft")

_SYSTEM_PROMPT = """Tu rédiges des mails pour l'utilisateur de MyDay, en son nom. Tu écris en français naturel et correctement accentué.

Règles :
- "subject" : objet court et clair ; en mode réponse, reprends l'objet d'origine préfixé « Re: » (sans doubler le préfixe).
- "body" : le message. Ton naturel et poli, ni ampoulé ni familier. Va droit au but en 2 à 8 phrases.
- Respecte fidèlement l'instruction de l'utilisateur - n'ajoute aucun engagement qu'il n'a pas exprimé.
- Le destinataire n'est pas de ta responsabilité : ne mentionne aucune adresse mail dans ta réponse.

Réponds UNIQUEMENT avec le JSON {"subject": "...", "body": "..."}."""


class DraftParams(BaseModel):
    to: str | None = None
    subject: str | None = None
    instruction: str
    reply_to_ref: bool = False


class _DraftLlmOutput(BaseModel):
    subject: str
    body: str


def _domain_of(email: str) -> str:
    return email.split("@")[-1] if "@" in email else email


def _fallback_content(params: DraftParams) -> dict:
    """Brouillon minimal si le LLM échoue - jamais de crash (SOP fallback)."""
    return {"subject": params.subject or "Sans objet", "body": params.instruction}


def _build_user_prompt(params: DraftParams, mail_ref: dict | None) -> str:
    lines = [f"Instruction de l'utilisateur : {params.instruction}"]
    if params.reply_to_ref and mail_ref:
        lines.append(
            "Mail d'origine - De : {expediteur} ; Objet : {sujet} ; Extrait : {extrait}".format(
                expediteur=mail_ref.get("expediteur", ""),
                sujet=mail_ref.get("sujet", ""),
                extrait=(mail_ref.get("extrait") or "")[:1500],
            )
        )
    return "\n".join(lines)


async def draft_email(user_id: str, params: dict, ref_data: dict, action_key: str) -> dict:
    try:
        validated = DraftParams.model_validate(params)
    except ValidationError as exc:
        raise bad_request("Paramètres de brouillon invalides.") from exc

    mail_ref = (ref_data or {}).get("mail")

    # Garde-fou destinataire (correction #9 review Round 008) : JAMAIS le "to"
    # inventé par le LLM - destinataire de confiance = expéditeur du mail de
    # référence (mode réponse) ou `to` déjà validé par le planificateur.
    if validated.reply_to_ref and mail_ref:
        _, destinataire = parseaddr(mail_ref.get("expediteur") or "")
    else:
        destinataire = validated.to or ""
    if not destinataire:
        raise bad_request("Destinataire du brouillon introuvable.")

    llm_model = getattr(settings, "assistant_llm_model", "claude-sonnet-4-5")
    try:
        raw = await complete_json(
            user_id=user_id,
            agent="assistant_draft",
            model=llm_model,
            system=_SYSTEM_PROMPT,
            user_prompt=_build_user_prompt(validated, mail_ref),
        )
        parsed = _DraftLlmOutput(**raw)
        content = {"subject": parsed.subject, "body": parsed.body}
    except Exception as exc:  # filet systématique (SOP) - jamais de crash
        logger.info("assistant draft_email fallback action_key=%s raison=%s", action_key, type(exc).__name__)
        content = _fallback_content(validated)

    mail_origine_id = mail_ref.get("id") if (validated.reply_to_ref and mail_ref) else None

    async with scoped_connection(user_id) as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO mail_drafts (user_id, destinataire, objet, corps, mail_origine_id)
            VALUES ($1, $2, $3, $4, $5::uuid)
            RETURNING id::text, destinataire, objet, corps
            """,
            user_id, destinataire, content["subject"], content["body"], mail_origine_id,
        )

    return {
        "type": "draft_email",
        "ok": True,
        "draft_id": row["id"],
        "to": row["destinataire"],
        "subject": row["objet"],
        "body": row["corps"],
        "label": f"Brouillon préparé pour {_domain_of(destinataire)}",
    }
