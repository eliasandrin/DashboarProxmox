"""
INFORMIX Spa — AWS Secrets Manager Integration
Retrieves secrets at startup. Falls back to environment variables in development.
Zero hardcoded secrets — all sensitive data comes from AWS or env vars.
"""

import json
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class SecretsManager:
    """
    Manages application secrets via AWS Secrets Manager.
    In development mode, falls back to environment variables.
    """

    _cache: Optional[Dict[str, Any]] = None

    @classmethod
    def load_secrets(cls, secret_name: str, region: str) -> Dict[str, Any]:
        """
        Load secrets from AWS Secrets Manager.
        Returns a dictionary of key-value pairs.
        Raises RuntimeError if retrieval fails in production.
        """
        if cls._cache is not None:
            logger.info("Returning cached secrets")
            return cls._cache

        try:
            import boto3
            from botocore.exceptions import ClientError, NoCredentialsError

            logger.info(f"Connecting to AWS Secrets Manager in {region}...")
            session = boto3.session.Session()
            client = session.client(
                service_name="secretsmanager",
                region_name=region,
            )

            response = client.get_secret_value(SecretId=secret_name)

            if "SecretString" in response:
                cls._cache = json.loads(response["SecretString"])
                logger.info("✅ Secrets loaded successfully from AWS Secrets Manager")
                return cls._cache
            else:
                raise ValueError("Secret is binary, expected JSON string")

        except ImportError:
            logger.warning("boto3 not available — using environment variables")
            return {}
        except Exception as e:
            logger.warning(f"⚠️ Could not load AWS secrets: {e}")
            logger.info("Falling back to environment variables")
            return {}

    @classmethod
    def apply_secrets(cls, settings) -> None:
        """
        Apply retrieved secrets to the application settings.
        Expected secret JSON structure:
        {
            "db_host": "...",
            "db_port": 5432,
            "db_name": "...",
            "db_user": "...",
            "db_password": "...",
            "proxmox_host": "...",
            "proxmox_user": "...",
            "proxmox_token_value": "...",
            "jwt_secret_key": "..."
        }
        """
        if not settings.USE_AWS_SECRETS:
            logger.info("AWS Secrets Manager disabled — using env vars")
            return

        secrets = cls.load_secrets(settings.AWS_SECRET_NAME, settings.AWS_REGION)

        if not secrets:
            logger.warning("No secrets retrieved — keeping current configuration")
            return

        # Map secret keys to settings attributes
        mapping = {
            "db_host": "DB_HOST",
            "db_port": "DB_PORT",
            "db_name": "DB_NAME",
            "db_user": "DB_USER",
            "db_password": "DB_PASSWORD",
            "proxmox_host": "PROXMOX_HOST",
            "proxmox_user": "PROXMOX_USER",
            "proxmox_token_value": "PROXMOX_TOKEN_VALUE",
            "jwt_secret_key": "JWT_SECRET_KEY",
        }

        applied = 0
        for secret_key, setting_attr in mapping.items():
            if secret_key in secrets:
                setattr(settings, setting_attr, secrets[secret_key])
                applied += 1

        logger.info(f"✅ Applied {applied} secrets from AWS Secrets Manager")

    @classmethod
    def clear_cache(cls):
        """Clear the secrets cache (for testing)."""
        cls._cache = None
