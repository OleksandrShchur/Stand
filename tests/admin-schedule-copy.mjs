// Build the client first; run Chrome with --remote-debugging-port=9251 and
// an isolated profile. All schedule reads and writes use this local fixture.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startFixture } from './accessibility-fixture.mjs';

let editorDate;
let failNext = true;
let releaseSlow;
let releaseSave;
const previews = [];
const saves = [];
const reads = [];
let slowDate;
let failedDate;
const server = await startFixture(5198, { adminSchedule: async (url, request, response) => {
    const send = value => response.end(JSON.stringify(value));
    if (request.method === 'GET') {
        const date = url.searchParams.get('date');
        editorDate ??= date;
        reads.push(date);
        if (date === slowDate) await new Promise(resolve => { releaseSlow = resolve; });
        if (date === failedDate && failNext) {
            failNext = false; response.writeHead(503); return send({ title: 'Не вдалося завантажити базовий розклад.' });
        }
        return send({ date, isActive: true, isCustom: true,
            locations: [{ locationId: date === editorDate ? 1 : 2, slots: [{ startTime: '10:00', endTime: '11:00', capacity: date === editorDate ? 3 : Number(date.slice(-2)) }] }],
            bookings: [], horizonDays: 14, minLeadTimeMinutes: 60 });
    }
    let body = ''; for await (const chunk of request) body += chunk;
    const dto = JSON.parse(body);
    if (request.method === 'PUT') {
        saves.push(dto); await new Promise(resolve => { releaseSave = resolve; });
    } else previews.push(dto);
    send({ updatedDates: dto.dates.length, preservedBookings: 1 });
} });
const base = 'http://127.0.0.1:5198';
const browser = process.env.ADMIN_CHROME_URL || 'http://127.0.0.1:9251';
const target = await (await fetch(`${browser}/json/new?about:blank`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let nextId = 0;
const pending = new Map();
socket.onmessage = event => {
    const value = JSON.parse(event.data);
    if (!value.id) return;
    const task = pending.get(value.id); pending.delete(value.id);
    value.error ? task.reject(value.error) : task.resolve(value.result);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
};
const pause = () => new Promise(resolve => setTimeout(resolve, 100));
const wait = async expression => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(); }
    throw new Error('Timed out: ' + expression);
};
const button = text => `[...document.querySelectorAll('button')].find(b => b.checkVisibility() && !b.closest('[aria-hidden="true"]') && b.textContent.trim() === ${JSON.stringify(text)})`;
const click = async expression => { await evaluate(`(${expression}).click()`); await pause(); };
const escape = async () => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await pause();
};
const choose = async (name, date) => {
    await click(`document.querySelector('input[name="${name}"]').closest('.MuiFormControl-root').querySelector('button')`);
    await wait('!!document.querySelector(".MuiDateCalendar-root")');
    const [year, month, day] = date.split('-').map(Number);
    await click(`document.querySelector('.MuiDateCalendar-root [data-timestamp="' + new Date(${year},${month - 1},${day}).getTime() + '"]')`);
    if (await evaluate(`${button('OK')} !== undefined`)) await click(button('OK'));
    await wait('!document.querySelector(".MuiDateCalendar-root")');
};
const addTarget = async date => {
    await choose('copy-date', date);
    await click(`document.querySelector('button[aria-label="Додати дату до копіювання"]')`);
};
const sourceText = 'document.querySelector("[data-testid=copy-source]").innerText';
const previewButton = button('Переглянути зміни');
const pretty = date => date.split('-').reverse().join('.');
mkdirSync('artifacts/admin-schedule-copy', { recursive: true });
try {
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Network.setCookie', { name: 'fixture-admin', value: 'true', url: base });
    for (const width of [320, 393, 1280]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 852, deviceScaleFactor: 1, mobile: width < 600 });
        await send('Page.navigate', { url: base + '/admin/schedule' });
        await wait(`${button('Копіювати')} !== undefined`);
        const days = [2, 4, 6, 8, 10].filter(day => day !== Number(editorDate.slice(-2))).map(day => `${editorDate.slice(0, 8)}${String(day).padStart(2, '0')}`);
        const [otherDate, targetDate, fastDate] = days;
        await click('document.querySelector("[data-testid=schedule-day-summary] input[type=checkbox]")');
        await click(button('Копіювати'));
        assert.ok(await evaluate(`${sourceText}.includes('незбереженими змінами')`), 'Default source explains unsaved editor changes');
        assert.ok(await evaluate(`${sourceText}.includes(${JSON.stringify(pretty(editorDate))})`), 'Default source date is explicit');
        await addTarget(targetDate);
        await click(previewButton);
        await wait('!!document.querySelector("#review-title")');
        assert.equal(previews.at(-1).isActive, false, 'Default source uses the draft');
        assert.deepEqual(previews.at(-1).dates, [targetDate], 'Preview affects only selected destinations');
        assert.equal(await evaluate('document.activeElement.textContent'), 'Назад', 'Cancel is focused in replacement confirmation');
        await escape();
        await wait('!document.querySelector("#review-title")');
        assert.equal(saves.length, 0, 'Escape from review leaves application data unchanged');
        await choose('copy-source-date', otherDate);
        await wait(`${sourceText}.includes('збережений розклад цієї дати')`);
        assert.ok(await evaluate(`${sourceText}.includes('День відкритий')`), 'Changing the base loads its saved schedule');
        await addTarget(fastDate);
        assert.ok(await evaluate('document.querySelector("[data-testid=copy-targets]").innerText.includes("Обрано дат: 2")'), 'Destinations and their count remain visible');
        await click(previewButton);
        await wait('!!document.querySelector("#review-title")');
        assert.equal(previews.at(-1).isActive, true);
        assert.equal(previews.at(-1).locations[0].locationId, 2);
        assert.equal(previews.at(-1).locations[0].slots[0].capacity, Number(otherDate.slice(-2)), 'Preview uses the newly selected source capacity');
        assert.deepEqual(previews.at(-1).dates, [targetDate, fastDate].sort());
        await click(button('Назад'));
        await wait('!document.querySelector("#review-title")');
        await choose('copy-source-date', targetDate);
        await wait(`${sourceText}.includes('збережений розклад цієї дати')`);
        assert.ok(await evaluate(`${previewButton}.disabled`), 'A source selected among destinations blocks replacement');
        await choose('copy-source-date', otherDate);
        await wait(`${sourceText}.includes('збережений розклад цієї дати')`);
        const screenshot = await send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(`artifacts/admin-schedule-copy/${width}.png`, Buffer.from(screenshot.data, 'base64'));
        assert.ok(await evaluate(`(() => { const e=document.querySelector('[aria-labelledby="copy-title"]'); return e.scrollWidth<=e.clientWidth && e.getBoundingClientRect().right<=${width}; })()`), 'Copy dialog fits the viewport');
        await choose('copy-source-date', editorDate);
        assert.ok(await evaluate(`${sourceText}.includes('незбереженими змінами')`), 'Returning to the editor date restores its unsaved draft');
        await escape(); await wait('!document.querySelector("#copy-title")');
        assert.equal(await evaluate('document.querySelector("[data-testid=schedule-day-summary] input[type=checkbox]").checked'), false, 'Changing source and cancelling preserves the original editor draft');
    }

    // Slow and failed reads must never permit copying an earlier source.
    const dates = [3, 5, 7].filter(day => day !== Number(editorDate.slice(-2))).map(day => `${editorDate.slice(0, 8)}${String(day).padStart(2, '0')}`);
    slowDate = dates[0]; failedDate = dates[1];
    await click(button('Копіювати'));
    await addTarget(dates[2] || `${editorDate.slice(0, 8)}25`);
    await choose('copy-source-date', slowDate);
    assert.ok(await evaluate(`${previewButton}.disabled`), 'Preview waits for the chosen source to load');
    await choose('copy-source-date', failedDate);
    await wait(`${sourceText}.includes('Не вдалося завантажити')`);
    assert.ok(await evaluate(`${previewButton}.disabled`), 'A failed source read blocks preview');
    releaseSlow(); await pause();
    assert.ok(await evaluate(`${sourceText}.includes('Не вдалося завантажити')`), 'A stale response cannot replace the latest source');
    await click(button('Повторити'));
    await wait(`${sourceText}.includes('збережений розклад цієї дати')`);
    await click(previewButton); await wait('!!document.querySelector("#review-title")');
    await click(button('Зберегти розклад'));
    assert.equal(saves.length, 1, 'Only explicit confirmation writes the replacement');
    await escape();
    assert.ok(await evaluate('!!document.querySelector("#review-title")'), 'Saving prevents dismissal');
    assert.ok(await evaluate(`${button('Зберегти розклад')}.disabled`), 'Saving prevents repeated submissions');
    assert.equal(saves[0].acknowledgeExistingBookings, true);
    assert.equal(saves[0].locations[0].slots[0].capacity, Number(failedDate.slice(-2)));
    releaseSave();
    await wait('!document.querySelector("#review-title") && !document.querySelector("#copy-title")');
    assert.equal(await evaluate('document.querySelector("[data-testid=schedule-day-summary] input[type=checkbox]").checked'), false, 'Saving targets does not overwrite the source editor draft');

    // Weekday copying continues to use the open editor, even after picking a
    // different source in the individual-date tab.
    await click(button('Копіювати'));
    await choose('copy-source-date', failedDate);
    await wait(`${sourceText}.includes('збережений розклад цієї дати')`);
    await click(button('За днями тижня'));
    await choose('copy-from', editorDate); await choose('copy-to', editorDate);
    const weekday = new Date(`${editorDate}T12:00:00Z`).getUTCDay();
    const weekdayButton = `document.querySelector('[aria-label="Дні тижня для копіювання"] button[value="${weekday}"]')`;
    if (await evaluate(`${weekdayButton}.getAttribute('aria-pressed') !== 'true'`)) await click(weekdayButton);
    await click(previewButton); await wait('!!document.querySelector("#review-title")');
    assert.equal(previews.at(-1).isActive, false, 'Weekday copying still uses the editor draft');
    assert.equal(previews.at(-1).locations[0].locationId, 1);
    assert.deepEqual(previews.at(-1).dates, [editorDate]);
    // Desktop backdrop dismissal cancels the replacement without a write.
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, x: 5, y: 5 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x: 5, y: 5 });
    await wait('!document.querySelector("#review-title")');
    assert.equal(saves.length, 1, 'Backdrop dismissal does not save');
    console.log('Schedule copy: mobile/desktop layout, draft/saved sources, exact destinations, races, retries, cancellation, confirmed save and unchanged weekday flow passed.');
} finally {
    releaseSlow?.(); releaseSave?.();
    await fetch(`${browser}/json/close/${target.id}`);
    socket.close(); await new Promise(resolve => server.close(resolve));
}
