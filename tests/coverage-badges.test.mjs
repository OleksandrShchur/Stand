import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coverageBadge, lineCoverage } from './coverage-badges.mjs';

test('coverage badges calculate percentages from measured counts rather than a preformatted value', () => {
    const coverage = lineCoverage(1937, 2052);
    assert.ok(Math.abs(coverage.percent - 94.3957115) < 0.000001);
    const svg = coverageBadge('server coverage', { ...coverage, percent: 100 });
    assert.match(svg, /server coverage: 94\.40%/);
    assert.doesNotMatch(svg, /100\.00%/);
});

test('empty, missing and impossible reports cannot publish a success badge', () => {
    for (const [covered, total] of [[0, 0], [undefined, 12], [1, undefined], [-1, 10], [11, 10], [NaN, 10], [1, Infinity], [0.5, 10]])
        assert.throws(() => lineCoverage(covered, total), /valid covered and total/);
});

test('badges escape XML labels, expose accessible text and reflect the measured coverage range', () => {
    const low = coverageBadge('coverage <80% & "low"', lineCoverage(7, 10));
    assert.match(low, /coverage &lt;80% &amp; &quot;low&quot;: 70\.00%/);
    assert.match(low, /role="img"/);
    assert.match(low, /#e05d44/);
    assert.match(coverageBadge('coverage', lineCoverage(4, 5)), /#97ca00/);
    assert.match(coverageBadge('coverage', lineCoverage(9, 10)), /#4c1/);
});
