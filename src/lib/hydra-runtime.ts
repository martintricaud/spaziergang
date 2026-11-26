/// <reference types="vite/client" />
import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { rewrite } from './hydra-rewrite';
import type { FunctionTable, Param } from './hydra-rewrite';

/** The part of a hydra-synth renderer that this module uses. Tests pass a fake that has no WebGL context. */
export interface RendererLike {
  /** Everything hydra exposes to user code: the source functions (`osc`, `noise`, ...), the outputs `o0`..`o3`, the sources `s0`..`s3`, `render`, `mouse`, and so on. */
  synth: Record<string, any>;
  generator: { glslTransforms: FunctionTable };
}

export type Evaluation = { params: Param[] } | { error: string };

/** Hydra's function table. It is undefined until the first renderer exists, because hydra-synth builds it in the renderer's constructor and exports nothing else. */
export const Table: Writable<FunctionTable | undefined> = writable(undefined);

/** Exposes the parameter record `P` to the code that `evaluate` runs. */
export function attach(renderer: RendererLike, P: Record<string, number>): void {
  renderer.synth.P = P;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * Runs `code` as a function body whose parameters are the members of `renderer.synth`.
 * hydra-synth's own `renderer.eval` cannot be used: with `makeGlobal: false` it declares these names through a direct `eval`, and inside an ES module (strict mode) such declarations are not visible to the evaluated code.
 */
function run(renderer: RendererLike, code: string): void {
  const names = Object.keys(renderer.synth).filter((name) => IDENTIFIER.test(name));
  new Function(...names, code)(...names.map((name) => renderer.synth[name]));
}

/**
 * Rewrites `code` and runs it once. Each parameter of `P` is first set to its literal, so that every closure returns a number before `syncParams` runs.
 * Returns the parameters, or the message of the parse or evaluation error; after a parse error nothing runs.
 */
export function evaluate(renderer: RendererLike, code: string): Evaluation {
  try {
    const result = rewrite(code, renderer.generator.glslTransforms);
    for (const { key, value } of result.params) renderer.synth.P[key] = value;
    run(renderer, result.code);
    if (import.meta.env?.DEV) console.log('[spaziergang] evaluated chain');
    return { params: result.params };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Writes parameter values into the record that the evaluated closures read on the next frame. Nothing is evaluated or recompiled. */
export function syncParams(renderer: RendererLike, values: Record<string, number>): void {
  Object.assign(renderer.synth.P, values);
}
