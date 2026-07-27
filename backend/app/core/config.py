from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Plant AI Platform"
    ENV: str = "development"

    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str
    DB_USERNAME: str
    DB_PASSWORD: str = "etiya41"

    SUPABASE_URL: str = ""
    SUPABASE_PUBLISHABLE_KEY: str = ""  
    SUPABASE_SECRET_KEY: str = ""  

    
    FIREBASE_CREDENTIALS_PATH: str = "./firebase-service-account.json"
    FIREBASE_PROJECT_ID: str = ""

    GEMINI_API_KEY: str = ""
    GEMINI_VISION_MODEL: str = "gemini-3.1-flash-lite"
    GEMINI_CHAT_MODEL: str = "gemini-3.1-flash-lite"

    CORS_ORIGINS: str = "*"
    DEFAULT_ROLE: str = "customer"

    @property
    def DATABASE_URL(self) -> str:
        password = f":{self.DB_PASSWORD}" if self.DB_PASSWORD else ""
        return f"postgresql+asyncpg://{self.DB_USERNAME}{password}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def cors_origins_list(self) -> list[str]:
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
