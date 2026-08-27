/* tslint:disable */
/* eslint-disable */
/**
* @param {string} hilbert_index
* @param {number} bits
* @param {number} dimensions
* @returns {Uint32Array}
*/
export function hilbert_axes_wasm_from_str(hilbert_index: string, bits: number, dimensions: number): Uint32Array;
/**
* @param {Uint32Array} hilbert_axes
* @param {number} bits
* @returns {string}
*/
export function hilbert_index_wasm_to_str(hilbert_axes: Uint32Array, bits: number): string;
/**
* @param {string} hilbert_index
* @param {number} bits
* @param {number} dimensions
* @returns {number}
*/
export function rescale_hilbert_from_str(hilbert_index: string, bits: number, dimensions: number): number;
/**
* @param {number} cursor_index
* @param {number} cursor_max
* @param {number} bits
* @param {number} dimensions
* @returns {string}
*/
export function rescale_hilbert_to_str(cursor_index: number, cursor_max: number, bits: number, dimensions: number): string;
/**
* @param {number} a
* @param {string} b
* @param {number} precision
* @returns {string}
*/
export function biguint_prod_by_f64(a: number, b: string, precision: number): string;
/**
* @param {number} a
* @param {string} b
* @param {number} precision
* @returns {string}
*/
export function bigint_prod_by_f64(a: number, b: string, precision: number): string;
/**
* @param {string} a
* @param {string} b
* @returns {string}
*/
export function bigint_sum_from_str(a: string, b: string): string;
/**
* @param {string} a
* @param {string} b
* @returns {string}
*/
export function bigint_dif_from_str(a: string, b: string): string;
/**
* @param {number} bits
* @param {number} dims
* @returns {string}
*/
export function max_hilbert(bits: number, dims: number): string;
/**
* @param {string} a
* @param {string} b
* @param {string} c
* @returns {string}
*/
export function biguint_clamp_from_str(a: string, b: string, c: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly hilbert_axes_wasm_from_str: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly hilbert_index_wasm_to_str: (a: number, b: number, c: number, d: number) => void;
  readonly rescale_hilbert_from_str: (a: number, b: number, c: number, d: number) => number;
  readonly rescale_hilbert_to_str: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly biguint_prod_by_f64: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly bigint_prod_by_f64: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly bigint_sum_from_str: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly bigint_dif_from_str: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly max_hilbert: (a: number, b: number, c: number) => void;
  readonly biguint_clamp_from_str: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_malloc: (a: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number) => number;
  readonly __wbindgen_free: (a: number, b: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {SyncInitInput} module
*
* @returns {InitOutput}
*/
export function initSync(module: SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function init (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
