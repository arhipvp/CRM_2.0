"use client";

import { useCallback } from "react";
import { useUpdateNotificationChannel } from "@/lib/api/hooks";
import {
  selectChannelSettings,
  useNotificationsStore,
} from "@/stores/notificationsStore";
import type { NotificationChannel } from "@/types/notifications";

export function DeliverySettingsPanel() {
  const channels = useNotificationsStore(selectChannelSettings);
  const channelPending = useNotificationsStore((state) => state.channelPending);
  const updateChannel = useUpdateNotificationChannel();

  const handleToggle = useCallback(
    (channel: NotificationChannel, enabled: boolean, editable: boolean) => {
      if (!editable) {
        return;
      }

      updateChannel.mutate({ channel, enabled });
    },
    [updateChannel],
  );

  if (channels.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Настройки доставки</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Управляйте каналами, через которые вы получаете уведомления. Изменения применяются сразу.
        </p>
      </header>

      <ul className="space-y-4">
        {channels.map((channel) => {
          const pending = channelPending[channel.channel];
          const disabled = pending || updateChannel.isPending;
          return (
            <li
              key={channel.channel}
              className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 transition dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{channel.label}</p>
                  {channel.description ? (
                    <p className="text-xs text-slate-500 dark:text-slate-300">{channel.description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={channel.enabled}
                  disabled={!channel.editable || disabled}
                  onClick={() => handleToggle(channel.channel, !channel.enabled, channel.editable)}
                  className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring focus-visible:ring-sky-500 ${
                    channel.enabled
                      ? "bg-sky-600 text-white"
                      : "border border-slate-300 bg-white text-slate-600 hover:border-sky-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  } ${channel.editable ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                >
                  {channel.enabled ? "Включено" : "Выключено"}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-300">
                {channel.lastChangedAt ? (
                  <span>
                    Обновлено{' '}
                    {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(
                      new Date(channel.lastChangedAt),
                    )}
                  </span>
                ) : null}
                {!channel.editable ? <span>Канал управляется системными настройками.</span> : null}
                {pending ? <span className="text-sky-600 dark:text-sky-300">Сохраняем…</span> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
