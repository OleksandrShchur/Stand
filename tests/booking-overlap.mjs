// Run after building the client; all API responses come from an isolated fixture.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startFixture, fixtureDate } from './accessibility-fixture.mjs';

const dateLabel = fixtureDate.split('-').reverse().join('.');
const message = `Ви вже записані ${dateLabel} о 09:30–10:30 у локації «Локація 2». Неможливо бути у двох локаціях одночасно. Оберіть інший час або спочатку скасуйте попередній запис.`;
let attempts = 0;
const server = await startFixture(5198, { bookingCreate: (_url, _request, response) => {
    attempts++;
    response.writeHead(409);
    response.end(JSON.stringify({ title: message, errorCode: 'BOOKING_TIME_CONFLICT' }));
} });
const base = 'http://127.0.0.1:5198';
const browser = process.env.ADMIN_CHROME_URL || 'http://127.0.0.1:9245';
const target = await (await fetch(`${browser}/json/new?${encodeURIComponent(base)}`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let nextId = 0;
const pending = new Map(), errors = [];
socket.onmessage = event => {
    const value = JSON.parse(event.data);
    if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.text);
    if (!value.id) return;
    const task = pending.get(value.id); pending.delete(value.id);
    value.error ? task.reject(value.error) : task.resolve(value.result);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
};
const wait = async expression => {
    for (let i = 0; i < 100; i++) {
        if (await evaluate(expression)) return;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Timed out: ' + expression);
};
const button = label => `[...document.querySelectorAll('button')].find(button=>button.checkVisibility() && button.textContent.trim()===${JSON.stringify(label)})`;
mkdirSync('artifacts/booking-overlap', { recursive: true });
try {
    await send('Page.enable'); await send('Runtime.enable');
    const state = { step: 'contact', date: fixtureDate, locationId: 1, locationName: 'Локація 1', timeSlotId: 1, timeSlotIds: [1] };
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `document.cookie='fixture-public=true; path=/'; sessionStorage.setItem('stand.booking.wizard.v2', ${JSON.stringify(JSON.stringify(state))})` });
    for (const width of [320, 393, 1280]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 852, deviceScaleFactor: 1, mobile: width < 600 });
        await send('Page.navigate', { url: base });
        await wait(`${button('Підтвердити запис')} !== undefined`);
        const before = attempts;
        await evaluate(`(${button('Підтвердити запис')}).click()`);
        await wait('!!document.querySelector(".MuiSnackbar-root [role=alert]")');
        assert.equal(attempts, before + 1);
        assert.equal(await evaluate('document.querySelector(".MuiSnackbar-root [role=alert]").textContent'), message);
        assert.ok(await evaluate('document.querySelector("h1").textContent.includes("Підтвердіть запис")'), 'Rejection keeps the user on confirmation');
        await wait(`!(${button('Підтвердити запис')}).disabled`);
        await evaluate('Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))');
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(`artifacts/booking-overlap/${width}-confirmation-toast.png`, Buffer.from(shot.data, 'base64'));
        const rect = await evaluate('(() => { const r=document.querySelector(".MuiSnackbar-root").getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}; })()');
        assert.ok(rect.left >= 0 && rect.right <= width && rect.top >= 0 && rect.bottom < 852, 'The complete toast fits the viewport');
        await evaluate('document.querySelector(".MuiSnackbar-root button").click()');
        await wait('!document.querySelector(".MuiSnackbar-root")');
        await evaluate(`(${button('Підтвердити запис')}).click()`);
        await wait('!!document.querySelector(".MuiSnackbar-root [role=alert]")');
        assert.equal(attempts, before + 2, 'Repeated confirmation is revalidated and shows the toast again');
        await evaluate(`(${button('Назад')}).click()`);
        await wait('document.querySelector("h1")?.textContent.includes("Оберіть час")');
        console.log(`PASS ${width}px: overlap rejection shows the detailed toast, keeps confirmation available and lets the user choose another time`);
    }
    assert.deepEqual(errors, []);
} finally {
    await send('Page.close'); socket.close(); await new Promise(resolve => server.close(resolve));
}
