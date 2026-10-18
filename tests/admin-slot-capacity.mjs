// Build the client first. Uses an isolated API fixture and headless Chrome's CDP;
// no requests reach the application database. Set ADMIN_CHROME_URL if needed.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startFixture } from './accessibility-fixture.mjs';

const server = await startFixture();
const base = 'http://127.0.0.1:5198';
const debuggerUrl = process.env.ADMIN_CHROME_URL || 'http://127.0.0.1:9245';
const target = await (await fetch(`${debuggerUrl}/json/new?${encodeURIComponent(base)}`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let nextId = 0;
const pending = new Map();
const scheduleWrites = [];
const deleteRequests = [];
socket.onmessage = event => {
    const value = JSON.parse(event.data);
    if (value.method === 'Network.requestWillBeSent' && value.params.request.url.includes('/api/admin/schedule') && value.params.request.method !== 'GET')
        scheduleWrites.push(value.params.request);
    if (value.method === 'Network.requestWillBeSent' && value.params.request.method === 'DELETE') deleteRequests.push(value.params.request);
    if (value.method === 'Page.javascriptDialogOpening') {
        send('Page.handleJavaScriptDialog', { accept: true });
        return;
    }
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
const pause = () => new Promise(resolve => setTimeout(resolve, 150));
const wait = async expression => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(); }
    throw new Error('Timed out: ' + expression);
};
const button = text => `[...document.querySelectorAll('button')].find(b => b.checkVisibility() && b.textContent.trim() === ${JSON.stringify(text)})`;
const click = async expression => { await evaluate(`(${expression}).click()`); await pause(); };
const clickClock = async expression => {
    const point = await evaluate(`(() => { const e=${expression}; e.scrollIntoView({block:'nearest'}); const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
    await pause();
};
const setNumber = async (expression, value) => {
    await evaluate(`(() => { const e=${expression}; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))}); e.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await pause();
};
const screenshot = async name => {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`artifacts/admin-slot-capacity/${name}.png`, Buffer.from(shot.data, 'base64'));
};
const editor = 'document.querySelector("[data-testid=location-time-editor] [role=dialog]")';
const intervalActionsButton = `document.querySelector(${JSON.stringify('button[aria-label="Дії інтервалу 10:00–11:00"]')})`;
const intervalSummaryButton = 'document.querySelector("#schedule-interval-summary-1-0")';
const confirmation = title => `[...document.querySelectorAll('[role=dialog]')].find(dialog=>dialog.querySelector('.MuiDialogTitle-root')?.textContent===${JSON.stringify(title)})`;
const intervalCount = 'document.querySelectorAll("[data-testid=schedule-interval]").length';
const lastNumber = `[...document.querySelectorAll(${JSON.stringify('[data-testid=location-time-editor] input[name$="-capacity"]')})].filter(e=>e.checkVisibility()).at(-1)`;
mkdirSync('artifacts/admin-slot-capacity', { recursive: true });
try {
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Network.setCookie', { name: 'fixture-admin', value: 'true', url: base });
    for (const width of [320, 393, 414]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 852, deviceScaleFactor: 1, mobile: true, screenWidth: width, screenHeight: 852 });
        await send('Page.navigate', { url: base + '/admin/schedule' });
        await wait(`${button('Налаштувати час')} !== undefined`);
        const writesBeforeSave = scheduleWrites.length;
        await click(button('Зберегти'));
        await wait('document.querySelector(".MuiSnackbar-root")?.innerText.includes("Немає змін для збереження")');
        assert.equal(await evaluate('document.querySelector("#review-title")'), null, 'Unchanged Save shows a toast without opening review');
        assert.equal(scheduleWrites.length, writesBeforeSave, 'Unchanged Save does not call preview or save APIs');
        await click('document.querySelector(".MuiSnackbar-root button")');
        await click(button('Копіювати'));
        await wait('!!document.querySelector("#copy-title")');
        await click(button('Назад'));
        await click(button('Налаштувати час'));
        await wait(`${editor} !== null`);
        assert.equal(await evaluate(`${intervalSummaryButton}.getAttribute('aria-expanded')`), 'false', 'Intervals start in the compact summary view');
        await click(intervalActionsButton);
        assert.deepEqual(await evaluate("[...document.querySelectorAll('[role=menuitem]')].map(item=>item.textContent.trim())"), ['Видалити'], 'Interval menu contains Delete only');
        assert.equal(await evaluate(`${intervalSummaryButton}.getAttribute('aria-expanded')`), 'false', 'Opening the action menu does not expand the interval');
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await wait('!document.querySelector("[role=menu]")');
        await clickClock(intervalSummaryButton);
        await wait('document.querySelector("input[name=schedule-1-0-capacity]")?.checkVisibility()');
        assert.equal(await evaluate(`${intervalSummaryButton}.getAttribute('aria-expanded')`), 'true', 'Expanding the interval opens editing');
        assert.equal(await evaluate(`${intervalSummaryButton}.querySelector('button')`), null, 'Accordion and menu buttons are separate controls');
        const endTime = 'document.querySelector("input[name=schedule-1-0-end]")';
        const clockNumber = text => `[...document.querySelectorAll('.MuiClockNumber-root')].find(e=>e.textContent===${JSON.stringify(text)})`;
        const selectEnd = async (hour, minute) => {
            await click(`document.querySelector('button[aria-label="Обрати завершення"]')`);
            await wait("!!document.querySelector('.MuiTimeClock-root')");
            assert.ok(await evaluate(`${clockNumber('13')} !== undefined && ${clockNumber('23')} !== undefined`), 'Hour picker uses a 24-hour clock');
            assert.ok(await evaluate('![...document.querySelectorAll(".MuiTimeClock-root,.MuiTimePickerToolbar-root")].some(e=>/\\b(AM|PM)\\b/.test(e.innerText))'), 'Picker has no AM/PM control');
            assert.ok(await evaluate(`(() => { const r=document.querySelector('.MuiTimeClock-root').getBoundingClientRect(); return r.left>=0 && r.right<=${width}; })()`), '24-hour clock fits the viewport');
            await clickClock(clockNumber(hour)); await clickClock(clockNumber(minute));
            await click(button('OK'));
            await wait("!document.querySelector('.MuiTimeClock-root')");
        };
        await selectEnd('17', '30');
        assert.equal(await evaluate(`${endTime}.value`), '17:30', 'Afternoon selection retains 24-hour time and minute precision');
        await screenshot(`${width}-24-hour-time`);
        await selectEnd('11', '00');
        assert.equal(await evaluate(`${lastNumber}.value`), '3', 'Existing interval capacity is loaded');
        for (const invalid of ['abc', '1e2', '-2', '+2', '2.5', '2,5', ' 4 ']) {
            await setNumber(lastNumber, invalid);
            assert.equal(await evaluate(`${lastNumber}.value`), '3', 'Capacity rejects letters, signs, decimals and exponent notation');
        }
        await setNumber(lastNumber, '');
        assert.equal(await evaluate(`${lastNumber}.value`), '', 'Capacity can be cleared while editing');
        assert.equal(await evaluate(`${lastNumber}.getAttribute('aria-invalid')`), 'true', 'The affected capacity field is highlighted');
        assert.ok(await evaluate(`${lastNumber}.closest('[data-testid="schedule-interval"]').innerText.includes('Вкажіть кількість місць — ціле число від 1.')`), 'Error is displayed next to the affected interval');
        await screenshot(`${width}-inline-capacity-error`);
        await clickClock(intervalSummaryButton);
        await wait(`document.querySelector('#schedule-interval-1-0 [role=alert]')?.innerText.includes('Вкажіть кількість місць')`);
        await wait('!document.querySelector("input[name=schedule-1-0-capacity]")');
        assert.equal(await evaluate(`${intervalSummaryButton}.getAttribute('aria-expanded')`), 'false', 'Collapsing the interval ends editing and keeps errors visible');
        await click(button('Готово'));
        await wait('document.activeElement.name === "schedule-1-0-capacity"');
        assert.ok(await evaluate(`${editor} !== null`), 'Done keeps the editor open and focuses the invalid interval');
        await setNumber(lastNumber, 0);
        await wait(`${editor}.innerText.includes('ціле число від 1')`);
        await setNumber(lastNumber, 5);
        await wait(`${editor}.innerText.includes('Місць: 5') && !${editor}.innerText.includes('ціле число від 1')`);
        assert.equal(await evaluate(`${lastNumber}.getAttribute('aria-invalid')`), 'false', 'Fixing capacity clears the field error');
        await clickClock(intervalSummaryButton);
        await wait('!document.querySelector("input[name=schedule-1-0-capacity]")');
        assert.ok(await evaluate(`${intervalSummaryButton}.innerText.includes('Місць: 5')`), 'Collapsed summary reflects the edited capacity');
        await evaluate(`(${intervalSummaryButton}).focus()`);
        assert.equal(await evaluate('document.activeElement.id'), 'schedule-interval-summary-1-0', 'Accordion summary is keyboard focusable');
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
        await wait('document.querySelector("input[name=schedule-1-0-capacity]")?.checkVisibility()');
        assert.equal(await evaluate(`${lastNumber}.value`), '5', 'Keyboard expansion preserves edits');
        assert.equal(await evaluate(`${editor}.getBoundingClientRect().width`), width);
        assert.ok(await evaluate('document.documentElement.scrollWidth <= ' + width), 'Capacity controls fit the mobile viewport');
        await screenshot(`${width}-capacity-editor`);
        await click(button('Готово'));
        await click(button('Зберегти'));
        await wait('document.body.innerText.includes("Підтвердити розклад")');
        assert.ok(await evaluate(`Array.from(document.querySelectorAll('[data-testid="schedule-review-location"] tbody tr')).some(row => row.cells[0].textContent === '10:00–11:00' && row.cells[1].textContent === '5')`), 'Save review aligns the edited interval with its capacity');
        assert.ok(await evaluate(`(() => { const content = document.querySelector('[data-testid="schedule-review-content"]'); return content.scrollWidth <= content.clientWidth; })()`), 'Review cards fit the mobile viewport');
        await evaluate('Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {})))');
        await screenshot(`${width}-capacity-preview`);
        await click(button('Назад'));
        await click(button('Налаштувати час'));
        await click(button('Очистити час'));
        await wait(`${confirmation('Видалити всі інтервали?')} !== undefined`);
        assert.equal(await evaluate(intervalCount), 2, 'Clear all waits for confirmation');
        await click(button('Скасувати'));
        assert.equal(await evaluate(intervalCount), 2, 'Cancelling clear all preserves every interval');
        await click(button('Очистити час'));
        await click(button('Так, видалити всі'));
        await wait(`${intervalCount} === 0`);
        await wait(`${button('Додати серію')} !== undefined`);
        assert.equal(await evaluate(`${lastNumber}.value`), '3', 'Generator starts with the location default');
        await setNumber(lastNumber, '4e1');
        assert.equal(await evaluate(`${lastNumber}.value`), '3', 'Generator capacity also rejects exponent notation');
        await setNumber(lastNumber, 4);
        await click(button('Додати серію'));
        await wait(`document.querySelectorAll(${JSON.stringify('button[aria-label^="Дії інтервалу"]')}).length === 8`);
        assert.equal(await evaluate(`(${editor}.innerText.match(/Місць: 4/g) || []).length`), 8, 'Generator applies the selected capacity to every interval');
        assert.equal(await evaluate('document.querySelector("input[name=schedule-1-to]").value'), '17:00', 'Generator also uses 24-hour times');
        await click(`[...document.querySelectorAll(${JSON.stringify('button[aria-label^="Дії інтервалу"]')})].at(-1)`);
        await click("[...document.querySelectorAll('[role=menuitem]')].find(item=>item.textContent.trim()==='Видалити')");
        await wait(`${confirmation('Видалити інтервал?')} !== undefined`);
        await screenshot(`${width}-delete-confirmation`);
        assert.equal(await evaluate(intervalCount), 8, 'Selecting Delete does not immediately remove an interval');
        assert.ok(await evaluate(`(${confirmation('Видалити інтервал?')}).innerText.includes('16:00–17:00')`), 'Confirmation identifies the selected interval');
        assert.equal(await evaluate('document.activeElement.textContent.trim()'), 'Скасувати', 'Delete confirmation focuses Cancel');
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await wait(`${confirmation('Видалити інтервал?')} === undefined`);
        assert.equal(await evaluate(intervalCount), 8, 'Escape leaves the interval unchanged');
        await click(`[...document.querySelectorAll(${JSON.stringify('button[aria-label^="Дії інтервалу"]')})].at(-1)`);
        await click("[...document.querySelectorAll('[role=menuitem]')].find(item=>item.textContent.trim()==='Видалити')");
        await click(button('Так, видалити'));
        await wait(`document.querySelectorAll(${JSON.stringify('button[aria-label^="Дії інтервалу"]')}).length === 7`);
        assert.ok(await evaluate(`${editor}.innerText.includes('15:00–16:00') && !${editor}.innerText.includes('16:00–17:00')`), 'Delete removes only the interval selected through its menu');
        await click(button('Готово'));
        const locationCheckbox = `(${button('Налаштувати час')}).closest('.MuiCardContent-root').querySelector('input[type=checkbox]')`;
        await click(locationCheckbox);
        await wait(`${confirmation('Прибрати локацію з розкладу?')} !== undefined`);
        assert.equal(await evaluate(`(${locationCheckbox}).checked`), true, 'Removing a location waits for confirmation');
        await click(button('Скасувати'));
        assert.equal(await evaluate(`(${locationCheckbox}).checked`), true, 'Cancelling preserves the enabled location');
        await click(locationCheckbox);
        await click(button('Так, прибрати'));
        await wait(`${button('Налаштувати час')} === undefined`);
        console.log(`PASS ${width}px: confirmation before deleting intervals, clearing all times and removing locations; cancellation and Escape preserve data; accordion editing and validation`);
    }
    await send('Page.navigate', { url: `${base}/admin/schedule` });
    await wait(`${button('Налаштувати час')} !== undefined`);
    await click("document.querySelectorAll('.MuiFormControlLabel-root input[type=checkbox]')[2]");
    await wait(`${button('Додати серію')} !== undefined`);
    await click(button('Додати серію'));
    await wait(`${intervalCount} === 8`);
    await clickClock("document.querySelector('[data-testid=location-time-editor] [role=combobox]')");
    await wait('!!document.querySelector("[role=option]")');
    await click("[...document.querySelectorAll('[role=option]')].find(option=>option.textContent.trim()==='Локація 1')");
    await click(button('Замінити час і місця'));
    await wait(`${confirmation('Замінити час локації?')} !== undefined`);
    assert.equal(await evaluate(intervalCount), 8, 'Replacing existing intervals waits for confirmation');
    await click(button('Скасувати'));
    assert.equal(await evaluate(intervalCount), 8, 'Cancelling replacement preserves current intervals');
    await click(button('Замінити час і місця'));
    await click(button('Так, замінити'));
    await wait(`${intervalCount} === 2`);
    await click(button('Готово'));
    console.log('PASS replacing existing intervals requires confirmation; cancel preserves the old times');
    for (const page of ['locations', 'authorized-users']) {
        await send('Page.navigate', { url: `${base}/admin/${page}` });
        const actions = page === 'locations' ? 'button[aria-label^="Дії локації"]' : 'button[aria-label^="Дії користувача"]';
        await wait(`!!document.querySelector(${JSON.stringify(actions)})`);
        const before = deleteRequests.length;
        await click(`document.querySelector(${JSON.stringify(actions)})`);
        await click("[...document.querySelectorAll('[role=menuitem]')].find(item=>item.textContent.trim()==='Видалити')");
        const title = page === 'locations' ? 'Видалити локацію?' : 'Видалити користувача?';
        await wait(`${confirmation(title)} !== undefined`);
        assert.equal(deleteRequests.length, before, `${page}: requesting deletion waits for confirmation`);
        await click(button('Скасувати'));
        assert.equal(deleteRequests.length, before, `${page}: cancelling never calls DELETE`);
        console.log(`PASS ${page}: deletion already requires confirmation; cancel sends no request`);
    }
} finally {
    await send('Page.close').catch(() => {});
    socket.close(); server.close();
}
