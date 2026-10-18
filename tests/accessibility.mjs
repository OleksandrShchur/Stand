// Build the client first; launch isolated Chrome with --remote-debugging-port=9241.
// Download axe-core to artifacts/axe.min.js (or set AXE_PATH). See accessibility.md.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { startFixture, fixtureDate } from './accessibility-fixture.mjs';

const axe = readFileSync(process.env.AXE_PATH || 'artifacts/axe.min.js', 'utf8');
const server = await startFixture();
const base = 'http://127.0.0.1:5198';
const browser = process.env.A11Y_CHROME_URL || 'http://127.0.0.1:9241';
const target = await (await fetch(`${browser}/json/new?${encodeURIComponent(base + '/login')}`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let nextId = 0;
const pending = new Map();
socket.onmessage = event => {
    const result = JSON.parse(event.data);
    if (!result.id) return;
    const task = pending.get(result.id); pending.delete(result.id);
    result.error ? task.reject(result.error) : task.resolve(result.result);
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
const wait = async expression => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(100); }
    throw new Error('Timed out: ' + expression);
};
const button = text => `[...document.querySelectorAll('button')].find(b => b.checkVisibility() && b.textContent.trim() === ${JSON.stringify(text)})`;
const click = async expression => { await evaluate(`(${expression}).focus(); (${expression}).click()`); await pause(300); };
const key = async (key, code, windowsVirtualKeyCode, modifiers = 0) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode, modifiers,
        ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : key === ' ' ? { text: ' ', unmodifiedText: ' ' } : {}) });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode, modifiers });
    await pause(100);
};
const escape = async () => { await key('Escape', 'Escape', 27); await pause(250); };
const activate = async expression => { await evaluate(`(${expression}).focus()`); await key('Enter', 'Enter', 13); await pause(300); };
const navigate = async path => {
    await send('Page.navigate', { url: base + path });
    await wait("document.readyState === 'complete' && !!document.querySelector('h1,h4,h5,form,.MuiCard-root') && !document.querySelector('.MuiSkeleton-root,.MuiCircularProgress-root,.MuiLinearProgress-indeterminate')");
    await pause(350);
};
const reports = [];
const checks = [];
async function checkTabVisibility(path, count) {
    await navigate(path);
    await evaluate("document.querySelector('main').focus()");
    for (let i = 0; i < count; i++) {
        await key('Tab', 'Tab', 9);
        const focused = await evaluate(`(() => {
            const element = document.activeElement;
            if (element === document.body) return { visible: true };
            const r = element.getBoundingClientRect();
            const points = [[r.left+r.width/2,r.top+r.height/2],[r.left+2,r.top+2],[r.right-2,r.bottom-2]];
            return { label: element.getAttribute('aria-label') || element.textContent || element.tagName,
                visible: points.some(([x,y]) => {
                    if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) return false;
                    const hit = document.elementFromPoint(x,y);
                    return hit && (element.contains(hit) || hit.contains(element));
                }) };
        })()`);
        assert.ok(focused.visible, `${path}: keyboard focus is obscured: ${focused.label}`);
    }
}
const audit = async label => {
    await evaluate(axe);
    const result = await evaluate("axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] } }).then(r=>({violations:r.violations,incomplete:r.incomplete}))");
    reports.push({ label, ...result });
    const tree = await send('Accessibility.getFullAXTree');
    writeFileSync(`artifacts/accessibility/${label}-tree.json`, JSON.stringify(tree, null, 2));
    console.log(label, JSON.stringify(result.violations.map(v => ({ id: v.id, nodes: v.nodes.length }))));
    if (process.env.A11Y_BASELINE !== '1') {
        assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), `${label}: horizontal page overflow`);
    }
};

