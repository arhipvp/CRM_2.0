# Repository Guidelines

## Project Structure & Module Organization
- `backend/` hosts the FastAPI service, split into `api/` (routers), `app/` (startup + dependencies), `domain/` (schemas & services), and `infrastructure/` (SQLAlchemy models, repositories, queues).
- `desktop_app/` contains the PySide/UI client. Key modules: `api/` (HTTP client wrapper), `ui/` (tabs, widgets), and `models.py` for shared DTOs.
- `.venv/` holds the local virtual environment; keep tooling changes inside `pyproject.toml` instead.
- Tests live in `backend/tests/` (pytest) and `desktop_app/tests/` (pytest + Qt helpers).

## Build, Test, and Development Commands
- `poetry install` (run inside `backend/`) installs backend dependencies.
- `poetry run uvicorn crm.app.main:app --reload` launches the API with hot reload.
- `poetry run pytest` executes backend tests.
- `pip install -r requirements.txt` (inside `desktop_app/`) prepares the desktop environment.
- `python desktop_app/main.py` starts the desktop client.
- `pytest desktop_app/tests` runs desktop tests.

## Coding Style & Naming Conventions
- Use Black + isort formatting (`poetry run black . && poetry run isort .` in backend; `python -m black .` in desktop scope).
- Stick to 4-space indentation; keep line length at 88 chars (Black default).
- Follow snake_case for modules/functions, PascalCase for classes, and UPPER_CASE for constants.
- For new FastAPI routers, name files `resource_name.py` and register them in `crm/api/router.py`.

## Testing Guidelines
- Backend: pytest with async fixtures; name tests `test_<feature>.py` and functions `test_<behavior>`.
- Desktop: focus on deterministic widget logic; mark GUI-heavy tests with `@pytest.mark.qt` for selective runs.
- Strive for coverage on service/repository layers when touching data paths; add regression tests for bug fixes.

## Commit & Pull Request Guidelines
- Follow conventional-style messages: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:` observed in history.
- Make commits scoped and reversible; include migrations or generated assets in the same commit when required.
- PRs should describe context, highlight risky areas, list manual/automated test steps, and attach UI screenshots for visible changes.
- Link Jira/Trello tasks (or GitHub issues) via `Closes #ID` when applicable.
