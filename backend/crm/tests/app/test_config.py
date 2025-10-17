from crm.app.config import Settings


def test_settings_ignore_foreign_env_keys(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        """
        SOME_FOREIGN_KEY=value
        CRM_APP_NAME=Custom CRM
        """.strip()
    )

    settings = Settings(_env_file=env_file)

    assert settings.app_name == "Custom CRM"
    assert not hasattr(settings, "SOME_FOREIGN_KEY")
    assert not settings.model_extra


def test_settings_prioritizes_prefixed_database_url(tmp_path, monkeypatch):
    monkeypatch.delenv("CRM_DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)

    env_file = tmp_path / ".env"
    env_file.write_text(
        """
        DATABASE_URL=postgresql+asyncpg://admin:admin@localhost:5432/admin
        CRM_DATABASE_URL=postgresql+asyncpg://crm:crm@localhost:5432/crm
        """.strip()
    )

    settings = Settings(_env_file=env_file)

    assert str(settings.database_url) == "postgresql+asyncpg://crm:crm@localhost:5432/crm"
