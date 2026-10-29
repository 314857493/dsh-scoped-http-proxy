export const DEFAULT_PROXY_URL = "http://127.0.0.1:7897/";

export function normalizeProxyUrl(value) {
  const url = new URL(value.trim());
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new TypeError(
      "Use http://host:port or https://host:port without credentials, path, query or fragment",
    );
  }
  return url.href;
}
