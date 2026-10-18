// Build the client first. Uses only an isolated API fixture, never application accounts.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startFixture } from './accessibility-fixture.mjs';

let users, failPassword, failDelete;
const writes = [];
const server = await startFixture(5198, { adminUsers: async (url, request, response) => {
    if (request.method === 'GET') { response.end(JSON.stringify(users)); return; }
    let body = '';
    for await (const chunk of request) body += chunk;
    writes.push({ method: request.method, path: url.pathname, body: body ? JSON.parse(body) : null });
    await new Promise(resolve => setTimeout(resolve, 200));
    if (request.method === 'PUT' && failPassword || request.method === 'DELETE' && failDelete) {
        failPassword = false; failDelete = false;
        response.writeHead(409); response.end(JSON.stringify({ title: 'Тестова помилка. Спробуйте ще раз.' })); return;
    }
    if (request.method === 'DELETE') users = users.filter(user => user.id !== Number(url.pathname.split('/').at(-1)));
    response.writeHead(204); response.end();
} });
const base = 'http://127.0.0.1:5198';
const chrome = process.env.ADMIN_CHROME_URL || 'http://127.0.0.1:9245';
const target = await (await fetch(`${chrome}/json/new?${encodeURIComponent(base)}`, { method: 'PUT' })).json();
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
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
};
const pause = () => new Promise(resolve => setTimeout(resolve, 100));
const wait = async expression => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(); }
    throw new Error('Timed out: ' + expression);
};
const button = text => `[...document.querySelectorAll('button')].find(e=>e.checkVisibility() && e.textContent.trim()===${JSON.stringify(text)})`;
const click = async expression => { await evaluate(`(${expression}).click()`); await pause(); };
const openMenu = async id => {
    await click(`[...document.querySelectorAll('button[aria-label="Дії адміністратора Адмін ${id}"]')].find(e=>e.checkVisibility())`);
    await wait('!!document.querySelector("[role=menu]")');
};
const menuItem = text => `[...document.querySelectorAll('[role=menuitem]')].find(e=>e.textContent===${JSON.stringify(text)})`;
const input = async (name, value) => { await evaluate(`(() => {
    const e=document.querySelector('input[name="${name}"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e, ${JSON.stringify(value)});
    e.dispatchEvent(new Event('input',{bubbles:true}));
})()`); await pause(); };
const escape = async () => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await wait('!document.querySelector(".MuiDialog-root [role=dialog]")');
};
const screenshot = async name => {
    await evaluate('Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))');
    const result = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`artifacts/admin-users/${name}.png`, Buffer.from(result.data, 'base64'));
};
mkdirSync('artifacts/admin-users', { recursive: true });
try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Network.setCookie', { name: 'fixture-admin', value: 'true', url: base });
    for (const width of [320, 393, 1280]) {
        users = [1, 2].map(id => ({ id, login: `Адмін ${id}`, isActive: true, createdAtUtc: new Date().toISOString() }));
        failPassword = false; failDelete = false;
        await send('Emulation.setDeviceMetricsOverride', { width, height: 852, deviceScaleFactor: 1, mobile: width < 600 });
        await send('Page.navigate', { url: base + '/admin/users' });
        await wait(`!!document.querySelector('button[aria-label="Дії адміністратора Адмін 1"]')`);
        assert.equal(await evaluate('[...document.querySelectorAll("th")].some(e=>e.textContent==="Статус")'), false);
        await openMenu(1);
        assert.deepEqual(await evaluate('[...document.querySelectorAll("[role=menuitem]")].map(e=>e.textContent)'), ['Змінити пароль']);
        await click(menuItem('Змінити пароль'));
        await wait('!!document.querySelector("input[name=admin-new-password]")');
        const beforePassword = writes.length;
        await input('admin-new-password', 'short'); await input('admin-confirm-password', 'short');
        await click(button('Зберегти'));
        assert.equal(writes.length, beforePassword, 'Short passwords do not reach the API');
        assert.equal(await evaluate('document.querySelector("input[name=admin-new-password]").getAttribute("aria-invalid")'), 'true');
        await input('admin-new-password', 'Replacement-pass-123'); await input('admin-confirm-password', 'Mismatch-pass-123');
        await click(button('Зберегти'));
        assert.equal(writes.length, beforePassword, 'Mismatched passwords do not reach the API');
        await screenshot(`${width}-password-validation`);
        assert.ok(await evaluate('document.querySelector(".MuiDialog-root [role=dialog]").innerText.includes("Паролі мають збігатися")'), await evaluate('document.querySelector(".MuiDialog-root [role=dialog]").innerText'));
        await input('admin-confirm-password', 'Replacement-pass-123');
        failPassword = true;
        await click(button('Зберегти'));
        await wait('document.querySelector(".MuiDialog-root [role=dialog]")?.innerText.includes("Тестова помилка")');
        assert.equal(await evaluate('document.querySelector("input[name=admin-new-password]").value'), 'Replacement-pass-123');
        await click(button('Зберегти'));
        await wait('!document.querySelector(".MuiDialog-root [role=dialog]")');
        assert.deepEqual(writes.at(-1), { method: 'PUT', path: '/api/admin/users/1/password', body: { password: 'Replacement-pass-123', confirmPassword: 'Replacement-pass-123' } });
        await openMenu(1); await click(menuItem('Змінити пароль'));
        await wait('!!document.querySelector("input[name=admin-new-password]")');
        assert.equal(await evaluate('document.querySelector("input[name=admin-new-password]").value'), '', 'A reopened password form is cleared');
        await click(button('Скасувати')); await wait('!document.querySelector(".MuiDialog-root [role=dialog]")');
        await openMenu(2);
        assert.deepEqual(await evaluate('[...document.querySelectorAll("[role=menuitem]")].map(e=>e.textContent)'), ['Змінити пароль', 'Видалити']);
        await screenshot(`${width}-actions`);
        await click(menuItem('Змінити пароль'));
        await input('admin-new-password', 'Other-password-123'); await input('admin-confirm-password', 'Other-password-123');
        await click(button('Зберегти')); await wait('!document.querySelector(".MuiDialog-root [role=dialog]")');
        assert.equal(writes.at(-1).path, '/api/admin/users/2/password');
        await openMenu(2); await click(menuItem('Видалити'));
        await wait('!!document.querySelector(".MuiDialog-root [role=dialog]")');
        await evaluate('Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))');
        assert.equal(await evaluate('document.activeElement.textContent'), 'Скасувати');
        const beforeDelete = writes.length;
        await click(button('Скасувати')); await wait('!document.querySelector(".MuiDialog-root [role=dialog]")');
        assert.equal(writes.length, beforeDelete);
        await openMenu(2); await click(menuItem('Видалити')); await escape();
        assert.equal(writes.length, beforeDelete, 'Cancel and Escape never delete');
        await openMenu(2); await click(menuItem('Видалити'));
        await screenshot(`${width}-delete-confirmation`);
        failDelete = true;
        await click(button('Видалити'));
        await wait('document.querySelector(".MuiDialog-root [role=dialog]")?.innerText.includes("Тестова помилка")');
        assert.equal(users.length, 2, 'Failed deletion preserves the account and keeps the confirmation open');
        await click(button('Видалити')); await wait('!document.querySelector(".MuiDialog-root [role=dialog]")');
        assert.equal(writes.at(-1).method, 'DELETE');
        assert.equal(writes.at(-1).path, '/api/admin/users/2');
        assert.deepEqual(users.map(user => user.id), [1]);
        assert.equal(await evaluate(`document.querySelectorAll('button[aria-label="Дії адміністратора Адмін 2"]').length`), 0);
        assert.ok(await evaluate(`document.documentElement.scrollWidth <= ${width}`));
        console.log(`PASS ${width}px: self/other menus, password validation and retry, deletion confirmation, cancellation and retry`);
    }
    assert.deepEqual(errors, []);
} finally {
    await send('Page.close'); socket.close(); await new Promise(resolve => server.close(resolve));
}
