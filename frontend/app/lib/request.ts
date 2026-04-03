type CacheEntry = {
  expiresAt: number;
  data: unknown;
};

interface RequestJsonOptions {
  retries?: number;
  cacheTtlMs?: number;
  dedupeKey?: string;
}

const inflightGetRequests = new Map<string, Promise<unknown>>();
const responseCache = new Map<string, CacheEntry>();

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function buildRequestKey(url: string, init?: RequestInit, explicitKey?: string) {
  if (explicitKey) return explicitKey;

  const method = init?.method || "GET";
  const credentials = init?.credentials || "same-origin";

  return `${method}:${url}:${credentials}`;
}

export function invalidateRequestCache(match?: string | RegExp | ((key: string) => boolean)) {
  if (!match) {
    responseCache.clear();
    return;
  }

  for (const key of responseCache.keys()) {
    const matched = typeof match === "string"
      ? key.includes(match)
      : match instanceof RegExp
        ? match.test(key)
        : match(key);

    if (matched) {
      responseCache.delete(key);
    }
  }
}

export async function requestJson<T>(url: string, init?: RequestInit, options: RequestJsonOptions = {}): Promise<T> {
  const method = init?.method || "GET";
  const retries = options.retries ?? (method === "GET" ? 2 : 0);
  const cacheKey = buildRequestKey(url, init, options.dedupeKey);
  const cacheTtlMs = options.cacheTtlMs ?? 0;

  if (method === "GET") {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cloneValue(cached.data as T);
    }

    const inflight = inflightGetRequests.get(cacheKey);
    if (inflight) {
      return cloneValue(await inflight as T);
    }
  }

  const executeRequest = async () => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const response = await fetch(url, {
          ...init,
          credentials: init?.credentials ?? "include",
        });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          const message = data?.error || data?.message || "Request failed";
          const error = new Error(message) as Error & { status?: number };
          error.status = response.status;

          if (response.status >= 500 && attempt < retries) {
            lastError = error;
            continue;
          }

          throw error;
        }

        if (method === "GET" && cacheTtlMs > 0) {
          responseCache.set(cacheKey, {
            expiresAt: Date.now() + cacheTtlMs,
            data,
          });
        }

        return data as T;
      } catch (error) {
        lastError = error;

        if (attempt >= retries) {
          throw lastError;
        }
      }
    }

    throw lastError;
  };

  if (method !== "GET") {
    return executeRequest();
  }

  const promise = executeRequest();
  inflightGetRequests.set(cacheKey, promise);

  try {
    return cloneValue(await promise as T);
  } finally {
    inflightGetRequests.delete(cacheKey);
  }
}