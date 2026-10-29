import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import React from "react";
import Renderer, { act } from "react-test-renderer";
function SettingsForm(props) {
  return React.createElement("section", null, props.children);
}
function SettingsValueField() {
  return null;
}
let client;
vm.runInNewContext(
  await readFile(new URL("../lib/client.js", import.meta.url), "utf8"),
  {
    URL,
    window: {
      __ModuleLoader__: {
        load({ factory }) {
          client = factory((name) =>
            name === "react" ? React : { SettingsForm, SettingsValueField },
          );
        },
      },
    },
  },
);
function fixture() {
  let snapshot = {
    status: "ready",
    writable: true,
    revision: 4,
    value: { proxyUrl: "http://127.0.0.1:7897/" },
  };
  const listeners = new Set(),
    writes = [];
  const form = {
    getSnapshot: () => snapshot,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async mutate(ops, revision) {
      writes.push({ ops, revision });
      snapshot = {
        ...snapshot,
        revision: 5,
        value: { proxyUrl: ops[0].value },
      };
      listeners.forEach((fn) => fn());
      return true;
    },
  };
  let render;
  act(() => {
    render = Renderer.create(
      React.createElement(client.ProxySettings, { form, t: (key) => key }),
    );
  });
  return {
    form,
    writes,
    render,
    field: () => render.root.findByType(SettingsValueField).props,
    shell: () => render.root.findByType(SettingsForm).props,
  };
}

test("settings save normalized custom address with captured revision", async () => {
  const f = fixture();
  act(() => f.field().onEdit("http://localhost:8080"));
  assert.equal(f.shell().state.dirty, true);
  await act(() => f.shell().onSave());
  assert.equal(f.writes[0].ops[0].value, "http://localhost:8080/");
  assert.equal(f.writes[0].revision, 4);
  assert.equal(f.shell().state.dirty, false);
  act(() => f.render.unmount());
});
test("invalid settings cannot be saved and reset stages a valid default", async () => {
  const f = fixture();
  act(() => f.field().onEdit("socks5://localhost:1080"));
  assert.equal(f.field().invalid, true);
  await act(() => f.shell().onSave());
  assert.equal(f.writes.length, 0);
  act(() => f.field().onReset());
  assert.equal(f.field().invalid, false);
  act(() => f.render.unmount());
});
test("failed write leaves editable draft and reports failure", async () => {
  const f = fixture();
  f.form.mutate = async () => false;
  act(() => f.field().onEdit("http://localhost:8080"));
  await act(() => f.shell().onSave());
  assert.equal(f.shell().state.failed, true);
  assert.equal(f.field().text, "http://localhost:8080");
  act(() => f.render.unmount());
});
