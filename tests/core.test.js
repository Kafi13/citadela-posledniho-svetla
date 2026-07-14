import test from 'node:test';
import assert from 'node:assert/strict';

import { aabb, approach, clamp, resolveMotion } from '../src/core.js';

test('clamp ořízne hodnotu do zadaného rozsahu', () => {
  assert.equal(clamp(-4, 0, 10), 0);
  assert.equal(clamp(6, 0, 10), 6);
  assert.equal(clamp(18, 0, 10), 10);
});

test('aabb rozpozná překryv a oddělené obdélníky', () => {
  const origin = { x: 10, y: 10, w: 20, h: 20 };

  assert.equal(aabb(origin, { x: 20, y: 20, w: 20, h: 20 }), true);
  assert.equal(aabb(origin, { x: 50, y: 50, w: 10, h: 10 }), false);
});

test('approach se k cíli blíží bez přestřelení', () => {
  assert.equal(approach(0, 10, 3), 3);
  assert.equal(approach(10, 0, 4), 6);
  assert.equal(approach(9, 10, 3), 10);
  assert.equal(approach(1, 0, 4), 0);
});

test('herní jádro exportuje resolver pohybu', () => {
  assert.equal(typeof resolveMotion, 'function');
});

test('resolver zastaví rychlý pád přes tenkou podlahu', () => {
  const body = { x: 20, y: 0, w: 20, h: 20 };
  const floor = { x: 0, y: 60, w: 120, h: 8 };
  const result = resolveMotion(body, 0, 120, [floor]);

  assert.equal(result.y, 40);
  assert.equal(result.hitBottom, true);
  assert.equal(result.floor, floor);
});

test('resolver zastaví rychlý pohyb na stěně a zachová volnou osu', () => {
  const body = { x: 10, y: 10, w: 20, h: 20 };
  const wall = { x: 70, y: 0, w: 10, h: 100 };
  const result = resolveMotion(body, 100, 12, [wall]);

  assert.equal(result.x, 50);
  assert.equal(result.y, 22);
  assert.equal(result.hitRight, true);
});
