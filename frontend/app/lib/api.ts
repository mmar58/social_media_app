const FALLBACK_API_URL = `http://localhost:5000`;
const FALLBACK_IP_URL = `http://192.168.0.2:5000`;
let baseUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || FALLBACK_API_URL;
let socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL?.trim() || baseUrl;

function removeProtocol(url: string) {
  return url.replace(/^https?:\/\//, "");
}
function stripTrailing(url: string) {
  return url.replace(/\/$/, "");
}

function isIpAddress(hostname: string) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname === "::1" || /^\[[0-9a-fA-F:]+\]$/.test(hostname);
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function resolveBaseUrl() {
  if(typeof window === 'undefined') return;
  const { protocol, hostname } = window.location;
  
  if(isLocalHost(hostname)){
    baseUrl = stripTrailing(FALLBACK_API_URL);
    socketUrl = baseUrl;
    return;
  }
  if(isIpAddress(hostname)){
    baseUrl = stripTrailing(`${protocol}//${removeProtocol(process.env.NEXT_PUBLIC_IP_URL?.trim() || FALLBACK_IP_URL)}`);
    socketUrl = baseUrl;
    return;
  }

  baseUrl = stripTrailing(protocol + "//" + removeProtocol(baseUrl));
  socketUrl = stripTrailing(protocol + "//" + removeProtocol(socketUrl));
}
resolveBaseUrl();

export const baseUrlExport = baseUrl;
export const socketBaseUrl = socketUrl;

export function apiUrl(path: string) {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
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