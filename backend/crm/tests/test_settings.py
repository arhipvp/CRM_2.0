from __future__ import annotations

import os

import pytest
from pydantic import ValidationError

from crm.app import config as app_config


@pytest.mark.usefixtures("configure_environment")
def test_documents_base_url_is_required(monkeypatch):
    original = os.environ.get("CRM_DOCUMENTS_BASE_URL")
    monkeypatch.delenv("CRM_DOCUMENTS_BASE_URL", raising=False)
    app_config.get_settings.cache_clear()

    with pytest.raises(ValidationError):
        app_config.Settings()

    if original is not None:
        monkeypatch.setenv("CRM_DOCUMENTS_BASE_URL", original)
    app_config.get_settings.cache_clear()
    app_config.settings = app_config.get_settings()
