import { describe, test } from 'vitest';
import assert from 'node:assert/strict';
import { rewrite, deriveInputSpace } from '../src/lib/hydra-rewrite';
import type { FunctionTable } from '../src/lib/hydra-rewrite';

const floats = (...names: string[]) => names.map((name) => ({ type: 'float', name }));
const source = { type: 'vec4', name: 'color' };

/** A subset of hydra's table in the shape of `renderer.generator.glslTransforms`: `combine` and `combineCoord` functions list their implicit source argument first. */
const table: FunctionTable = {
  osc: { type: 'src', inputs: floats('frequency', 'sync', 'offset') },
  noise: { type: 'src', inputs: floats('scale', 'offset') },
  shape: { type: 'src', inputs: floats('sides', 'radius', 'smoothing') },
  src: { type: 'src', inputs: [{ type: 'sampler2D', name: 'tex' }] },
  rotate: { type: 'coord', inputs: floats('angle', 'speed') },
  scale: { type: 'coord', inputs: floats('amount', 'xMult', 'yMult', 'offsetX', 'offsetY') },
  repeat: { type: 'coord', inputs: floats('repeatX', 'repeatY', 'offsetX', 'offsetY') },
  color: { type: 'color', inputs: floats('r', 'g', 'b', 'a') },
  modulate: { type: 'combineCoord', inputs: [source, ...floats('amount')] },
  blend: { type: 'combine', inputs: [source, ...floats('amount')] },
  layer: { type: 'combine', inputs: [source] },
  mask: { type: 'combine', inputs: [source] },
};

const keys = (code: string) =>
  rewrite(code, table)
    .params.map((p) => `${p.key}=${p.value}`)
    .join(' ');

describe('rewrite: the ten prototype samples', () => {
  const samples: Array<[string, string, string]> = [
    [
      'osc(10, 0.1).rotate(0.5).out()',
      'osc((__p) => (P.osc1_frequency), (__p) => (P.osc1_sync)).rotate((__p) => (P.rotate1_angle)).out()',
      'osc1_frequency=10 osc1_sync=0.1 rotate1_angle=0.5',
    ],
    [
      'osc(10, 0.1, -0.5).modulate(osc(20).rotate(0.2), 0.3).out(o0)',
      'osc((__p) => (P.osc1_frequency), (__p) => (P.osc1_sync), (__p) => (P.osc1_offset)).modulate(osc((__p) => (P.osc2_frequency)).rotate((__p) => (P.rotate1_angle)), (__p) => (P.modulate1_amount)).out(o0)',
      'osc1_frequency=10 osc1_sync=0.1 osc1_offset=-0.5 modulate1_amount=0.3 osc2_frequency=20 rotate1_angle=0.2',
    ],
    [
      'noise(3).modulate(src(o0).scale(1.01), 0.5).out()',
      'noise((__p) => (P.noise1_scale)).modulate(src(o0).scale((__p) => (P.scale1_amount)), (__p) => (P.modulate1_amount)).out()',
      'noise1_scale=3 modulate1_amount=0.5 scale1_amount=1.01',
    ],
    [
      'osc(Math.log(10), 1/10).color(1, 0.5, 0).out()',
      'osc((__p) => (Math.log(P.osc1_frequency)), (__p) => (P.osc1_sync/P.osc1_sync_2)).color((__p) => (P.color1_r), (__p) => (P.color1_g), (__p) => (P.color1_b)).out()',
      'osc1_frequency=10 osc1_sync=1 osc1_sync_2=10 color1_r=1 color1_g=0.5 color1_b=0',
    ],
    [
      'osc([10, 20, 30].fast(2), 0.1).out()',
      'osc([10, 20, 30].fast(2), (__p) => (P.osc1_sync)).out()',
      'osc1_sync=0.1',
    ],
    [
      'osc(() => Math.sin(time) * 10, 0.1).out()',
      'osc((__p) => Math.sin(__p.time) * P.osc1_frequency, (__p) => (P.osc1_sync)).out()',
      'osc1_frequency=10 osc1_sync=0.1',
    ],
    ['osc(({ time }) => time * 0.1).out()', 'osc(({ time }) => time * 0.1).out()', ''],
    [
      'shape(4, 0.3, 0.001).repeat(3, 3).out()',
      'shape((__p) => (P.shape1_sides), (__p) => (P.shape1_radius), (__p) => (P.shape1_smoothing)).repeat((__p) => (P.repeat1_repeatX), (__p) => (P.repeat1_repeatY)).out()',
      'shape1_sides=4 shape1_radius=0.3 shape1_smoothing=0.001 repeat1_repeatX=3 repeat1_repeatY=3',
    ],
    [
      'osc(60).layer(osc(30).mask(shape(4))).out()',
      'osc((__p) => (P.osc1_frequency)).layer(osc((__p) => (P.osc2_frequency)).mask(shape((__p) => (P.shape1_sides)))).out()',
      'osc1_frequency=60 osc2_frequency=30 shape1_sides=4',
    ],
    [
      'setResolution(100, 100); osc(10).out()',
      'setResolution(100, 100); osc((__p) => (P.osc1_frequency)).out()',
      'osc1_frequency=10',
    ],
  ];
  for (const [input, output, params] of samples) {
    test(input, () => {
      assert.equal(rewrite(input, table).code, output);
      assert.equal(keys(input), params);
    });
  }
});

