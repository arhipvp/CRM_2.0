export const NO_MANAGER_VALUE = "__NO_MANAGER__";
export const NO_MANAGER_LABEL = "Без владельца";

export function normalizeManagerValue(value: string | null | undefined): string | undefined {
  if (value === undefined || value === null) {
    return NO_MANAGER_VALUE;
  }

  if (value === NO_MANAGER_VALUE) {
    return NO_MANAGER_VALUE;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return NO_MANAGER_VALUE;
  }

  return trimmed;
}

export function getManagerLabel(value: string): string {
  return value === NO_MANAGER_VALUE ? NO_MANAGER_LABEL : value;
}

export function collectManagerValues(values: Array<string | null | undefined>): string[] {
  const unique = new Set<string>();

  for (const value of values) {
    const normalized = normalizeManagerValue(value);
    if (!normalized) {
      continue;
    }

    unique.add(normalized);
  }

  return Array.from(unique).sort((a, b) => getManagerLabel(a).localeCompare(getManagerLabel(b)));
}
