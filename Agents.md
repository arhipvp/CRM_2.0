# Repository Guidelines

## Project Structure & Module Organization
- `backend/` runs the FastAPI stack: `api/` for routers, `app/` for startup/deps, `domain/` for schemas + business services, `infrastructure/` for SQLAlchemy models, repos, and queues.
- `desktop_app/` ships the PySide client: `api/` wraps HTTP calls, `ui/` hosts tabs/widgets, `models.py` holds shared DTOs.
- Tests live in `backend/tests/` (pytest) and `desktop_app/tests/` (pytest with Qt helpers). Keep new fixtures alongside their target layers.

## Build, Test, and Development Commands
- Backend setup: `cd backend && poetry install`.
- Run API: `poetry run uvicorn crm.app.main:app --reload`.
- Backend tests: `poetry run pytest`.
- Desktop deps: `cd desktop_app && pip install -r requirements.txt`.
- Desktop client: `python desktop_app/main.py`.
- Desktop tests: `pytest desktop_app/tests`.

## Coding Style & Naming Conventions
- Use 4-space indentation, 88-char lines, snake_case for modules/functions, PascalCase for classes, UPPER_CASE for constants.
- Run formatters before committing: `poetry run black . && poetry run isort .` in `backend/`, `python -m black .` in `desktop_app/`.
- New FastAPI routers follow `resource_name.py` and must be registered in `crm/api/router.py`.

## Testing Guidelines
- Prefer service/repository coverage when touching data paths; add regression tests for bug fixes.
- Backend tests are async-friendly pytest modules named `test_<feature>.py` with functions `test_<behavior>`.
- Desktop tests use pytest; mark GUI-heavy specs `@pytest.mark.qt` to keep headless runs stable.

## Commit & Pull Request Guidelines
- Follow conventional commits (`feat:`, `fix:`, `chore:`, etc.); keep each commit scoped and reversible.
- Include migrations or generated assets with the change that requires them.
- PRs should describe context, highlight risky areas, list manual/automated test steps, and attach UI screenshots for visible updates.
- Reference Jira/Trello or GitHub issues with `Closes #ID` where applicable.

## Security & Configuration Tips
- Keep tooling dependencies in `pyproject.toml`; avoid touching `.venv/`.
- Do not commit secrets; rely on environment variables or `.env` files ignored by git.
- When adding queues or external services, document required env vars in README or deployment notes.