describe('rewrite: rules', () => {
  test('rule 3: an argument that holds an array is left unchanged', () => {
    assert.equal(
      rewrite('osc([1, 2], 3).out()', table).code,
      'osc([1, 2], (__p) => (P.osc1_sync)).out()',
    );
    assert.equal(keys('osc([1, 2].fast(4)).out()'), '');
  });
  test('rule 4: a function that declares parameters is left unchanged', () => {
    const code = 'osc((props) => props.time * 2 + bpm).out()';
    assert.deepEqual(rewrite(code, table), { code, params: [] });
  });
  test('rule 4: a function without parameters is rewritten in place', () => {
    assert.deepEqual(rewrite('osc(() => 10 + bpm / 60).out()', table), {
      code: 'osc((__p) => P.osc1_frequency + __p.bpm / P.osc1_frequency_2).out()',
      params: [
        { key: 'osc1_frequency', value: 10 },
        { key: 'osc1_frequency_2', value: 60 },
      ],
    });
    assert.equal(
      rewrite('osc(function () { return 10 }).out()', table).code,
      'osc(function (__p) { return P.osc1_frequency }).out()',
    );
  });
  test('rule 5: time and bpm are read from the closure argument, property names are not', () => {
    assert.equal(rewrite('osc(time).out()', table).code, 'osc((__p) => (__p.time)).out()');
    assert.equal(rewrite('osc(x.time).out()', table).code, 'osc(x.time).out()');
  });
  test('rule 6: the implicit source argument takes the first input name', () => {
    assert.equal(keys('osc(10).modulate(o0, 0.5).out()'), 'osc1_frequency=10 modulate1_amount=0.5');
    assert.equal(
      keys('osc(10).blend(o0, 0.2).blend(o0, 0.3).out()'),
      'osc1_frequency=10 blend1_amount=0.2 blend2_amount=0.3',
    );
  });
  test('rule 6: an argument beyond the table is named by its position', () => {
    assert.equal(keys('noise(1, 2, 3).out()'), 'noise1_scale=1 noise1_offset=2 noise1_arg2=3');
  });
  test('rule 8: a parse error throws', () => {
    assert.throws(() => rewrite('osc(', table), SyntaxError);
  });
});

describe('deriveInputSpace', () => {
  const params = [
    { key: 'osc1_frequency', value: 10 },
    { key: 'osc1_offset', value: -0.5 },
    { key: 'rotate1_angle', value: 0.2 },
  ];
  test('rule 7: a new key gets its literal and the range [min(0, 2v), max(1, 2v)]', () => {
    assert.deepEqual(deriveInputSpace(params), [
      ['osc1_frequency', { c0: 0, c1: 20, a: 10, locked: false }],
      ['osc1_offset', { c0: -1, c1: 1, a: -0.5, locked: false }],
      ['rotate1_angle', { c0: 0, c1: 1, a: 0.2, locked: false }],
    ]);
  });
  test('rule 7: previous fields are preserved and absent keys are dropped', () => {
    const previous = {
      osc1_frequency: { c0: 1, c1: 100, a: 42, z: 10, b: 40, locked: true },
      kaleid1_nSides: { c0: 0, c1: 8, a: 4, locked: false },
    };
    const space = deriveInputSpace(params, previous);
    assert.deepEqual(space[0], ['osc1_frequency', previous.osc1_frequency]);
    assert.deepEqual(
      space.map(([key]) => key),
      ['osc1_frequency', 'osc1_offset', 'rotate1_angle'],
    );
  });
  test('overrides apply to new keys only', () => {
    const overrides = { osc1_frequency: { c0: 0.0001, c1: 100 }, rotate1_angle: { c1: 6.28 } };
    const previous = { osc1_frequency: { c0: 0, c1: 20, a: 5, locked: false } };
    const space = deriveInputSpace(params, previous, overrides);
    assert.deepEqual(space[0][1], previous.osc1_frequency);
    assert.deepEqual(space[2][1], { c0: 0, c1: 6.28, a: 0.2, locked: false });
  });
  test('a changed literal becomes the value; the range is kept and grows only to contain it', () => {
    const previous = {
      osc1_frequency: { c0: 0, c1: 20, a: 5, z: 4, b: 5, locked: true },
      rotate1_angle: { c0: 0, c1: 0.1, a: 0.05, locked: false },
    };
    const space = deriveInputSpace(
      params,
      previous,
      {},
      new Set(['osc1_frequency', 'rotate1_angle']),
    );
    assert.deepEqual(space[0][1], { c0: 0, c1: 20, a: 10, locked: true });
    assert.deepEqual(space[2][1], { c0: 0, c1: 0.2, a: 0.2, locked: false });
  });
});
