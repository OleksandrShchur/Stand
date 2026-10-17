import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

// Run against an isolated local app and an installed Chrome launched with
// --remote-debugging-port=9237 and a separate --user-data-dir. No dependencies.
// Only drafts and save previews are exercised; no schedules or bookings are saved.
const base = process.env.ADMIN_BASE_URL || 'http://127.0.0.1:5197';
const debuggerUrl = process.env.ADMIN_CHROME_URL || 'http://127.0.0.1:9237';
const target = await (await fetch(`${debuggerUrl}/json/new?${encodeURIComponent(base + '/admin/login')}`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let nextId = 0, deviceWidth = 393;
const pending = new Map(), errors = [];
socket.onmessage = event => {
    const value = JSON.parse(event.data);
    if (value.id) {
        const job = pending.get(value.id); pending.delete(value.id);
        value.error ? job.reject(value.error) : job.resolve(value.result);
    }
    if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.exception?.description || value.params.exceptionDetails.text);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
};
const wait = async expression => {
    for (let attempt = 0; attempt < 100; attempt++) {
        if (await evaluate(expression)) return;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Timed out: ' + expression);
};
const button = text => `[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width>0&&getComputedStyle(b).visibility==='visible'&&!b.closest('[aria-hidden=true]')).find(b=>b.textContent.trim()===${JSON.stringify(text)})`;
const dialog = "[...document.querySelectorAll('.MuiDialog-root [role=dialog]')].at(-1)";

async function tap(expression) {
    await evaluate(`(() => { const element=${expression}; if(!element)throw new Error('Missing tap target'); element.scrollIntoView({block:'center',inline:'nearest'}); })()`);
    // A pointer tap, unlike element.click(), catches clipped or covered controls.
    await new Promise(resolve => setTimeout(resolve, 200));
    const point = await evaluate(`(() => {
        const element=${expression}, rect=element.getBoundingClientRect();
        const x=rect.left+rect.width/2, y=rect.top+rect.height/2;
        const hit=document.elementFromPoint(x,y);
        return {x,y,visible:rect.width>0&&x>=0&&x<${deviceWidth}&&y>=0&&y<innerHeight&&!!hit&&(hit===element||element.contains(hit))};
    })()`);
    assert.ok(point.visible, `Tap target is clipped or covered: ${expression} (${JSON.stringify(point)})`);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await new Promise(resolve => setTimeout(resolve, 300));
}
async function checkWidth(label) {
    const dimensions = await evaluate(`({layout:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,visual:visualViewport.width,scale:visualViewport.scale})`);
    for (const dimension of ['layout', 'client', 'scroll', 'visual'])
        assert.ok(dimensions[dimension] <= deviceWidth + 1, `${label}: ${dimension} widened past ${deviceWidth}: ${JSON.stringify(dimensions)}`);
    assert.ok(Math.abs(dimensions.scale - 1) < 0.01, label + ': browser scaled the page to fit overflowing content');
}
async function screenshot(name) {
    await new Promise(resolve => setTimeout(resolve, 250));
    const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(`artifacts/admin-mobile/${name}.png`, Buffer.from(result.data, 'base64'));
}
async function input(selector, value) {
    await evaluate(`(() => {
        const element=document.querySelector(${JSON.stringify(selector)});
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,${JSON.stringify(value)});
        element.dispatchEvent(new Event('input',{bubbles:true})); element.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
}
async function navigate(path) {
    // Discard only local drafts without triggering a native before-unload dialog.
    await send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
    await send('Page.navigate', { url: base + path });
}

mkdirSync('artifacts/admin-mobile', { recursive: true });
try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await send('Emulation.setDeviceMetricsOverride', { width: 393, height: 852, deviceScaleFactor: 1, mobile: true, screenWidth: 393, screenHeight: 852 });
    await navigate('/admin/login');
    await wait("!!document.querySelector('input[type=password]')");
    const loginStatus = await evaluate(`fetch('/api/admin/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify({ login: process.env.ADMIN_TEST_LOGIN || 'admin', password: process.env.ADMIN_TEST_PASSWORD || 'ChangeMe!Admin1' })})}).then(r=>r.status)`);
    assert.equal(loginStatus, 200, 'Test admin login must succeed');
    await navigate('/admin/schedule');
    await wait("document.querySelectorAll('input[type=checkbox]').length > 1");
    await checkWidth('iPhone 16 initial schedule');
    assert.equal(await evaluate("document.querySelector('#schedule-calendar').getBoundingClientRect().height"), 0, 'Calendar must start collapsed on a phone');
    await screenshot('393-schedule');
    await tap(button('Обрати в календарі'));
    await wait("document.querySelector('#schedule-calendar').getBoundingClientRect().height > 0");
    await checkWidth('Expanded phone calendar');
    await screenshot('393-calendar');
    await tap(button('Згорнути календар'));

    const currentDate = await evaluate("document.querySelector('input[type=date]').value");
    const future = new Date(`${currentDate}T12:00:00Z`); future.setUTCDate(future.getUTCDate() + 60);
    await input('input[type=date]', future.toISOString().slice(0, 10));
    await wait("document.querySelectorAll('input[type=checkbox]:checked').length === 0 && document.body.innerText.includes('День закритий для запису')");
    await tap("document.querySelector('input[type=checkbox]')");
    await tap("document.querySelectorAll('input[type=checkbox]')[1]");
    await wait(`${dialog}?.innerText.includes('Час чергувань')`);
    await checkWidth('Full-screen time generator');
    assert.equal(await evaluate(`${dialog}.getBoundingClientRect().width`), deviceWidth);
    for (const width of [320, 393, 414]) {
        deviceWidth = width;
        await send('Emulation.setDeviceMetricsOverride', { width, height: 852, deviceScaleFactor: 1, mobile: true, screenWidth: width, screenHeight: 852 });
        if (width === 320) await evaluate("document.documentElement.style.fontSize='20px'");
        await checkWidth(`${width}px generator`);
        await tap(button('Додати серію'));
        await wait("document.querySelectorAll('button[aria-label^=\"Видалити інтервал\"]').length === 8");
        await tap("document.querySelector('button[aria-label^=\"Змінити інтервал\"]')");
        await checkWidth(`${width}px edited slot`);
        await screenshot(`${width}-time-editor`);
        if (width === 320) await evaluate("document.documentElement.style.fontSize=''");
        await tap(button('Очистити час'));
        await wait("document.querySelectorAll('button[aria-label^=\"Видалити інтервал\"]').length === 0");
        await wait("document.querySelector('.MuiDialog-root .MuiAccordionSummary-root')?.getAttribute('aria-expanded') === 'true'");
    }
    await tap(button('Один інтервал'));
    await wait(`${button('Додати інтервал')} !== undefined`);
    await input(`${'.MuiDialog-root'} input[type=time]`, '09:00');
    await evaluate("(() => { const e=document.querySelectorAll('.MuiDialog-root input[type=time]')[1]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'12:00'); e.dispatchEvent(new Event('input',{bubbles:true})); })()");
    await tap(button('Додати інтервал'));
    await wait("document.querySelectorAll('button[aria-label^=\"Видалити інтервал\"]').length === 1");
    await tap(button('Готово'));
    await wait("document.querySelectorAll('.MuiDialog-root [role=dialog]').length === 0");
    await checkWidth('Schedule after editing');
    await tap(button('Зберегти'));
    await wait(`${dialog}?.innerText.includes('Підтвердити розклад')`);
    await checkWidth('Save preview');
    await screenshot('save-preview');
    // Verify final action is physically reachable without committing a change.
    await evaluate(`(${button('Зберегти розклад')}).scrollIntoView({block:'center'})`);
    assert.ok(await evaluate(`(() => {const e=${button('Зберегти розклад')},r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));})()`));
    await tap(button('Назад до редагування'));
    await tap(button('Копіювати'));
    await wait(`${dialog}?.innerText.includes('За днями тижня')`);
    await tap(button('За днями тижня'));
    await checkWidth('Copy weekdays');
    await screenshot('copy');
    await tap(button('Назад'));
    // Deliberately leave the draft without saving any schedule to the test DB.
    await tap("document.querySelector('.MuiBottomNavigation-root a[href=\"/admin/bookings\"]')");
    await wait(`${dialog}?.innerText.includes('Залишити незбережені зміни?')`);
    await tap(button('Відкинути зміни'));
    await wait("location.pathname === '/admin/bookings' && !!document.querySelector('h4')");
    for (const width of [320, 393, 414]) {
        deviceWidth = width;
        await send('Emulation.setDeviceMetricsOverride', { width, height: 852, deviceScaleFactor: 1, mobile: true, screenWidth: width, screenHeight: 852 });
        for (const path of ['/admin/schedule', '/admin/bookings', '/admin/locations', '/admin/authorized-users', '/admin/users']) {
            await navigate(path);
            await wait("!!document.querySelector('h4')");
            await new Promise(resolve => setTimeout(resolve, 250));
            await checkWidth(`${width}px ${path}`);
        }
        console.log(`PASS ${width}px: admin pages match device width`);
    }
    deviceWidth = 1280;
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate('/admin/schedule');
    await wait("!!document.querySelector('input[type=date]')");
    await wait("document.querySelectorAll('input[type=checkbox]').length > 1");
    await checkWidth('Desktop schedule');
    await screenshot('desktop-schedule');
    assert.deepEqual(errors, []);
    console.log('PASS real screen-coordinate taps: calendar, location, hourly slots, custom time, edit/remove, save preview, copy and discard confirmation');
} catch (error) {
    await screenshot('failure');
    console.error(await evaluate('document.body.innerText'));
    throw error;
} finally { socket.close(); }
