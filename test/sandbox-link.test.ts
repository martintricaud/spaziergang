import { describe, expect, it } from 'vitest';
import { zoomAt } from 'orthozoom';
import { init, move, press } from 'archie';
import { run, linearChart } from 'instrument';

/** These tests fail when the packages linked from displacement-techniques-sandbox do not resolve. */
describe('packages linked from displacement-techniques-sandbox', () => {
  it('orthozoom computes the zoom at half the maximum distance', () => {
    expect(zoomAt({ s: 4, r: 16, dMax: 100, edgeRate: 0 }, 50)).toBe(0.5);
  });

  it('archie moves the lever handle to the pointer while pressed', () => {
    expect(move(press(init(), true), { x: 10, y: 10 }).A).toEqual({ x: 10, y: 10 });
  });

  it('instrument exports the contract and the chart', () => {
    expect(typeof run).toBe('function');
    expect(typeof linearChart).toBe('function');
  });
});
