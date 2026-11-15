import { parse } from 'acorn';
import type { Node } from 'acorn';
import { full } from 'acorn-walk';

/** Hydra's function table, in the shape of `renderer.generator.glslTransforms`: for `combine` and `combineCoord` functions, `inputs[0]` is the implicit source argument. */
export type FunctionTable = Record<
  string,
  { type?: string; inputs: Array<{ type: string; name: string; default?: unknown }> }
>;

/** One parameter derived from a numeric literal of the source text. */
export interface Param {
  key: string;
  value: number;
}

/** The fields of one parameter in the input space. `z` and `b` are optional: the parameter store computes them when absent. */
export interface ParamFields {
  c0: number;
  c1: number;
  a: number;
  locked: boolean;
  z?: number;
  b?: number;
}

type AnyNode = Node & Record<string, any>;
interface Edit {
  start: number;
  end: number;
  text: string;
}

/** Scalars of hydra's sandbox that are never updated when `makeGlobal` is false; the rewrite reads them from the closure's argument. */
const PROPS = new Set(['time', 'bpm']);

const isNode = (x: unknown): x is AnyNode =>
  typeof x === 'object' && x !== null && typeof (x as AnyNode).type === 'string';

const isFunction = (n: AnyNode): boolean =>
  n.type === 'ArrowFunctionExpression' || n.type === 'FunctionExpression';

/** The identifier that names the called function: `osc` in `osc(1)`, `rotate` in `x.rotate(1)`. */
function calleeId(call: AnyNode): AnyNode | undefined {
  const c = call.callee;
  if (c.type === 'Identifier') return c;
  if (c.type === 'MemberExpression' && !c.computed && c.property.type === 'Identifier') {
    return c.property;
  }
  return undefined;
}

const isNumeric = (n: AnyNode): boolean =>
  (n.type === 'Literal' && typeof n.value === 'number') ||
  (n.type === 'UnaryExpression' &&
    n.operator === '-' &&
    n.argument.type === 'Literal' &&
    typeof n.argument.value === 'number');

/** Calls `visit` on `node` and its descendants, with each node's parent. `visit` returns false to skip a node's children. */
function walk(
  node: AnyNode,
  visit: (n: AnyNode, parent?: AnyNode) => boolean | void,
  parent?: AnyNode,
): void {
  if (visit(node, parent) === false) return;
  for (const key of Object.keys(node)) {
    const v = node[key];
    if (Array.isArray(v)) v.forEach((c) => isNode(c) && walk(c, visit, node));
    else if (isNode(v)) walk(v, visit, node);
  }
}

/** True when the identifier reads a variable, false when it is a property name (`x.time`, `{ time: 1 }`). */
function isVariableRead(id: AnyNode, parent?: AnyNode): boolean {
  if (!parent) return true;
  if (parent.type === 'MemberExpression') return parent.object === id || parent.computed;
  if (parent.type === 'Property') return parent.value === id || parent.computed;
  return true;
}

/**
 * Rewrites Hydra source text so that every numeric literal in an argument of a Hydra function reads the parameter record `P`.
 * Returns the rewritten text and the parameters in source order. Throws a `SyntaxError` when the text does not parse.
 */
