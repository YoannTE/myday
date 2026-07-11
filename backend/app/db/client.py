"""Pool de connexions asyncpg partage entre les endpoints FastAPI.

Le pool applicatif se connecte avec le role NON-superuser `app_rls` : il ne
contourne PAS la Row Level Security. Toute requete sur une table de contenu
utilisateur DOIT passer par `scoped_connection(user_id)`, qui pose
`app.current_user_id` pour la duree de la transaction (les policies comparent
ce parametre au champ `user_id`, en texte - les ids Better-auth sont des cuid).
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import asyncpg

from app.config import settings

_pool: asyncpg.Pool | None = None
_admin_pool: asyncpg.Pool | None = None


async def create_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            settings.backend_database_url,
            min_size=1,
            max_size=10,
            command_timeout=60,
        )
    return _pool


async def create_admin_pool() -> asyncpg.Pool:
    """Deuxieme pool connecte avec le role `app_admin` (DATABASE_URL).

    JUSTIFICATION (usage restreint aux modules admin/me) : les tables de gestion
    de comptes (`user`, `session`, `invitations`) sont HORS RLS et le role
    applicatif `app_rls` n'a PAS les grants d'ecriture dessus. Les operations
    d'administration (creer/renouveler/revoquer une invitation, activer/desactiver
    un compte, supprimer son propre compte en cascade) exigent donc une connexion
    privilegiee. Ce pool ne doit JAMAIS servir aux tables de contenu utilisateur :
    celles-ci passent toujours par `scoped_connection` (RLS fail-closed).

    EXTENSION whitelistee (Round 010, journal d'usage admin) : ce pool peut
    AUSSI servir a LIRE des AGREGATS de METADONNEES d'usage cross-user sur
    `usage_events` et `llm_usage` (COUNT/SUM/GROUP BY sur `type`, `created_at`,
    `agent`, `cost_usd`, `prompt_tokens`, `completion_tokens`) : ces tables sont
    sous RLS (isolation par `user_id`) et l'admin a besoin d'une vue cross-user
    pour la baseline produit (jours actifs, cout IA). Cette lecture reste
    STRICTEMENT un COMPTAGE : la colonne `usage_events.metadata` (jsonb, peut
    contenir des bribes de contenu) ne doit JAMAIS etre lue via ce pool, ni
    aucune autre table de contenu utilisateur (`tasks`, `notes`, `mails`,
    `events`, `briefs`, `assistant_conversations`, ...). Toute nouvelle lecture
    cross-user via ce pool doit rester un agregat de compteurs/metadonnees de
    compte, jamais du contenu.
    """
    global _admin_pool
    if _admin_pool is None:
        _admin_pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=1,
            max_size=5,
            command_timeout=60,
        )
    return _admin_pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def close_admin_pool() -> None:
    global _admin_pool
    if _admin_pool is not None:
        await _admin_pool.close()
        _admin_pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("DB pool non initialise. Verifier le lifespan de main.py.")
    return _pool


def get_admin_pool() -> asyncpg.Pool:
    if _admin_pool is None:
        raise RuntimeError(
            "Admin pool non initialise. Verifier le lifespan de main.py."
        )
    return _admin_pool


@asynccontextmanager
async def scoped_connection(user_id: str) -> AsyncIterator[asyncpg.Connection]:
    """Ouvre une transaction et pose `app.current_user_id` (RLS).

    Usage :
        async with scoped_connection(user.id) as conn:
            rows = await conn.fetch("SELECT * FROM tasks")

    Le parametre est pose en LOCAL (3e argument `true` de set_config) : il est
    automatiquement remis a zero a la fin de la transaction, ce qui evite toute
    fuite d'identite entre deux emprunts successifs de la meme connexion du pool.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "SELECT set_config('app.current_user_id', $1, true)", user_id
            )
            yield conn
