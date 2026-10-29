import { Service } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { ScopedHttpProxy } from "./transport.js";
import { normalizeProxyUrl, DEFAULT_PROXY_URL } from "./url.js";

export const name = "scoped-http-proxy";
export const Config = z.object({
  proxyUrl: z
    .transform(z.string(), normalizeProxyUrl)
    .default(DEFAULT_PROXY_URL)
    .description("HTTP proxy address including port / HTTP 代理地址及端口")
    .volatile(),
});

class ProxyService extends Service {
  constructor(ctx, config) {
    super(ctx, "scopedHttpProxy");
    this.transport = new ScopedHttpProxy(() => config.proxyUrl.get());
    ctx.effect(() => () => this.transport.dispose());
  }
  fetch(input, options) {
    return this.transport.fetch(input, options);
  }
}

export function apply(ctx, config) {
  new ProxyService(ctx, config);
  ctx.inject(["settings"], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });
}
