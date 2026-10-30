// Build the client first; uses the isolated API fixture and headless Chrome CDP.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { startFixture, fixtureDate } from './accessibility-fixture.mjs';

const browser = process.env.A11Y_CHROME_URL || 'http://127.0.0.1:9241';
const previous = { startTime: '09:00', endTime: '10:00', participants: [
    { firstName: 'Олександра-Марія', lastName: 'Довгопрізвищенська' },
    { firstName: 'Андрій', lastName: 'Коваль' },
] };
const next = { startTime: '11:00', endTime: '12:00', participants: [{ firstName: 'Ірина', lastName: 'Мельник' }] };
let neighbors = { previousShifts: [previous], nextShifts: [next] };
const server = await startFixture(5197, { myShifts: (_, response) => response.end(JSON.stringify([{
    id: 1, date: fixtureDate, locationName: 'Центральна локація', locationAddress: 'вул. Тестова, 1',
    startTime: '10:00', endTime: '11:00', cancelToken: 'fixture-token',
    participants: [{ firstName: 'Олена', lastName: 'Партнерка' }], ...neighbors,
}])) });
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
async function open(path) {
    await send('Page.navigate', { url: `http://127.0.0.1:5197${path}` });
    for (let i = 0; i < 100; i++) {
        if (await evaluate(`!!document.querySelector('main') && document.querySelector('main').innerText.includes('Центральна локація')`)) return;
        await pause(50);
    }
    throw new Error('Bookings did not load');
}
const section = `document.querySelector('section[aria-label="Хто чергує до та після вас"]')`;
try {
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Network.setCookie', { name: 'fixture-public', value: 'true', url: 'http://127.0.0.1:5197' });
    for (const width of [320, 390, 1280]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
        neighbors = { previousShifts: [previous], nextShifts: [next] };
        for (const path of ['/my-shifts', '/']) {
            await open(path);
            const text = await evaluate(`${section}.innerText`);
            for (const value of ['До вас', '09:00–10:00', 'Олександра-Марія Довгопрізвищенська', 'Андрій Коваль', 'Після вас', '11:00–12:00', 'Ірина Мельник']) assert.ok(text.includes(value), value);
            assert.equal(await evaluate(`document.documentElement.scrollWidth > window.innerWidth`), false, 'No horizontal overflow');
            assert.equal(await evaluate(`Array.from(${section}.querySelectorAll('dd')).some(e => e.scrollWidth > e.clientWidth)`), false, 'Long names wrap');
        }
        await open('/my-shifts');
        assert.ok(await evaluate(`document.querySelector('main').innerText.includes('Олена Партнерка')`), 'Current partners are still visible');
        if (width === 390) {
            await pause(350); // Let the page entrance animation finish before capturing.
            await mkdir('artifacts', { recursive: true });
            const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
            await writeFile('artifacts/adjacent-shifts-mobile.png', Buffer.from(screenshot.data, 'base64'));
        }
        for (const [before, after] of [[[], [next]], [[previous], []], [[], []], [[{ ...previous, participants: [] }], [{ ...next, participants: [] }]]]) {
            neighbors = { previousShifts: before, nextShifts: after };
            await open('/my-shifts');
            const labels = await evaluate(`Array.from(document.querySelectorAll('section dt')).map(e => e.innerText)`);
            assert.deepEqual(labels, [
                ...(before.some(slot => slot.participants.length) ? ['До вас'] : []),
                ...(after.some(slot => slot.participants.length) ? ['Після вас'] : []),
            ]);
            assert.equal(await evaluate(`!!${section}`), labels.length > 0, 'Empty rows and their container are hidden');
        }
        neighbors = {};
        await open('/my-shifts');
        assert.equal(await evaluate(`!!${section}`), false, 'Older responses without neighbors remain readable');
        console.log(`PASS ${width}px: times and all names, long-name wrapping, home preview, existing partners, either/both empty sides and older responses`);
    }
    assert.deepEqual(errors, [], 'No browser exceptions');
} finally {
    socket.close();
    await fetch(`${browser}/json/close/${target.id}`);
    await new Promise(resolve => server.close(resolve));
}
