"use client";

import { ReactNode, useEffect, useId } from "react";

interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  description?: string;
}

export function Modal({ isOpen, title, onClose, children, footer, description }: ModalProps) {
  const labelId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div>
            <h2 id={labelId} className="text-lg font-semibold text-slate-900 dark:text-white">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Закрыть модальное окно"
          >
            ×
          </button>
        </header>
        <div className="space-y-6 px-6 py-6 text-left text-sm text-slate-700 dark:text-slate-200">{children}</div>
        {footer ? (
          <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end dark:border-slate-700">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
