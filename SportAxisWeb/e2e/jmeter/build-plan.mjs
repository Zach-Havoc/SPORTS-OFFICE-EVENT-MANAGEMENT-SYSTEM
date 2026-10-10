/**
 * Builds the Apache JMeter test plans for the SportAxis load test.
 *
 *   node e2e/jmeter/build-plan.mjs   → sportaxis-load.jmx, sportaxis-ocr.jmx
 *
 * Both are ordinary JMeter plans (open them in the JMeter GUI to inspect).
 * Every value that changes between runs is a JMeter property with a default,
 * passed on the command line (-Jname=value) by run-jmeter.mjs:
 *
 *   host, port, protocol      the API under test
 *   users, rampup, duration   virtual users, ramp-up and run time (seconds)
 *   think                     think time between a user's requests (ms, ±500)
 *   adminToken, coachToken, judgeToken, email, password
 *   eventId, sessionId, athleteId, deptA, deptB, sheet (OCR image path)
 *
 * sportaxis-load.jmx runs one thread group per operation named in Chapter
 * III, one after the other, each for `duration` seconds at `users` users.
 * sportaxis-ocr.jmx sends a score-sheet photo to OCR extraction.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const P = (name, def) => `\${__P(${name},${def})}`;

const headers = (pairs) => `
<HeaderManager guiclass="HeaderPanel" testclass="HeaderManager" testname="Headers">
  <collectionProp name="HeaderManager.headers">
${pairs.map(([n, v]) => `    <elementProp name="" elementType="Header"><stringProp name="Header.name">${x(n)}</stringProp><stringProp name="Header.value">${x(v)}</stringProp></elementProp>`).join('\n')}
  </collectionProp>
</HeaderManager><hashTree/>`;

function sampler(label, method, url, { token, json, form, file } = {}) {
  const [p, query] = url.split('?');
  const args = [];
  if (json !== undefined) {
    args.push(`<elementProp name="" elementType="HTTPArgument"><boolProp name="HTTPArgument.always_encode">false</boolProp><stringProp name="Argument.value">${x(JSON.stringify(json))}</stringProp><stringProp name="Argument.metadata">=</stringProp></elementProp>`);
  }
  for (const [k, v] of [...(query ? query.split('&').map((kv) => kv.split('=')) : []), ...Object.entries(form ?? {})]) {
    args.push(`<elementProp name="${x(k)}" elementType="HTTPArgument"><boolProp name="HTTPArgument.always_encode">${form ? 'false' : 'true'}</boolProp><stringProp name="Argument.name">${x(k)}</stringProp><stringProp name="Argument.value">${x(v)}</stringProp><stringProp name="Argument.metadata">=</stringProp><boolProp name="HTTPArgument.use_equals">true</boolProp></elementProp>`);
  }
  const files = file
    ? `<elementProp name="HTTPsampler.Files" elementType="HTTPFileArgs"><collectionProp name="HTTPFileArgs.files"><elementProp name="${x(file.path)}" elementType="HTTPFileArg"><stringProp name="File.path">${x(file.path)}</stringProp><stringProp name="File.paramname">${x(file.param)}</stringProp><stringProp name="File.mimetype">${x(file.type)}</stringProp></elementProp></collectionProp></elementProp>`
    : '';
  const hdr = [['Accept', 'application/json']];
  if (json !== undefined) hdr.push(['Content-Type', 'application/json']);
  if (token) hdr.push(['Authorization', `Bearer ${P(`${token}Token`, '')}`]);
  return `
<HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="${x(label)}">
  <boolProp name="HTTPSampler.postBodyRaw">${json !== undefined}</boolProp>
  <elementProp name="HTTPsampler.Arguments" elementType="Arguments"><collectionProp name="Arguments.arguments">${args.join('')}</collectionProp></elementProp>
  ${files}
  <stringProp name="HTTPSampler.path">${x(p)}</stringProp>
  <stringProp name="HTTPSampler.method">${method}</stringProp>
  <boolProp name="HTTPSampler.follow_redirects">false</boolProp>
  <boolProp name="HTTPSampler.use_keepalive">true</boolProp>
  <boolProp name="HTTPSampler.DO_MULTIPART_POST">${!!file}</boolProp>
</HTTPSamplerProxy>
<hashTree>${headers(hdr)}</hashTree>`;
}

function threadGroup(name, samplers, { users = P('users', 10), rampup = P('rampup', 10), duration = P('duration', 45), loops = -1, scheduler = true } = {}) {
  return `
<ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="${x(name)}">
  <stringProp name="ThreadGroup.num_threads">${users}</stringProp>
  <stringProp name="ThreadGroup.ramp_time">${rampup}</stringProp>
  <boolProp name="ThreadGroup.scheduler">${scheduler}</boolProp>
  <stringProp name="ThreadGroup.duration">${scheduler ? duration : ''}</stringProp>
  <stringProp name="ThreadGroup.delay">0</stringProp>
  <boolProp name="ThreadGroup.same_user_on_next_iteration">true</boolProp>
  <stringProp name="ThreadGroup.on_sample_error">continue</stringProp>
  <elementProp name="ThreadGroup.main_controller" elementType="LoopController" guiclass="LoopControlPanel" testclass="LoopController">
    <stringProp name="LoopController.loops">${loops}</stringProp>
    <boolProp name="LoopController.continue_forever">false</boolProp>
  </elementProp>
</ThreadGroup>
<hashTree>
  ${samplers.join('\n')}
  <UniformRandomTimer guiclass="UniformRandomTimerGui" testclass="UniformRandomTimer" testname="Think time">
    <stringProp name="ConstantTimer.delay">${P('think', 500)}</stringProp>
    <stringProp name="RandomTimer.range">1000</stringProp>
  </UniformRandomTimer><hashTree/>
</hashTree>`;
}

function plan(name, groups) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">
<hashTree>
<TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="${x(name)}">
  <boolProp name="TestPlan.serialize_threadgroups">true</boolProp>
  <boolProp name="TestPlan.functional_mode">false</boolProp>
  <elementProp name="TestPlan.user_defined_variables" elementType="Arguments" guiclass="ArgumentsPanel" testclass="Arguments"><collectionProp name="Arguments.arguments"/></elementProp>
</TestPlan>
<hashTree>
<ConfigTestElement guiclass="HttpDefaultsGui" testclass="ConfigTestElement" testname="HTTP Request Defaults">
  <elementProp name="HTTPsampler.Arguments" elementType="Arguments"><collectionProp name="Arguments.arguments"/></elementProp>
  <stringProp name="HTTPSampler.domain">${P('host', '127.0.0.1')}</stringProp>
  <stringProp name="HTTPSampler.port">${P('port', 8001)}</stringProp>
  <stringProp name="HTTPSampler.protocol">${P('protocol', 'http')}</stringProp>
  <stringProp name="HTTPSampler.connect_timeout">10000</stringProp>
  <stringProp name="HTTPSampler.response_timeout">180000</stringProp>
</ConfigTestElement><hashTree/>
${groups.join('\n')}
</hashTree>
</hashTree>
</jmeterTestPlan>
`;
}

const load = plan('SportAxis load test', [
  threadGroup('Public schedule and standings', [
    sampler('Public: game schedule', 'GET', '/api/events?perPage=50'),
    sampler('Public: college leaderboard', 'GET', '/api/leaderboard'),
    sampler('Public: live scores', 'GET', '/api/live-scores'),
  ]),
  threadGroup('Login authentication', [
    sampler('Login', 'POST', '/api/login', { json: { email: P('email', ''), password: P('password', '') } }),
  ]),
  threadGroup('Attendance submission', [
    sampler('Attendance submission', 'POST', `/api/attendance/sessions/${P('sessionId', '')}/records`, {
      token: 'coach', json: { records: [{ athleteId: P('athleteId', ''), status: 'present' }] },
    }),
  ]),
  threadGroup('Score processing', [
    sampler('Score processing', 'POST', '/api/scores', {
      token: 'judge', json: { eventId: P('eventId', ''), department: P('deptA', ''), totalScore: '${__Random(40,99)}' },
    }),
  ]),
  threadGroup('Ranking computation', [
    sampler('Ranking computation: game rankings', 'GET', `/api/rankings/${P('eventId', '')}`),
    sampler('Ranking computation: overall leaderboard', 'GET', '/api/leaderboard'),
  ]),
  threadGroup('Report generation', [
    sampler('Report generation: result sheet', 'GET', `/api/reports/events/${P('eventId', '')}`, { token: 'admin' }),
    sampler('Report generation: standings CSV', 'GET', '/api/reports/leaderboard/export?format=csv', { token: 'admin' }),
  ]),
]);

const ocr = plan('SportAxis OCR extraction under load', [
  threadGroup('OCR extraction', [
    sampler('OCR extraction', 'POST', '/api/ocr/extract', {
      token: 'judge',
      form: { departments: `["${P('deptA', '')}","${P('deptB', '')}"]` },
      file: { path: P('sheet', ''), param: 'image_file', type: 'image/jpeg' },
    }),
  ], { users: P('users', 1), rampup: 0, loops: P('loops', 3), scheduler: false }),
]);

// "${__Random}" must reach JMeter unescaped inside the JSON body.
fs.writeFileSync(path.join(here, 'sportaxis-load.jmx'), load.replaceAll('&quot;${__Random(40,99)}&quot;', '${__Random(40,99)}'));
fs.writeFileSync(path.join(here, 'sportaxis-ocr.jmx'), ocr);
console.log('Wrote e2e/jmeter/sportaxis-load.jmx and sportaxis-ocr.jmx');
