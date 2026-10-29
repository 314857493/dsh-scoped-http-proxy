import React from "react";
import {
  SettingsForm,
  SettingsValueField,
} from "@deepseek-ai/dsh-client-ui-primitives";
import { normalizeProxyUrl, DEFAULT_PROXY_URL } from "./url.js";

const NS = "settings.scopedHttpProxy";
const dictionaries = {
  zh: {
    title: "独立 HTTP 代理",
    description: "仅供主动调用此服务的插件使用，不修改系统或 DSH 全局代理。",
    address: "代理地址与端口",
    hint: "例如 http://127.0.0.1:7897。保存后后续请求使用新地址，正在进行的请求不受影响。",
    invalid:
      "请输入有效的 HTTP(S) 代理地址，包含端口；不支持账号密码、路径或 SOCKS。",
    save: "保存",
    saving: "保存中…",
    saved: "已保存",
    saveFailed: "保存失败，或设置已被其他窗口修改。请确认当前值后重试。",
    unavailable: "正在读取代理配置…",
    readOnly: "当前配置为只读。",
    overridden: "已自定义",
    reset: "恢复默认",
  },
  en: {
    title: "Scoped HTTP proxy",
    description:
      "Used only by plugins that call this service. System and global DSH proxy settings are unchanged.",
    address: "Proxy address and port",
    hint: "For example http://127.0.0.1:7897. Saved changes apply to subsequent requests; in-flight requests continue.",
    invalid:
      "Enter an HTTP(S) proxy URL with a port. Credentials, paths and SOCKS are not supported.",
    save: "Save",
    saving: "Saving…",
    saved: "Saved",
    saveFailed:
      "Save failed or settings changed in another window. Review the current value and retry.",
    unavailable: "Loading proxy settings…",
    readOnly: "These settings are read-only.",
    overridden: "Customized",
    reset: "Reset to default",
  },
};

export function ProxySettings({ form, t, view }) {
  const state = React.useSyncExternalStore(
    (listener) => form.subscribe(listener),
    () => form.getSnapshot(),
  );
  const current = state.value?.proxyUrl ?? DEFAULT_PROXY_URL;
  const [draft, setDraft] = React.useState(null);
  const [revision, setRevision] = React.useState();
  const [saving, setSaving] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const text = draft ?? current;
  let invalid = false;
  try {
    normalizeProxyUrl(text);
  } catch {
    invalid = true;
  }
  const dirty = draft !== null && text !== current;
  const available = state.status === "ready";
  const disabled = !available || !state.writable || saving;
  function edit(value) {
    if (draft === null) setRevision(state.revision);
    setDraft(value);
    setFailed(false);
    setSaved(false);
  }
  async function save() {
    if (disabled || invalid || !dirty) return;
    setSaving(true);
    setFailed(false);
    setSaved(false);
    try {
      const ok = await form.mutate(
        [{ op: "set", path: ["proxyUrl"], value: normalizeProxyUrl(text) }],
        revision,
      );
      if (ok) {
        setDraft(null);
        setSaved(true);
      } else {
        setFailed(true);
        setRevision(form.getSnapshot().revision);
      }
    } catch {
      setFailed(true);
      setRevision(form.getSnapshot().revision);
    } finally {
      setSaving(false);
    }
  }
  if (view === "summary") return t("description");
  return React.createElement(
    SettingsForm,
    {
      labels: Object.fromEntries(
        ["save", "saving", "saveFailed", "unavailable", "readOnly"].map(
          (key) => [key, t(key)],
        ),
      ),
      state: {
        available,
        writable: state.writable,
        dirty: dirty && state.writable,
        invalid,
        saving,
        failed,
      },
      onSave: save,
      onDiscard: () => {},
    },
    React.createElement(SettingsValueField, {
      id: "scoped-http-proxy-url",
      label: t("address"),
      hint: t("hint"),
      text,
      invalid,
      disabled,
      invalidLabel: t("invalid"),
      placeholder: DEFAULT_PROXY_URL,
      overridden: invalid || normalizeProxyUrl(text) !== DEFAULT_PROXY_URL,
      overriddenLabel: t("overridden"),
      resetLabel: t("reset"),
      onEdit: edit,
      onReset: () => edit(DEFAULT_PROXY_URL),
    }),
    saved ? React.createElement("p", { role: "status" }, t("saved")) : null,
  );
}

export const inject = ["slots", "locale", "configForms"];
export function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, dictionaries));
  const form = ctx.configForms.get("scoped-http-proxy");
  ctx.effect(() =>
    ctx.configForms.whileServed(["scoped-http-proxy"], () =>
      ctx.slots.inject("plugins.item", () =>
        ctx.slots.register(
          {
            name: "plugins.item",
            id: "scoped-http-proxy",
            order: 25,
            label: () => ctx.locale.bind(NS)("title"),
            locale: NS,
          },
          (props) => React.createElement(ProxySettings, { ...props, form }),
        ),
      ),
    ),
  );
}
