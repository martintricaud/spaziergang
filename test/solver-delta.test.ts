import { describe, test } from 'vitest';
import assert from 'node:assert/strict';
import * as U from '../src/lib/utils';
import { constraintsPreset } from '../src/lib/constraints';

const X = { k: { c0: 0, c1: 10, z: 4, b: 5, a: 5, locked: false } };
const solve = U.solve(constraintsPreset);

describe('solver with a non-constant evolver', () => {
  test('moves a by d, not 2d', () => {
    const Y = U.liftSolve(solve, { k: { a: (x: number) => x + 0.5 } }, X);
    assert.equal(Y.k.a, 5.5);
  });
  test('clamps a to [b - z/2, b + z/2]', () => {
    const Y = U.liftSolve(solve, { k: { a: (x: number) => x + 100 } }, X);
    assert.equal(Y.k.a, 7);
  });
  test('moves z by d and clamps to [e, c1 - c0]', () => {
    const Y = U.liftSolve(solve, { k: { z: (x: number) => x + 1 } }, X);
    assert.equal(Y.k.z, 5);
    const Z = U.liftSolve(solve, { k: { z: (x: number) => x + 100 } }, X);
    assert.equal(Z.k.z, 10);
  });
});

describe('a change of the width of the range', () => {
  /** The range is [3, 7] and the thumb is at three quarters of it. */
  const Q = { k: { c0: 0, c1: 10, z: 4, b: 5, a: 6, locked: false } };

  test('keeps the thumb at the same relative position when the range grows', () => {
    const Y = U.liftSolve(solve, { k: { z: (x: number) => x + 2 } }, Q);
    assert.deepEqual([Y.k.z, Y.k.b, Y.k.a], [6, 5, 6.5]);
  });
  test('keeps the thumb at the same relative position when the range shrinks', () => {
    const Y = U.liftSolve(solve, { k: { z: (x: number) => x - 2 } }, Q);
    assert.deepEqual([Y.k.z, Y.k.b, Y.k.a], [2, 5, 5.5]);
  });
  test('keeps it when the range reaches an end of the track and its centre moves', () => {
    /** The range is [6, 10]; 2 wider, it is [4, 10]. */
    const atEnd = { k: { ...Q.k, b: 8, a: 9 } };
    const Y = U.liftSolve(solve, { k: { z: (x: number) => x + 2 } }, atEnd);
    assert.deepEqual([Y.k.z, Y.k.b, Y.k.a], [6, 7, 8.5]);
  });
  test('keeps it when the track becomes shorter than the range', () => {
    const Y = U.liftSolve(solve, { k: { c1: () => 2 } }, Q);
    assert.deepEqual([Y.k.z, Y.k.b, Y.k.a], [2, 1, 1.5]);
  });
  test('leaves a thumb that the caller moves in the same change where the caller puts it', () => {
    const Y = U.liftSolve(solve, { k: { z: (x: number) => x + 2, a: () => 5.2 } }, Q);
    assert.equal(Y.k.a, 5.2);
  });
});

describe('a move of the range without a change of its width', () => {
  test('moves the thumb only when an end of the range reaches it', () => {
    const Q = { k: { c0: 0, c1: 10, z: 4, b: 5, a: 6, locked: false } };
    const near = U.liftSolve(solve, { k: { b: (x: number) => x + 0.5 } }, Q);
    assert.equal(near.k.a, 6);
    const far = U.liftSolve(solve, { k: { b: (x: number) => x + 4 } }, Q);
    assert.deepEqual([far.k.b, far.k.a], [8, 6]);
    const back = U.liftSolve(solve, { k: { b: (x: number) => x - 4 } }, Q);
    assert.deepEqual([back.k.b, back.k.a], [2, 4]);
  });
});
