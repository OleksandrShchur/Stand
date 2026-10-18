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
const pause = () => new Promise(resolve => setTimeout(resolve, 150));
const wait = async expression => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(); }
    throw new Error('Timed out: ' + expression);
};
const button = text => `[...document.querySelectorAll('button')].find(b => b.checkVisibility() && b.textContent.trim() === ${JSON.stringify(text)})`;
const click = async expression => { await evaluate(`(${expression}).click()`); await pause(); };
const setNumber = async (expression, value) => {
    await evaluate(`(() => { const e=${expression}; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))}); e.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await pause();
};
const screenshot = async name => {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`artifacts/admin-slot-capacity/${name}.png`, Buffer.from(shot.data, 'base64'));
};
const editor = 'document.querySelector("[data-testid=location-time-editor] [role=dialog]")';
const editButton = `document.querySelector(${JSON.stringify('button[aria-label="Змінити інтервал 10:00–11:00"]')})`;
const lastNumber = '[...document.querySelectorAll("[data-testid=location-time-editor] input[type=number]")].filter(e=>e.checkVisibility()).at(-1)';
mkdirSync('artifacts/admin-slot-capacity', { recursive: true });
try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Network.setCookie', { name: 'fixture-admin', value: 'true', url: base });
    for (const width of [320, 393, 414]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 852, deviceScaleFactor: 1, mobile: true, screenWidth: width, screenHeight: 852 });
        await send('Page.navigate', { url: base + '/admin/schedule' });
        await wait(`${button('Налаштувати час')} !== undefined`);
        await click(button('Налаштувати час'));
        await wait(`${editor} !== null`);
        await click(editButton);
        assert.equal(await evaluate(`${lastNumber}.value`), '3', 'Existing interval capacity is loaded');
        await setNumber(lastNumber, 0);
        await wait(`${editor}.innerText.includes('цілим числом')`);
        await setNumber(lastNumber, 5);
        await wait(`${editor}.innerText.includes('Місць: 5') && !${editor}.innerText.includes('цілим числом')`);
        assert.equal(await evaluate(`${editor}.getBoundingClientRect().width`), width);
        assert.ok(await evaluate('document.documentElement.scrollWidth <= ' + width), 'Capacity controls fit the mobile viewport');
        await screenshot(`${width}-capacity-editor`);
        await click(button('Готово'));
        await click(button('Зберегти'));
        await wait('document.body.innerText.includes("Підтвердити розклад")');
        assert.ok(await evaluate('document.body.innerText.includes("10:00–11:00 · 5 місць")'), 'Save review shows the edited capacity');
        await screenshot(`${width}-capacity-preview`);
        await click(button('Назад до редагування'));
        await click(button('Налаштувати час'));
        await click(button('Очистити час'));
        await wait(`${button('Додати серію')} !== undefined`);
        assert.equal(await evaluate(`${lastNumber}.value`), '3', 'Generator starts with the location default');
        await setNumber(lastNumber, 4);
        await click(button('Додати серію'));
        await wait(`document.querySelectorAll(${JSON.stringify('button[aria-label^="Видалити інтервал"]')}).length === 8`);
        assert.equal(await evaluate(`(${editor}.innerText.match(/Місць: 4/g) || []).length`), 8, 'Generator applies the selected capacity to every interval');
        console.log(`PASS ${width}px: capacity edit, validation, preview and series generation`);
    }
} finally {
    await send('Page.close').catch(() => {});
    socket.close(); server.close();
}
