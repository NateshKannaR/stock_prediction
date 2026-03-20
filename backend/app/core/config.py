from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[3] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Benx Quant Trading Platform"
    environment: str = "development"
    backend_cors_origins: str = "http://localhost:3000"

    mongodb_url: str
    mongodb_db: str = "benx_quant"
    redis_url: str

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 720

    default_admin_email: str
    default_admin_password: str

    upstox_client_id: str = ""
    upstox_client_secret: str = ""
    upstox_access_token: str = ""
    upstox_redirect_uri: str = ""
    upstox_auth_url: str = "https://api-v2.upstox.com/login/authorization/dialog"
    upstox_token_url: str = "https://api-v2.upstox.com/login/authorization/token"
    upstox_api_base_url: str = "https://api.upstox.com"
    upstox_hft_base_url: str = "https://api-hft.upstox.com"
    upstox_market_feed_authorize_url: str = "https://api.upstox.com/v3/feed/market-data-feed/authorize"

    socket_io_redis_channel: str = "benx:stream"
    model_path: str = "./artifacts/lstm_latest.pt"
    scaler_path: str = "./artifacts/feature_scaler.pkl"
    news_api_key: str = ""

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
