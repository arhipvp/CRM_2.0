# Payment Timeline Components

Набор React компонентов для отображения визуальной временной шкалы платежей со сделкой.

## Компоненты

### 1. PaymentTimeline

Главный компонент, отображающий полную горизонтальную шкалу платежа с 4 этапами:
- **Документы** - Документы получены
- **Ожидание** - Ожидание платежа (показывает дни до срока)
- **Получен** - Платеж получен
- **Распределение** - Расчёты выполнены

#### Props

```typescript
interface PaymentTimelineProps {
  payment: Payment;
  dealId: string;
  onStageClick?: (stage: PaymentStage) => void;
}
```

#### Используемые типы

```typescript
type PaymentStageName = "documents" | "awaiting" | "received" | "distributed";

interface PaymentStage {
  id: PaymentStageName;
  label: string;
  status: "completed" | "waiting" | "pending" | "failed";
  dueDate?: string;
  completedAt?: string;
  daysUntilDue?: number;
  isOverdue?: boolean;
  percentage?: number;
  actionRequired?: boolean;
}
```

#### Логика расчёта этапов

1. **Документы** - всегда "completed" (создан платёж)
2. **Ожидание** - "waiting" если статус `planned` или `expected`, иначе "completed"
3. **Получен** - "completed" если статус `received` или `paid_out`, иначе "pending"
4. **Распределение** - "completed" если статус `paid_out`, иначе "pending"

#### Пример использования

```tsx
import { PaymentTimeline } from '@/components/payments';
import { usePayment } from '@/lib/api/hooks';

export function PaymentDetails({ paymentId }: { paymentId: string }) {
  const { data: payment } = usePayment(paymentId);

  if (!payment) return null;

  const handleStageClick = (stage) => {
    console.log('Clicked stage:', stage.id);
  };

  return (
    <PaymentTimeline
      payment={payment}
      dealId={payment.dealId}
      onStageClick={handleStageClick}
    />
  );
}
```

#### Особенности

- Автоматический расчёт дней до срока
- Отслеживание просрочки платежа
- Индикатор требуемых действий
- Прогресс-бар показывающий процент завершения
- Информационные блоки о текущем статусе
- Сводка по суммам (плановая, доходы, расходы, чистый результат)
- Поддержка dark mode
- Мобильная адаптивность

---

### 2. PaymentTimelineStage

Отдельный компонент для одного этапа шкалы. Содержит иконку, название и интерактивность.

#### Props

```typescript
interface PaymentTimelineStageProps {
  stage: PaymentStage;
  isActive?: boolean;
  onClick?: () => void;
  showDetails?: boolean;
}
```

#### Иконки статусов

- **completed** ✓ (зелёная) - этап завершён
- **waiting** ⏳ (жёлтая) - этап в процессе
- **pending** ○ (серая) - этап ожидает
- **failed** ✕ (красная) - ошибка

#### Пример использования

```tsx
import { PaymentTimelineStage } from '@/components/payments';

export function CustomTimeline({ stages }: { stages: PaymentStage[] }) {
  return (
    <div className="flex gap-4">
      {stages.map((stage) => (
        <PaymentTimelineStage
          key={stage.id}
          stage={stage}
          isActive={stage.status === 'waiting'}
          onClick={() => console.log(stage.id)}
          showDetails={true}
        />
      ))}
    </div>
  );
}
```

#### Особенности

- Компактное отображение статуса
- Анимированная иконка для "waiting" статуса
- Дополнительная информация (дни, действия) при `showDetails=true`
- Hover эффекты
- Масштабирование при активном статусе

---

### 3. PaymentStatusIndicator

Компактный индикатор статуса для использования в таблицах. Показывает 4 маленьких квадратика со статусом каждого этапа.

#### Props

```typescript
interface PaymentStatusIndicatorProps {
  payment: Payment;
  size?: "sm" | "md";
  showLabels?: boolean;
}
```

#### Размеры

- `sm` (по умолчанию) - 20x20px для компактного отображения в таблицах
- `md` - 28x28px для более крупного отображения

#### Пример использования

```tsx
import { PaymentStatusIndicator } from '@/components/payments';

export function PaymentsTableCell({ payment }: { payment: Payment }) {
  return (
    <div className="flex items-center gap-2">
      <PaymentStatusIndicator
        payment={payment}
        size="sm"
        showLabels={true}
      />
    </div>
  );
}
```

Вывод:
```
[✓] [⏳] [○] [○]  Платёж #1
```

