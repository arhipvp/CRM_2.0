const INTERNAL_HOSTNAMES = new Set([
  "gateway",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
]);

function isPrivateIp(hostname: string): boolean {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    const [a, b] = hostname.split(".").map(Number);
    if (a === 10) {
      return true;
    }
    if (a === 192 && b === 168) {
      return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }
  }
  return false;
}

function isInternalHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return (
    INTERNAL_HOSTNAMES.has(normalized) ||
    normalized.endsWith(".internal") ||
    normalized.endsWith(".local") ||
    isPrivateIp(normalized)
  );
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.document !== "undefined";
}

function joinWithOrigin(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, window.location.origin).toString();
}

/**
 * Resolves a URL so that browser clients use a public origin even when internal hosts
 * (gateway, localhost, private subnets) are configured via environment variables.
 * Server-side callers receive the original value unchanged.
 */
export function resolvePublicUrl(raw: string | undefined | null, fallbackPath?: string): string | undefined {
  const trimmed = raw?.trim();

  if (!isBrowser()) {
    return trimmed || fallbackPath;
  }

  if (!trimmed) {
    return fallbackPath ? joinWithOrigin(fallbackPath) : undefined;
  }

  try {
    const parsed = new URL(trimmed);
    if (isInternalHostname(parsed.hostname)) {
      const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      return joinWithOrigin(path || "/");
    }
    return parsed.toString();
  } catch {
    if (trimmed.startsWith("/")) {
      return joinWithOrigin(trimmed);
    }
    return trimmed;
  }
}
