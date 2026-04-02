const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

export function assetUrl(path: string) {
  if (!path) {
    return path;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (!path.startsWith("/")) {
    return `${basePath}/${path}`;
  }

  if (basePath && path.startsWith(`${basePath}/`)) {
    return path;
  }

  return `${basePath}${path}`;
}