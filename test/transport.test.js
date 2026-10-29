import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { getGlobalDispatcher } from "undici";
import { ScopedHttpProxy } from "../src/transport.js";
import { normalizeProxyUrl } from "../src/url.js";
import { Config, apply } from "../src/index.js";
import { Context } from "@deepseek-ai/cordis";

async function proxy(t, label) {
  const server = http.createServer((req, res) => res.end(label));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  return { url: `http://127.0.0.1:${server.address().port}`, server };
}

test("proxy address validates and is exposed as a live setting", () => {
  assert.equal(Config({}).proxyUrl.get(), "http://127.0.0.1:7897/");
  assert.equal(
    normalizeProxyUrl(" http://localhost:8080 "),
    "http://localhost:8080/",
  );
  assert.equal(normalizeProxyUrl("http://[::1]:7890"), "http://[::1]:7890/");
  for (const value of [
    "bad",
    "socks5://localhost:1080",
    "http://a:b@localhost",
    "http://localhost/path",
    "http://localhost?key=1",
    "http://localhost:99999",
  ]) {
    assert.throws(() => Config({ proxyUrl: value }));
  }
});

test("only explicit requests use private proxy; address changes apply live", async (t) => {
  const a = await proxy(t, "first"),
    b = await proxy(t, "second");
  let selected = a.url;
  const transport = new ScopedHttpProxy(() => selected);
  const env = { ...process.env },
    global = getGlobalDispatcher(),
    fetch = globalThis.fetch;
  try {
    assert.equal(transport.agents.size, 0);
    assert.equal(
      await (await transport.fetch("http://example.test")).text(),
      "first",
    );
    selected = b.url;
    assert.equal(
      await (await transport.fetch("http://example.test")).text(),
      "second",
    );
    assert.equal(getGlobalDispatcher(), global);
    assert.equal(globalThis.fetch, fetch);
    assert.deepEqual({ ...process.env }, env);
  } finally {
    await transport.dispose();
  }
  assert.equal(transport.agents.size, 0);
  await assert.rejects(transport.fetch("http://example.test"), /disposed/);
});

test("switching proxy drains an in-flight response instead of cancelling it", async (t) => {
  let release;
  const a = await proxy(t, "unused"),
    b = await proxy(t, "new");
  a.server.removeAllListeners("request");
  const started = new Promise((resolve) =>
    a.server.on("request", (req, res) => {
      release = () => res.end("old completes");
      resolve();
    }),
  );
  let selected = a.url;
  const transport = new ScopedHttpProxy(() => selected);
  try {
    const old = transport.fetch("http://example.test");
    await started;
    selected = b.url;
    assert.equal(
      await (await transport.fetch("http://example.test")).text(),
      "new",
    );
    release();
    assert.equal(await (await old).text(), "old completes");
  } finally {
    await transport.dispose();
  }
});

test("manual redirects and abort signals remain caller-controlled", async (t) => {
  const a = await proxy(t, "unused");
  a.server.removeAllListeners("request");
  a.server.on("request", (req, res) =>
    res.writeHead(302, { location: "http://elsewhere.test" }).end(),
  );
  const transport = new ScopedHttpProxy(() => a.url);
  try {
    const result = await transport.fetch("http://example.test", {
      redirect: "follow",
    });
    assert.equal(result.status, 302);
    await result.body.cancel();
    await assert.rejects(
      transport.fetch("http://example.test", { signal: AbortSignal.abort() }),
    );
  } finally {
    await transport.dispose();
  }
});

test("real Cordis plugin publishes and disposes its service", async () => {
  const ctx = new Context();
  const fiber = ctx.plugin(
    { Config, apply },
    { proxyUrl: "http://127.0.0.1:7897" },
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(typeof ctx.scopedHttpProxy.fetch, "function");
  const service = ctx.scopedHttpProxy;
  await fiber.dispose();
  assert.equal(service.transport.closed, true);
});
