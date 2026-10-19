import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/phone.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { digitsOnly, formatUaPhoneDigits, formatUaPhone, uaPhoneValidationError, toUaPhone } =
    await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);

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
