const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const native = require("react-native-web");

function loadComponents(session = { user: null, loading: true, error: "" }) {
  const cache = new Map();
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative).exports;
    const filename = path.join(__dirname, "../src", relative);
    const source = fs.readFileSync(filename, "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    const module = { exports: {} };
    cache.set(relative, module);
    vm.runInNewContext(compiled, {
      module, exports: module.exports,
      require: (name) => {
        if (name === "react-native") return native;
        if (name === "expo-router") return { router: {} };
        if (name === "expo-status-bar") return { StatusBar: () => null };
        if (name === "react-native-safe-area-context") return { SafeAreaProvider: React.Fragment, SafeAreaView: native.View };
        if (name === "@/providers/session") return { SessionProvider: React.Fragment, useSession: () => session };
        if (name === "@/components/ui") return load("components/ui.tsx");
        if (name === "@/services/scheduling") return load("services/scheduling.ts");
        return require(name);
      },
    }, { filename });
    return module.exports;
  }
  return { ui: load("components/ui.tsx"), Layout: load("app/_layout.tsx").default };
}

function renderWithoutRawText(element) {
  const messages = [];
  const original = console.error;
  let html;
  try {
    console.error = (...args) => messages.push(args.map(String).join(" "));
    html = renderToStaticMarkup(element);
  } finally { console.error = original; }
  assert.deepEqual(messages.filter(message => message.includes("Unexpected text node")), []);
  return html;
}

test("session loading renders without an empty text child in ScrollView", () => {
  const { Layout } = loadComponents();
  assert.match(renderWithoutRawText(React.createElement(Layout)), /ApplyPilot/);
});

test("empty optional titles and feedback do not render raw text children", () => {
  const { ui } = loadComponents();
  renderWithoutRawText(React.createElement(ui.Page, { title: "Overview", subtitle: "" },
    React.createElement(ui.Card, { title: "" },
      React.createElement(ui.Feedback, { busy: false, error: "", message: "" }))));
});

test("nonempty feedback and reconnect errors still render", () => {
  const { ui, Layout } = loadComponents({ user: null, loading: false, error: "Connection unavailable" });
  const html = renderWithoutRawText(React.createElement(Layout));
  assert.match(html, /Connection unavailable/);
  assert.match(html, /Reconnect/);
  assert.match(renderWithoutRawText(React.createElement(ui.Feedback, { busy: false, error: "", message: "Saved successfully" })), /Saved successfully/);
});
