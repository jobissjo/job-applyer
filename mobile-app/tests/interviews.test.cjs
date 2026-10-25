const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadTracking(root = '../src/services/interviews.ts') {
  const calls = [];
  const api = Object.fromEntries(['get', 'patch', 'post', 'put'].map(method => [method, async (url, body) => {
    calls.push({ method, url, body }); return { data: { application: {}, rounds: [], history: [] } };
  }]));
  const compiled = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, root), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: () => ({ api }), Date });
  return { ...module.exports, calls };
}

for (const [client, source] of [['mobile', '../src/services/interviews.ts'], ['web', '../../frontend/src/services/interviews.ts']]) {
  test(`${client}: appointments need an explicit update; filters distinguish upcoming and awaiting results`, () => {
    const s = loadTracking(source);
    const now = Date.parse('2026-10-25T12:00:00Z');
    const past = { status: 'scheduled', scheduled_at: '2026-10-24T12:00:00Z' };
    const tomorrow = { name: 'Technical', status: 'scheduled', scheduled_at: '2026-10-26T12:00:00Z' };
    const later = { name: 'Final', status: 'scheduled', scheduled_at: '2026-10-28T12:00:00Z' };
    const completed = { status: 'completed', result: 'awaiting_result' };
    const item = { application: { hiring_progress: 'interviewing' }, rounds: [later, past, tomorrow, completed] };
    assert.equal(s.roundNeedsUpdate(past, now), true);
    assert.equal(past.status, 'scheduled');
    assert.equal(s.roundNeedsUpdate({ ...past, status: 'missed' }, now), false);
    assert.equal(s.roundNeedsUpdate(tomorrow, now), false);
    assert.equal(s.nextInterview(item.rounds, now).name, 'Technical');
    for (const filter of ['all', 'interviewing', 'upcoming', 'needs_update', 'awaiting_result']) assert.equal(s.matchesTracking(item, filter, now), true);
    assert.equal(s.matchesTracking(item, 'selected', now), false);
    assert.equal(s.matchesTracking({ application: { hiring_progress: 'selected' }, rounds: [] }, 'selected', now), true);
  });

  test(`${client}: local interview dates round-trip in UTC and invalid dates are rejected`, () => {
    const s = loadTracking(source);
    assert.equal(s.interviewISO(''), null);
    assert.equal(s.utcDate('2026-10-25T12:00:00').toISOString(), '2026-10-25T12:00:00.000Z');
    assert.equal(s.utcDate('2026-10-25T17:30:00+05:30').toISOString(), '2026-10-25T12:00:00.000Z');
    assert.equal(s.localInterviewDate(s.interviewISO('2026-10-25T17:30')), '2026-10-25T17:30');
    for (const invalid of ['invalid', '2026-02-30T12:30', '2026-10-25', '2026-10-25T25:00']) assert.throws(() => s.interviewISO(invalid));
  });

  test(`${client}: tracking requests preserve all reflection fields and use dedicated endpoints`, async () => {
    const s = loadTracking(source);
    const round = { ...s.emptyRound, name: 'Technical', went_wrong: 'Missed SQL question', reflection: 'Good discussion', feedback: 'Practice joins', improvements: 'Build SQL examples' };
    await s.interviewsApi.list();
    await s.interviewsApi.get(7);
    await s.interviewsApi.progress(7, 'selected');
    await s.interviewsApi.saveRound(7, round);
    await s.interviewsApi.saveRound(7, round, 9);
    assert.deepEqual(s.calls.map(c => [c.method, c.url]), [
      ['get', '/interviews'], ['get', '/applications/7/interviews'], ['patch', '/applications/7/hiring-progress'],
      ['post', '/applications/7/interviews'], ['put', '/applications/7/interviews/9'],
    ]);
    assert.equal(s.calls[3].body.went_wrong, round.went_wrong);
    assert.equal(s.calls[4].body.feedback, round.feedback);
    assert.equal(s.calls[2].body.progress, 'selected');
  });
}

test('mobile interview screen renders saved reflections and needs-update notice without raw text children', () => {
  const React = require('react');
  const native = require('react-native-web');
  const { renderToStaticMarkup } = require('react-dom/server');
  const tracking = loadTracking();
  const data = { application: { hiring_progress: 'interviewing' }, history: [], rounds: [{
    ...tracking.emptyRound, id: 1, name: 'Technical', status: 'scheduled', scheduled_at: '2020-01-01T10:00:00Z',
    reflection: 'Explained my project clearly', went_wrong: 'Missed indexing question',
    feedback: 'Practice SQL', improvements: 'Explain tradeoffs',
  }] };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const module = { exports: {} }; cache.set(file, module);
    vm.runInNewContext(compiled, { module, exports: module.exports, require: name => {
      if (name === 'react-native') return native;
      if (name === 'expo-router') return { router: {} };
      if (name === '@/components/ui') return load('components/ui.tsx');
      if (name === '@/hooks/use-resource') return { useResource: () => ({ data }), useAction: () => ({ busy: false }) };
      if (name === '@/services/interviews') return tracking;
      if (name === '@/services/scheduling') return load('services/scheduling.ts');
      if (name === '@/services/api' || name === '@/screens/preparation') return {};
      return require(name);
    } });
    return module.exports;
  }
  const Panel = load('screens/interviews.tsx').InterviewTrackingPanel;
  const messages = [];
  const original = console.error;
  let html;
  try {
    console.error = (...args) => messages.push(args.join(' '));
    html = renderToStaticMarkup(React.createElement(Panel, { applicationId: 7 }));
  } finally { console.error = original; }
  assert.deepEqual(messages.filter(m => m.includes('Unexpected text node')), []);
  for (const text of ['Explained my project clearly', 'Missed indexing question', 'Practice SQL', 'Explain tradeoffs', 'Needs update']) assert.ok(html.includes(text), text);
});
