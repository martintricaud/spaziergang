/**
 * Hilbert-curve transforms on native BigInt (Skilling, "Programming the Hilbert curve", 2004).
 *
 * Conventions match the `hilbert` Rust crate that the app used through wasm until now:
 * every axis has `bits` bits, the index has `bits * dims` bits, and the index's least
 * significant bit is bit 0 of the last axis, the next one bit 0 of the axis before it,
 * and so on (bit b of axis d is index bit `b * dims + (dims - 1 - d)`).
 */

/** Maps a Hilbert index to its axes (coordinates), each in [0, 2^bits). */
export function forward(index: bigint, bits: number, dims: number): Uint32Array {
  const X = new Uint32Array(dims);
  if (dims === 0) return X;
  // Transpose: distribute the index bits over the axes.
  let k = 0n;
  for (let b = 0; b < bits; b++) {
    for (let d = dims - 1; d >= 0; d--) {
      if ((index >> k) & 1n) X[d] |= 1 << b;
      k++;
    }
  }
  // Skilling's TransposetoAxes.
  const n = dims;
  let t = X[n - 1] >>> 1;
  for (let i = n - 1; i > 0; i--) X[i] ^= X[i - 1];
  X[0] ^= t;
  const N = 2 ** bits;
  for (let Q = 2; Q < N; Q *= 2) {
    const P = Q - 1;
    for (let i = n - 1; i >= 0; i--) {
      if ((X[i] & Q) !== 0) {
        X[0] ^= P;
      } else {
        t = (X[0] ^ X[i]) & P;
        X[0] ^= t;
        X[i] ^= t;
      }
    }
  }
  return X;
}

/** Maps axes (coordinates, each in [0, 2^bits)) to their Hilbert index. */
export function inverse(axes: Uint32Array, bits: number): bigint {
  const n = axes.length;
  if (n === 0) return 0n;
  // Skilling's AxestoTranspose.
  const X = Uint32Array.from(axes);
  const M = 2 ** (bits - 1);
  let t: number;
  for (let Q = M; Q > 1; Q /= 2) {
    const P = Q - 1;
    for (let i = 0; i < n; i++) {
      if ((X[i] & Q) !== 0) {
        X[0] ^= P;
      } else {
        t = (X[0] ^ X[i]) & P;
        X[0] ^= t;
        X[i] ^= t;
      }
    }
  }
  for (let i = 1; i < n; i++) X[i] ^= X[i - 1];
  t = 0;
  for (let Q = M; Q > 1; Q /= 2) if ((X[n - 1] & Q) !== 0) t ^= Q - 1;
  for (let i = 0; i < n; i++) X[i] ^= t;
  // Untranspose: interleave the axis bits, most significant first.
  let binary = '';
  for (let b = bits - 1; b >= 0; b--) {
    for (let d = 0; d < n; d++) binary += (X[d] >>> b) & 1;
  }
  return BigInt('0b' + binary);
}

/** Position of an index along the curve as a fraction in [0, 1] of the largest index. */
export function rescale(index: bigint, bits: number, dims: number): number {
  const n = BigInt(bits * dims);
  if (n === 0n) return 0;
  const max = (1n << n) - 1n;
  if (index <= 0n) return 0;
  if (index >= max) return 1;
  return Number((index << 53n) / max) / 2 ** 53;
}
