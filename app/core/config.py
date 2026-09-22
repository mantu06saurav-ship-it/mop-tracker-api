from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Auth
    jwt_secret: str
    jwt_expires_minutes: int = 480

    # Database
    db_server: str
    db_port: int = 1433
    db_name: str
    db_user: str
    db_password: str
    db_odbc_driver: str = "ODBC Driver 17 for SQL Server"

    # SMTP
    smtp_host: str
    smtp_port: int = 465
    smtp_user: str
    smtp_password: str
    smtp_from_name: str = "MOP Tracker"

    cors_origins: str = "http://localhost:3000"

    port: int = 8000

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def sqlalchemy_url(self) -> str:
        driver = self.db_odbc_driver.replace(" ", "+")
        return (
            f"mssql+pyodbc://{self.db_user}:{self.db_password}"
            f"@{self.db_server}:{self.db_port}/{self.db_name}"
            f"?driver={driver}&TrustServerCertificate=yes&Encrypt=no"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
