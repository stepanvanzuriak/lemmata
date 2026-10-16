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

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY);

  if (token) {
    config.headers.set("x-lemmata-token", token);
  }

  return config;
});

api.interceptors.response.use(undefined, (error: unknown) => {
  if (isAxiosError<{ error?: string }>(error) && error.response) {
    const { status, data } = error.response;

    throw new ApiError(status, data?.error ?? `Request failed: ${status}`);
  }

  throw error;
});
