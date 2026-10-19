import axios, { isAxiosError } from "axios";

const TOKEN_KEY = "lemmata-token";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function captureToken() {
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get("token");

  if (!token) {
    return;
  }

  sessionStorage.setItem(TOKEN_KEY, token);
  params.delete("token");

  const hash = params.size ? `#${params}` : "";
  history.replaceState(
    history.state,
    "",
    `${location.pathname}${location.search}${hash}`,
  );
}

export const api = axios.create({ baseURL: "/api" });

export function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem(TOKEN_KEY);

  return token ? { "x-lemmata-token": token } : {};
}

api.interceptors.request.use((config) => {
  for (const [name, value] of Object.entries(authHeaders())) {
    config.headers.set(name, value);
  }

  return config;
});

const UNREACHABLE = "Can't reach the Lemmata daemon.";

api.interceptors.response.use(undefined, (error: unknown) => {
  if (!isAxiosError<{ error?: string }>(error)) {
    throw error;
  }

  if (!error.response) {
    throw new ApiError(0, UNREACHABLE);
  }

  const { status, data } = error.response;

  if (data?.error) {
    throw new ApiError(status, data.error);
  }

  // The dev proxy answers 502/504 when the daemon is down.
  if (status === 502 || status === 504) {
    throw new ApiError(status, UNREACHABLE);
  }

  throw new ApiError(status, `Request failed: ${status}`);
});
