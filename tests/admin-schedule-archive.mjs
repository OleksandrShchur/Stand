// Build the client first. Uses only an isolated API fixture and a Chrome
// debugging session on port 9251; no requests reach the application database.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startFixture } from './accessibility-fixture.mjs';

const today = '2026-10-20';
const yesterday = '2026-10-19';
const writes = [];
const server = await startFixture(5198, { adminSchedule: async (url, request, response) => {
    if (request.method === 'GET') return response.end(JSON.stringify({ date: url.searchParams.get('date'), isActive: true, isCustom: true,
        locations: [{ locationId: 1, slots: [{ startTime: '10:00', endTime: '11:00', capacity: 3 }] }], bookings: [], horizonDays: 14, minLeadTimeMinutes: 60 }));
    let body = ''; for await (const chunk of request) body += chunk;
    const dto = JSON.parse(body); writes.push({ method: request.method, dto });
    if (dto.dates.some(date => date < today)) { response.writeHead(400); return response.end(JSON.stringify({ title: 'Archive write rejected' })); }
    response.end(JSON.stringify({ updatedDates: dto.dates.length, preservedBookings: 0 }));
}, adminDates: (url, response) => {
    const month = url.searchParams.get('from').slice(0, 7);
    const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    response.end(JSON.stringify(Array.from({ length: days }, (_, i) => ({ id: i + 1, date: `${month}-${String(i + 1).padStart(2, '0')}`, isActive: true }))));
} });
const browser = process.env.ADMIN_CHROME_URL || 'http://127.0.0.1:9251';
const base = 'http://127.0.0.1:5198';
const fakeDate = `const RealDate = Date; window.archiveNow = RealDate.parse('2026-10-19T21:30:00Z');
    window.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [window.archiveNow])); } static now() { return window.archiveNow; } };`;
