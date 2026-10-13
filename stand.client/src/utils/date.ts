const WEEKDAYS_SHORT = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS_GENITIVE = [
    'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
    'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
];

/** Parses a "yyyy-MM-dd" civil date string into a local Date (midnight, no TZ shifting). */
export function parseIsoDate(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
}

export function formatDateHuman(iso: string): string {
    const date = parseIsoDate(iso);
    return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}

export function formatWeekdayShort(iso: string): string {
    const date = parseIsoDate(iso);
    return WEEKDAYS_SHORT[date.getDay()];
}

export function formatDateFull(iso: string): string {
    const date = parseIsoDate(iso);
    return `${WEEKDAYS_SHORT[date.getDay()]}, ${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()}`;
}

export function dateRangeIso(startIso: string, endIso: string): string[] {
    const start = parseIsoDate(startIso);
    const end = parseIsoDate(endIso);
    const result: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    return result;
}

export function todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
