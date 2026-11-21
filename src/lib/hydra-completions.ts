import type { TransactionSpec } from '@codemirror/state';
import type { Completion, CompletionResult, CompletionSource } from '@codemirror/autocomplete';
import { syntaxTree } from '@codemirror/language';
import type { FunctionTable } from './hydra-rewrite';

type Inputs = FunctionTable[string]['inputs'];

/** The types of the functions that hydra attaches to a chain. Functions of type `src` start a chain. */
const CHAIN_TYPES = new Set(['color', 'coord', 'combine', 'combineCoord']);

/** `out` is a method of every chain, but hydra's table does not list it. */
const OUT: Inputs = [{ type: 'output', name: 'output', default: 'o0' }];

const WORD = /^[\w$]*$/;

/** The change that inserts a call of `name` over [from, to], and the selection that puts the caret between its parentheses. */
export function insertion(name: string, from: number, to: number): TransactionSpec {
  return {
    changes: { from, to, insert: `${name}()` },
    selection: { anchor: from + name.length + 1 },
  };
}

/** The argument list shown next to a function's name. A `vec4` input is another chain or an output; the table names it `color`, hydra's documentation names it `texture`. */
function signature(inputs: Inputs): string {
  const argument = ({ type, name, default: value }: Inputs[number]): string => {
    if (type === 'vec4') return 'texture';
    return value === undefined ? name : `${name} = ${value}`;
  };
  return `(${inputs.map(argument).join(', ')})`;
}

function entry(name: string, inputs: Inputs): Completion {
  return {
    label: name,
    detail: signature(inputs),
    type: 'function',
    apply: (view, _completion, from, to) => view.dispatch(insertion(name, from, to)),
  };
}

/**
 * Suggests hydra's functions at the caret: after a ".", the functions that continue a chain and `out`; after a word that no "." precedes, the functions that start a chain.
 * Suggests nothing inside a comment or a string, after the "." of a number, or while the table is undefined.
 */
export function hydraCompletionSource(getTable: () => FunctionTable | undefined): CompletionSource {
  return (context): CompletionResult | null => {
    const table = getTable();
    if (!table) return null;
    const node = syntaxTree(context.state).resolveInner(context.pos, -1);
    if (/Comment|String/.test(node.name)) return null;

    const entries = (keep: (type?: string) => boolean): Completion[] =>
      Object.entries(table)
        .filter(([, fn]) => keep(fn.type))
        .map(([name, fn]) => entry(name, fn.inputs));

    const afterDot = context.matchBefore(/\.[\w$]*$/);
    if (afterDot) {
      if (/\d/.test(context.state.sliceDoc(afterDot.from - 1, afterDot.from))) return null;
      return {
        from: afterDot.from + 1,
        options: [...entries((type) => CHAIN_TYPES.has(type ?? '')), entry('out', OUT)],
        validFor: WORD,
      };
    }

    const word = context.matchBefore(/[\w$]+$/);
    if (!word && !context.explicit) return null;
    return {
      from: word ? word.from : context.pos,
      options: entries((type) => type === 'src'),
      validFor: WORD,
    };
  };
}
