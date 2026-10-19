export const UA_PHONE_DIGITS_LENGTH = 10;

export function digitsOnly(value: string): string {
    return value.replace(/\D/g, '').slice(0, UA_PHONE_DIGITS_LENGTH);
}

export function formatUaPhoneDigits(digits: string): string {
    const cleaned = digitsOnly(digits);
    const parts = [
        cleaned.slice(0, 3),
        cleaned.slice(3, 6),
        cleaned.slice(6, 8),
        cleaned.slice(8, 10),
    ].filter(Boolean);

    return parts.join(' ');
}

export function formatUaPhone(phone: string): string {
    const digits = phone.startsWith('+38') ? phone.slice(3) : phone;
    return `+38 ${formatUaPhoneDigits(digits)}`.trim();
}

export function uaPhoneValidationError(digits: string): string | null {
    if (digits.length !== UA_PHONE_DIGITS_LENGTH) {
        return 'Введіть 10 цифр номера після +38, починаючи з 0.';
    }

    if (digits[0] !== '0' || !['3', '5', '6', '7', '9'].includes(digits[1])) {
        return 'Введіть коректний український мобільний номер.';
    }

    return null;
}

export function toUaPhone(digits: string): string {
    return `+38${digitsOnly(digits)}`;
}
