const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

// Exercise the actual TypeScript transport without loading a native runtime.
function harness(responder = () => Response.json({ skills: [] })) {
  const calls = [];
  const modules = new Map();
  function load(name) {
    if (modules.has(name)) return modules.get(name).exports;
    const source = fs.readFileSync(
      path.join(__dirname, "../src/services", name + ".ts"),
      "utf8",
    );
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const module = { exports: {} };
    modules.set(name, module);
    vm.runInNewContext(
      compiled,
      {
        module,
        exports: module.exports,
        require: (specifier) => load(specifier.replace("./", "")),
        process: { env: {} },
        URLSearchParams,
        FormData,
        AbortController,
        setTimeout,
        clearTimeout,
        fetch: async (url, options) => {
          calls.push({ url, ...options });
          return responder(url, options);
        },
      },
      { filename: name + ".ts" },
    );
    return module.exports;
  }
  return { http: load("http"), services: load("api"), scheduling: load("scheduling"), calls };
}

test("scheduled times use local input, reject invalid dates and serialize UTC", () => {
  const { scheduling } = harness();
  const year = new Date().getFullYear() + 2;
  const result = scheduling.scheduleISO(`${year}-06-15 14:30`);
  assert.equal(result, new Date(year, 5, 15, 14, 30).toISOString());
  assert.throws(() => scheduling.scheduleISO(`${year}-02-30 14:30`));
  assert.throws(() => scheduling.scheduleISO(`${year}-06-15 25:00`));
  assert.throws(() => scheduling.scheduleISO("2000-01-01 10:00"));
  assert.throws(() => scheduling.scheduleISO("15/06/2030 14:30"));
  assert.equal(scheduling.localDate(new Date(year, 5, 15, 0, 10)), `${year}-06-15`);
});

test("a late 401 from an old token does not clear a newer session", async () => {
  let release;
  const { http, services } = harness(() => new Promise(resolve => { release = resolve; }));
  let expired = 0;
  http.setSessionExpiredHandler(() => expired++);
  http.setAuthToken("old-token");
  const pending = services.authApi.getMe();
  http.setAuthToken("new-token");
  release(Response.json({ detail: "Expired" }, { status: 401 }));
  await assert.rejects(pending, /Expired/);
  assert.equal(expired, 0);
  assert.equal(http.getAuthToken(), "new-token");
});

