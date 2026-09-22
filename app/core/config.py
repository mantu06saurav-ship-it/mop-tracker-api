from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


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
    def sqlalchemy_url(self) -> URL:
        # Built via URL.create (not an f-string) so special characters in the username/password
        # — e.g. a literal "@" — get percent-encoded instead of corrupting the connection string.
        return URL.create(
            "mssql+pyodbc",
            username=self.db_user,
            password=self.db_password,
            host=self.db_server,
            port=self.db_port,
            database=self.db_name,
            query={
                "driver": self.db_odbc_driver,
                "TrustServerCertificate": "yes",
                "Encrypt": "no",
            },
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
