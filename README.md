# dsh-scoped-http-proxy

[English](README.en.md) · MIT

为 DeepSeek Harness 插件提供一个**显式调用才生效**的 HTTP 代理服务，以及 DSH 插件设置页中的地址/端口输入框。

不修改系统代理、Clash、环境变量、全局 `fetch` 或全局 dispatcher。不扫描、包装或接管其他插件的网络请求，也不自动修复 Fake-IP。

## 安装

Node.js 22.19+；已验证 DSH Desktop 的 Cordis 4.0.5 / Web 设置接口 0.2.1-rc.4。

```sh
dsh plugin --profile web add 'git+https://github.com/314857493/dsh-scoped-http-proxy.git#v0.1.0'
```

重启 DSH，打开 **设置 → 插件 → 独立 HTTP 代理**，填写完整地址，例如 `http://127.0.0.1:7897`，点击保存。支持 HTTP(S) 代理和 IPv6 地址；不支持 SOCKS、内嵌账号密码或 URL 路径。

保存到当前 profile 的 Cordis patch。后续请求使用新地址，现有请求继续完成。默认地址为 `http://127.0.0.1:7897`。

也可以手工设置：

```yaml
- id: scoped-http-proxy
  config:
    proxyUrl: http://127.0.0.1:8080
```

地址只有被插件主动调用时才使用；装好此服务不会让模型 API、MCP、搜索或网页抓取自动走代理。

## 接入其他插件

通过 Cordis 服务协作，无需导入本包的实现：

```js
export const inject = ['scopedHttpProxy'];
export function apply(ctx) {
  // 在业务代码需要代理时调用：
  // const response = await ctx.scopedHttpProxy.fetch(url, {
  //   method: 'GET', signal, headers: { accept: 'text/html' }
  // });
}
```

`fetch` 返回标准 Response，支持调用者传入 `signal`；强制手动处理重定向，且不能通过 options 覆盖代理 dispatcher。调用者负责目标地址准入、超时、响应大小和响应体消费/取消。

[我们维护的 Fake-IP 插件](https://github.com/314857493/dsh-web-fetch-fakeip)在 0.4.0 起通过这个服务做条件回退。两者需要同时安装。

市场中的 [kaminn 插件](https://github.com/kaminn/dsh-web-fetch-fakeip) 和 [wjj-8283 插件](https://github.com/wjj-8283/dsh-web-fetch-fakeip-plugin)使用各自的 TUN 处理方式，不会自动调用本服务。仅安装本服务不会改变它们的行为。

## 卸载

```sh
dsh plugin --profile web remove dsh-scoped-http-proxy
```

先停用或移除依赖 `scopedHttpProxy` 的插件，再卸载并重启。移除用户 patch 中 `scoped-http-proxy` 的覆盖项。

## 开发与测试

```sh
npm ci --ignore-scripts
npm run build
npm run check
```

`src/client.js` 是设置界面源码，`lib/client.js` 是随包发布的 DSH 浏览器模块。修改界面后需要重建并提交产物。CI 校验两者一致。

测试包含真实本地代理、地址切换、在途请求、全局状态隔离、服务注册/释放，以及设置表单的保存、输入校验和失败提示。无需 Clash、API 密钥或外网。

## 安全边界

这是供可信插件使用的网络能力，不是面向模型开放的工具，也不承担 SSRF 过滤。仅允许 HTTP(S) 目标 URL、禁止目标内嵌凭据，其他地址策略由调用者负责。只配置你信任的代理服务器。
