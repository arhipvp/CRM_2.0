import type { AxiosResponseHeaders } from 'axios';

type HeadersLike = AxiosResponseHeaders | Record<string, unknown> | undefined;

const JSON_CONTENT_TYPES = ['application/json', '+json'];

export interface ResponseTransformContext {
  headers: Record<string, unknown>;
  status: number;
}

export type ResponseTransformer = (value: unknown, context: ResponseTransformContext) => unknown;

const camelCaseCache = new Map<string, string>();

const hasOwnProperty = Object.prototype.hasOwnProperty;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null) {
    return false;
  }

  if (Array.isArray(value)) {
    return false;
  }

  return Object.prototype.toString.call(value) === '[object Object]';
};

const isJsonLikeContentType = (headers: HeadersLike): boolean => {
  if (!headers) {
    return false;
  }

  const entries: Array<[string, unknown]> = [];

  if (typeof (headers as AxiosResponseHeaders)?.toJSON === 'function') {
    const json = (headers as AxiosResponseHeaders).toJSON() as Record<string, unknown>;
    entries.push(...Object.entries(json));
  } else {
    entries.push(...Object.entries(headers as Record<string, unknown>));
  }

  const contentTypeEntry = entries.find(([key]) => key.toLowerCase() === 'content-type');

  if (!contentTypeEntry) {
    return false;
  }

  const [, value] = contentTypeEntry;
  if (!value) {
    return false;
  }

  const normalized = Array.isArray(value) ? value.join(';') : String(value);
  const lowerCased = normalized.toLowerCase();
  return JSON_CONTENT_TYPES.some((marker) => lowerCased.includes(marker));
};

const toCamelCase = (value: string): string => {
  if (!value.includes('_') && !value.includes('-')) {
    return value;
  }

  const cached = camelCaseCache.get(value);
  if (cached) {
    return cached;
  }

  const segments = value
    .split(/[_-]+/g)
    .filter((segment) => segment.length > 0)
    .map((segment, index) => {
      if (index === 0) {
        return segment.toLowerCase();
      }

      return segment.charAt(0).toUpperCase() + segment.slice(1);
    });

  const camelCased = segments.join('');
  camelCaseCache.set(value, camelCased);
  return camelCased;
};

const transformValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => transformValue(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const result: Record<string, unknown> = {};

  for (const [key, nested] of Object.entries(value)) {
    const targetKey = hasOwnProperty.call(value, key) ? toCamelCase(key) : key;
    result[targetKey] = transformValue(nested);
  }

  return result;
};

export const camelCaseKeysTransformer: ResponseTransformer = (value) => transformValue(value);

export const shouldTransformJson = (headers: HeadersLike, data: unknown): boolean => {
  if (Array.isArray(data) || isPlainObject(data)) {
    return true;
  }

  return isJsonLikeContentType(headers);
};
