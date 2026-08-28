import { evolve } from 'remeda';

interface Vec {
  x: number;
  y: number;
}

export const scale = (K: number, B: Partial<Vec>) =>
  evolve(B, { x: (x) => x * K, y: (y) => y * K });
export const dot = (A: Partial<Vec>, B: Partial<Vec>) => A.x * B.x + A.y * B.y;
export const norm = (A: Partial<Vec>) => Math.sqrt(dot(A, A));
export const setNorm = (K: number, B: Partial<Vec>) => scale(K, unit(B));
export const add = (B: Partial<Vec>, A: Partial<Vec>) =>
  evolve(A, { x: (x) => x + B.x, y: (y) => y + B.y });
export const sub = (B: Partial<Vec>, A: Partial<Vec>) =>
  evolve(A, { x: (x) => x - B.x, y: (y) => y - B.y });
export const unit = (B: Partial<Vec>) => scale(1 / norm(B), B);
/** Orthogonal projection of X onto the line through A and B. */
export const projectXAB = (X, A, B) =>
  add(A, scale(dot(sub(A, X), sub(A, B)) / norm(sub(A, B)), unit(sub(A, B))));