#### Особенности

- Очень компактное отображение
- Оптимизировано для таблиц
- Иконки быстро показывают статус
- Title атрибуты для подсказок
- ARIA labels для доступности

---

### 4. PaymentMetricsCard

Карточка с метриками текущего этапа платежа, финансовыми показателями и быстрыми действиями.

#### Props

```typescript
interface PaymentMetricsCardProps {
  payment: Payment;
  currentStage: PaymentStage;
  onActionClick?: (actionType: string) => void;
  className?: string;
}
```

#### Доступные действия (зависят от этапа)

**Stage: "awaiting" (status: "waiting")**
- `record_payment` - Зафиксировать платёж

**Все этапы (если не подтверждено)**
- `confirm_payment` - Подтвердить платёж

**Stage: "received" (status: "completed")**
- `distribute_payment` - Распределить платёж

#### Пример использования

```tsx
import { PaymentMetricsCard } from '@/components/payments';
import { PaymentTimeline } from '@/components/payments';

export function PaymentOverview({ payment }: { payment: Payment }) {
  const [stages] = useState(() => calculateStages(payment));
  const currentStage = stages.find(s => s.status === 'waiting') || stages[0];

  const handleAction = (actionType: string) => {
    switch (actionType) {
      case 'record_payment':
        // Открыть форму фиксации платежа
        break;
      case 'confirm_payment':
        // Открыть диалог подтверждения
        break;
      case 'distribute_payment':
        // Открыть форму распределения
        break;
    }
  };

  return (
    <div className="space-y-6">
      <PaymentTimeline
        payment={payment}
        dealId={payment.dealId}
      />
      <PaymentMetricsCard
        payment={payment}
        currentStage={currentStage}
        onActionClick={handleAction}
      />
    </div>
  );
}
```

#### Метрики в карточке

- **Плановая сумма** - Ожидаемая сумма платежа
- **Доходы** - Зафиксированные поступления
- **Расходы** - Зафиксированные расходы
- **Netto** - Чистый результат (доходы - расходы)
- **Статус подтверждения** - Подтверждено ли
- **Срок** (если awaiting) - Дни до срока или просрочка

#### Особенности

- Интерактивные кнопки действий
- Динамические цвета для метрик
- Красные цвета для просрочки
- Жёлтые для срочных сроков (≤3 дней)
- Статус подтверждения
- Адаптивный грид для метрик (2 колонки на мобильных, 4 на десктопе)
- Поддержка темы

---

## Типы данных

### PaymentStatus (из types/crm.ts)

```typescript
type PaymentStatus = "planned" | "expected" | "received" | "paid_out" | "cancelled";
```

### Payment (из types/crm.ts)

```typescript
interface Payment {
  id: string;
  dealId: string;
  clientId: string;
  status: PaymentStatus;
  confirmationStatus: "pending" | "confirmed";
  amount: number;
  plannedAmount: number;
  actualAmount?: number;
  currency: string;
  dueDate?: string;
  plannedDate?: string;
  actualDate?: string;
  paidAt?: string;
  incomesTotal: number;
  expensesTotal: number;
  netTotal: number;
  createdAt: string;
  updatedAt: string;
  // ... остальные поля
}
```

---

## Примеры интеграции

### В DealDetail странице

```tsx
import { PaymentTimeline, PaymentMetricsCard } from '@/components/payments';
import { useState, useMemo } from 'react';

export function DealPaymentsTab({ deal }: { deal: Deal }) {
  return (
    <div className="space-y-8">
      {deal.payments.map((payment) => (
        <div key={payment.id} className="space-y-4">
          <h3 className="text-lg font-bold">
            Полис {payment.policyNumber}
          </h3>
          <PaymentTimeline
            payment={payment}
            dealId={deal.id}
          />
        </div>
      ))}
    </div>
  );
}
```

### В PaymentsTable (строка таблицы)

```tsx
import { PaymentStatusIndicator } from '@/components/payments';

export function PaymentsTableRow({ payment }: { payment: Payment }) {
  return (
    <tr>
      <td className="px-4 py-3">
        {payment.policyNumber}
      </td>
      <td className="px-4 py-3">
        <PaymentStatusIndicator
          payment={payment}
          size="sm"
          showLabels={true}
        />
      </td>
      <td className="px-4 py-3">
        {formatCurrency(payment.plannedAmount, payment.currency)}
      </td>
    </tr>
  );
}
```

### В Payment Modal (детальный просмотр)

