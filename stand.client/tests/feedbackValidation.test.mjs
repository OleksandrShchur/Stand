import assert from 'node:assert/strict';
import { test } from 'vitest';
import { FEEDBACK_MAX_LENGTH, feedbackValidationError } from '../src/features/feedback/feedbackValidation.ts';

test('feedback requires actual text and accepts multiline Ukrainian comments', () => {
    for (const blank of ['', ' ', '\n\t\r', '\u00a0']) assert.ok(feedbackValidationError(blank));
    assert.equal(feedbackValidationError('Дякую!\nБуло б зручно бачити більше дат.'), null);
});

test('feedback allows at most 500 UTF-16 units, matching textarea maxlength and server validation', () => {
    assert.equal(FEEDBACK_MAX_LENGTH, 500);
    assert.equal(feedbackValidationError('а'.repeat(500)), null);
    assert.ok(feedbackValidationError('а'.repeat(501)));
    assert.equal(feedbackValidationError('🙂'.repeat(250)), null);
    assert.ok(feedbackValidationError('🙂'.repeat(251)));
    assert.ok(feedbackValidationError('а' + ' '.repeat(500)));
});
