// Build the client first. Uses an isolated API fixture and Chrome CDP, without application data.
import assert from 'node:assert/strict';
import { startFixture } from './accessibility-fixture.mjs';

let logoutRequests = 0;
let failNext = false;
let finishLogout;
const server = await startFixture(5199, { adminLogout: (_, response) => {
    logoutRequests++;
    if (failNext) {
        failNext = false;
        response.writeHead(503);
        response.end(JSON.stringify({ title: 'Не вдалося вийти. Спробуйте ще раз.' }));
    } else finishLogout = () => {
        response.setHeader('Set-Cookie', 'fixture-admin=; Max-Age=0; Path=/');
        response.writeHead(204); response.end();
    };
} });
const base = 'http://127.0.0.1:5199';
const debuggerUrl = process.env.ADMIN_CHROME_URL || 'http://127.0.0.1:9250';
const target = await (await fetch(`${debuggerUrl}/json/new?about:blank`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let nextId = 0;
const pending = new Map();
const errors = [];
socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (!message.id) return;
    const task = pending.get(message.id); pending.delete(message.id);
    message.error ? task.reject(message.error) : task.resolve(message.result);
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
const dialog = `document.querySelector('.MuiDialog-root [role=dialog]')`;
const button = text => `[...document.querySelectorAll('.MuiDialog-root button')].find(e => e.textContent.trim() === ${JSON.stringify(text)})`;
const escape = async () => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
};
const backdrop = async () => {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, x: 4, y: 4 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x: 4, y: 4 });
};
const openLogout = async () => {
    await evaluate(`[...document.querySelectorAll('button')].find(e=>e.checkVisibility() && e.textContent.trim().startsWith('Вийти (')).click()`);
    await wait(`${dialog}?.textContent.includes('Вийти з адмін-панелі?')`);
    await wait('document.activeElement?.textContent.trim() === "Скасувати"');
};
try {
    await send('Page.enable'); await send('Runtime.enable');
    for (const width of [320, 393, 1024]) {
        const baseline = logoutRequests;
        await send('Network.setCookie', { name: 'fixture-admin', value: 'true', url: base });
        await send('Emulation.setDeviceMetricsOverride', { width, height: 852, deviceScaleFactor: 1, mobile: width < 600 });
        await send('Page.navigate', { url: base + '/admin' });
        await wait('!!document.querySelector("h1")');
        if (width < 600) {
            await evaluate(`document.querySelector('button[aria-label="Відкрити меню адміністратора"]').click()`);
            await wait(`[...document.querySelectorAll('button')].some(e=>e.checkVisibility() && e.textContent.includes('Вийти ('))`);
        }
        await openLogout();
        assert.equal(logoutRequests, baseline, 'Opening confirmation does not call logout');
        await evaluate(`${button('Скасувати')}.click()`);
        await wait(`!${dialog}`);
        await openLogout();
        await escape();
        await wait(`!${dialog}`);
        await openLogout();
        await new Promise(resolve => setTimeout(resolve, 250));
        await backdrop();
        await wait(`!${dialog}`);
        assert.equal(logoutRequests, baseline, 'Cancel, Escape and backdrop leave the session unchanged');
        assert.equal(await evaluate('location.pathname'), '/admin');
        await openLogout();
        failNext = true;
        await evaluate(`${button('Вийти')}.click()`);
        await wait(`${dialog}?.querySelector('[role=alert]')?.textContent.includes('Не вдалося вийти')`);
        assert.equal(await evaluate('location.pathname'), '/admin', 'Failed logout keeps the current page and session');
        await evaluate(`${button('Вийти')}.click(); ${button('Вийти')}.click()`);
        for (let i = 0; i < 100 && logoutRequests < baseline + 2; i++) await pause();
        assert.equal(logoutRequests, baseline + 2, 'Repeated confirmation sends one in-flight logout');
        assert.equal(await evaluate(`${button('Скасувати')}.disabled && ${button('Вийти')}.disabled`), true);
        await escape(); await backdrop(); await pause();
        assert.equal(await evaluate(`!!${dialog}`), true, 'Pending logout cannot be dismissed');
        finishLogout();
        await wait('location.pathname === "/admin/login"');
        console.log(`PASS ${width}px: confirmation, Cancel focus, safe dismissal, error recovery, submission lock, login redirect`);
    }
    assert.deepEqual(errors, []);
} finally {
    await send('Page.close');
    socket.close();
    await new Promise(resolve => server.close(resolve));
}
