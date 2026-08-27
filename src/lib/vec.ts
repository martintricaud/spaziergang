import * as R from 'ramda'
import * as U from './utils';
interface Vec {
    x: number,
    y: number,
    z: number
}

export const scale = R.curry((K, B: Partial<Vec>) => U.evolve({ x: x => x * K, y: y => y * K }, B))
export const dot = (A:Partial<Vec>, B:Partial<Vec>) => A.x * B.x + A.y * B.y
export const norm = (A:Partial<Vec>) => Math.sqrt(dot(A,A))
export const setNorm = (K: number, B: Partial<Vec>) => scale(K, unit(B))
export const add = (B: Partial<Vec>, A: Partial<Vec>) => U.evolve({ x: x => x + B.x, y: y => y + B.y }, A)
export const sub = (B: Partial<Vec>, A: Partial<Vec>) => U.evolve({ x: x => x - B.x, y: y => y - B.y }, A)
export const unit = (B: Partial<Vec>) => scale(1 / norm(B), B)
export const projectXAB = (X, A, B) => add(A,
    scale(dot(sub(A, X), sub(A, B)) / (norm(sub(A, B))),unit(sub(A, B))))
