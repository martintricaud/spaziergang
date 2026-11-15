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
