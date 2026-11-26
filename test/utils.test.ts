/**
 * Pins the behaviour of `src/lib/utils.ts` and `src/lib/constraints.ts` as it is, so that the
 * library migration can be checked against it. Expected values were recorded from the code
 * before the migration.
 */

import { describe, test } from 'vitest';
import assert from 'node:assert/strict';
import * as R from 'ramda';

import * as U from '../src/lib/utils';
import { constraintsPreset } from '../src/lib/constraints';

describe('stringToPath', () => {
  test('splits on spaces and converts numeric segments', () => {
    assert.deepEqual(U.stringToPath('key 0'), ['key', 0]);
    assert.deepEqual(U.stringToPath('frequency a'), ['frequency', 'a']);
  });
  test('an empty or undefined path gives an empty array', () => {
    assert.deepEqual(U.stringToPath(''), []);
    assert.deepEqual(U.stringToPath(undefined), []);
  });
});

describe('assignDefaultName', () => {
  test('returns "preset" with the lowest free suffix from 1', () => {
    assert.equal(U.assignDefaultName([]), 'preset1');
    assert.equal(U.assignDefaultName(['preset0']), 'preset1');
    assert.equal(U.assignDefaultName(['preset1', 'preset3']), 'preset2');
    assert.equal(
      U.assignDefaultName([
        'preset1',
        'preset2',
        'preset3',
        'preset4',
        'preset5',
        'preset6',
        'preset7',
        'preset8',
        'preset9',
        'preset10',
      ]),
      'preset11',
    );
  });
  test('ignores names that are not "preset" followed by digits', () => {
    assert.equal(U.assignDefaultName(['my preset', 'preset1x', 'Preset1']), 'preset1');
  });
});

describe('prod, scale, lerp', () => {
  test('prod multiplies two numbers or two BigInts directly', () => {
    assert.equal(U.prod(2, 3, 9), 6);
    assert.equal(U.prod(2n, 3n, 9), 6n);
  });
  test('prod multiplies a BigInt by a number at the given decimal precision', () => {
    assert.equal(U.prod(0.5, 1000n, 9), 500n);
    assert.equal(U.prod(1000n, 0.25, 9), 250n);
    assert.equal(U.prod(0.1, 2n ** 64n, 6), (2n ** 64n * 100000n) / 1000000n);
  });
  test('scale maps a number from one interval onto the size of another', () => {
    assert.equal(U.scale(0, 10, 0, 100, 5), 50);
    assert.equal(U.scale(0, 10, 0n, 1000n, 5), 500n);
  });
  test('lerp maps between intervals, for numbers and for BigInt targets', () => {
    assert.equal(U.lerp(0, 10, 100, 200, 5), 150);
    assert.equal(U.lerp(0, 10, 0n, 1000n, 5), 500n);
  });
  test('lerp is curried with Ramda placeholders', () => {
    const lerpTo = U.lerp(0, 10, R.__, R.__, 5);
    assert.equal(lerpTo(100, 200), 150);
    assert.equal(lerpTo(0n, 1000n), 500n);
  });
});

describe('deepAlways and deepObjOf', () => {
  test('deepAlways turns every leaf into a constant function', () => {
    const evolver = U.deepAlways({ a: 1, b: { c: 2 } });
    assert.equal(evolver.a(999), 1);
    assert.equal(evolver.b.c(999), 2);
  });
  test('deepObjOf builds a nested object from a path', () => {
    assert.deepEqual(U.deepObjOf(['key', 'a'], 7), { key: { a: 7 } });
  });
});

describe('solve and liftSolve (constraint propagation)', () => {
  const solver = U.solve(constraintsPreset);
  const param = () => ({ c0: 0, c1: 10, z: 4, b: 5, a: 6, locked: false });

  test('an empty evolver leaves the parameters unchanged', () => {
    const X = { p: param() };
    assert.deepEqual(U.liftSolve(solver, {}, X), X);
  });
  test('a is clamped to the window [b - z/2, b + z/2]', () => {
    assert.equal(U.liftSolve(solver, { p: { a: () => 100 } }, { p: param() }).p.a, 7);
    assert.equal(U.liftSolve(solver, { p: { a: () => -100 } }, { p: param() }).p.a, 3);
  });
  test('b is clamped to [c0 + z/2, c1 - z/2] and a follows the moved window', () => {
    const out = U.liftSolve(solver, { p: { b: () => 100 } }, { p: param() }).p;
    assert.equal(out.b, 8);
    assert.equal(out.a, 6);
  });
  test('z is clamped to the full range, and a keeps its relative position in the window', () => {
    const out = U.liftSolve(solver, { p: { z: () => 100 } }, { p: param() }).p;
    assert.equal(out.z, 10);
    assert.equal(out.b, 5);
    assert.equal(out.a, 7.5);
  });
  test('shrinking c1 propagates to z, b and a', () => {
    const out = U.liftSolve(solver, { p: { c1: () => 3 } }, { p: param() }).p;
    assert.equal(out.c1, 3);
    assert.equal(out.z, 3);
    assert.equal(out.b, 1.5);
    /** The window shrinks from [3, 7] to [0, 3]; a stays at three quarters of it. */
    assert.equal(out.a, 2.25);
  });
  test('only the parameters named in the evolver are touched', () => {
    const X = { p: param(), q: param() };
    const out = U.liftSolve(solver, { p: { a: () => 100 } }, X);
    assert.equal(out.p.a, 7);
    assert.deepEqual(out.q, X.q);
  });
});
