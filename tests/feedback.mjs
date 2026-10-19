// Build the client first; uses an isolated fixture and headless Chrome CDP, without a database.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startFixture } from './accessibility-fixture.mjs';

const submissions = [];
let failNext = false;
let hold = false;
let reply;
const server = await startFixture(5199, {
    feedbackCreate: async (_, request, response) => {
        let body = '';
        for await (const chunk of request) body += chunk;
        submissions.push(JSON.parse(body));
        if (failNext) {
            failNext = false;
            response.writeHead(400);
            response.end(JSON.stringify({ title: 'Не вдалося надіслати відгук. Спробуйте ще раз.' }));
        } else if (hold) reply = () => { response.writeHead(204); response.end(); };
        else { response.writeHead(204); response.end(); }
    },
});
const base = 'http://127.0.0.1:5199';
const debuggerUrl = process.env.FEEDBACK_CHROME_URL || 'http://127.0.0.1:9248';
const target = await (await fetch(`${debuggerUrl}/json/new?about:blank`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let nextId = 0;
const pending = new Map();
const feedbackReads = [];
const errors = [];
socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Network.requestWillBeSent' && message.params.request.url.includes('/api/feedback') && message.params.request.method === 'GET')
        feedbackReads.push(message.params.request.url);
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
const button = text => `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)})`;
const input = 'document.querySelector("textarea:not([aria-hidden])")';
const setText = async text => {
    await evaluate(`(() => { const e=${input}; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(text)}); e.dispatchEvent(new Event('input',{bubbles:true})); })()`);
};
const feedbackIcon = `document.querySelector(${JSON.stringify('a[aria-label="Залишити відгук"]')})`;
const screenshot = async name => {
    await new Promise(resolve => setTimeout(resolve, 400));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`artifacts/feedback/${name}.png`, Buffer.from(shot.data, 'base64'));
};
mkdirSync('artifacts/feedback', { recursive: true });
try {
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Network.setCookie', { name: 'fixture-public', value: 'true', url: base });
    for (const width of [320, 393, 414]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 852, deviceScaleFactor: 1, mobile: true, screenWidth: width, screenHeight: 852 });
        await send('Page.navigate', { url: base });
        await wait(`${feedbackIcon} !== null`);
        assert.equal(await evaluate(`(() => { const f=${feedbackIcon}.getBoundingClientRect(); const s=document.querySelector('button[aria-label="Технічна підтримка"]').getBoundingClientRect(); return f.right<=s.left; })()`), true, 'Feedback appears directly left of support');
        await screenshot(`${width}-home`);
        await evaluate(`${feedbackIcon}.click()`);
        await wait(`${input} !== null`);
        assert.equal(await evaluate('document.querySelector("header").innerText.includes("Відгук")'), true);
        assert.equal(await evaluate(`${feedbackIcon}`), null, 'Feedback shortcut is home-only');
        assert.equal(await evaluate('document.querySelector("#feedback-privacy").innerText.includes("не анонімний")'), true);
        assert.equal(await evaluate(`${button('Надіслати')}.disabled`), true);
        await setText(' \n\t');
        assert.equal(await evaluate(`${button('Надіслати')}.disabled`), true);
        const geometry = await evaluate(`(() => { const b=${button('Назад')}.getBoundingClientRect(); const s=${button('Надіслати')}.getBoundingClientRect(); return {back:b.width,submit:s.width,bottom:s.bottom,scroll:document.documentElement.scrollWidth,width:innerWidth}; })()`);
        assert.ok(Math.abs(geometry.back - geometry.submit) < 1, 'Bottom buttons split the available width equally');
        assert.ok(geometry.bottom <= 852 && geometry.bottom >= 796, 'Buttons stay at the bottom');
        assert.ok(geometry.scroll <= geometry.width, 'Page fits the mobile viewport');
        await setText('Тестовий відгук');
        failNext = true;
        await evaluate(`${button('Надіслати')}.click()`);
        await wait('document.querySelector("[role=alert]")?.innerText.includes("Не вдалося")');
        assert.equal(await evaluate(`${input}.value`), 'Тестовий відгук', 'Submission failure keeps the draft');
        await setText('');
        await evaluate(`${input}.focus()`);
        await send('Input.insertText', { text: 'а'.repeat(501) });
        assert.equal(await evaluate(`${input}.value.length`), 500, 'Native editing stops at 500 characters');
        assert.equal(await evaluate(`${button('Надіслати')}.disabled`), false);
        await screenshot(`${width}-feedback`);
        const before = submissions.length;
        hold = true;
        await evaluate(`${button('Надіслати')}.click(); document.querySelector('#feedback-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));`);
        for (let i = 0; i < 100 && submissions.length === before; i++) await pause();
        assert.equal(submissions.length, before + 1, 'Repeated submission sends one request');
        assert.equal(await evaluate(`${button('Назад')}.disabled && ${button('Надіслати')}.disabled && ${input}.disabled`), true);
        assert.deepEqual(Object.keys(submissions.at(-1)), ['comment'], 'Client sends only the comment, without booking or identity fields');
        assert.equal(submissions.at(-1).comment.length, 500);
        hold = false; reply();
        await wait('document.querySelector("[role=alert]")?.innerText.includes("Дякуємо")');
        assert.equal(await evaluate(`${input}.value`), '', 'Success clears the comment');
        await send('Page.reload');
        await wait(`${input} !== null`);
        assert.equal(await evaluate(`${input}.value`), '', 'Submitted comments are not restored on reload');
        await evaluate(`${button('Назад')}.click()`);
        await wait(`${feedbackIcon} !== null`);
        await evaluate(`${button('Записатись на стенд')}.click()`);
        await wait(`!!document.querySelector("h1") && !${feedbackIcon}`);
        await send('Page.navigate', { url: base + '/my-shifts' });
        await wait('document.querySelector("header")?.innerText.includes("Мої записи")');
        assert.equal(await evaluate(`${feedbackIcon}`), null);
        await evaluate('sessionStorage.clear()');
        console.log(`PASS ${width}px: home-only icon, private feedback page, 500-character cap, error recovery, equal buttons, one submission, no history`);
    }
    assert.deepEqual(feedbackReads, []);
    assert.deepEqual(errors, []);
    await send('Network.deleteCookies', { name: 'fixture-public', url: base });
    await send('Page.navigate', { url: base + '/feedback' });
    await wait('location.pathname === "/login"');
    console.log('PASS feedback requires sign-in and never requests comment history');
} finally {
    await send('Page.close');
    socket.close();
    await new Promise(resolve => server.close(resolve));
}
