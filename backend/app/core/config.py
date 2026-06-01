from decimal import Decimal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://stocklisto:stocklisto@localhost:5432/stocklisto"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TTL_MIN: int = 30
    JWT_REFRESH_TTL_DAYS: int = 7

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    # Stock
    STOCK_LOCK_TTL_SEC: int = 900
    DISPATCH_AUTH_THRESHOLD_UNITS: int = 500
    DISPATCH_AUTH_THRESHOLD_AMOUNT: Decimal = Decimal("10000.00")

    # Bootstrap
    BOOTSTRAP_ADMIN_PASSWORD: str = "Admin1234!"

    # App
    CURRENCY_SYMBOL: str = "Q"
    APP_NAME: str = "StockListo"
    DEBUG: bool = False

    # Observability
    OTEL_EXPORTER_OTLP_ENDPOINT: str = ""


settings = Settings()