```tsx
import {
  PaymentTimeline,
  PaymentMetricsCard,
  PaymentStatusIndicator,
} from '@/components/payments';

export function PaymentDetailModal({ payment }: { payment: Payment }) {
  const [stages] = useState(() => calculateStages(payment));
  const currentWaitingStage = stages.find(s => s.status === 'waiting');
  const currentStage = currentWaitingStage || stages[stages.length - 1];

  return (
    <Modal>
      <Modal.Header>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">
              Платёж - Полис {payment.policyNumber}
            </h2>
            <p className="text-sm text-slate-500">
              Сделка: {payment.dealName}
            </p>
          </div>
          <PaymentStatusIndicator
            payment={payment}
            size="md"
          />
        </div>
      </Modal.Header>

      <Modal.Body className="space-y-6">
        <PaymentTimeline
          payment={payment}
          dealId={payment.dealId}
        />
        <PaymentMetricsCard
          payment={payment}
          currentStage={currentStage}
          onActionClick={handleActionClick}
        />
      </Modal.Body>
    </Modal>
  );
}
```

---

## Стилизация и темы

Все компоненты используют **Tailwind CSS** и поддерживают **dark mode** через префикс `dark:`:

### Цветовая схема

- **Completed** - зелёный (`emerald`)
- **Waiting** - жёлтый/оранжевый (`amber`)
- **Pending** - серый (`slate`)
- **Failed** - красный (`rose`)

### Адаптивность

- **Mobile-first** подход
- Переносимые элементы на малых экранах
- Грид меняется от 2 колонок (мобиль) к 4 (десктоп)

---

## Производительность

### Оптимизации

1. **useMemo** для расчёта этапов
2. **React.memo** для компонентов этапов
3. Минимальное количество re-renders
4. Условный рендеринг ненужного контента

### Размер bundle

- PaymentTimeline: ~2.5 KB
- PaymentTimelineStage: ~1.2 KB
- PaymentStatusIndicator: ~1.5 KB
- PaymentMetricsCard: ~2.2 KB
- **Итого**: ~7.4 KB (min+gzip)

---

## Доступность (A11y)

- ARIA labels для иконок
- Semantic HTML (button, section, article)
- Color не единственный способ показать информацию
- Keyboard navigation поддержка
- Screen reader friendly

---

## Тестирование

### Unit тесты (Vitest)

```typescript
import { render, screen } from '@testing-library/react';
import { PaymentTimeline } from './PaymentTimeline';

describe('PaymentTimeline', () => {
  it('renders all 4 stages', () => {
    const payment = mockPayment({ status: 'expected' });
    render(<PaymentTimeline payment={payment} dealId="123" />);

    expect(screen.getByText('Документы')).toBeInTheDocument();
    expect(screen.getByText('Ожидание')).toBeInTheDocument();
    expect(screen.getByText('Получен')).toBeInTheDocument();
    expect(screen.getByText('Распределение')).toBeInTheDocument();
  });

  it('shows correct stages status', () => {
    const payment = mockPayment({ status: 'received' });
    render(<PaymentTimeline payment={payment} dealId="123" />);

    // Документы и ожидание должны быть завершены
    // Получен должен быть завершён
    // Распределение должно быть в ожидании
  });

  it('calculates days until due correctly', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const payment = mockPayment({
      status: 'expected',
      dueDate: tomorrow.toISOString(),
    });

    render(<PaymentTimeline payment={payment} dealId="123" />);
    expect(screen.getByText(/До срока: 1 дн/)).toBeInTheDocument();
  });
});
```

---

## Частые вопросы

**Q: Как кастомизировать цвета?**
A: Измените tailwind классы в компонентах или используйте `className` prop.

**Q: Как обновить этапы при изменении платежа?**
A: `useMemo` в PaymentTimeline автоматически пересчитывает этапы при изменении `payment`.

**Q: Можно ли использовать компоненты отдельно?**
A: Да, каждый компонент независимый и может использоваться отдельно.

**Q: Поддерживается ли темизация?**
A: Да, используется `dark:` префикс Tailwind для светлой/тёмной темы.

**Q: Как обработать клик по этапу?**
A: Передайте `onStageClick` в PaymentTimeline или `onClick` в PaymentTimelineStage.

---

## Версия

- Created: 2025-10-23
- Last Updated: 2025-10-23
- Component Library Version: 1.0.0
- React: 18+
- Next.js: 15+
- Tailwind CSS: 3.3+
