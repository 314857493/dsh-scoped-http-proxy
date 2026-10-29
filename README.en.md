# dsh-scoped-http-proxy

[中文](README.md) · MIT

An opt-in HTTP proxy service and live address/port settings for DeepSeek Harness plugins. No system proxy, environment, global fetch, or global dispatcher changes.

## Install

Requires Node.js 22.19+. Tested with Cordis 4.0.5 and DSH web settings 0.2.1-rc.4.

```sh
dsh plugin --profile web add 'git+https://github.com/314857493/dsh-scoped-http-proxy.git#v0.1.0'
```

Restart DSH, then open Settings → Plugins → Scoped HTTP proxy. Enter an HTTP(S) proxy URL, including the port, and save. Default: `http://127.0.0.1:7897`. IPv6 is supported; SOCKS, credentials, paths, queries, and fragments are rejected.

Changes persist in the profile's Cordis patch. New requests use the saved address; in-flight responses drain normally. Installing this service alone does not reroute any existing plugin.

```yaml
- id: scoped-http-proxy
  config:
    proxyUrl: http://127.0.0.1:8080
```

## Plugin API

Declare `inject = ['scopedHttpProxy']`, then call `ctx.scopedHttpProxy.fetch(url, {signal, method, headers})` when proxying is intended. The method returns a Response and forces manual redirects and its own private dispatcher. Callers own destination validation, deadlines, response limits, and body consumption/cancellation. The proxy service is not an SSRF filter or a model-facing tool.

The separately maintained `314857493/dsh-web-fetch-fakeip` adapter uses this service starting with 0.4.0. Both packages must be installed. Third-party Fake-IP plugins do not automatically integrate with this service.

## Development

```sh
npm ci --ignore-scripts
npm run build
npm run check
```

Tests use local fixtures; no external proxy, API keys, or network access required. Commit the generated `lib/client.js` after editing `src/client.js`.

## Remove

Remove dependent plugins first, then run `dsh plugin --profile web remove dsh-scoped-http-proxy`, remove its custom profile override, and restart DSH.
