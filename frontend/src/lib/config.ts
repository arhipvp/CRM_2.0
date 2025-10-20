export function getApiBaseUrl(): string {
  const base =
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://gateway:8080/api/v1";

  return base.replace(/\/$/, "");
}
