/** The number of values of one parameter: parameters are encoded on 32 bits. */
export const STEPS_PER_PARAMETER = 2 ** 32;

/** The largest step count a double can hold as a power of two. A macro slider over 32 or more parameters is limited to it. */
const MAX_STEPS = 2 ** 1023;

/** The number of steps of a macro slider whose largest Hilbert index is `maxH`. It is at least 1, so that a chart over it has a non-empty domain. */
export const macroSteps = (maxH: bigint): number => Math.max(1, Math.min(Number(maxH), MAX_STEPS));

/** The Hilbert index `h` moved by `shift` steps. `shift` is rounded to a whole number of steps. */
export const shiftIndex = (h: bigint, shift: number): bigint =>
  Number.isFinite(shift) ? h + BigInt(Math.round(shift)) : h;

/** The value of a parameter whose range is [c0, c1], moved by `shift` steps of that range. */
export const shiftValue = (value: number, shift: number, c0: number, c1: number): number =>
  value + (shift / STEPS_PER_PARAMETER) * (c1 - c0);
