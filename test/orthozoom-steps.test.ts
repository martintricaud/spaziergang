import { describe, expect, it } from 'vitest';
import { orthoZoom } from 'orthozoom';
import { linearChart, step } from 'instrument';
import type { Input } from 'instrument';
import {
  STEPS_PER_PARAMETER,
  macroSteps,
  shiftIndex,
  shiftValue,
} from '../src/lib/orthozoom-steps';

describe('macroSteps', () => {
  it('is the largest index for the indices a double can hold', () => {
    expect(macroSteps((1n << 64n) - 1n)).toBe(2 ** 64);
    expect(macroSteps((1n << 352n) - 1n)).toBe(2 ** 352);
  });
  it('is limited to 2^1023 for 32 parameters or more', () => {
    expect(macroSteps((1n << 1024n) - 1n)).toBe(2 ** 1023);
  });
  it('is 1 when no parameter is unlocked', () => {
    expect(macroSteps(0n)).toBe(1);
  });
});

describe('shiftIndex', () => {
  it('adds a small shift to a large index without losing it', () => {
    const h = (1n << 352n) - 10n;
    expect(shiftIndex(h, 3)).toBe(h + 3n);
    expect(shiftIndex(h, -2.6)).toBe(h - 3n);
  });
  it('adds a shift larger than 2^53', () => {
    expect(shiftIndex(0n, 2 ** 100)).toBe(1n << 100n);
  });
  it('ignores a shift that is not finite', () => {
    expect(shiftIndex(5n, Infinity)).toBe(5n);
    expect(shiftIndex(5n, NaN)).toBe(5n);
  });
});

describe('shiftValue', () => {
  it('moves a value by a fraction of its range', () => {
    expect(shiftValue(0.5, STEPS_PER_PARAMETER / 4, 0, 2)).toBe(1);
    expect(shiftValue(10, -STEPS_PER_PARAMETER / 2, 0, 100)).toBe(-40);
  });
});

describe('orthoZoom on a chart of steps', () => {
  /** Presses at (100, 0) on a 200-pixel track of `steps` steps, moves across the track by `distance`, then 10 pixels along it; returns the last shift. */
  function drag(steps: number, distance: number): number {
    let instrument = orthoZoom({ dMax: 500, edgeRate: 0 }).instrument;
    const feed = (input: Input): number => {
      const [next, endo] = step(instrument, input);
      instrument = next;
      return endo(0);
    };
    feed({ kind: 'move', p: { x: 100, y: 0 } });
    feed({ kind: 'press', target: { chart: linearChart([0, steps], [0, 200]), value: 0 } });
    feed({ kind: 'move', p: { x: 100, y: distance } });
    return feed({ kind: 'move', p: { x: 110, y: distance } });
  }

  it('follows the pointer on the track', () => {
    expect(drag(STEPS_PER_PARAMETER, 0)).toBeCloseTo((10 / 200) * STEPS_PER_PARAMETER, 0);
  });
  it('moves by one step per pixel at dMax', () => {
    expect(drag(STEPS_PER_PARAMETER, 500)).toBe(10);
    expect(drag(2 ** 352, 500)).toBe(10);
  });
});
