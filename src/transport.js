import { ProxyAgent, fetch } from "undici";
import { normalizeProxyUrl, DEFAULT_PROXY_URL } from "./url.js";

/** A private connection pool. Only explicit callers use it. */
export class ScopedHttpProxy {
  constructor(readUrl = () => DEFAULT_PROXY_URL) {
    this.readUrl = readUrl;
    this.agents = new Set();
    this.active = undefined;
    this.closed = false;
  }

  agent() {
    if (this.closed) throw new Error("Scoped HTTP proxy has been disposed");
    const url = normalizeProxyUrl(this.readUrl());
    if (this.active?.url === url) return this.active.agent;
    const agent = new ProxyAgent(url);
    this.agents.add(agent);
    const old = this.active;
    this.active = { url, agent };
    if (old) {
      // Drain existing responses; changing settings must not cancel in-flight work.
      old.agent.close().then(
        () => this.agents.delete(old.agent),
        () => {},
      );
    }
    return agent;
  }

  async fetch(input, options = {}) {
    const url = new URL(input);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      throw new TypeError(
        "Only HTTP(S) target URLs without embedded credentials are supported",
      );
    }
    return fetch(url, {
      ...options,
      redirect: "manual",
      dispatcher: this.agent(),
    });
  }

  async dispose() {
    this.closed = true;
    await Promise.all([...this.agents].map((agent) => agent.destroy()));
    this.agents.clear();
    this.active = undefined;
  }
}
