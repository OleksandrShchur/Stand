export const UA_PHONE_DIGITS_LENGTH = 9;

export function digitsOnly(value: string): string {
    return value.replace(/\D/g, '').slice(0, UA_PHONE_DIGITS_LENGTH);
}

export function formatUaPhoneDigits(digits: string): string {
    const cleaned = digitsOnly(digits);
    const parts = [
        cleaned.slice(0, 2),
        cleaned.slice(2, 5),
        cleaned.slice(5, 7),
        cleaned.slice(7, 9),
    ].filter(Boolean);

    return parts.join(' ');
}

export function formatUaPhone(phone: string): string {
    const digits = phone.startsWith('+380') ? phone.slice(4) : phone;
    return `+380 ${formatUaPhoneDigits(digits)}`.trim();
}

export function uaPhoneValidationError(digits: string): string | null {
    if (digits.length !== UA_PHONE_DIGITS_LENGTH) {
        return 'Введіть 9 цифр номера після +380.';
    }

    if (!['3', '5', '6', '7', '9'].includes(digits[0])) {
        return 'Введіть коректний український мобільний номер.';
    }

    return null;
}

export function toUaPhone(digits: string): string {
    return `+380${digitsOnly(digits)}`;
}
