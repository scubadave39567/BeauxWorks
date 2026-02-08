from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="BEAUXWORKS_",
        env_file=str(Path(__file__).resolve().parent.parent.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # SQL Server connection
    sql_server: str = "CHAMBERLAIN-PC"
    sql_database: str = "BeauxWorks"
    sql_user: str = "sa"
    sql_password: str = ""
    sql_driver: str = "ODBC Driver 17 for SQL Server"
    sql_trusted_connection: bool = False

    # JWT
    jwt_access_secret: str = "change-me"
    jwt_refresh_secret: str = "change-me"
    jwt_access_expires_minutes: int = 15
    jwt_refresh_expires_days: int = 7

    # MFA
    mfa_encryption_key: str = ""  # 64-char hex for AES-256

    # Account lockout
    max_failed_logins: int = 5
    lockout_duration_minutes: int = 15

    # Server
    api_port: int = 8000
    debug: bool = False
    cors_origins: str = "http://localhost:5173"

    @property
    def database_url(self) -> str:
        driver = self.sql_driver.replace(" ", "+")
        if self.sql_trusted_connection:
            return (
                f"mssql+pyodbc://@{self.sql_server}/{self.sql_database}"
                f"?driver={driver}&TrustServerCertificate=yes"
                f"&Trusted_Connection=yes"
            )
        return (
            f"mssql+pyodbc://{self.sql_user}:{self.sql_password}"
            f"@{self.sql_server}/{self.sql_database}"
            f"?driver={driver}&TrustServerCertificate=yes"
        )


settings = Settings()
