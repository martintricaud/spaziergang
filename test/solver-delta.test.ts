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
  /** The range is [3, 7] and the thumb, at 6, is at three quarters of it. */
  const Q = { k: { c0: 0, c1: 10, z: 4, b: 5, a: 6, locked: false } };
  const ratio = ({ a, b, z }: { a: number; b: number; z: number }) => (a - (b - z / 2)) / z;

  test('scales the range around the thumb when the range grows', () => {
    const Y = U.liftSolve(solve, { k: { z: (x: number) => x + 2 } }, Q);
    /** The range is [1.5, 7.5]. */
    assert.deepEqual([Y.k.z, Y.k.b, Y.k.a], [6, 4.5, 6]);
    assert.equal(ratio(Y.k), 0.75);
  });
  test('scales the range around the thumb when the range shrinks', () => {
    const Y = U.liftSolve(solve, { k: { z: (x: number) => x - 2 } }, Q);
    /** The range is [4.5, 6.5]. */
    assert.deepEqual([Y.k.z, Y.k.b, Y.k.a], [2, 5.5, 6]);
    assert.equal(ratio(Y.k), 0.75);
  });
  test('scales the range around the thumb when the range fills the track', () => {
    const full = { k: { ...Q.k, z: 10, b: 5, a: 1 } };
    const Y = U.liftSolve(solve, { k: { z: (x: number) => x - 5 } }, full);
    /** The thumb is at one tenth of the range [0.5, 5.5]. */
    assert.deepEqual([Y.k.z, Y.k.b, Y.k.a], [5, 3, 1]);
  });
  test('keeps the value of the thumb when an end of the track stops the range', () => {
    /** The range is [6, 10]; 2 wider around the thumb it would be [4.5, 10.5], so it is [4, 10]. */
    const atEnd = { k: { ...Q.k, b: 8, a: 9 } };
    const Y = U.liftSolve(solve, { k: { z: (x: number) => x + 2 } }, atEnd);
    assert.deepEqual([Y.k.z, Y.k.b, Y.k.a], [6, 7, 9]);
  });
  test('moves the thumb only as far as needed when the track becomes shorter than the range', () => {
    const Y = U.liftSolve(solve, { k: { c1: () => 2 } }, Q);
    assert.deepEqual([Y.k.z, Y.k.b, Y.k.a], [2, 1, 2]);
  });
  test('leaves the range in place when the caller moves the thumb in the same change', () => {
    const Y = U.liftSolve(solve, { k: { z: (x: number) => x + 2, a: () => 5.2 } }, Q);
    assert.deepEqual([Y.k.b, Y.k.a], [5, 5.2]);
  });
  test('leaves the range where the caller puts it in the same change', () => {
    const Y = U.liftSolve(solve, { k: { z: (x: number) => x + 2, b: () => 6 } }, Q);
    assert.deepEqual([Y.k.z, Y.k.b, Y.k.a], [6, 6, 6]);
  });
});

describe('a move of the range without a change of its width', () => {
  /** The range is [3, 7] and the thumb is at 6. */
  const Q = { k: { c0: 0, c1: 10, z: 4, b: 5, a: 6, locked: false } };

  test('moves the thumb by the same amount', () => {
    const Y = U.liftSolve(solve, { k: { b: (x: number) => x + 0.5 } }, Q);
    assert.deepEqual([Y.k.z, Y.k.b, Y.k.a], [4, 5.5, 6.5]);
  });
  test('moves the thumb by the amount the range really moves when an end of the track stops it', () => {
    const far = U.liftSolve(solve, { k: { b: (x: number) => x + 4 } }, Q);
    assert.deepEqual([far.k.b, far.k.a], [8, 9]);
    const back = U.liftSolve(solve, { k: { b: (x: number) => x - 4 } }, Q);
    assert.deepEqual([back.k.b, back.k.a], [2, 3]);
  });
  test('leaves a thumb that the caller moves in the same change where the caller puts it', () => {
    const Y = U.liftSolve(solve, { k: { b: (x: number) => x + 0.5, a: () => 4 } }, Q);
    assert.deepEqual([Y.k.b, Y.k.a], [5.5, 4]);
  });
});
