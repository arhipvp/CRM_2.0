const CSV_SEPARATOR = ",";

function escapeCsvValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);
  if (stringValue.includes(CSV_SEPARATOR) || stringValue.includes("\n") || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function createCsv(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
  const headerRow = headers.map((header) => escapeCsvValue(header)).join(CSV_SEPARATOR);
  const dataRows = rows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(CSV_SEPARATOR));
  return [headerRow, ...dataRows].join("\n");
}

export function createJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function triggerDownload({
  fileName,
  content,
  mimeType,
}: {
  fileName: string;
  content: string;
  mimeType: string;
}) {
  if (typeof window === "undefined") {
    return;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
