import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertCoverage, mergeCoverlet, summarize } from './coverage.mjs';

const report = (lines, paths) => ({ 'Stand.Server.dll': { 'service.cs': { Service: { Method: {
    Lines: lines, Branches: paths.map(([path, hits]) => ({ Line: 1, Offset: 10, EndOffset: 20 + path, Path: path, Ordinal: path, Hits: hits })),
} } } } });

test('complementary suites cover both branches without double-counting source lines', () => {
    const unit = report({ 1: 1, 2: 0 }, [[0, 1], [1, 0]]);
    const integration = report({ 1: 1, 2: 1 }, [[0, 0], [1, 1]]);
    const summary = summarize(mergeCoverlet([unit, integration, unit]));
    assert.deepEqual(summary.lines, { covered: 2, total: 2, percent: 100 });
    assert.deepEqual(summary.branches, { covered: 2, total: 2, percent: 100 });
    assert.doesNotThrow(() => assertCoverage(summary));
});

test('a passing suite cannot hide uncovered files or insufficient branches', () => {
    const summary = summarize(mergeCoverlet([report({ 1: 1, 2: 1 }, [[0, 1], [1, 0]])]));
    assert.throws(() => assertCoverage(summary), /branches.*50.00%/);
    assert.throws(() => assertCoverage(summarize(mergeCoverlet([report({ 1: 1, 2: 0 }, [])]))), /lines.*50.00%/);
    assert.throws(() => assertCoverage(summarize(new Map())), /below 80%/);
});

test('80% is inclusive and percentages below it fail before rounding', () => {
    const summary = { lines: { covered: 4, total: 5, percent: 80 }, branches: { covered: 4, total: 5, percent: 80 } };
    assert.doesNotThrow(() => assertCoverage(summary));
    assert.throws(() => assertCoverage({ ...summary, lines: { covered: 7999, total: 10000, percent: 79.99 } }), /below 80%/);
});
