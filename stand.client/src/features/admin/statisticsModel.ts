import type { StatisticsMonthDto, StatisticsPeriodType } from '../../api/types';

export const MONTH_NAMES = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
];

export interface StatisticsPeriod {
    period: StatisticsPeriodType;
    year: number;
    /** Month 1–12, quarter 1–4, or 0 for a whole year. */
    value: number;
}

export function periodKey(period: StatisticsPeriod): string {
    return `${period.period}-${period.year}-${period.value}`;
}

/** Derive every selectable period from non-cancelled booking months only. */
export function availablePeriods(months: StatisticsMonthDto[], period: StatisticsPeriodType): StatisticsPeriod[] {
    const options = months.map(({ year, month }) => ({
        period, year, value: period === 'month' ? month : period === 'quarter' ? Math.ceil(month / 3) : 0,
    }));
    return [...new Map(options.map(option => [periodKey(option), option])).values()]
        .sort((a, b) => b.year - a.year || b.value - a.value);
}

/** Prefer the requested period, then its year, then today's period, then the latest data. */
export function resolvePeriod(options: StatisticsPeriod[], requested: StatisticsPeriod | null, today: string): StatisticsPeriod | null {
    if (requested) {
        const exact = options.find(option => periodKey(option) === periodKey(requested));
        if (exact) return exact;
        const sameYear = options.find(option => option.year === requested.year);
        if (sameYear) return sameYear;
    }
    const [year, month] = today.split('-').map(Number);
    return options.find(option => option.year === year && option.value === (
        option.period === 'month' ? month : option.period === 'quarter' ? Math.ceil(month / 3) : 0
    )) ?? options[0] ?? null;
}

export function changePeriodType(selected: StatisticsPeriod | null, period: StatisticsPeriodType): StatisticsPeriod | null {
    if (!selected) return null;
    const month = selected.period === 'month' ? selected.value : selected.period === 'quarter' ? (selected.value - 1) * 3 + 1 : 1;
    return { period, year: selected.year, value: period === 'month' ? month : period === 'quarter' ? Math.ceil(month / 3) : 0 };
}

export function periodLabel({ period, year, value }: StatisticsPeriod): string {
    return period === 'month' ? `${MONTH_NAMES[value - 1]} ${year}`
        : period === 'quarter' ? `${value} квартал ${year}` : String(year);
}
