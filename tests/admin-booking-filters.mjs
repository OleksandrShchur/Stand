// Run from the repo root after building the client. Requires isolated Chrome
// with --remote-debugging-port=9241; no real API or database is contacted.
import assert from 'node:assert/strict';
import { startFixture, fixtureDate } from './accessibility-fixture.mjs';

const browser = process.env.A11Y_CHROME_URL || 'http://127.0.0.1:9241';
await fetch(`${browser}/json/version`, { signal: AbortSignal.timeout(2000) });
const requests = [], cancelled = [];
const server = await startFixture(5199, { bookings: (url, response) => {
    const query = Object.fromEntries(url.searchParams);
    requests.push(query);
    response.on('close', () => { if (!response.writableEnded) cancelled.push(query); });
    const page = Number(query.page), pageSize = Number(query.pageSize);
    const items = Array.from({ length: pageSize }, (_, i) => ({
        id: (page - 1) * pageSize + i + 1, publicNumber: `TEST-${i + 1}`,
        date: fixtureDate, locationId: 1, locationName: 'Локація 1',
        timeSlotId: 1, startTime: '10:00', endTime: '11:00',
        firstName: query.search === '67' ? 'Застарілий результат' : query.search === '678' ? 'Останній результат' : 'Олена',
        lastName: 'Тестова', phone: '+380670000001', isBooked: true,
        createdAtUtc: new Date().toISOString(),
    }));
    setTimeout(() => response.end(JSON.stringify({ items, totalCount: 30, page, pageSize })), query.search === '67' ? 500 : 10);
} });
const target = await (await fetch(`${browser}/json/new?about:blank`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let nextId = 0;
const pending = new Map(), errors = [];
socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (!message.id) return;
    const job = pending.get(message.id); pending.delete(message.id);
    message.error ? job.reject(message.error) : job.resolve(message.result);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitFor = async (condition, message) => {
    for (let i = 0; i < 100; i++) { if (await condition()) return; await pause(50); }
    throw new Error('Timed out: ' + message);
};
const ready = () => waitFor(() => evaluate("!!document.querySelector('main h1') && !!document.querySelector('main .MuiCard-root') && !document.querySelector('.MuiCircularProgress-root,.MuiLinearProgress-indeterminate')"), 'bookings loaded');
const last = () => requests.at(-1);
const setSearch = value => evaluate(`(() => {
    const input = document.querySelector('input[name=booking-search]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
const click = async expression => {
    const point = await evaluate(`(() => {
        const element=${expression};
        if (!element) throw new Error('Missing click target');
        element.scrollIntoView({ block: 'center' });
        const r=element.getBoundingClientRect();
        return { x:r.left+r.width/2, y:r.top+r.height/2 };
    })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
    await pause(300);
};
const choose = async (index, text) => {
    await click(`document.querySelectorAll('[role=combobox]')[${index}]`);
    await click(`[...document.querySelectorAll('[role=option]')].find(e=>e.textContent===${JSON.stringify(text)})`);
    await ready();
};

try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 393, height: 852, deviceScaleFactor: 1, mobile: true });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: "document.cookie='fixture-admin=true; path=/'" });
    await send('Page.navigate', { url: 'http://127.0.0.1:5199/admin/bookings' });
    await ready();
    assert.equal(last().date, undefined, 'No date is applied by default');
    assert.equal(await evaluate("document.querySelector('input[name=booking-date]').value"), '');
    assert.equal(await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Застосувати'))"), false);
    await click("document.querySelector('.MuiAccordionSummary-root')");
    await choose(0, 'Локація 2');
    assert.equal(last().locationId, '2', 'Location applies immediately');
    await click("document.querySelector('button[aria-label=\"Наступна сторінка\"]')");
    await ready();
    assert.equal(last().page, '2');

    const beforeTyping = requests.length;
    await setSearch('6'); await pause(150);
    await setSearch('(6) -'); await pause(150);
    assert.equal(requests.length, beforeTyping, 'A single digit and formatting do not issue searches or reset pagination');
    await setSearch('6-7');
    await waitFor(() => last().search === '67', 'two digits start searching');
    assert.equal(last().page, '1', 'Searching resets pagination');
    await setSearch('678');
    await ready(); await pause(600);
    assert.equal(last().search, '678');
    assert.ok(await evaluate("document.querySelector('main').innerText.includes('Останній результат') && !document.querySelector('main').innerText.includes('Застарілий результат')"), 'The latest search wins');
    assert.ok(cancelled.some(query => query.search === '67'), 'Superseded requests are aborted');
    const beforeFormatting = requests.length;
    await setSearch('(67) 8'); await pause(150);
    assert.equal(requests.length, beforeFormatting, 'Formatting without digit changes does not issue another request');
    await setSearch('6'); await ready();
    assert.equal(last().search, undefined, 'Dropping below two digits removes the phone restriction');
    const beforeClear = requests.length;
    await setSearch(''); await pause(150);
    assert.equal(requests.length, beforeClear, 'Clearing an inactive phone restriction does not refetch');
    await setSearch('В'); await pause(150);
    assert.equal(requests.length, beforeClear, 'A single letter does not issue a search');
    await setSearch('Ва');
    await waitFor(() => last().search === 'ва', 'partial first name is sent to the server');
    await ready();
    await click("document.querySelector('button[aria-label=\"Наступна сторінка\"]')"); await ready();
    assert.equal(last().page, '2');
    await setSearch('  Василь   Пупкін  ');
    await waitFor(() => last().search === 'василь пупкін', 'full name preserves both name and surname');
    await ready();
    assert.equal(last().page, '1', 'Name search resets pagination');
    const beforeCaseChange = requests.length;
    await setSearch('ВАСИЛЬ ПУПКІН'); await pause(150);
    assert.equal(requests.length, beforeCaseChange, 'Case-only changes do not refetch');
    await setSearch('Пупкін');
    await waitFor(() => last().search === 'пупкін', 'surname is sent to the server'); await ready();
    await setSearch('');
    await waitFor(() => last().search === undefined, 'clearing removes the name restriction'); await ready();
    assert.equal(await evaluate("document.querySelectorAll('.MuiAccordionDetails-root [role=combobox]').length"), 1, 'Only location uses a dropdown');

    const calendarButton = "document.querySelector('input[name=booking-date]').closest('.MuiFormControl-root').querySelector('button:not(.clearButton)')";
    const openCalendar = async () => {
        await click(calendarButton);
        await waitFor(() => evaluate("!!document.querySelector('.MuiDateCalendar-root')"), 'calendar opened');
    };
    const action = text => `[...document.querySelectorAll('button')].find(b=>b.checkVisibility() && b.textContent.trim()===${JSON.stringify(text)})`;
    const calendarClosed = () => waitFor(() => evaluate("!document.querySelector('.MuiDateCalendar-root')"), 'calendar closed');
    const daySelector = "[...document.querySelectorAll('.MuiDateCalendar-root [role=gridcell][data-timestamp]')].find(e=>!e.disabled && e.getAttribute('aria-selected')!=='true')";
    const openClock = async bound => {
        await click(`document.querySelector('button[aria-label="Обрати час ${bound}"]')`);
        await waitFor(() => evaluate("!!document.querySelector('.MuiTimeClock-root')"), 'analog clock opened');
    };
    const clockNumber = text => `[...document.querySelectorAll('.MuiClockNumber-root')].find(e=>e.textContent===${JSON.stringify(text)})`;
    const clockClosed = () => waitFor(() => evaluate("!document.querySelector('.MuiTimeClock-root')"), 'clock closed');
    const selectTime = async (bound, hour, minute = '00') => {
        await openClock(bound); await click(clockNumber(hour)); await click(clockNumber(minute));
    };
    const applyTime = async (bound, hour, minute = '00') => {
        await selectTime(bound, hour, minute); await click(action('OK')); await clockClosed(); await ready();
    };
    const clearTime = async bound => {
        await click(`document.querySelector('button[aria-label="Очистити час ${bound}"]')`); await ready();
    };
    for (const width of [320, 393, 1280]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 852, deviceScaleFactor: 1, mobile: width < 600 });
        if (last().timeFrom) await clearTime('від');
        if (last().timeTo) await clearTime('до');
        const beforeClock = requests.length;
        await selectTime('від', '10');
        assert.equal(requests.length, beforeClock, `${width}px: choosing hours and minutes waits for OK`);
        assert.ok(await evaluate(`(() => { const r=document.querySelector('.MuiTimeClock-root').getBoundingClientRect(); return r.left>=0 && r.right<=${width}; })()`), 'Clock fits the viewport');
        await click(action('Відміна')); await clockClosed();
        assert.equal(requests.length, beforeClock, 'Cancelling the clock does not filter');
        await applyTime('від', '10');
        assert.equal(last().timeFrom, '10:00', 'From accepts an independent lower bound');
        assert.equal(last().timeTo, undefined);
        assert.equal(last().timeSlotId, undefined, 'The time range replaces the slot filter');
        await applyTime('до', '13');
        assert.equal(last().timeTo, '13:00', 'To combines with the lower bound');
        await click("document.querySelector('button[aria-label=\"Наступна сторінка\"]')"); await ready();
        assert.equal(last().page, '2');
        await applyTime('від', '10', '30');
        assert.equal(last().timeFrom, '10:30', 'Minute precision is retained');
        assert.equal(last().page, '1', 'Changing time resets pagination');
        await openClock('від');
        assert.equal(await evaluate(`(${clockNumber('13')}).getAttribute('aria-disabled')`), 'true', 'From cannot equal or exceed To');
        await click(clockNumber('11')); await click(clockNumber('00'));
        const beforeDismiss = requests.length;
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await clockClosed();
        assert.equal(requests.length, beforeDismiss, 'Dismissal does not apply a time draft');
        assert.equal(last().timeFrom, '10:30');
        await clearTime('від');
        assert.equal(last().timeFrom, undefined);
        assert.equal(last().timeTo, '13:00', 'To works without From');
        await clearTime('до');
        assert.equal(last().timeTo, undefined, 'Clearing both removes the time restriction');
        await applyTime('від', '10'); await applyTime('до', '13');
        await openCalendar();
        const beforeDraft = requests.length;
        await click(daySelector);
        assert.equal(requests.length, beforeDraft, `${width}px: choosing a day does not filter`);
        await click(action('Відміна')); await calendarClosed();
        assert.equal(requests.length, beforeDraft, `${width}px: cancelling an empty date makes no request`);
        assert.equal(await evaluate("document.querySelector('input[name=booking-date]').value"), '');

        await openCalendar();
        const chosenDate = await evaluate(`(() => { const d=new Date(Number((${daySelector}).dataset.timestamp)); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); })()`);
        await click(daySelector);
        assert.equal(requests.length, beforeDraft);
        await click(action('OK')); await calendarClosed(); await ready();
        assert.equal(last().date, chosenDate, `${width}px: OK applies the chosen date`);
        await click("document.querySelector('button[aria-label=\"Наступна сторінка\"]')"); await ready();
        assert.equal(last().page, '2');
        const committedInput = await evaluate("document.querySelector('input[name=booking-date]').value");
        const beforeCancel = requests.length;
        await openCalendar(); await click(daySelector); await click(action('Відміна')); await calendarClosed();
        assert.equal(requests.length, beforeCancel, `${width}px: cancel does not search or reset pagination`);
        assert.equal(await evaluate("document.querySelector('input[name=booking-date]').value"), committedInput, 'Cancel restores the committed input');
        assert.equal(last().date, chosenDate);
        assert.equal(last().page, '2');

        await openCalendar(); await click(daySelector);
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await calendarClosed();
        assert.equal(requests.length, beforeCancel, 'Dismissing without OK does not apply the date');
        assert.equal(await evaluate("document.querySelector('input[name=booking-date]').value"), committedInput);
        await click("document.querySelector('button[aria-label=\"Очистити дату\"]')"); await ready();
        assert.equal(last().date, undefined, 'Clearing the date applies immediately');
        assert.ok(await evaluate(`document.documentElement.scrollWidth <= ${width}`), 'Filters fit the viewport');
    }
    assert.equal(last().locationId, '2', 'Other filters are retained');
    assert.equal(last().timeFrom, '10:00');
    assert.equal(last().timeTo, '13:00');
    assert.equal(last().isBooked, 'true');
    assert.deepEqual(errors, []);
    console.log('PASS mobile/desktop date and analog clock confirmation, cancellation and dismissal; optional From/To bounds, range validation, minute precision and clearing; phone and name search; pagination reset and request cancellation');
} finally {
    socket.close(); await new Promise(resolve => server.close(resolve));
}
