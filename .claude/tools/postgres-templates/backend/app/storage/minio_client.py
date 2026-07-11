"""Client S3/MinIO partage entre les services backend."""

import uuid
from typing import Final

import boto3
from botocore.client import Config

from app.config import settings

_s3 = boto3.client(
    "s3",
    endpoint_url=settings.s3_endpoint,
    region_name=settings.s3_region,
    aws_access_key_id=settings.s3_access_key_id,
    aws_secret_access_key=settings.s3_secret_access_key,
    config=Config(
        signature_version="s3v4",
        s3={"addressing_style": "path" if settings.s3_force_path_style else "auto"},
    ),
)

BUCKET: Final[str] = settings.s3_bucket


def build_object_key(user_id: str, filename: str) -> str:
    """Genere une cle unique : users/{user_id}/{uuid}-{nom-nettoye}."""
    safe = "".join(c if c.isalnum() or c in "._-" else "_" for c in filename)
    return f"users/{user_id}/{uuid.uuid4()}-{safe}"


def upload_bytes(key: str, body: bytes, content_type: str) -> None:
    _s3.put_object(Bucket=BUCKET, Key=key, Body=body, ContentType=content_type)


def delete_object(key: str) -> None:
    _s3.delete_object(Bucket=BUCKET, Key=key)


def get_public_url(key: str) -> str:
    return f"{settings.s3_public_url}/{key}"


def get_presigned_download_url(key: str, expires_in: int = 3600) -> str:
    return _s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET, "Key": key},
        ExpiresIn=expires_in,
    )