mkdirSync('artifacts/admin-schedule-archive', { recursive: true });
try {
    for (const width of [393, 1280]) {
        const target = await (await fetch(`${browser}/json/new?about:blank`, { method: 'PUT' })).json();
        const socket = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
        let nextId = 0; const pending = new Map();
        socket.onmessage = event => {
            const value = JSON.parse(event.data); if (!value.id) return;
            const task = pending.get(value.id); pending.delete(value.id);
            value.error ? task.reject(value.error) : task.resolve(value.result);
        };
        const send = (method, params = {}) => new Promise((resolve, reject) => {
            const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
        });
        const evaluate = async expression => {
            const result = await send('Runtime.evaluate', { expression, returnByValue: true });
            if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
            return result.result.value;
        };
        const pause = () => new Promise(resolve => setTimeout(resolve, 150));
        const wait = async expression => {
            for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(); }
            throw new Error('Timed out: ' + expression);
        };
        const button = label => `[...document.querySelectorAll('button')].find(b => b.checkVisibility() && !b.closest('[aria-hidden="true"]') && b.textContent.trim() === ${JSON.stringify(label)})`;
        const click = async expression => { await evaluate(`(${expression}).click()`); await pause(); };
        const day = date => {
            const [year, month, dateOfMonth] = date.split('-').map(Number);
            return `document.querySelector('.MuiDateCalendar-root [data-timestamp="' + new Date(${year},${month - 1},${dateOfMonth}).getTime() + '"]')`;
        };
        const openCalendar = async name => {
            await click(`document.querySelector('input[name="${name}"]').closest('.MuiFormControl-root').querySelector('button')`);
            await wait('!!document.querySelector(".MuiDateCalendar-root")');
        };
        const choose = async (name, date) => {
            await openCalendar(name); await click(day(date));
            if (await evaluate(`${button('OK')} !== undefined`)) await click(button('OK'));
            await wait('!document.querySelector(".MuiDateCalendar-root")');
        };
        const viewDate = async date => {
            await choose('schedule-date', date);
            await wait(`document.querySelector('[data-testid=schedule-day-summary] h2')?.textContent === '${date.split('-').reverse().join('.')}'`);
        };
        const archived = 'document.querySelector("[data-testid=schedule-day-summary] .MuiChip-root")?.textContent === "Архів"';
        const toggle = 'document.querySelector("[data-testid=schedule-day-summary] input[type=checkbox]")';
        try {
            await send('Page.enable');
            await send('Network.enable');
            await send('Network.setCookie', { name: 'fixture-admin', value: 'true', url: base });
            await send('Emulation.setDeviceMetricsOverride', { width, height: 852, deviceScaleFactor: 1, mobile: width < 600 });
            await send('Emulation.setTouchEmulationEnabled', { enabled: width < 600 });
            // Kyiv is already on the 20th while this device is still on the 19th.
            await send('Emulation.setTimezoneOverride', { timezoneId: 'America/Los_Angeles' });
            await send('Page.addScriptToEvaluateOnNewDocument', { source: fakeDate });
            await send('Page.navigate', { url: base + '/admin/schedule' });
            await wait('!!document.querySelector("[data-testid=schedule-day-summary]")');
            assert.equal(await evaluate('new Date().toISOString()'), '2026-10-19T21:30:00.000Z');
            assert.equal(await evaluate('document.querySelector("[data-testid=schedule-day-summary] h2").textContent'), '20.10.2026');
            await viewDate(yesterday); await wait(archived);
            assert.equal(await evaluate(`${toggle}.disabled`), true);
            assert.ok(await evaluate('[...document.querySelectorAll("main input[type=checkbox]")].every(e => e.disabled)'), 'All archive location switches are disabled');
            assert.equal(await evaluate(`${button('Зберегти')}.disabled`), true);
            assert.equal(await evaluate(`${button('Налаштувати час')} !== undefined`), false, 'Archive exposes no time editor');
            assert.equal(await evaluate(`${button('Копіювати')}.disabled`), false, 'Archive remains available as a copy source');
            await click(button('Переглянути час (1)'));
            assert.ok(await evaluate('document.querySelector("main").innerText.includes("10:00–11:00") && document.querySelector("main").innerText.includes("Місць: 3")'));
            const shot = await send('Page.captureScreenshot', { format: 'png' });
            writeFileSync(`artifacts/admin-schedule-archive/${width}.png`, Buffer.from(shot.data, 'base64'));

            await click(button('Копіювати')); await openCalendar('copy-date');
            assert.equal(await evaluate(`${day(yesterday)}.disabled`), true, 'Yesterday cannot be a destination');
            assert.equal(await evaluate(`${day(today)}.disabled`), false, 'Today remains a valid destination');
            await click(day(today));
            if (await evaluate(`${button('OK')} !== undefined`)) await click(button('OK'));
            await wait('!document.querySelector(".MuiDateCalendar-root")');
            await click(`document.querySelector('button[aria-label="Додати дату до копіювання"]')`);
            await click(button('Переглянути зміни')); await wait('!!document.querySelector("#review-title")');
            assert.deepEqual(writes.at(-1).dto.dates, [today]);
            await click(button('Зберегти розклад')); await wait('!document.querySelector("#review-title") && !document.querySelector("#copy-title")');
            assert.ok(await evaluate(archived));
            assert.deepEqual(writes.filter(write => write.method === 'PUT').at(-1).dto.locations[0].slots, [{ startTime: '10:00', endTime: '11:00', capacity: 3 }]);

            await viewDate(today);
            assert.equal(await evaluate(archived), false); assert.equal(await evaluate(`${toggle}.disabled`), false);
            await click(toggle); assert.equal(await evaluate(`${toggle}.checked`), false, 'Today is still editable');
            await click(toggle); // Restore the saved state before navigation.
            await viewDate('2026-10-21'); assert.equal(await evaluate(archived), false); assert.equal(await evaluate(`${toggle}.disabled`), false);
            await viewDate(today);
            if (width < 600) {
                await click(button('Налаштувати час')); await wait('!!document.querySelector("[data-testid=location-time-editor] [role=dialog]")');
                await evaluate('window.archiveNow += 86400000; window.dispatchEvent(new Event("focus"))');
                await wait(archived); await wait('!document.querySelector("[data-testid=location-time-editor] [role=dialog]")');
                assert.equal(await evaluate(`${toggle}.disabled`), true, 'An open editor becomes read-only at Kyiv midnight');
            } else {
                await click(button('Копіювати')); await choose('copy-source-date', yesterday);
                await wait('document.querySelector("[data-testid=copy-source]").innerText.includes("збережений розклад")');
                await choose('copy-date', today);
                await click(`document.querySelector('button[aria-label="Додати дату до копіювання"]')`);
                await click(button('Переглянути зміни')); await wait('!!document.querySelector("#review-title")');
                const writesBeforeMidnight = writes.length;
                await evaluate('window.archiveNow += 86400000; window.dispatchEvent(new Event("focus"))');
                await wait(`${button('Зберегти розклад')}.disabled`);
                assert.equal(writes.length, writesBeforeMidnight, 'A pending replacement cannot save yesterday after midnight');
            }
            assert.ok(writes.every(write => write.dto.dates.every(date => date >= today)), 'No mutation targets an archived day');
            console.log(`${width}px: archive badge, read-only intervals, copy from archive, current/future editing and midnight guards passed.`);
        } finally {
            await fetch(`${browser}/json/close/${target.id}`); socket.close();
        }
    }
} finally {
    await new Promise(resolve => server.close(resolve));
}
