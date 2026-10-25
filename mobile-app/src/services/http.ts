export function normalizeBaseUrl(value: string) {
  const base = value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base))
    throw new Error("The API URL must start with https:// or http://");
  return base.endsWith("/api") ? base : `${base}/api`;
}

export const API_BASE_URL = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_API_URL || "https://api.apply-pilot.jotech.in",
);

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function errorDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((item) => {
        const field = item.loc
          ?.filter((part: string) => part !== "body")
          .join(".");
        return typeof item === "string"
          ? item
          : `${field ? field + ": " : ""}${item.msg || "Invalid value"}`;
      })
      .join("\n");
  return detail
    ? JSON.stringify(detail)
    : "The request failed. Please try again.";
}

let token: string | null = null;
let onExpired: (() => void) | undefined;
export const setAuthToken = (value: string | null) => {
  token = value;
};
export const getAuthToken = () => token;
export const setSessionExpiredHandler = (handler?: () => void) => {
  onExpired = handler;
};

type Options = {
  params?: Record<string, unknown>;
  responseType?: "blob";
};

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: Options = {},
): Promise<{ data: T }> {
  const query = new URLSearchParams();
  Object.entries(options.params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "")
      query.set(key, String(value));
  });
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    method === "GET" ? 30000 : 240000,
  );
  const requestToken = token;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  try {
    const response = await fetch(
      `${API_BASE_URL}${path}${query.size ? "?" + query : ""}`,
      {
        method,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(body !== undefined && !isForm
            ? { "Content-Type": "application/json" }
            : {}),
          ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}),
        },
        body:
          body === undefined
            ? undefined
            : isForm
              ? (body as FormData)
              : JSON.stringify(body),
      },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      if (response.status === 401 && requestToken && requestToken === token)
        onExpired?.();
      throw new ApiError(
        payload?.detail
          ? errorDetail(payload.detail)
          : `Request failed (${response.status})`,
        response.status,
      );
    }
    if (response.status === 204) return { data: undefined as T };
    return {
      data:
        options.responseType === "blob"
          ? ((await response.blob()) as T)
          : ((await response.json()) as T),
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "The request timed out. Refresh the saved records before retrying a send or submission.",
      );
    }
    throw new Error(
      "Could not reach ApplyPilot. Check your internet connection and try again.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  get: <T>(path: string, options?: Options) =>
    request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: Options) =>
    request<T>("POST", path, body, options),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T = void>(path: string) => request<T>("DELETE", path),
};

export function formatApiError(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  return error instanceof Error ? error.message : fallback;
}
