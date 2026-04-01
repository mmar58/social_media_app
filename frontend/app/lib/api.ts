const FALLBACK_API_URL = "http://localhost:5000";

export const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || FALLBACK_API_URL).replace(/\/$/, "");
export const socketBaseUrl = (process.env.NEXT_PUBLIC_SOCKET_URL || apiBaseUrl).replace(/\/$/, "");

export function apiUrl(path: string) {
  return `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function mediaUrl(path: string | null | undefined) {
  if (!path) {
    return null;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return apiUrl(path);
}