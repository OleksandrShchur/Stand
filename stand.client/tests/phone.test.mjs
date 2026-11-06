import assert from 'node:assert/strict';
import { test } from 'vitest';
import { digitsOnly, formatUaPhoneDigits, formatUaPhone, uaPhoneValidationError, toUaPhone } from '../src/utils/phone.ts';

test('phone input starts empty and retains the manually entered leading zero', () => {
    assert.equal(formatUaPhoneDigits(''), '');
    assert.equal(formatUaPhoneDigits('0'), '0');
    assert.equal(digitsOnly('067 123 45 67'), '0671234567');
    assert.equal(formatUaPhoneDigits('0671234567'), '067 123 45 67');
    assert.equal(digitsOnly('06712345678'), '0671234567');
});

test('ten national digits preserve the existing international phone number', () => {
    const national = '0671234567';
    assert.equal(uaPhoneValidationError(national), null);
    assert.equal(toUaPhone(national), '+380671234567');
    assert.equal(formatUaPhone('+380671234567'), '+38 067 123 45 67');
    assert.equal(toUaPhone('+380671234567'.slice(3)), '+380671234567');
});

test('validation requires ten digits starting with zero and a mobile prefix', () => {
    for (const invalid of ['', '671234567', '1671234567', '0171234567', '06712345678']) {
        assert.ok(uaPhoneValidationError(invalid), invalid || 'empty input');
    }
});
