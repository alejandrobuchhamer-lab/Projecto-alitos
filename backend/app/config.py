import os
from pydantic_settings import BaseSettings


def _default_debug() -> bool:
    return os.environ.get("RAILWAY_ENVIRONMENT") is None


class Settings(BaseSettings):
    app_name: str = "ALITOS Sistema Operativo"
    app_version: str = "1.0.0"
    database_url: str = "sqlite:///./alitos.db"
    debug: bool = _default_debug()
    moneda_base: str = "ARS"
    moneda_secundaria: str = "USD"
    anthropic_api_key: str = ""
    secret_key: str = "alitos-secret-key-cambia-esto-en-produccion-2025"
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_email: str = "mailto:admin@alitos.com"

    class Config:
        env_file = ".env"


settings = Settings()
