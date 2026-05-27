from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "ALITOS Sistema Operativo"
    app_version: str = "1.0.0"
    database_url: str = "sqlite:///./alitos.db"
    debug: bool = True
    moneda_base: str = "ARS"
    moneda_secundaria: str = "USD"
    anthropic_api_key: str = ""
    secret_key: str = "alitos-secret-key-cambia-esto-en-produccion-2025"

    class Config:
        env_file = ".env"


settings = Settings()