export function rewrite(code: string, table: FunctionTable): { code: string; params: Param[] } {
  const ast = parse(code, { ecmaVersion: 2022, sourceType: 'script' });
  const isHydraCall = (n: AnyNode): boolean =>
    n.type === 'CallExpression' && Object.hasOwn(table, calleeId(n)?.name ?? '');

  const calls: AnyNode[] = [];
  full(ast, (node) => {
    if (isHydraCall(node as AnyNode)) calls.push(node as AnyNode);
  });
  /** A chained call starts where its receiver starts, so the position of the function's name gives the source order. */
  calls.sort((x, y) => calleeId(x)!.start - calleeId(y)!.start);

  const edits: Edit[] = [];
  const params: Param[] = [];
  const occurrences: Record<string, number> = {};

  for (const call of calls) {
    const fn: string = calleeId(call)!.name;
    occurrences[fn] = (occurrences[fn] ?? 0) + 1;
    const inputs = table[fn].inputs;

    (call.arguments as AnyNode[]).forEach((arg, i) => {
      /** A `vec4` input is a source (another chain or an output), never a parameter. */
      if (inputs[i]?.type === 'vec4') return;
      /** A function that declares parameters already reads hydra's props; its author owns it. */
      if (isFunction(arg) && arg.params.length > 0) return;

      const root: AnyNode = isFunction(arg) ? arg.body : arg;
      const literals: AnyNode[] = [];
      const props: AnyNode[] = [];
      let skip = false;
      walk(root, (n, parent) => {
        /** An argument that holds a hydra call is a source; one that holds an array is a hydra sequence. */
        if (isHydraCall(n) || n.type === 'ArrayExpression') skip = true;
        if (isNumeric(n)) {
          literals.push(n);
          return false;
        }
        if (n.type === 'Identifier' && PROPS.has(n.name) && isVariableRead(n, parent))
          props.push(n);
      });
      if (skip || (literals.length === 0 && props.length === 0)) return;

      const base = `${fn}${occurrences[fn]}_${inputs[i]?.name ?? `arg${i}`}`;
      literals.forEach((lit, j) => {
        const key = j === 0 ? base : `${base}_${j + 1}`;
        const value: number = lit.type === 'Literal' ? lit.value : -lit.argument.value;
        params.push({ key, value });
        edits.push({ start: lit.start, end: lit.end, text: `P.${key}` });
      });
      props.forEach((id) => edits.push({ start: id.start, end: id.end, text: `__p.${id.name}` }));

      if (isFunction(arg)) {
        /** The function declares no parameter, so the first parenthesis pair after its start is its empty parameter list. */
        const open = code.indexOf('(', arg.start);
        const close = code.indexOf(')', open);
        edits.push({ start: open, end: close + 1, text: '(__p)' });
      } else {
        edits.push({ start: arg.start, end: arg.start, text: '(__p) => (' });
        edits.push({ start: arg.end, end: arg.end, text: ')' });
      }
    });
  }

  /** Edits are applied from the end of the text so that earlier offsets stay valid. At one offset, a replacement is applied before an insertion, so the inserted text lands before the replaced text. */
  const ordered = [...edits].sort((x, y) => y.start - x.start || y.end - x.end);
  let out = code;
  for (const e of ordered) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return { code: out, params };
}

/**
 * Builds the input space from the parameters of a rewrite.
 * A key present in `previous` keeps its previous fields. A new key gets its literal as value and the range [min(0, 2v), max(1, 2v)], then the fields of `overrides[key]`.
 * A key listed in `changed` (its literal was edited) takes the literal as its value and keeps its range, which grows only when the value falls outside it.
 * Keys absent from `params` are dropped.
 */
export function deriveInputSpace(
  params: Param[],
  previous: Record<string, ParamFields> = {},
  overrides: Record<string, Partial<ParamFields>> = {},
  changed: ReadonlySet<string> = new Set(),
): Array<[string, ParamFields]> {
  return params.map(({ key, value }): [string, ParamFields] => {
    const old = previous[key];
    if (old && !changed.has(key)) return [key, { ...old }];
    if (old) {
      /** `z` and `b` are dropped so that the parameter store recomputes a zoom window that contains the new value. */
      const { z, b, ...kept } = old;
      return [key, { ...kept, a: value, c0: Math.min(old.c0, value), c1: Math.max(old.c1, value) }];
    }
    return [
      key,
      {
        c0: Math.min(0, 2 * value),
        c1: Math.max(1, 2 * value),
        a: value,
        locked: false,
        ...overrides[key],
      },
    ];
  });
}
