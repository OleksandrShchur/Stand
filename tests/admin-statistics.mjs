// Production UI against isolated responses; never contacts the application database.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { startFixture } from './accessibility-fixture.mjs';

const requests = [], errors = [];
let empty = false, fail = false;
const people = [
    { id: 1, firstName: 'Олена', lastName: 'Тестова', phone: '+380670000001' },
    { id: 2, firstName: 'Ірина', lastName: 'Інша', phone: '+380670000002' },
];
const server = await startFixture(5201, { dashboard: async (url, response) => {
    const query = Object.fromEntries(url.searchParams);
    requests.push({ path: url.pathname, ...query });
    const send = data => response.end(JSON.stringify(data));
    if (fail) { fail = false; response.writeHead(503); return send({ title: 'Тестова помилка статистики' }); }
    if (url.pathname.endsWith('/people')) {
        // Force a slow previous query to exercise cancellation.
        if (query.search === 'Оле') await new Promise(resolve => setTimeout(resolve, 700));
        return send(query.search.startsWith('Іри') ? [people[1]] : [people[0]]);
    }
    const personal = query.personId === '1';
    if (url.pathname.endsWith('/periods')) return send({ today: '2026-11-06', months: empty ? [] : personal
        ? [{ year: 2026, month: 3 }]
        : [{ year: 2027, month: 2 }, { year: 2026, month: 11 }, { year: 2026, month: 10 }] });
    const year = Number(query.year), month = Number(query.month || (query.quarter ? (Number(query.quarter) - 1) * 3 + 1 : 1));
    const count = query.period === 'month' ? new Date(Date.UTC(year, month, 0)).getUTCDate() : query.period === 'quarter' ? 3 : 12;
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = query.period === 'year' ? 12 : query.period === 'quarter' ? month + 2 : month;
    const end = `${year}-${String(endMonth).padStart(2, '0')}-${new Date(Date.UTC(year, endMonth, 0)).getUTCDate()}`;
    return send({ dateFrom: start, dateTo: end,
        summary: { booked: personal ? 3 : 12, bookedHours: personal ? 4.5 : 18, activeDays: 3, locationCount: 2, scheduledPlaces: personal ? null : 24, fillRatePercent: personal ? null : 50 },
        byLocation: [1, 2].map(id => ({ locationId: id, locationName: id === 1 ? 'Центр міста' : 'Залізничний вокзал', booked: personal ? id : 6, bookedHours: personal ? id * 1.5 : 9, scheduledPlaces: personal ? null : 12, fillRatePercent: personal ? null : 50 })),
        trend: Array.from({ length: count }, (_, i) => ({ date: query.period === 'month'
            ? `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
            : `${year}-${String(month + i).padStart(2, '0')}-01`, booked: i === 0 ? personal ? 3 : 12 : 0, bookedHours: i === 0 ? personal ? 4.5 : 18 : 0 })),
    });
} });
const base = 'http://127.0.0.1:5201';
const chrome = process.env.STATISTICS_CHROME_URL || 'http://127.0.0.1:9251';
const target = await (await fetch(`${chrome}/json/new?${encodeURIComponent(base)}`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let nextId = 0;
const pending = new Map();
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
    if (result.exceptionDetails) throw new Error((result.exceptionDetails.exception?.description || result.exceptionDetails.text) + '\nExpression: ' + expression);
    return result.result.value;
};
const pause = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms));
const wait = async expression => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(); }
    throw new Error('Timed out: ' + expression + '\n' + await evaluate('document.body.innerText'));
};
const click = async expression => { await evaluate(`(${expression}).click()`); await pause(250); };
const button = text => `[...document.querySelectorAll('button')].find(e=>e.checkVisibility() && e.textContent.trim()===${JSON.stringify(text)})`;
const openSelect = async index => {
    await evaluate(`document.querySelectorAll('main [role=combobox]')[${index}].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))`);
    await wait('!!document.querySelector("[role=listbox]")');
};
const ready = () => wait('!!document.querySelector("main svg[role=img]")');
const input = async text => {
    await evaluate(`(() => { const e=document.querySelector('input[role=combobox]');
        e.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e, ${JSON.stringify(text)});
        e.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await pause();
};
const choose = async (index, value) => {
    await openSelect(index);
    await click(`[...document.querySelectorAll('[role=option]')].find(e=>e.getAttribute('data-value')===${JSON.stringify(String(value))})`);
    await ready();
};
const scrollThroughTable = async distance => {
    await evaluate(`(() => {
        const details = document.querySelector('main details');
        const topBar = document.querySelector('header.MuiAppBar-root');
        const offset = topBar?.getBoundingClientRect().height ?? 0;
        window.scrollTo(0, details.getBoundingClientRect().top + window.scrollY - offset + ${distance});
    })()`);
    await pause(100);
    return evaluate(`(() => {
        const summary = document.querySelector('main summary');
        const bounds = summary.getBoundingClientRect();
        return {
            scrollY: window.scrollY,
            topBarBottom: document.querySelector('header.MuiAppBar-root')?.getBoundingClientRect().bottom ?? 0,
            summaryTop: bounds.top, summaryBottom: bounds.bottom,
            headerTop: document.querySelector('main thead th').getBoundingClientRect().top,
            rowTop: document.querySelector('main tbody tr').getBoundingClientRect().top,
            toggleAccessible: document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)?.closest('summary') === summary,
        };
    })()`);
};
const screenshot = async name => {
    await evaluate('Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))');
    const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    writeFileSync(`artifacts/admin-statistics/${name}.png`, Buffer.from(result.data, 'base64'));
};
mkdirSync('artifacts/admin-statistics', { recursive: true });
try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Network.setCookie', { name: 'fixture-admin', value: 'true', url: base });
    for (const width of [320, 393, 568, 1280]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: width === 568 ? 450 : 900, deviceScaleFactor: 1, mobile: width < 600 });
        await send('Page.navigate', { url: base + '/admin' }); await ready();
        assert.equal(requests.at(-1).month, '11', 'Defaults to the current month with data');
        await openSelect(0);
        assert.deepEqual(await evaluate('[...document.querySelectorAll("[role=option]")].map(e=>e.textContent)'), ['2027', '2026']);
        await click('[...document.querySelectorAll("[role=option]")].find(e=>e.textContent==="2026")');
        await openSelect(1);
        assert.deepEqual(await evaluate('[...document.querySelectorAll("[role=option]")].map(e=>e.textContent)'), ['Жовтень', 'Листопад']);
        await click('[...document.querySelectorAll("[role=option]")].find(e=>e.textContent==="Жовтень")'); await ready();
        assert.equal(requests.at(-1).month, '10');
        await click(button('Квартал')); await ready(); assert.equal(requests.at(-1).quarter, '4');
        await choose(0, 2027); assert.equal(requests.at(-1).quarter, '1');
        await click(button('Рік')); await ready(); assert.equal(requests.at(-1).period, 'year');
        assert.equal(requests.at(-1).year, '2027'); assert.equal(requests.at(-1).month, undefined);
        await click('document.querySelector("main summary")');
        assert.equal(await evaluate('document.querySelectorAll("main tbody tr").length'), 12);
        assert.deepEqual(await evaluate('[...document.querySelectorAll("main thead th")].map(e=>e.textContent)'), ['Місяць', 'Записи']);
        await click(button('Місяць')); await ready();
        await click('document.querySelector("main summary")');
        assert.equal(await evaluate('document.querySelectorAll("main tbody tr").length'), 28);
        assert.deepEqual(await evaluate('[...document.querySelectorAll("main thead th")].map(e=>e.textContent)'), ['Дата', 'Записи']);
        const first = await scrollThroughTable(100);
        const second = await scrollThroughTable(180);
        assert.ok(second.scrollY > first.scrollY && second.rowTop < first.rowTop, 'Rows move with page scrolling');
        for (const frozen of [first, second]) {
            assert.ok(Math.abs(frozen.summaryTop - frozen.topBarBottom) < 1, 'Chart toggle sticks below the top bar: ' + JSON.stringify(frozen));
            assert.ok(Math.abs(frozen.headerTop - frozen.summaryBottom) < 1, 'Column headers stick directly below the chart toggle: ' + JSON.stringify(frozen));
            assert.ok(frozen.toggleAccessible, 'The sticky chart toggle stays reachable');
        }
        await screenshot(`${width}-frozen-headers`);
        await click('document.querySelector("main summary")');
        await wait('!document.querySelector("main details").open');
        assert.ok(await evaluate(`(() => {
            const bounds = document.querySelector('main summary').getBoundingClientRect();
            const top = document.querySelector('header.MuiAppBar-root')?.getBoundingClientRect().bottom ?? 0;
            return bounds.top >= top && bounds.bottom <= window.innerHeight;
        })()`), 'Collapsing the table while scrolled keeps its toggle visible');
        await click('document.querySelector("main summary")');
        await evaluate('window.scrollTo(0,0)'); await pause();
        assert.ok(await evaluate(`document.documentElement.scrollWidth <= ${width}`), 'Location report fits the viewport: ' + JSON.stringify(await evaluate(`
            [...document.querySelectorAll('main *')].map(e => ({ tag: e.tagName, className: e.className?.baseVal ?? e.className, right: e.getBoundingClientRect().right, width: e.getBoundingClientRect().width }))
                .filter(e => e.right > ${width} + 1).slice(0, 12)
        `)));
        await screenshot(`${width}-locations`);
        await click(button('За людиною'));
        const before = requests.filter(r => r.path.endsWith('/people')).length;
        await input('Ол'); await pause(350);
        assert.equal(requests.filter(r => r.path.endsWith('/people')).length, before, 'Two characters do not search');
        await input('Оле'); await pause(300); await input('Іри');
        await wait('document.querySelector("[role=option]")?.innerText.includes("Ірина")'); await pause(750);
        assert.ok(await evaluate('document.querySelector("[role=option]").innerText.includes("Ірина")'), 'A slow old query cannot replace current search results');
        await input('Тестова'); await wait('document.querySelector("[role=option]")?.innerText.includes("Олена")');
        assert.ok(await evaluate('document.querySelector("[role=option]").innerText.includes("+38 067 000 00 01")'));
        await click('document.querySelector("[role=option]")'); await ready();
        assert.equal(requests.at(-1).personId, '1'); assert.equal(requests.at(-1).month, '3');
        assert.equal(await evaluate('document.querySelector("input[role=combobox]").value'), 'Олена Тестова · +38 067 000 00 01');
        await click(button('Квартал')); await ready(); assert.equal(requests.at(-1).quarter, '1');
        await click(button('Рік')); await ready(); assert.equal(requests.at(-1).personId, '1');
        const href = await evaluate(`document.querySelector('main a[href^="/admin/bookings?"]').getAttribute('href')`);
        assert.deepEqual(Object.fromEntries(new URL(href, base).searchParams), { dateFrom: '2026-01-01', dateTo: '2026-12-31', isBooked: 'true', phone: people[0].phone });
        assert.ok(await evaluate(`document.documentElement.scrollWidth <= ${width}`), 'Person report fits the viewport');
        await screenshot(`${width}-person`);
        const axeSource = readFileSync('artifacts/axe.min.js', 'utf8');
        await evaluate(axeSource);
        const audit = await evaluate('axe.run(document, {runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa","wcag22aa","best-practice"]}})');
        writeFileSync(`artifacts/admin-statistics/${width}-axe.json`, JSON.stringify(audit.violations, null, 2));
        assert.deepEqual(audit.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), []);
        await click(`document.querySelector('button[aria-label="Очистити пошук"]')`);
        await wait('!document.querySelector("main svg[role=img]")');
        assert.equal(await evaluate('document.querySelector("input[role=combobox]").value'), '');
        await input('067'); await wait('!!document.querySelector("[role=option]")');
        assert.equal(requests.at(-1).search, '067');
        await click('document.querySelector("[role=option]")'); await ready();
        console.log(`PASS ${width}px: page scrolling with sticky toggle and headers, collapse while scrolled, periods, search, clear, drill-down, layout and axe`);
    }
    empty = true;
    await send('Page.navigate', { url: base + '/admin' });
    await wait('document.querySelector("main")?.innerText.includes("Ще немає нескасованих записів")');
    assert.equal(await evaluate('document.querySelectorAll("main [role=combobox]").length'), 0);
    empty = false; fail = true;
    await send('Page.navigate', { url: base + '/admin' });
    await wait('document.querySelector("main")?.innerText.includes("Тестова помилка статистики")');
    await click(button('Спробувати знову')); await ready();
    assert.deepEqual(errors, []);
    console.log('PASS Empty data offers no invalid period; errors can be retried; no runtime exceptions');
} finally {
    await send('Page.close'); socket.close(); await new Promise(resolve => server.close(resolve));
}
