/** Pins the 2-D vector helpers in `src/lib/vec.ts`. */

import { describe, test } from 'vitest';
import assert from 'node:assert/strict';

import * as vec from '../src/lib/vec';

describe('vec', () => {
  test('add and sub operate on x and y and keep other fields', () => {
    assert.deepEqual(vec.add({ x: 1, y: 2 }, { x: 10, y: 20, movementX: 3 }), {
      x: 11,
      y: 22,
      movementX: 3,
    });
    assert.deepEqual(vec.sub({ x: 1, y: 2 }, { x: 10, y: 20 }), { x: 9, y: 18 });
  });
  test('scale, dot, norm, unit, setNorm', () => {
    assert.deepEqual(vec.scale(2, { x: 1, y: 2 }), { x: 2, y: 4 });
    assert.equal(vec.dot({ x: 1, y: 2 }, { x: 3, y: 4 }), 11);
    assert.equal(vec.norm({ x: 3, y: 4 }), 5);
    const close = (v, e) =>
      assert.ok(Math.abs(v.x - e.x) < 1e-12 && Math.abs(v.y - e.y) < 1e-12, `${JSON.stringify(v)}`);
    close(vec.unit({ x: 3, y: 4 }), { x: 0.6, y: 0.8 });
    close(vec.setNorm(10, { x: 3, y: 4 }), { x: 6, y: 8 });
  });
  test('projectXAB projects X onto the line through A and B', () => {
    assert.deepEqual(vec.projectXAB({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 }), {
      x: 5,
      y: 0,
    });
    assert.deepEqual(vec.projectXAB({ x: 0, y: 7 }, { x: 0, y: 0 }, { x: 0, y: 10 }), {
      x: 0,
      y: 7,
    });
  });
});
