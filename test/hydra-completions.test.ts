import { describe, test } from 'vitest';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import type { CompletionResult } from '@codemirror/autocomplete';
import { javascript } from '@codemirror/lang-javascript';
import { hydraCompletionSource, insertion } from '../src/lib/hydra-completions';
import type { FunctionTable } from '../src/lib/hydra-rewrite';

const table: FunctionTable = {
  osc: { type: 'src', inputs: [{ type: 'float', name: 'frequency', default: 60 }] },
  noise: { type: 'src', inputs: [{ type: 'float', name: 'scale', default: 10 }] },
  rotate: {
    type: 'coord',
    inputs: [
      { type: 'float', name: 'angle', default: 10 },
      { type: 'float', name: 'speed', default: 0 },
    ],
  },
  color: { type: 'color', inputs: [{ type: 'float', name: 'r', default: 1 }] },
  blend: {
    type: 'combine',
    inputs: [
      { type: 'vec4', name: 'color' },
      { type: 'float', name: 'amount', default: 0.5 },
    ],
  },
  modulate: {
    type: 'combineCoord',
    inputs: [
      { type: 'vec4', name: 'color' },
      { type: 'float', name: 'amount', default: 0.1 },
    ],
  },
  /** An argument without a default, and a type that neither starts nor continues a chain. */
  helper: { type: 'float', inputs: [{ type: 'float', name: 'x' }] },
};

/** The result of the source for `doc` with the caret at its end. */
function complete(
  doc: string,
  explicit = false,
  getTable = (): FunctionTable | undefined => table,
) {
  const state = EditorState.create({ doc, extensions: [javascript()] });
  const context = new CompletionContext(state, doc.length, explicit);
  return hydraCompletionSource(getTable)(context) as CompletionResult | null;
}
const labels = (result: CompletionResult | null) => result?.options.map((o) => o.label);

describe('hydraCompletionSource', () => {
  test('after a ".", lists the chain functions and `out`, and no source function', () => {
    const result = complete('osc(10).');
    assert.deepEqual(labels(result), ['rotate', 'color', 'blend', 'modulate', 'out']);
    assert.equal(result?.from, 8);
  });

  test('after a "." and a prefix, the result starts after the "."', () => {
    assert.equal(complete('osc(10).ro')?.from, 8);
  });

  test('suggests nothing after the "." of a number, in a comment, or in a string', () => {
    assert.equal(complete('osc(0.'), null);
    assert.equal(complete('// a sentence.'), null);
    assert.equal(complete('x("a.'), null);
  });

  test('after a word that no "." precedes, lists the source functions', () => {
    const result = complete('os');
    assert.deepEqual(labels(result), ['osc', 'noise']);
    assert.equal(result?.from, 0);
  });

  test('suggests nothing in an empty text unless the request is explicit', () => {
    assert.equal(complete(''), null);
    assert.deepEqual(labels(complete('', true)), ['osc', 'noise']);
  });

  test('suggests nothing while the table is undefined', () => {
    assert.equal(
      complete('osc(10).', false, () => undefined),
      null,
    );
  });

  test('shows each argument with its default, and a chain argument as `texture`', () => {
    const detail = (doc: string, label: string) =>
      complete(doc)?.options.find((o) => o.label === label)?.detail;
    assert.equal(detail('x.', 'rotate'), '(angle = 10, speed = 0)');
    assert.equal(detail('x.', 'blend'), '(texture, amount = 0.5)');
    assert.equal(detail('x.', 'out'), '(output = o0)');
    assert.equal(
      hydraCompletionSource(() => ({ helper: { ...table.helper, type: 'src' } }))(
        new CompletionContext(EditorState.create({ doc: 'h' }), 1, false),
      )?.options[0].detail,
      '(x)',
    );
  });
});

describe('insertion', () => {
  test('inserts a call and puts the caret between its parentheses', () => {
    const state = EditorState.create({ doc: 'osc(10).' });
    const next = state.update(insertion('rotate', 8, 8)).state;
    assert.equal(next.doc.toString(), 'osc(10).rotate()');
    assert.equal(next.selection.main.head, 15);
  });
});
