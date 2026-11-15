import { describe, test } from 'vitest';
import assert from 'node:assert/strict';
import { attach, evaluate, syncParams } from '../src/lib/hydra-runtime';
import type { RendererLike } from '../src/lib/hydra-runtime';

/** A renderer without WebGL. Its `osc` records the arguments of each call; `rotate` and `out` record that they ran. */
function fakeRenderer() {
  const calls: Array<{ fn: string; args: unknown[] }> = [];
  const chain = {
    rotate: (...args: unknown[]) => (calls.push({ fn: 'rotate', args }), chain),
    out: (...args: unknown[]) => (calls.push({ fn: 'out', args }), chain),
  };
  const o0 = { name: 'o0' };
  const renderer: RendererLike = {
    synth: { o0, osc: (...args: unknown[]) => (calls.push({ fn: 'osc', args }), chain) },
    generator: {
      glslTransforms: {
        osc: { type: 'src', inputs: [{ type: 'float', name: 'frequency' }] },
        rotate: { type: 'coord', inputs: [{ type: 'float', name: 'angle' }] },
      },
    },
  };
  return { renderer, calls, o0 };
}
const names = (calls: Array<{ fn: string }>) => calls.map((c) => c.fn).join(' ');

describe('hydra runtime', () => {
  test('evaluate runs the chain with the members of synth in scope', () => {
    const { renderer, calls, o0 } = fakeRenderer();
    attach(renderer, {});
    const result = evaluate(renderer, 'osc(10).rotate(0.5).out(o0)');
    assert.deepEqual(result, {
      params: [
        { key: 'osc1_frequency', value: 10 },
        { key: 'rotate1_angle', value: 0.5 },
      ],
    });
    assert.equal(names(calls), 'osc rotate out');
    assert.equal(calls[2].args[0], o0);
  });

  test('evaluating the same text twice runs the chain twice', () => {
    const { renderer, calls } = fakeRenderer();
    attach(renderer, {});
    evaluate(renderer, 'osc(10).out()');
    evaluate(renderer, 'osc(10).out()');
    assert.equal(names(calls), 'osc out osc out');
  });

  test('evaluate sets each parameter to its literal; syncParams changes what the closures return without running the chain', () => {
    const { renderer, calls } = fakeRenderer();
    const P: Record<string, number> = { osc1_frequency: 99 };
    attach(renderer, P);
    evaluate(renderer, 'osc(10).rotate(0.5).out()');
    assert.deepEqual(P, { osc1_frequency: 10, rotate1_angle: 0.5 });
    const frequency = calls[0].args[0] as (props: object) => number;
    assert.equal(frequency({}), 10);
    syncParams(renderer, { osc1_frequency: 42 });
    assert.equal(renderer.synth.P, P);
    assert.equal(frequency({}), 42);
    assert.equal(calls.length, 3);
  });

  test('time is read from the argument that hydra passes to the closure', () => {
    const { renderer, calls } = fakeRenderer();
    attach(renderer, {});
    evaluate(renderer, 'osc(time * 2).out()');
    const frequency = calls[0].args[0] as (props: object) => number;
    assert.equal(frequency({ time: 3 }), 6);
  });

  test('a parse error returns the message and runs nothing', () => {
    const { renderer, calls } = fakeRenderer();
    attach(renderer, {});
    const result = evaluate(renderer, 'osc(');
    assert.ok('error' in result && result.error.length > 0);
    assert.equal(calls.length, 0);
  });

  test('an error thrown by the code is returned as a message', () => {
    const { renderer } = fakeRenderer();
    attach(renderer, {});
    assert.deepEqual(evaluate(renderer, 'foo(10).out()'), { error: 'foo is not defined' });
  });
});
