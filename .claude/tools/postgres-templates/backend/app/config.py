from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Cherche .env.local d'abord a la racine (../) puis dans backend/
    # Permet d'avoir un SEUL fichier .env.local partage avec Next.js
    model_config = SettingsConfigDict(
        env_file=("../.env.local", ".env.local"),
        extra="ignore",
    )

    database_url: str = "postgres://app_admin:app_password_dev@localhost:5433/app_main"

    # MinIO / S3
    s3_endpoint: str = "http://localhost:9000"
    s3_region: str = "us-east-1"
    s3_bucket: str = "app-files"
    s3_access_key_id: str = "app_minio_admin"
    s3_secret_access_key: str = "app_minio_password_dev"
    s3_force_path_style: bool = True
    s3_public_url: str = "http://localhost:9000/app-files"

    # CORS : autorise le frontend Next.js local
    cors_allowed_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ]


settings = Settings()
