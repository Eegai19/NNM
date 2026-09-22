import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios";

import { STORAGE_KEYS } from "@/utils/constants";

/** Raised by the session store when the token is gone or expired. */
export const SESSION_EXPIRED_EVENT = "nnm:session-expired";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export const api: AxiosInstance = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

function readToken(): string | null {
  try {
    return (
      window.localStorage.getItem(STORAGE_KEYS.token) ??
      window.sessionStorage.getItem(STORAGE_KEYS.token)
    );
  } catch {
    return null;
  }
}

api.interceptors.request.use((config) => {
  const token = readToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // A 401 means the JWT is missing, invalid or expired: tell the app to log
    // out rather than leaving the user on a page that cannot load data.
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);

interface ApiErrorBody {
  detail?: string | { msg?: string }[];
  errors?: { field?: string; message?: string }[];
}

/** Turn any thrown value into a message that is safe to show a user. */
export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (error.code === "ECONNABORTED") return "The request timed out. Please try again.";
    if (!error.response) return "Cannot reach the server. Check your connection.";

    const detail = error.response.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail) && detail.length) {
      return detail.map((item) => item?.msg).filter(Boolean).join("; ") || fallback;
    }

    const errors = error.response.data?.errors;
    if (Array.isArray(errors) && errors.length) {
      return errors.map((item) => item.message).filter(Boolean).join("; ") || fallback;
    }

    if (error.response.status === 403) return "You do not have permission to do that.";
    if (error.response.status === 404) return "That record could not be found.";
    if (error.response.status >= 500) return "The server ran into a problem. Please try again.";
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Strip undefined/empty values so they never reach the query string. */
export function cleanParams<T extends Record<string, unknown>>(params: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  );
}

/** Download a binary response and hand it to the browser as a file. */
export async function downloadFile(
  path: string,
  filename: string,
  config?: AxiosRequestConfig,
): Promise<void> {
  const response = await api.get<Blob>(path, { ...config, responseType: "blob" });

  const disposition = response.headers["content-disposition"];
  let resolvedName = filename;
  if (typeof disposition === "string") {
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    if (match?.[1]) resolvedName = decodeURIComponent(match[1]);
  }

  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = resolvedName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
