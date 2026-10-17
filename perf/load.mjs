import http from 'node:http';
import https from 'node:https';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const [base = 'http://127.0.0.1:5116', countArg = '1', secondsArg = '120', output = 'load.json'] = process.argv.slice(2);
const hosted = process.argv[6] === '--hosted';
const users = Number(countArg), seconds = Number(secondsArg);
if (!Number.isInteger(users) || users < 1 || users > 10000 || !Number.isFinite(seconds) || !(seconds > 0)) throw Error('Invalid users/duration');
const target = new URL(base);
if (hosted ? target.origin !== 'https://stand.runasp.net' : target.hostname !== '127.0.0.1')
  throw Error('Target must be the isolated loopback server, or the explicitly designated hosted test site with --hosted');
const transport = target.protocol === 'https:' ? https : http;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const stats = new Map();
let phase = 'setup';
let failedJourneys = 0, completedJourneys = 0, bookings = 0, conflicts = 0, validationFailures = 0;
const clients = [];
const pendingBookings = new Map();
let identityCount = users;

async function request(client, path, body, allowConflict = false) {
  const started = performance.now();
  let status = 0, text = '', headers = {};
  try {
    ({status, text, headers} = await new Promise((resolve, reject) => {
      const data = body === undefined ? undefined : JSON.stringify(body);
      const req = transport.request(new URL(path, base), {
        agent: client.agent, method: data ? 'POST' : 'GET',
        headers: { ...(client.cookie ? {Cookie: client.cookie} : {}), ...(data ? {'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(data)} : {}) },
      }, res => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', chunk => text += chunk);
        res.on('error', reject);
        res.on('end', () => resolve({status:res.statusCode, text, headers:res.headers}));
      });
      req.setTimeout(10000, () => req.destroy(Error('timeout')));
      req.on('error', reject);
      req.end(data);
    }));
  } catch {}
  let json;
  try { json = JSON.parse(text); } catch {}
  const conflict = allowConflict && status === 409 && json?.errorCode === 'SLOT_FULL';
  const ok = status >= 200 && status < 300 || conflict;
  if (phase === 'measure') {
    const key = `${body === undefined ? 'GET' : 'POST'} ${path.split('?')[0]}`;
    const s = stats.get(key) ?? {latencies:[], errors:0, statuses:{}};
    s.latencies.push(performance.now() - started);
    s.errors += !ok;
    s.statuses[status] = (s.statuses[status] ?? 0) + 1;
    stats.set(key, s);
  }
  if (!ok) throw Error(`${path}: ${status} ${text.slice(0,180)}`);
  if (headers['set-cookie']) client.cookie = headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
  return {json, status};
}

// Each simulated visitor has a unique account and loopback source address, so the
// unchanged per-IP login policy is exercised without one generator IP blocking all users.
if (hosted) {
  const phones = (process.env.STAND_PERF_PHONES ?? '').split(',').map(s=>s.trim()).filter(Boolean);
  if (!phones.length || phones.length > 3) throw Error('Provide 1–3 designated synthetic accounts through STAND_PERF_PHONES');
  identityCount = phones.length;
  const sessionFile = process.env.STAND_PERF_SESSION_FILE ?? 'artifacts/perf/hosted-sessions.json';
  const accountHash = createHash('sha256').update(phones.join(',')).digest('hex');
  let cookies;
  if (existsSync(sessionFile)) {
    const cached = JSON.parse(readFileSync(sessionFile,'utf8'));
    if (cached.origin === target.origin && cached.accountHash === accountHash && cached.validUntil > Date.now()) cookies = cached.cookies;
  }
  if (!cookies) {
    cookies = [];
    for (const phone of phones) {
      const account = {agent:new https.Agent({keepAlive:true, maxSockets:1})};
      await request(account, '/api/auth/login', {phone});
      cookies.push(account.cookie);
      account.agent.destroy();
    }
    writeFileSync(sessionFile,JSON.stringify({origin:target.origin,accountHash,validUntil:Date.now()+3600000,cookies}),{mode:0o600});
  }
  for (let i=0; i<users; i++) clients.push({agent:new https.Agent({keepAlive:true,maxSockets:1}),cookie:cookies[i%cookies.length]});
} else {
  for (let i = 1; i <= users; i++) {
    const client = {agent:new http.Agent({keepAlive:true, maxSockets:1, localAddress:`127.0.${Math.floor(i/250)}.${i%250+1}`})};
    await request(client, '/api/auth/login', {phone:`+38067${String(i).padStart(7,'0')}`});
    clients.push(client);
  }
}
const calendar = (await request(clients[0], '/api/calendar')).json;
const dates = calendar.bookableDates;
const locations = (await request(clients[0], '/api/locations')).json;
if (!dates?.length || !locations?.length) throw Error('Missing test dates/locations');
const slots = (await request(clients[0], `/api/slots?date=${dates[0]}&locationId=${locations[0].id}`)).json;
if (!Array.isArray(slots) || !slots.length) throw Error('Missing test slots');
const started = performance.now(), end = started + seconds * 1000;
const cpuStarted = process.cpuUsage();
const eventLoopDelay = monitorEventLoopDelay({resolution:20});
eventLoopDelay.enable();
phase = 'measure';
await Promise.all(clients.map(async (client, index) => {
  await sleep(Math.random() * Math.min(10000, seconds * 200));
  while (performance.now() < end) {
    const cycle = performance.now();
    try {
      await request(client, '/api/auth/me');
      await request(client, '/api/bookings/mine');
      const cal = (await request(client, '/api/calendar')).json;
      if (!Array.isArray(cal?.bookableDates)) { validationFailures++; throw Error('Invalid calendar'); }
      await sleep(Math.min(5000, Math.max(0,end-performance.now())));
      if (performance.now() >= end) break;
      const date = dates[Math.floor(Math.random()*dates.length)];
      const location = locations[Math.floor(Math.random()*locations.length)].id;
      await request(client, `/api/locations?date=${date}`);
      await sleep(Math.min(5000,Math.max(0,end-performance.now())));
      if (performance.now() >= end) break;
      const available = (await request(client, `/api/slots?date=${date}&locationId=${location}`)).json;
      if (!Array.isArray(available)) { validationFailures++; throw Error('Invalid slots'); }
      // 10% of journeys attempt a booking; cancel our own new booking immediately
      // to keep finite real slot capacities usable across a long test.
      if (Math.random() < 0.1) {
        const slot = available.find(s => s.isBookable && s.remaining > 0);
        if (slot) {
          const result = await request(client, '/api/bookings', {date,locationId:location,timeSlotId:slot.timeSlotId}, true);
          if (result.status === 409) conflicts++;
          else {
            if (!result.json?.cancelToken || result.json.isBooked !== true) { validationFailures++; throw Error('Invalid booking'); }
            bookings++;
            pendingBookings.set(result.json.cancelToken,client);
            const cancelled = await request(client, '/api/bookings/cancel', {cancelToken:result.json.cancelToken});
            if (cancelled.json?.isBooked !== false) { validationFailures++; throw Error('Invalid cancellation'); }
            pendingBookings.delete(result.json.cancelToken);
          }
        }
      }
      completedJourneys++;
    } catch (error) {
      failedJourneys++;
      if (failedJourneys < 5) console.error(error.message);
    }
    await sleep(Math.min(Math.max(0,30000-(performance.now()-cycle)),Math.max(0,end-performance.now())));
  }
}));
const elapsed = (performance.now()-started)/1000;
const cpuUsed = process.cpuUsage(cpuStarted);
eventLoopDelay.disable();
const generator = {cpuCores:(cpuUsed.user+cpuUsed.system)/1e6/elapsed,eventLoopP95Ms:eventLoopDelay.percentile(95)/1e6};
generator.saturated = generator.cpuCores > .85 || generator.eventLoopP95Ms > 100;
phase = 'cleanup';
for (const [cancelToken,client] of pendingBookings) {
  for (let attempt=0; attempt<3; attempt++) {
    try {
      const cancelled = await request(client,'/api/bookings/cancel',{cancelToken});
      if (cancelled.json?.isBooked === false) { pendingBookings.delete(cancelToken); break; }
    } catch {}
    await sleep(1000);
  }
}
for (const client of clients) client.agent.destroy();
const percentile = (sorted,p) => sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length*p)-1)] : null;
const endpoints = {};
const all = [];
let errors = 0;
for (const [key,s] of stats) {
  s.latencies.sort((a,b)=>a-b);
  all.push(...s.latencies);
  errors += s.errors;
  endpoints[key] = {requests:s.latencies.length, errors:s.errors, p95Ms:percentile(s.latencies,.95), statuses:s.statuses};
}
all.sort((a,b)=>a-b);
const result = {users, identityCount, identityMode:hosted ? 'shared hosted test account pool' : 'unique synthetic accounts', elapsedSeconds:elapsed, requests:all.length, requestsPerSecond:all.length/elapsed,
  errorRate:errors/all.length, p95Ms:percentile(all,.95), p99Ms:percentile(all,.99),
  completedJourneys, failedJourneys, validationFailures, bookings, conflicts, cleanupRemaining:pendingBookings.size, generator, endpoints};
result.endpointTargetsMet = Object.values(endpoints).every(s=>s.p95Ms < 1000);
result.passed = result.requests > 0 && result.p95Ms < 1000 && result.errorRate < .01 && validationFailures === 0 && pendingBookings.size === 0;
writeFileSync(output, JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
process.exitCode = result.passed ? 0 : 2;