mkdirSync('artifacts/accessibility', { recursive: true });
try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.bringToFront');
    await navigate('/login');
    await evaluate("document.cookie='fixture-admin=true; path=/'; document.cookie='fixture-public=true; path=/'");
    for (const width of process.env.A11Y_INTERACTIONS_ONLY === '1' ? [] : [1280, 320]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
        for (const path of ['/admin', '/admin/bookings', '/admin/locations', '/admin/authorized-users', '/admin/users', '/admin/schedule', '/my-shifts', '/booking/fixture-token']) {
            await navigate(path);
            await audit(`${width}-${path.replaceAll('/', '-').slice(1)}`);
            if (['/admin/locations', '/admin/authorized-users', '/admin/users'].includes(path)) {
                await click(button('Додати'));
                await wait("!!document.querySelector('[role=dialog]')");
                await audit(`${width}-${path.split('/').at(-1)}-dialog`);
                await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
                await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
            }
        }
        for (const step of ['home', 'date', 'location', 'time', 'contact']) {
            await evaluate(`sessionStorage.${step === 'home' ? "removeItem('stand.booking.wizard.v2')" : `setItem('stand.booking.wizard.v2', ${JSON.stringify(JSON.stringify({ step, date: fixtureDate, locationId: 1, locationName: 'Локація 1', timeSlotId: 1, timeSlotIds: [1] }))})`}`);
            await navigate('/');
            await audit(`${width}-booking-${step}`);
        }
    }
    await evaluate("document.cookie='fixture-public=; max-age=0; path=/'; document.cookie='fixture-admin=; max-age=0; path=/'");
    for (const path of ['/login', '/admin/login']) { await navigate(path); await audit(path.replaceAll('/', '-').slice(1)); }

    if (process.env.A11Y_BASELINE !== '1') {
        await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 900, deviceScaleFactor: 1, mobile: false });
        await navigate('/login');
        await activate(button('Увійти'));
        assert.ok(await evaluate("document.activeElement.matches('input[aria-invalid=true]')"), 'Invalid phone receives focus');
        await audit('login-validation');
        checks.push('Invalid public login focuses the named invalid field and exposes its live error.');
        await evaluate("document.cookie='fixture-admin=true; path=/'; document.cookie='fixture-public=true; path=/'; sessionStorage.removeItem('stand.booking.wizard.v2')");
        await navigate('/');
        await evaluate("document.querySelector('.skip-link').focus()");
        assert.ok(await evaluate("document.activeElement.getBoundingClientRect().top >= 0"), 'Skip link is visible on focus');
        await key('Enter', 'Enter', 13);
        assert.equal(await evaluate('document.activeElement.id'), 'main-content');
        await activate(button('Записатись на стенд'));
        await wait("document.activeElement.tagName === 'H1' && document.activeElement.textContent === 'Оберіть дату'");
        await evaluate("[...document.querySelectorAll('button[aria-pressed=false]')].find(b=>!b.getAttribute('aria-label')?.includes('немає записів')).focus()");
        await key(' ', 'Space', 32);
        assert.ok(await evaluate("!!document.querySelector('button[aria-pressed=true]')"), 'Space selects date');
        await activate(button('Далі'));
        await wait("document.activeElement.textContent === 'Оберіть локацію'");
        await evaluate("document.querySelector('input[type=radio]').focus()");
        await key('ArrowDown', 'ArrowDown', 40);
        assert.equal(await evaluate("document.querySelector('input[type=radio]:checked').value"), '2');
        await activate(button('Далі'));
        await wait("document.activeElement.textContent === 'Оберіть час'");
        await evaluate("document.querySelector('input[type=checkbox]:not(:disabled)').focus()");
        await key(' ', 'Space', 32);
        assert.ok(await evaluate("!!document.querySelector('input[type=checkbox]:checked')"), 'Space selects time once');
        await activate(button('Далі'));
        await wait("document.activeElement.textContent === 'Підтвердіть запис'");
        assert.match(await evaluate('document.title'), /Підтвердіть запис/);
        checks.push('Keyboard booking: Enter starts/continues, Space selects date/time, arrow keys select location; each step focuses and titles its heading.');

        await activate("document.querySelector('button[aria-label=\"Технічна підтримка\"]')");
        await wait("!!document.querySelector('[role=dialog]')");
        await audit('support-dialog');
        for (let i = 0; i < 6; i++) {
            await key('Tab', 'Tab', 9);
            assert.ok(await evaluate("!!document.activeElement.closest('[role=dialog]')"), 'Dialog contains forward focus');
        }
        await key('Tab', 'Tab', 9, 8);
        assert.ok(await evaluate("!!document.activeElement.closest('[role=dialog]')"), 'Dialog contains backward focus');
        await escape(); await pause(250);
        assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'), 'Технічна підтримка');
        checks.push('Support dialog traps Tab/Shift+Tab; Escape restores the invoking button.');

        for (const path of ['/my-shifts', '/admin/bookings']) {
            await navigate(path);
            if (path === '/admin/bookings') {
                await activate("document.querySelector('.MuiAccordionSummary-root')");
                await audit('admin-booking-filters');
            }
            await activate(button('Скасувати запис'));
            await audit(path === '/my-shifts' ? 'public-cancel-dialog' : 'admin-cancel-dialog');
            await escape();
        }
        await navigate('/admin/schedule');
        await activate(button('Налаштувати час'));
        await activate("document.querySelector('[role=dialog] .MuiAccordionSummary-root')");
        await audit('schedule-time-generator');
        await escape();
        await activate(button('Копіювати'));
        await audit('schedule-copy-dates');
        await activate(button('За днями тижня'));
        await audit('schedule-copy-weekdays');
        await escape();
        await click("document.querySelector('[data-testid=schedule-day-summary] input[type=checkbox]')");
        await activate(button('Зберегти'));
        await wait("[...document.querySelectorAll('[role=dialog]')].some(d=>d.checkVisibility() && d.innerText.includes('Підтвердити розклад'))");
        await audit('schedule-review');
        await escape();

        await navigate('/admin/authorized-users');
        await activate(button('Додати'));
        await activate(button('Зберегти'));
        assert.ok(await evaluate("document.activeElement.matches('input[aria-invalid=true][autocomplete=\"given-name\"]')"), 'First invalid user field receives focus');
        await audit('authorized-user-validation');
        await escape();
        checks.push('Public/admin cancellation, filters, time generator, schedule copying/review and invalid user forms audited without saving records.');

        await navigate('/admin');
        await activate("document.querySelector('button[aria-label=\"Відкрити меню адміністратора\"]')");
        await audit('admin-mobile-drawer');
        await escape(); await pause(250);
        assert.equal(await evaluate('document.activeElement.getAttribute("aria-expanded")'), 'false');
        checks.push('Mobile navigation drawer opens by keyboard and returns focus/state on Escape.');

        await checkTabVisibility('/admin/schedule', 25);
        await checkTabVisibility('/my-shifts', 20);
        await evaluate(`sessionStorage.setItem('stand.booking.wizard.v2', ${JSON.stringify(JSON.stringify({ step: 'date', date: fixtureDate }))})`);
        await checkTabVisibility('/', 48);
        checks.push('Keyboard Tab sweeps keep focused controls visible around sticky headers and fixed booking/admin actions.');

        await send('Emulation.setDeviceMetricsOverride', { width: 640, height: 450, deviceScaleFactor: 1, mobile: false });
        for (const path of ['/', '/my-shifts', '/admin/schedule', '/admin/bookings']) {
            await navigate(path);
            assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), `200% zoom equivalent: ${path}`);
        }
        checks.push('640×450 CSS pixel viewport (1280×900 at 200% zoom) fits public and admin pages.');
        await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'forced-colors', value: 'active' }] });
        await navigate('/admin/bookings');
        await evaluate("document.querySelector('button').focus()");
        await key('Tab', 'Tab', 9);
        assert.ok(await evaluate("matchMedia('(forced-colors: active)').matches && getComputedStyle(document.activeElement).outlineStyle === 'solid'"), 'Forced colors preserves a visible keyboard outline');
        assert.ok(await evaluate("[...document.getAnimations()].every(a=>a.effect.getTiming().duration <= 0.01)"), 'Reduced motion suppresses animations');
        const forcedColors = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        writeFileSync('artifacts/accessibility/forced-colors.png', Buffer.from(forcedColors.data, 'base64'));
        // axe mixes author and system colors in forced-colors mode (axe-core #3978).
        // Check its screenshot/keyboard outline separately; keep all axe rules enabled
        // when auditing reduced motion with the normal author palette.
        await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        await audit('reduced-motion');
        checks.push('Reduced motion suppresses animations; forced colors preserves keyboard outlines.');
    }
} finally {
    const reportPath = `artifacts/accessibility/${process.env.A11Y_REPORT || 'audit'}.json`;
    writeFileSync(reportPath, JSON.stringify(reports, null, 2));
    writeFileSync('artifacts/accessibility/interaction-checks.json', JSON.stringify(checks, null, 2));
    console.log('Report:', reportPath);
    socket.close(); await server.close();
}
if (process.env.A11Y_BASELINE !== '1') assert.equal(reports.flatMap(r => r.violations).length, 0, 'axe reported accessibility violations');
