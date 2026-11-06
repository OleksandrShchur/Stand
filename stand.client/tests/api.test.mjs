import { afterEach, expect, test, vi } from 'vitest';
import { api, ApiError, downloadFile } from '../src/api/client';
import { publicApi } from '../src/api/publicApi';
import { adminApi } from '../src/api/adminApi';
import { requestActivity } from '../src/api/requestActivity';

afterEach(() => vi.unstubAllGlobals());

test('JSON requests include cookies, payload, idempotency key and cancellation signal', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"id":12}', { headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetch);
    const signal = new AbortController().signal;
    expect(await api.get('/items', signal)).toEqual({ id: 12 });
    expect(fetch).toHaveBeenLastCalledWith('/items', expect.objectContaining({ method: 'GET', credentials: 'include', signal, headers: {}, body: undefined }));
    await api.post('/items', { name: 'Ім’я' }, { 'Idempotency-Key': 'retry-key' });
    expect(fetch).toHaveBeenLastCalledWith('/items', expect.objectContaining({ method: 'POST', body: '{"name":"Ім’я"}', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'retry-key' } }));
    await api.put('/items');
    expect(fetch).toHaveBeenLastCalledWith('/items', expect.objectContaining({ method: 'PUT', body: '{}' }));
    await api.post('/items');
    expect(fetch).toHaveBeenLastCalledWith('/items', expect.objectContaining({ body: '{}' }));
    await api.del('/items/12');
    expect(fetch).toHaveBeenLastCalledWith('/items/12', expect.objectContaining({ method: 'DELETE', body: undefined, headers: {} }));
    expect(requestActivity.getSnapshot()).toBe(false);
});

test.each([502, 503, 504, 400])('non-JSON HTTP %i gets an actionable fallback and releases progress', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>error</html>', { status })));
    await expect(api.get('/items')).rejects.toMatchObject({ status });
    expect(requestActivity.getSnapshot()).toBe(false);
});

test('ProblemDetails preserves machine code and message; malformed JSON is tolerated', async () => {
    const fetch = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ title: 'Місць немає', errorCode: 'SLOT_FULL' }), { status: 409, headers: { 'Content-Type': 'application/problem+json' } }))
        .mockResolvedValueOnce(new Response('{', { status: 500, headers: { 'Content-Type': 'application/json' } }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(new Response('plain text'));
    vi.stubGlobal('fetch', fetch);
    await expect(api.get('/items')).rejects.toMatchObject(new ApiError('Місць немає', 409, 'SLOT_FULL'));
    await expect(api.get('/items')).rejects.toMatchObject({ status: 500 });
    expect(await api.del('/items')).toBeUndefined();
    expect(await api.get('/text')).toBeUndefined();
});

test('network failure preserves the original error and releases progress', async () => {
    const failure = new TypeError('offline');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(failure));
    await expect(api.get('/items')).rejects.toBe(failure);
    expect(requestActivity.getSnapshot()).toBe(false);
});

