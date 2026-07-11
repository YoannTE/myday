from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Cherche .env.local d'abord a la racine (../) puis dans backend/
    # Permet d'avoir un SEUL fichier .env.local partage avec Next.js
    model_config = SettingsConfigDict(
        env_file=("../.env.local", ".env.local"),
        extra="ignore",
    )

    # Connexion Postgres DIRECTE (jamais PgBouncer - contrainte DBOS future).
    # DATABASE_URL : role app_admin (superuser), reserve aux migrations DDL.
    database_url: str = "postgres://app_admin:app_password_dev@localhost:5433/app_main"

    # BACKEND_DATABASE_URL : role app_rls (NON-superuser) utilise par le pool
    # applicatif. Ce role NE contourne PAS la RLS : chaque transaction doit
    # poser `app.current_user_id` via scoped_connection(user_id) pour voir ses
    # lignes. Sans ce parametre, les tables de contenu renvoient 0 ligne.
    backend_database_url: str = (
        "postgres://app_rls:app_rls_password_dev@localhost:5433/app_main"
    )

    # Better-auth : secret partage avec Next.js pour verifier la signature HMAC
    # du cookie de session (better-auth.session_token).
    better_auth_secret: str = ""

    # Cle de chiffrement des jetons Google OAuth (AES-256-GCM enveloppe).
    # 32 octets encodes en base64, hors BDD (decision revue). Vide par defaut :
    # la validation fail-fast est faite par app.security.token_cipher au chargement.
    token_encryption_key: str = ""

    # Identifiants OAuth Google (application enregistree console.cloud.google.com).
    # L'echange de code et le rafraichissement des jetons se font cote FastAPI :
    # le client_secret ne quitte jamais le backend.
    google_client_id: str = ""
    google_client_secret: str = ""
    # redirect_uri autorise cote Google : le callback vit sur Next (:3000), qui
    # delegue ensuite l'echange sensible a FastAPI (POST /api/google/exchange).
    google_redirect_uri: str = "http://localhost:3000/api/google/callback"

    # Fenetres de synchronisation (constantes de config, pas de plateforme Core) :
    # bornes du premier sync / resync pour ne pas exploser les quotas Google.
    calendar_window_days: int = 60  # fenetre agenda (passe 7 j + futur N j)
    gmail_lookback_days: int = 7  # fenetre mails au premier sync / resync
    max_mails_per_sync: int = 50  # plafond de mails traites par run

    # Scheduler de synchronisation periodique (~5 min). Desactivable en test.
    google_scheduler_enabled: bool = True
    google_scheduler_interval_minutes: int = 5
    # Timeout global d'un run de sync declenche par le scheduler (secondes).
    google_sync_run_timeout: int = 60

    # Environnement : en prod le cookie est prefixe __Secure- (HTTPS uniquement).
    environment: str = "development"

    # Fuseau applicatif : sert a calculer les bornes du jour (cockpit, planning)
    # en heure locale plutot qu'en UTC naif (correction #6 review Round 004).
    app_timezone: str = "Europe/Paris"

    # URL publique du frontend Next.js : sert a construire le lien d'invitation
    # ({app_url}/sign-up?invitation={jeton}) renvoye a l'administrateur.
    app_url: str = "http://localhost:3000"

    # MinIO / S3
    s3_endpoint: str = "http://localhost:9000"
    s3_region: str = "us-east-1"
    s3_bucket: str = "app-files"
    s3_access_key_id: str = "app_minio_admin"
    s3_secret_access_key: str = "app_minio_password_dev"
    s3_force_path_style: bool = True
    s3_public_url: str = "http://localhost:9000/app-files"

    # CORS : autorise le frontend Next.js local (origine explicite, jamais *
    # avec allow_credentials=True).
    cors_allowed_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # Tri des mails (Round 006) : clé Anthropic vide = mode "règles" (fallback
    # heuristique, chemin nominal ce round). Dès qu'une clé est fournie, le
    # scoring/résumé LLM s'active sans autre changement de code.
    anthropic_api_key: str = ""
    triage_llm_model: str = "claude-haiku-4-5"
    triage_summary_model: str = "claude-sonnet-4-5"
    triage_importance_threshold: int = 60
    triage_max_llm_mails_per_run: int = 30
    triage_notify_important: bool = True
    triage_max_push_per_hour: int = 3

    # Brief IA quotidien (Round 007) : clé Anthropic vide = brief dégradé
    # (chemin nominal ce round), assemblé de façon déterministe avec le
    # même schéma que le brief rédigé par IA. Dès qu'une clé est fournie,
    # la rédaction fine s'active sans autre changement de code.
    brief_llm_model: str = "claude-sonnet-4-5"
    brief_max_priorities: int = 3
    brief_include_mails: bool = True
    brief_lookahead_tomorrow: bool = True
    brief_notify_ready: bool = True
    brief_scheduler_enabled: bool = True
    brief_scheduler_interval_minutes: int = 5
    brief_run_timeout: int = 45
    brief_manual_cooldown_seconds: int = 60

    # Assistant conversationnel (Round 008) : clé Anthropic présente -> l'IA
    # est le chemin nominal de ce round (contrairement aux rounds précédents).
    # Le fallback gracieux (plan invalide/LLM en panne -> clarification, reply
    # LLM en panne -> template) reste actif si un appel échoue malgré tout.
    assistant_llm_model: str = "claude-sonnet-4-5"
    assistant_max_actions_per_message: int = 3
    assistant_allow_email_send: bool = True
    assistant_hitl_timeout_hours: int = 24
    assistant_reply_tone: str = "naturel"
    assistant_rate_limit_per_min: int = 10

    # Notifications push web (Round 009) : clés VAPID (paire d'application,
    # cf. `.env.local`) - la privée est le base64url des 32 octets bruts,
    # acceptée telle quelle par `pywebpush` (vérifié - cf. `services/push/sender.py`).
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:admin@admin.com"
    push_max_per_hour: int = 10

    # Rappels d'événements (Round 009) : notifie `event_reminder_minutes` avant
    # le début d'un événement, tick `event_reminder_interval_minutes`.
    event_reminder_minutes: int = 30
    event_reminder_scheduler_enabled: bool = True
    event_reminder_interval_minutes: int = 5


settings = Settings()
