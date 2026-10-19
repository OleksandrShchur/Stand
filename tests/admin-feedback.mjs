// Build the client first. Uses mocked APIs and an isolated Chrome CDP endpoint, without a database.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startFixture } from './accessibility-fixture.mjs';

const feedback = Array.from({ length: 28 }, (_, index) => ({
    id: 1000 - index,
    firstName: index === 0 ? 'ДовгеІм’я'.repeat(13).slice(0, 100) : `Ім’я ${index + 1}`,
    lastName: index === 0 ? 'ДовгеПрізвище'.repeat(10).slice(0, 100) : `Прізвище ${index + 1}`,
    phone: '+380671234567',
    comment: index === 0 ? ('Перший рядок.\nДругий рядок.\n<b>Це текст</b>\n' + 'ДовгийКоментар'.repeat(50)).slice(0, 500) : `Відгук ${index + 1}. Дякую за зручний сайт!`,
    createdAtUtc: new Date(Date.UTC(2026, 9, 20, 12, 0) - index * 60000).toISOString(),
}));
const requests = [];
let responseMode = 'normal';
const server = await startFixture(5199, {
    adminFeedback: (url, response) => {
        const page = Number(url.searchParams.get('page')) || 1;
        const pageSize = Number(url.searchParams.get('pageSize')) || 10;
        requests.push({ page, pageSize });
        if (responseMode === 'error') { response.writeHead(503); response.end(JSON.stringify({ title: 'Не вдалося завантажити відгуки.' })); return; }
        const items = responseMode === 'empty' ? [] : feedback.slice((page - 1) * pageSize, page * pageSize);
        response.end(JSON.stringify({ items, totalCount: responseMode === 'empty' ? 0 : feedback.length, page, pageSize }));
    },
});
const base = 'http://127.0.0.1:5199';
const debuggerUrl = process.env.ADMIN_CHROME_URL || 'http://127.0.0.1:9249';
const target = await (await fetch(`${debuggerUrl}/json/new?about:blank`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let nextId = 0;
const pending = new Map();
const mutations = [];
const errors = [];
socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Network.requestWillBeSent' && message.params.request.url.includes('/api/admin/feedback') && message.params.request.method !== 'GET') mutations.push(message.params.request);
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
const actions = `[...document.querySelectorAll('button[aria-label^="Дії для відгуку"]')].filter(e => e.checkVisibility())`;
const button = text => `[...document.querySelectorAll('button')].find(b => b.checkVisibility() && b.textContent.trim() === ${JSON.stringify(text)})`;
const pointerClick = async expression => {
    const point = await evaluate(`(() => { const e=${expression}; e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
};
const screenshot = async name => {
    await new Promise(resolve => setTimeout(resolve, 400));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`artifacts/admin-feedback/${name}.png`, Buffer.from(shot.data, 'base64'));
};
mkdirSync('artifacts/admin-feedback', { recursive: true });
try {
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Network.setCookie', { name: 'fixture-admin', value: 'true', url: base });
    for (const width of [320, 393, 414, 1024, 1440]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600, screenWidth: width, screenHeight: 900 });
        await send('Page.navigate', { url: base + (width < 600 ? '/admin' : '/admin/feedback') });
        if (width < 600) {
            await wait(`!!document.querySelector('button[aria-label="Відкрити меню адміністратора"]')`);
            await evaluate(`document.querySelector('button[aria-label="Відкрити меню адміністратора"]').click()`);
            await wait(`[...document.querySelectorAll('a[href="/admin/feedback"]')].some(e => e.checkVisibility())`);
            await evaluate(`[...document.querySelectorAll('a[href="/admin/feedback"]')].find(e => e.checkVisibility()).click()`);
        }
        await wait(`${actions}.length === 10`);
        assert.equal(await evaluate('document.querySelector("h1").textContent'), 'Відгуки');
        assert.equal(await evaluate(`document.querySelector('table[aria-label="Відгуки користувачів"]').checkVisibility()`), width >= 900);
        assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Long names and comments do not overflow the viewport');
        await screenshot(`${width}-list`);
        await evaluate(`${actions}[0].click()`);
        await wait('!!document.querySelector("[role=menu]")');
        assert.deepEqual(await evaluate(`[...document.querySelectorAll('[role=menuitem]')].map(e => e.textContent.trim())`), ['Деталі']);
        await evaluate(`document.querySelector('[role=menuitem]').click()`);
        await wait(`document.querySelector('.MuiDialog-root [role=dialog]')?.textContent.includes('Деталі відгуку')`);
        const details = await evaluate(`(() => { const d=document.querySelector('.MuiDialog-root [role=dialog]'); return {labels:[...d.querySelectorAll('dt')].map(e=>e.textContent), values:[...d.querySelectorAll('dd')].map(e=>e.textContent), phone:d.querySelector('a[href^="tel:"]').getAttribute('href'), html:!!d.querySelector('dd b'), width:d.getBoundingClientRect().width,scroll:d.scrollWidth}; })()`);
        assert.deepEqual(details.labels, ['Ім’я', 'Прізвище', 'Телефон', 'Дата', 'Коментар']);
        assert.equal(details.values[0], feedback[0].firstName);
        assert.equal(details.values[1], feedback[0].lastName);
        assert.equal(details.phone, `tel:${feedback[0].phone}`);
        assert.equal(details.values[3], '20.10.2026, 15:00');
        assert.equal(details.values[4], feedback[0].comment);
        assert.equal(details.html, false, 'User comments render as text, including markup');
        assert.ok(details.scroll <= details.width + 1, 'Details remain readable within the modal');
        await screenshot(`${width}-details`);
        await evaluate(`${button('Закрити')}.click()`);
        await wait('!document.querySelector(".MuiDialog-root [role=dialog]")');
        await evaluate(`document.querySelector('button[aria-label="Наступна сторінка"]').click()`);
        await wait(`${actions}[0]?.id.endsWith('-990')`);
        assert.deepEqual(requests.at(-1), { page: 2, pageSize: 10 }, 'Pagination requests the next page from the server');
        await evaluate(`document.querySelector('button[aria-label="Наступна сторінка"]').click()`);
        await wait(`${actions}.length === 8 && ${actions}[0]?.id.endsWith('-980')`);
        assert.equal(await evaluate(`document.querySelector('button[aria-label="Наступна сторінка"]').disabled`), true);
        await pointerClick(`document.querySelector('[role=combobox]')`);
        await wait(`!!document.querySelector('[role=option][data-value="25"]')`);
        await evaluate(`document.querySelector('[role=option][data-value="25"]').click()`);
        await wait(`${actions}.length === 25`);
        assert.deepEqual(requests.at(-1), { page: 1, pageSize: 25 }, 'Changing page size resets to the first page');
        console.log(`PASS ${width}px: admin menu, responsive view, complete read-only details, long content, Kyiv date, server pagination`);
    }
    responseMode = 'error';
    await send('Page.navigate', { url: base + '/admin/feedback' });
    await wait(`document.querySelector('[role=alert]')?.textContent.includes('Не вдалося')`);
    responseMode = 'normal';
    await evaluate(`${button('Спробувати знову')}.click()`);
    await wait(`${actions}.length === 10`);
    responseMode = 'empty';
    await send('Page.reload');
    await wait(`document.querySelector('main')?.textContent.includes('Відгуків поки немає.')`);
    assert.equal(await evaluate(`${actions}.length`), 0);
    assert.deepEqual(mutations, [], 'Viewing feedback never sends mutation requests');
    assert.deepEqual(errors, []);
    await send('Network.deleteCookies', { name: 'fixture-admin', url: base });
    await send('Network.setCookie', { name: 'fixture-public', value: 'true', url: base });
    await send('Page.navigate', { url: base + '/admin/feedback' });
    await wait('location.pathname === "/admin/login"');
    console.log('PASS error recovery, empty state, no mutations, public users cannot open admin feedback');
} finally {
    await send('Page.close');
    socket.close();
    await new Promise(resolve => server.close(resolve));
}