test('public booking journey sends the API contract and reuses batch keys', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('[]', { headers: { 'Content-Type': 'application/json' } })));
    vi.stubGlobal('fetch', fetch);
    await publicApi.login('0671234567');
    await publicApi.me();
    await publicApi.getCalendar();
    await publicApi.getLocations();
    await publicApi.getLocations('2026-11-06');
    await publicApi.getSlots('2026-11-06', 4);
    await publicApi.book('2026-11-06', 4, 2);
    await publicApi.bookMany('2026-11-06', 4, [2, 3], 'stable-key');
    expect(fetch).toHaveBeenLastCalledWith('/api/bookings/batch', expect.objectContaining({ body: '{"date":"2026-11-06","locationId":4,"timeSlotIds":[2,3]}', headers: expect.objectContaining({ 'Idempotency-Key': 'stable-key' }) }));
    await publicApi.bookMany('2026-11-06', 4, [2, 3]);
    expect(fetch.mock.lastCall[1].headers).not.toHaveProperty('Idempotency-Key');
    await publicApi.getMyUpcomingShifts();
    await publicApi.getByCancelToken('token');
    await publicApi.cancel('token');
    expect(fetch).toHaveBeenLastCalledWith('/api/bookings/cancel', expect.objectContaining({ body: '{"cancelToken":"token"}' }));
    await publicApi.cancelMyShift('token');
    await publicApi.submitFeedback('Дякую');
    expect(fetch).toHaveBeenLastCalledWith('/api/feedback', expect.objectContaining({ body: '{"comment":"Дякую"}' }));
    await publicApi.logout();
    expect(fetch.mock.calls.map(([url, options]) => `${options.method} ${url}`)).toEqual([
        'POST /api/auth/login', 'GET /api/auth/me', 'GET /api/calendar', 'GET /api/locations',
        'GET /api/locations?date=2026-11-06', 'GET /api/slots?date=2026-11-06&locationId=4',
        'POST /api/bookings', 'POST /api/bookings/batch', 'POST /api/bookings/batch',
        'GET /api/bookings/mine', 'GET /api/bookings/token', 'POST /api/bookings/cancel',
        'POST /api/bookings/cancel', 'POST /api/feedback', 'POST /api/auth/logout',
    ]);
});

test('admin filters preserve false and zero, encode names, and share CSV query semantics', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('[]', { headers: { 'Content-Type': 'application/json' } })));
    vi.stubGlobal('fetch', fetch);
    const filters = { search: 'Ім’я & прізвище', isBooked: false, page: 0, date: '', phone: undefined, locationId: null };
    const query = '?search=%D0%86%D0%BC%E2%80%99%D1%8F%20%26%20%D0%BF%D1%80%D1%96%D0%B7%D0%B2%D0%B8%D1%89%D0%B5&isBooked=false&page=0';
    const signal = new AbortController().signal;
    await adminApi.listBookings(filters, signal);
    expect(fetch).toHaveBeenLastCalledWith('/api/admin/bookings' + query, expect.objectContaining({ signal }));
    expect(adminApi.exportCsvUrl(filters)).toBe('/api/admin/bookings/export.csv' + query);
    expect(adminApi.exportCsvUrl({})).toBe('/api/admin/bookings/export.csv');
    await adminApi.listFeedback(2, 25, signal);
    expect(fetch).toHaveBeenLastCalledWith('/api/admin/feedback?page=2&pageSize=25', expect.objectContaining({ signal }));
    await adminApi.getStatistics({ period: 'quarter', year: 2026, quarter: 4, personId: 12 }, signal);
    expect(fetch).toHaveBeenLastCalledWith('/api/admin/dashboard?period=quarter&year=2026&quarter=4&personId=12', expect.objectContaining({ signal }));
    await adminApi.getStatisticsPeriods(12, signal);
    await adminApi.searchStatisticsPeople('Олена', signal);
});

