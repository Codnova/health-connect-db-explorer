const test = require('node:test');
const assert = require('node:assert/strict');

const { calToKcal, isLoopbackAddress, msToLocalDate } = require('../server');

test('calToKcal converts small calories to kcal with 1 decimal rounding', () => {
    assert.equal(calToKcal(1000), 1);
    assert.equal(calToKcal(1550), 1.6);
    assert.equal(calToKcal(1499), 1.5);
    assert.equal(calToKcal(0), 0);
    assert.equal(calToKcal(null), 0);
});

test('isLoopbackAddress accepts only loopback addresses', () => {
    assert.equal(isLoopbackAddress('127.0.0.1'), true);
    assert.equal(isLoopbackAddress('::1'), true);
    assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true);
    assert.equal(isLoopbackAddress('192.168.1.2'), false);
    assert.equal(isLoopbackAddress('::ffff:10.0.0.5'), false);
    assert.equal(isLoopbackAddress(''), false);
});

test('msToLocalDate applies offset correctly for date grouping', () => {
    const ms = Date.UTC(2026, 1, 25, 23, 30, 0);
    assert.equal(msToLocalDate(ms, 7200), '2026-02-26');
    assert.equal(msToLocalDate(ms, -18000), '2026-02-25');
});
