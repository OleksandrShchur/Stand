// Isolated UI fixture: no requests reach the application's database or API.
import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';

export const fixtureDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date(Date.now() + 86400000));
const locations = [1, 2].map(id => ({ id, name: `Локація ${id}`, address: 'Вулиця Тестова, 1', capacity: 3, sortOrder: id, isActive: true }));
const slots = [1, 2, 3].map((id, index) => ({ id, timeSlotId: id, startTime: `${10 + index}:00`, endTime: `${11 + index}:00`, capacity: 3, booked: index === 2 ? 3 : 1, remaining: index === 2 ? 0 : 2, isFull: index === 2, isBlocked: false, isTooSoon: false, isBookable: index !== 2, isActive: true, sortOrder: id, participants: [{ firstName: 'Олена', lastName: 'Тестова' }] }));
const booking = { id: 1, publicNumber: 'TEST-1', date: fixtureDate, locationId: 1, locationName: locations[0].name, locationAddress: locations[0].address, timeSlotId: 1, startTime: '10:00', endTime: '11:00', firstName: 'Олена', lastName: 'Тестова', phone: '+380670000001', isBooked: true, cancelToken: 'fixture-token', createdAtUtc: new Date().toISOString(), participants: slots[0].participants };
const root = resolve('stand.client/dist');

export async function startFixture(port = 5198, { bookings } = {}) {
    const server = http.createServer(async (request, response) => {
        const url = new URL(request.url, 'http://localhost');
        if (url.pathname.startsWith('/api/')) {
            response.setHeader('Content-Type', 'application/json');
            const cookies = request.headers.cookie || '';
            const send = data => response.end(JSON.stringify(data));
            const path = url.pathname;
            if (path.endsWith('/auth/me')) {
                if (!cookies.includes(path.includes('/admin/') ? 'fixture-admin=true' : 'fixture-public=true')) {
                    response.writeHead(401); return send({ title: 'Потрібен вхід' });
                }
                return send(path.includes('/admin/') ? { id: 1, login: 'Тест' } : { id: 1, phone: booking.phone });
            }
            if (request.method !== 'GET') {
                // Preview only. Unexpected mutations fail so a test cannot accidentally save.
                if (path === '/api/admin/schedule/preview') return send({ updatedDates: 1, preservedBookings: 0 });
                response.writeHead(400); return send({ title: 'Тестова помилка. Перевірте введені дані.' });
            }
            if (path === '/api/calendar') return send({ bookableDates: [fixtureDate], readOnlyDates: [], earliestBookableDate: fixtureDate, latestBookableDate: fixtureDate });
            if (path === '/api/locations' || path === '/api/admin/locations') return send(locations);
            if (path === '/api/slots' || path === '/api/admin/timeslots') return send(slots);
            if (path === '/api/bookings/mine') return send([booking]);
            if (path === '/api/bookings/fixture-token') return send(booking);
            if (path === '/api/admin/bookings') {
                if (bookings) return bookings(url, response);
                return send({ items: [booking], totalCount: 1, page: 1, pageSize: 10 });
            }
            if (path === '/api/admin/users') return send([1, 2].map(id => ({ id, login: `Адмін ${id}`, isActive: true, createdAtUtc: booking.createdAtUtc })));
            if (path === '/api/admin/authorized-users') return send(Array.from({ length: 12 }, (_, i) => ({ id: i + 1, firstName: `Ім’я ${i + 1}`, lastName: 'Тестове', phone: `+3806700000${String(i).padStart(2, '0')}`, isActive: true, createdAtUtc: booking.createdAtUtc })));
            if (path === '/api/admin/schedule') return send({ date: url.searchParams.get('date'), isActive: true, isCustom: true, locations: [{ locationId: 1, slots: slots.slice(0, 2).map(({ startTime, endTime }) => ({ startTime, endTime })) }], bookings: [], horizonDays: 14, minLeadTimeMinutes: 60 });
            if (path === '/api/admin/dashboard') {
                const rates = locations.map(location => ({ locationId: location.id, locationName: location.name, capacity: 3, booked: 1, fillRatePercent: 33 }));
                return send({ todayBookedCount: 2, upcomingBookedCount: 2, todayByLocation: rates, upcomingByLocation: rates });
            }
            response.writeHead(404); return send({ title: `Missing fixture: ${path}` });
        }
        const file = resolve(root, '.' + decodeURIComponent(url.pathname));
        if (file !== root && !file.startsWith(root + sep)) { response.writeHead(400); response.end(); return; }
        const target = existsSync(file) && extname(file) ? file : resolve(root, 'index.html');
        response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(target)] || 'application/octet-stream');
        createReadStream(target).pipe(response);
    });
    await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
    return server;
}
