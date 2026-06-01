/**
 * Typed API client with:
 *  - Bearer token injection
 *  - Automatic refresh-on-401 (single retry)
 *  - RFC 7807 problem+json error parsing
 */

import { useAuthStore } from "@/stores/authStore";

const BASE = "/api/v1";

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail: string;
  errors?: Array<{ field: string; message: string }>;
}

export class ApiError extends Error {
  constructor(public problem: Problem) {
    super(problem.detail);
    this.name = "ApiError";
  }
}

function formatValidationLocation(loc: unknown): string {
  if (!Array.isArray(loc)) return "";
  return loc.filter((part) => part !== "body").join(".");
}

function formatErrorDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const msg = typeof record.msg === "string" ? record.msg : "Dato inválido";
          const location = formatValidationLocation(record.loc);
          return location ? `${location}: ${msg}` : msg;
        }
        return "Dato inválido";
      })
      .join("\n");
  }

  return "Ocurrió un error inesperado.";
}

function normalizeProblem(raw: unknown, status: number, fallbackDetail: string): Problem {
  if (!raw || typeof raw !== "object") {
    return { type: "http_error", title: "Error", status, detail: fallbackDetail };
  }

  const record = raw as Record<string, unknown>;
  const detail = formatErrorDetail(record.detail ?? fallbackDetail);

  return {
    type: typeof record.type === "string" ? record.type : "http_error",
    title: typeof record.title === "string" ? record.title : "Error",
    status: typeof record.status === "number" ? record.status : status,
    detail,
    errors: Array.isArray(record.errors) ? (record.errors as Problem["errors"]) : undefined,
  };
}

async function refreshTokens(): Promise<boolean> {
  const { tokens, setTokens, logout } = useAuthStore.getState();
  if (!tokens?.refreshToken) {
    logout();
    return false;
  }
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    if (!res.ok) {
      logout();
      return false;
    }
    const data = await res.json();
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return true;
  } catch {
    logout();
    return false;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const { tokens } = useAuthStore.getState();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (tokens?.accessToken) {
    headers["Authorization"] = `Bearer ${tokens.accessToken}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401 && retry) {
    const ok = await refreshTokens();
    if (ok) return request<T>(path, init, false);
  }

  if (!res.ok) {
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("problem+json") || contentType.includes("application/json")) {
      const problem = normalizeProblem(await res.json(), res.status, res.statusText);
      throw new ApiError(problem);
    }
    throw new ApiError({ type: "http_error", title: "Error", status: res.status, detail: res.statusText });
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body != null ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
};