test("production URL normalizes the host and /api exactly once", () => {
  const { http } = harness();
  assert.equal(http.API_BASE_URL, "https://api.apply-pilot.jotech.in/api");
  assert.equal(
    http.normalizeBaseUrl("https://example.com/api/"),
    "https://example.com/api",
  );
  assert.equal(
    http.normalizeBaseUrl("https://example.com/"),
    "https://example.com/api",
  );
  assert.throws(() => http.normalizeBaseUrl("example.com"));
});
test("JWT, query encoding, JSON bodies and multipart uploads", async () => {
  const { http, services, calls } = harness();
  http.setAuthToken("example-token");
  await services.jobsApi.list({ query: "C++ & React", page: 2 });
  assert.equal(new URL(calls[0].url).searchParams.get("query"), "C++ & React");
  assert.equal(calls[0].headers.Authorization, "Bearer example-token");
  assert.equal(calls[0].headers["Content-Type"], undefined);
  await services.authApi.login("user@example.com", "password");
  assert.deepEqual(JSON.parse(calls[1].body), {
    email: "user@example.com",
    password: "password",
  });
  const form = new FormData();
  form.set("title", "Resume");
  await services.resumesApi.upload(form);
  assert.equal(calls[2].body, form);
  assert.equal(calls[2].headers["Content-Type"], undefined);
});
test("401 expires authenticated sessions, but login errors do not", async () => {
  const { http, services } = harness(() =>
    Response.json({ detail: "Session expired" }, { status: 401 }),
  );
  let expired = 0;
  http.setSessionExpiredHandler(() => expired++);
  await assert.rejects(
    services.authApi.login("user@example.com", "wrong"),
    /Session expired/,
  );
  assert.equal(expired, 0);
  http.setAuthToken("expired");
  await assert.rejects(services.authApi.getMe(), /Session expired/);
  assert.equal(expired, 1);
});
test("validation errors retain field names, failed sends are never automatically retried", async () => {
  const { services, calls } = harness(() =>
    Response.json(
      { detail: [{ loc: ["body", "email"], msg: "Invalid email" }] },
      { status: 422 },
    ),
  );
  await assert.rejects(
    services.applicationsApi.send(1),
    /email: Invalid email/,
  );
  assert.equal(calls.length, 1);
});
test("handles 204, binary downloads and offline failures", async () => {
  const empty = harness(() => new Response(null, { status: 204 }));
  await empty.services.jobTitlesApi.delete(1);
  const binary = harness(() => new Response("PDF"));
  assert.equal(
    await (await binary.services.resumesApi.download(1)).text(),
    "PDF",
  );
  const offline = harness(() => {
    throw new TypeError("Network error");
  });
  await assert.rejects(offline.services.jobsApi.list(), /internet connection/);
});
test("every mobile service request matches the deployed API method, path and required body fields", async () => {
  const schema = JSON.parse(
    fs
      .readFileSync(path.join(__dirname, "backend-openapi.json"), "utf8")
      .replace(/^\uFEFF/, ""),
  );
  const { services: s, calls } = harness();
  const id = 17;
  const uuid = "9ae25735-6bad-497e-9f70-c537a598ab30";
  const form = new FormData();
  form.set("title", "Resume");
  form.set("file", new Blob(["PDF"]), "resume.pdf");
  const actions = [
    () => s.authApi.login("a@example.com", "password"),
    () => s.authApi.register("a@example.com", "password"),
    () => s.authApi.getMe(),
    () => s.profileApi.getProfile(),
    () => s.profileApi.updateProfile({ name: "Candidate" }),
    () => s.jobTitlesApi.list(),
    () => s.jobTitlesApi.create("Developer"),
    () => s.jobTitlesApi.update(id, { active: false }),
    () => s.jobTitlesApi.delete(id),
    () => s.resumesApi.list(),
    () => s.resumesApi.upload(form),
    () => s.resumesApi.update(id, { job_title_ids: [1] }),
    () => s.resumesApi.delete(id),
    () => s.resumesApi.download(id),
    () => s.jobsApi.list(),
    () => s.jobsApi.get(id),
    () => s.jobsApi.analyze(id),
    () => s.jobsApi.generateCoverLetter(id),
    () => s.jobsApi.delete(id),
    () =>
      s.jobsApi.createManual({
        request_id: uuid,
        role: "Developer",
        email: "hr@example.com",
        description: "Role details",
      }),
    () => s.llmApi.list(),
    () =>
      s.llmApi.create({
        provider: "groq",
        model: "model",
        api_key: "key",
        priority: 1,
        active: true,
        enabled: true,
      }),
    () => s.llmApi.update(id, { enabled: false }),
    () => s.llmApi.test(id),
    () => s.llmApi.delete(id),
    () => s.hrContactsApi.list(),
    () => s.hrContactsApi.listRequiredJobs(),
    () => s.hrContactsApi.create({ job_id: id, email: "hr@example.com" }),
    () => s.hrContactsApi.delete(id),
    () => s.emailApi.getSettings(),
    () => s.emailApi.updateSettings({ smtp_host: "smtp.example.com" }),
    () => s.emailApi.testConnection(),
    () => s.applicationsApi.list("ready"),
    () => s.applicationsApi.get(id),
    () => s.applicationsApi.create({ job_id: id }),
    () =>
      s.applicationsApi.update(id, {
        resume_id: null,
        cover_letter_content: "Letter",
      }),
    () => s.applicationsApi.preview(id),
    () => s.applicationsApi.schedule(id, "2030-01-01T09:00:00Z"),
    () => s.applicationsApi.cancelSchedule(id),
    () => s.applicationsApi.send(id),
    () => s.applicationsApi.getDashboardStats(),
    () =>
      s.applicationsApi.recordExternal({
        request_id: uuid,
        role: "Developer",
        company: "Example",
        applied_on: "2026-10-17",
        application_method: "Referral",
      }),
    () => s.autoApplyApi.run({ source: "infopark", search_query: "React" }),
    () => s.followUpsApi.list(id),
    () =>
      s.followUpsApi.send(id, {
        request_id: uuid,
        subject: "Follow-up",
        body: "Hello",
        attach_resume: false,
      }),
    () => s.followUpsApi.cancel(id, 3),
    () => s.learningApi.list(),
    () => s.learningApi.create("React", [id]),
    () => s.learningApi.update(id, "completed"),
    () => s.learningApi.delete(id),
    () => s.learningApi.unlink(id, 3),
    () => s.learningApi.gaps(id, 3),
    () =>
      s.learningApi.saveEntry(id, {
        kind: "note",
        content: "Notes",
        url: null,
      }),
    () =>
      s.learningApi.saveEntry(
        id,
        { kind: "resource", content: "Docs", url: "https://example.com" },
        3,
      ),
    () => s.learningApi.deleteEntry(id, 3),
    () => s.interviewPreparationApi.get(id),
    () =>
      s.interviewPreparationApi.generate(id, { resume_id: null, context: "" }),
    () => s.interviewPreparationApi.setCompleted(id, 3, uuid, true),
  ];
  for (const action of actions) await action();
  assert.equal(calls.length, actions.length);
  for (const call of calls) {
    const pathname = new URL(call.url).pathname;
    const route = Object.keys(schema.paths).find((route) =>
      new RegExp("^" + route.replace(/\{[^}]+\}/g, "[^/]+") + "$").test(
        pathname,
      ),
    );
    assert.ok(route, `Unknown route: ${pathname}`);
    const operation = schema.paths[route][call.method.toLowerCase()];
    assert.ok(operation, `${call.method} ${route} is unsupported`);
    const content = operation.requestBody?.content;
    if (!content) continue;
    const type =
      call.body instanceof FormData
        ? "multipart/form-data"
        : "application/json";
    const inputSchema = content[type]?.schema;
    assert.ok(inputSchema, `Wrong content type for ${route}`);
    const bodySchema = inputSchema.$ref
      ? schema.components.schemas[inputSchema.$ref.split("/").pop()]
      : inputSchema;
    const body =
      call.body instanceof FormData
        ? Object.fromEntries(call.body)
        : JSON.parse(call.body || "{}");
    for (const key of bodySchema.required || [])
      assert.ok(key in body, `${call.method} ${route} is missing ${key}`);
  }
});
