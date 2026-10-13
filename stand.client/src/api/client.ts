import type { ProblemDetailsResponse } from './types';

export class ApiError extends Error {
    status: number;
    errorCode?: string;

    constructor(message: string, status: number, errorCode?: string) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
    }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
    const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) {
        return undefined as T;
    }

    const contentType = res.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json') || contentType.includes('application/problem+json');
    const data = isJson ? await res.json().catch(() => undefined) : undefined;

    if (!res.ok) {
        const problem = data as ProblemDetailsResponse | undefined;
        const fallback =
            res.status === 502 || res.status === 503 || res.status === 504
                ? 'Сервер тимчасово недоступний. Переконайтеся, що API запущено, і спробуйте ще раз.'
                : `Помилка запиту (${res.status})`;
        throw new ApiError(
            problem?.title ?? fallback,
            res.status,
            problem?.errorCode,
        );
    }

    return data as T;
}

export const api = {
    get: <T>(url: string) => request<T>('GET', url),
    post: <T>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
    put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body ?? {}),
    del: <T>(url: string) => request<T>('DELETE', url),
};

export async function downloadFile(url: string, fallbackName: string): Promise<void> {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
        throw new ApiError('Не вдалося завантажити файл.', res.status);
    }

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;

    const disposition = res.headers.get('content-disposition');
    const match = disposition?.match(/filename="?([^";]+)"?/);
    a.download = match?.[1] ?? fallbackName;

    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
}
