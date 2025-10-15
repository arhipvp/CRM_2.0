from __future__ import annotations

from datetime import date, timedelta
from typing import Any
from uuid import UUID, uuid4

from aiogram import Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import Message

from telegram_bot.clients.auth import AuthUser
from telegram_bot.clients.crm import CRMClientError
from telegram_bot.clients.notifications import NotificationsClientError
from telegram_bot.services.deals import DealService, QuickDealData
from telegram_bot.services.payments import PaymentContext, PaymentService
from telegram_bot.services.tasks import TaskService

class NewDealStates(StatesGroup):
    client_name = State()
    client_email = State()
    client_phone = State()
    deal_title = State()
    review_date = State()
    deal_value = State()
    description = State()


async def start(message: Message) -> None:
    await message.answer(
        "Привет! Доступные команды:\n"
        "• /new_deal — быстрый черновик сделки\n"
        "• /confirm_task <task_id> [комментарий]\n"
        "• /confirm_payment <deal_id> <policy_id> <payment_id> [дата YYYY-MM-DD]"
    )


async def cancel(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("Диалог сброшен.")


async def new_deal(message: Message, state: FSMContext) -> None:
    await state.clear()
    await state.update_data(trace_id=str(uuid4()))
    await state.set_state(NewDealStates.client_name)
    await message.answer("Введите имя клиента.")


async def process_client_name(message: Message, state: FSMContext) -> None:
    text = message.text.strip() if message.text else ""
    if not text:
        await message.answer("Имя не может быть пустым. Повторите ввод.")
        return
    await state.update_data(client_name=text)
    await state.set_state(NewDealStates.client_email)
    await message.answer("Введите email клиента или '-' если нет.")


async def process_client_email(message: Message, state: FSMContext) -> None:
    email = _normalize_optional(message.text)
    await state.update_data(client_email=email)
    await state.set_state(NewDealStates.client_phone)
    await message.answer("Введите телефон клиента или '-' если нет.")


async def process_client_phone(message: Message, state: FSMContext) -> None:
    phone = _normalize_optional(message.text)
    await state.update_data(client_phone=phone)
    await state.set_state(NewDealStates.deal_title)
    await message.answer("Введите название сделки.")


async def process_deal_title(message: Message, state: FSMContext) -> None:
    text = message.text.strip() if message.text else ""
    if not text:
        await message.answer("Название не может быть пустым. Повторите ввод.")
        return
    await state.update_data(deal_title=text)
    await state.set_state(NewDealStates.review_date)
    default_date = date.today() + timedelta(days=14)
    await message.answer(
        "Введите дату следующего обзора в формате YYYY-MM-DD\n"
        f"(по умолчанию {default_date.isoformat()}, оставьте '-' для значения по умолчанию)."
    )


async def process_review_date(message: Message, state: FSMContext) -> None:
    text = (message.text or "").strip()
    default_date = date.today() + timedelta(days=14)
    if text in {"", "-"}:
        review_date = default_date
    else:
        try:
            review_date = date.fromisoformat(text)
        except ValueError:
            await message.answer("Некорректная дата. Используйте формат YYYY-MM-DD.")
            return
    await state.update_data(review_date=review_date)
    await state.set_state(NewDealStates.deal_value)
    await message.answer("Введите оценочную сумму сделки или '-' если значение отсутствует.")


async def process_deal_value(message: Message, state: FSMContext) -> None:
    text = (message.text or "").strip()
    value: float | None
    if text in {"", "-"}:
        value = None
    else:
        try:
            value = float(text.replace(",", "."))
        except ValueError:
            await message.answer("Не удалось распознать число. Укажите сумму или '-' для пропуска.")
            return
    await state.update_data(deal_value=value)
    await state.set_state(NewDealStates.description)
    await message.answer("Добавьте комментарий к сделке или '-' для пропуска.")


async def finalize_deal(message: Message, state: FSMContext, data: dict[str, Any]) -> None:
    description = _normalize_optional(message.text)
    stored = await state.get_data()
    user: AuthUser = data["auth_user"]
    deal_service: DealService = data["deal_service"]
    trace_id = stored.get("trace_id")
    quick_data = QuickDealData(
        client_name=stored["client_name"],
        client_email=stored.get("client_email"),
        client_phone=stored.get("client_phone"),
        title=stored["deal_title"],
        description=description,
        next_review_at=stored["review_date"],
        value=stored.get("deal_value"),
    )
    try:
        result = await deal_service.create_quick_deal(user, quick_data, trace_id=trace_id)
    except CRMClientError:
        await message.answer("Не удалось создать сделку. CRM недоступна, попробуйте позже.")
        return
    except NotificationsClientError:
        await message.answer("Сделка создана, но уведомление отправить не удалось. Сообщите в поддержку.")
    else:
        await message.answer(
            "Черновик сделки создан!\n"
            f"ID сделки: {result.deal.id}\n"
            f"Клиент: {result.client.name}"
        )
    await state.clear()


async def confirm_task(message: Message, data: dict[str, Any]) -> None:
    parts = (message.text or "").split(maxsplit=2)
    if len(parts) < 2:
        await message.answer("Укажите идентификатор задачи: /confirm_task <task_id> [комментарий].")
        return
    try:
        task_id = UUID(parts[1])
    except ValueError:
        await message.answer("Неверный формат UUID задачи.")
        return
    comment = parts[2] if len(parts) > 2 else None
    user: AuthUser = data["auth_user"]
    task_service: TaskService = data["task_service"]
    try:
        result = await task_service.confirm_task(user, task_id, comment=comment, trace_id=str(uuid4()))
    except CRMClientError:
        await message.answer("Не удалось обновить задачу. CRM недоступна или задача не найдена.")
        return
    except NotificationsClientError:
        await message.answer("Задача подтверждена, но уведомление не отправлено. Сообщите в поддержку.")
    else:
        await message.answer(f"Задача {result.task.title} отмечена выполненной.")


async def confirm_payment(message: Message, data: dict[str, Any]) -> None:
    parts = (message.text or "").split(maxsplit=4)
    if len(parts) < 4:
        await message.answer(
            "Используйте формат /confirm_payment <deal_id> <policy_id> <payment_id> [дата YYYY-MM-DD]."
        )
        return
    try:
        deal_id = UUID(parts[1])
        policy_id = UUID(parts[2])
        payment_id = UUID(parts[3])
    except ValueError:
        await message.answer("Идентификаторы должны быть в формате UUID.")
        return
    actual_date = None
    if len(parts) == 5:
        try:
            actual_date = date.fromisoformat(parts[4])
        except ValueError:
            await message.answer("Дата должна быть в формате YYYY-MM-DD.")
            return
    user: AuthUser = data["auth_user"]
    payment_service: PaymentService = data["payment_service"]
    context = PaymentContext(deal_id=deal_id, policy_id=policy_id, payment_id=payment_id)
    try:
        await payment_service.confirm_payment(
            user,
            context,
            actual_date=actual_date,
            trace_id=str(uuid4()),
        )
    except CRMClientError:
        await message.answer("Не удалось обновить платёж. Проверьте идентификаторы или повторите позже.")
        return
    except NotificationsClientError:
        await message.answer("Платёж подтверждён, но уведомление не доставлено. Сообщите в поддержку.")
    else:
        await message.answer("Платёж успешно подтверждён.")


def _normalize_optional(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    if not text or text == "-":
        return None
    return text


def create_router() -> Router:
    router = Router(name="commands")
    router.message.register(start, Command("start"))
    router.message.register(cancel, Command("cancel"))
    router.message.register(new_deal, Command("new_deal"))
    router.message.register(process_client_name, NewDealStates.client_name)
    router.message.register(process_client_email, NewDealStates.client_email)
    router.message.register(process_client_phone, NewDealStates.client_phone)
    router.message.register(process_deal_title, NewDealStates.deal_title)
    router.message.register(process_review_date, NewDealStates.review_date)
    router.message.register(process_deal_value, NewDealStates.deal_value)
    router.message.register(finalize_deal, NewDealStates.description)
    router.message.register(confirm_task, Command("confirm_task"))
    router.message.register(confirm_payment, Command("confirm_payment"))
    return router
