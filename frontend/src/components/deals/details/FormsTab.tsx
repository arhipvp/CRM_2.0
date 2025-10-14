"use client";

import { useState } from "react";
import type { DealFormField, DealFormGroup } from "@/types/crm";

export interface FormsTabProps {
  groups: DealFormGroup[];
  onFieldChange: (groupId: string, fieldId: string, value: string) => void;
}

function FieldInput({ field, onChange }: { field: DealFormField; onChange: (value: string) => void }) {
  const commonClasses = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  if (field.type === "select") {
    return (
      <select
        value={field.value}
        onChange={(event) => onChange(event.target.value)}
        disabled={field.disabled}
        className={commonClasses}
      >
        <option value="">Не выбрано</option>
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        value={field.value}
        onChange={(event) => onChange(event.target.value)}
        disabled={field.disabled}
        className={`${commonClasses} min-h-[120px]`}
      />
    );
  }

  const inputType = field.type === "currency" ? "number" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text";

  return (
    <input
      type={inputType}
      value={field.type === "date" && field.value ? field.value.slice(0, 10) : field.value}
      onChange={(event) => onChange(event.target.value)}
      disabled={field.disabled}
      className={commonClasses}
    />
  );
}

export function FormsTab({ groups, onFieldChange }: FormsTabProps) {
  const [expandedGroups, setExpandedGroups] = useState(() =>
    groups.filter((group) => !group.collapsedByDefault).map((group) => group.id),
  );

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => (prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]));
  };

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const isExpanded = expandedGroups.includes(group.id);

        return (
          <section key={group.id} className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
            >
              <span className="text-lg font-semibold text-slate-900 dark:text-white">{group.title}</span>
              <span className="text-sm text-sky-600">{isExpanded ? "Свернуть" : "Раскрыть"}</span>
            </button>
            {isExpanded ? (
              <div className="border-t border-slate-200 px-6 py-4 dark:border-slate-700">
                <div className="grid gap-4 md:grid-cols-2">
                  {group.fields.map((field) => (
                    <div key={field.id} className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {field.label}
                        {field.required ? <span className="ml-1 text-rose-500">*</span> : null}
                      </label>
                      <FieldInput field={field} onChange={(value) => onFieldChange(group.id, field.id, value)} />
                      {field.error ? (
                        <p className="text-xs text-rose-500">{field.error}</p>
                      ) : field.hint ? (
                        <p className="text-xs text-slate-500">{field.hint}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
