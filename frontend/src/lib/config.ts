import { resolvePublicUrl } from "@/lib/utils/url";

const DEFAULT_API_BASE = "http://gateway:8080/api/v1";
const PUBLIC_API_FALLBACK_PATH = "/api/v1";
const AUTH_DISABLED_TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export function getApiBaseUrl(): string {
  const base =
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    DEFAULT_API_BASE;

  const resolved = resolvePublicUrl(base, PUBLIC_API_FALLBACK_PATH);
  return (resolved ?? DEFAULT_API_BASE).replace(/\/$/, "");
}

export function isAuthDisabled(): boolean {
  const raw =
    process.env.NEXT_PUBLIC_AUTH_DISABLED ?? process.env.AUTH_DISABLED ?? "";
  return AUTH_DISABLED_TRUE_VALUES.has(raw.trim().toLowerCase());
}