test('admin management sends writes and retrieves the resulting resources', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fetch);
    const location = { name: 'Площа', address: null, capacity: 2, sortOrder: 1, isActive: true };
    const slot = { startTime: '09:00', endTime: '10:00', sortOrder: 0, isActive: true };
    const schedule = { dates: ['2026-11-06'], isActive: true, locations: [] };
    await adminApi.login('admin', 'password'); await adminApi.me();
    await adminApi.createLocation(location); await adminApi.updateLocation(7, location);
    await adminApi.listLocations(); await adminApi.deactivateLocation(7); await adminApi.activateLocation(7); await adminApi.deleteLocation(7);
    expect(fetch).toHaveBeenLastCalledWith('/api/admin/locations/7', expect.objectContaining({ method: 'DELETE' }));
    await adminApi.createTimeSlot(slot); await adminApi.updateTimeSlot(8, slot);
    await adminApi.listTimeSlots(); await adminApi.listTimeSlots(true);
    await adminApi.activateTimeSlot(8); await adminApi.deactivateTimeSlot(8);
    await adminApi.listDates(); await adminApi.listDates('2026-11-01', '2026-11-30');
    await adminApi.setDate('2026-11-06', false); await adminApi.bulkDates(2026, 11, [1, 3], true);
    await adminApi.getSchedule('2026-11-06'); await adminApi.previewSchedule(schedule); await adminApi.saveSchedule(schedule);
    expect(fetch).toHaveBeenLastCalledWith('/api/admin/schedule', expect.objectContaining({ method: 'PUT', body: JSON.stringify(schedule) }));
    await adminApi.listExceptions(); await adminApi.upsertException('2026-11-06', 8, true, 'Закрито'); await adminApi.deleteException(9);
    await adminApi.cancelBooking(10);
    await adminApi.createUser('new-admin', 'password'); await adminApi.listUsers();
    await adminApi.changeUserPassword(11, 'new-password', 'new-password'); await adminApi.disableUser(11); await adminApi.enableUser(11); await adminApi.deleteUser(11);
    const person = { phone: '0671234567', firstName: 'Олена', lastName: 'Тестова' };
    await adminApi.createAuthorizedUser(person); await adminApi.updateAuthorizedUser(12, person); await adminApi.listAuthorizedUsers();
    await adminApi.disableAuthorizedUser(12); await adminApi.enableAuthorizedUser(12); await adminApi.deleteAuthorizedUser(12);
    expect(fetch).toHaveBeenLastCalledWith('/api/admin/authorized-users/12', expect.objectContaining({ method: 'DELETE' }));
    await adminApi.logout();
    expect(fetch.mock.calls.map(([url, options]) => `${options.method} ${url}`)).toEqual([
        'POST /api/admin/auth/login', 'GET /api/admin/auth/me',
        'POST /api/admin/locations', 'PUT /api/admin/locations/7', 'GET /api/admin/locations',
        'POST /api/admin/locations/7/deactivate', 'POST /api/admin/locations/7/activate', 'DELETE /api/admin/locations/7',
        'POST /api/admin/timeslots', 'PUT /api/admin/timeslots/8',
        'GET /api/admin/timeslots?includeScheduleOnly=false', 'GET /api/admin/timeslots?includeScheduleOnly=true',
        'POST /api/admin/timeslots/8/activate', 'POST /api/admin/timeslots/8/deactivate',
        'GET /api/admin/dates', 'GET /api/admin/dates?from=2026-11-01&to=2026-11-30',
        'PUT /api/admin/dates', 'POST /api/admin/dates/bulk', 'GET /api/admin/schedule?date=2026-11-06',
        'POST /api/admin/schedule/preview', 'PUT /api/admin/schedule',
        'GET /api/admin/exceptions', 'POST /api/admin/exceptions', 'DELETE /api/admin/exceptions/9',
        'POST /api/admin/bookings/10/cancel', 'POST /api/admin/users', 'GET /api/admin/users',
        'PUT /api/admin/users/11/password', 'POST /api/admin/users/11/disable', 'POST /api/admin/users/11/enable', 'DELETE /api/admin/users/11',
        'POST /api/admin/authorized-users', 'PUT /api/admin/authorized-users/12', 'GET /api/admin/authorized-users',
        'POST /api/admin/authorized-users/12/disable', 'POST /api/admin/authorized-users/12/enable', 'DELETE /api/admin/authorized-users/12',
        'POST /api/admin/auth/logout',
    ]);
});

test.each([['attachment; filename="bookings.csv"', 'bookings.csv'], [null, 'fallback.csv']])('downloads use server filenames or the fallback and clean up the object URL', async (disposition, expected) => {
    const anchor = { click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('document', { createElement: () => anchor, body: { appendChild: vi.fn() } });
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('csv', { headers: disposition ? { 'Content-Disposition': disposition } : {} })));
    try {
        await downloadFile('/export', 'fallback.csv');
        expect(anchor.download).toBe(expected);
        expect(anchor.click).toHaveBeenCalledOnce();
        expect(anchor.remove).toHaveBeenCalledOnce();
        expect(revoke).toHaveBeenCalledWith('blob:test');
    } finally { create.mockRestore(); revoke.mockRestore(); }
});

test('failed downloads do not create a DOM element', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    await expect(downloadFile('/export', 'fallback')).rejects.toMatchObject({ status: 403 });
});
