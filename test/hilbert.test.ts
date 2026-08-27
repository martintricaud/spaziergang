/**
 * Pins `src/lib/hilbert.ts`: the curve convention (known-answer vectors, and a comparison with
 * the wasm package while it is still in the tree), the round trip between index and axes, and
 * the semantics of `rescale`.
 *
 * Every random value comes from a seeded generator, so a failing case reproduces on a rerun.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { forward, inverse, rescale } from '../src/lib/hilbert.ts';

/** Bits per axis. The app uses 32 everywhere. */
const BITS = 32;

/** Dimension counts covered by the vectors, the round trip, and the wasm comparison. */
const DIMENSIONS = Array.from({ length: 19 }, (_, i) => i + 1);

/** Mulberry32: a small seeded PRNG, so that a failure names a case that reproduces. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draws a random integer in [0, 2^bitCount) as a BigInt built from 32-bit limbs. */
function randomBigInt(random: () => number, bitCount: number): bigint {
  let value = 0n;
  for (let drawn = 0; drawn < bitCount; drawn += 32) {
    value = (value << 32n) | BigInt(Math.floor(random() * 4294967296));
  }
  return value & ((1n << BigInt(bitCount)) - 1n);
}

/** The largest index of the curve that fills `dims` axes of `BITS` bits each. */
function maxIndex(dims: number): bigint {
  return (1n << BigInt(BITS * dims)) - 1n;
}

/**
 * The indices tested for `dims` dimensions: the eight edge values, then 100 random ones.
 * The seed depends only on `dims`, so every group below tests the same list.
 */
function sampleIndices(dims: number): bigint[] {
  const max = maxIndex(dims);
  const indices = [0n, 1n, 2n, 3n, max / 3n, max / 2n, max - 1n, max];
  const random = mulberry32(0x5eed0000 + dims);
  for (let i = 0; i < 100; i++) indices.push(randomBigInt(random, BITS * dims));
  return indices;
}

/** The 50 random axes vectors tested for `dims` dimensions, drawn from a `dims`-dependent seed. */
function sampleAxes(dims: number): Uint32Array[] {
  const random = mulberry32(0xa11ce000 + dims);
  const vectors: Uint32Array[] = [];
  for (let i = 0; i < 50; i++) {
    const axes = new Uint32Array(dims);
    for (let d = 0; d < dims; d++) axes[d] = Math.floor(random() * 4294967296);
    vectors.push(axes);
  }
  return vectors;
}

/**
 * Index and axes pairs produced by the wasm package and pasted here as literals. They pin the
 * curve convention (which index bit belongs to which axis) after `src/pkg` is deleted.
 */
const KNOWN_ANSWERS: { dims: number; vectors: { index: bigint; axes: number[] }[] }[] = [
  {
    dims: 1,
    vectors: [
      { index: 2104562540n, axes: [2104562540] },
      { index: 1472944655n, axes: [1472944655] },
      { index: 3872232645n, axes: [3872232645] },
    ],
  },
  {
    dims: 2,
    vectors: [
      { index: 10270673669493024921n, axes: [2232201621, 2778068752] },
      { index: 12873588550126549410n, axes: [3783825341, 2712541677] },
      { index: 2731810621761226967n, axes: [1911182681, 1209262678] },
    ],
  },
  {
    dims: 3,
    vectors: [
      { index: 54863779203477548166707997781n, axes: [3821069566, 4164138587, 2519916288] },
      { index: 39104924076952354404514263758n, axes: [2048029972, 2553287872, 1062445034] },
      { index: 32749440771437716298467179900n, axes: [826109467, 4134056993, 1982791372] },
    ],
  },
  {
    dims: 6,
    vectors: [
      {
        index: 5446176050168851343209035574226354716215266924147819349478n,
        axes: [3097797247, 855037072, 2578673427, 3077849726, 1804138390, 322701990],
      },
      {
        index: 222539539262890470015457130662754404745689895558485508642n,
        axes: [1122006761, 2063487161, 1039925945, 117245306, 2517041654, 3777065637],
      },
      {
        index: 4482325459352501027768060424654421680111906906200164474106n,
        axes: [4047195201, 3349167644, 4234751595, 808636776, 3337142779, 2732441715],
      },
    ],
  },
  {
    dims: 10,
    vectors: [
      {
        index:
          2085227241095714485474190451349820549757525692387874741202807219141933325018022242423500006313494n,
        axes: [
          2308651575, 1101317243, 1145431351, 1880646722, 470802746, 4005427533, 1154798544,
          4164648254, 1546251837, 231821831,
        ],
      },
      {
        index:
          3616182746997059302537852968180685938508750904824336419549129131255509571494730866547353719392n,
        axes: [
          1091260261, 1879726001, 777026479, 139908218, 1874068773, 1092535428, 470615271,
          363404090, 1722585928, 3066291073,
        ],
      },
      {
        index:
          773909427018509494987678810594250252475105802231103116422235235710735984086483660203888155225135n,
        axes: [
          2051017991, 2814671542, 2750813305, 2217022106, 403488677, 1217404952, 3457091665,
          1531735680, 2220809265, 1498097088,
        ],
      },
    ],
  },
  {
    dims: 19,
    vectors: [
      {
        index:
          960183820914798117674815481607379808455459055090508904926159362009597150625002430698411833890411312219429102241044231625451037078726342877286191051633696289211037342604143810589539743n,
        axes: [
          3776750765, 1077336560, 1348778745, 2999482132, 1360625346, 2712182153, 727870182,
          234172105, 2647776260, 2248657716, 2004056121, 3059538130, 1802479362, 2453394256,
          3669801113, 3192953161, 1051535124, 3129279139, 19606873,
        ],
      },
      {
        index:
          980713570077073570900580483754694434017034961525207602151610282170484867753907012143953297816649323369167461314646841558946383733050829839878325745839848745148215652749415927439765699n,
        axes: [
          2588692413, 1078681143, 681320229, 2507840935, 2471738653, 861010534, 4051886958,
          1048929595, 1472005804, 3376805697, 2988704849, 2183536278, 2010136550, 2336881348,
          1251925371, 1087054991, 907918295, 281861728, 1775290448,
        ],
      },
      {
        index:
          483883646689050552507745397253225213857066633854983514060613642780340209179864578005041485017368688947720956818139006036739885382282168600280233745130324309107730170936219992407334201n,
        axes: [
          1575119681, 4017690476, 907637414, 14711532, 3451058742, 3963496650, 3701848226,
          1723180446, 3265335427, 2299821491, 1579640071, 4201425325, 1333006177, 2029380464,
          4047948391, 2073099567, 3545890267, 3314814258, 2587079500,
        ],
      },
    ],
  },
];

describe('known-answer vectors', () => {
  for (const { dims, vectors } of KNOWN_ANSWERS) {
    test(`${dims} dimensions`, () => {
      for (const { index, axes } of vectors) {
        assert.deepEqual(forward(index, BITS, dims), Uint32Array.from(axes), `forward of ${index}`);
        assert.equal(inverse(Uint32Array.from(axes), BITS), index, `inverse of [${axes}]`);
      }
    });
  }
});

describe('round trip', () => {
  for (const dims of DIMENSIONS) {
    test(`${dims} dimensions`, () => {
      for (const index of sampleIndices(dims)) {
        assert.equal(inverse(forward(index, BITS, dims), BITS), index, `index ${index}`);
      }
      for (const axes of sampleAxes(dims)) {
        assert.deepEqual(forward(inverse(axes, BITS), BITS, dims), axes, `axes [${axes}]`);
      }
    });
  }
});

describe('rescale', () => {
  for (let dims = 1; dims <= 30; dims++) {
    test(`${dims} dimensions`, () => {
      const max = maxIndex(dims);
      const fractions = [0n, max / 100n, max / 8n, max / 4n, max / 2n, (3n * max) / 4n, max];
      for (const index of fractions) {
        const distance = Math.abs(rescale(index, BITS, dims) - Number(index) / Number(max));
        assert.ok(distance < 1e-12, `rescale of ${index} is off by ${distance}`);
      }
      assert.equal(rescale(max, BITS, dims), 1, 'the largest index rescales to 1');
      assert.equal(rescale(max + 1n, BITS, dims), 1, 'an index above the largest one clamps to 1');
      assert.equal(rescale(0n, BITS, dims), 0, 'index 0 rescales to 0');
    });
  }
});

describe('zero dimensions', () => {
  test('forward returns no axes', () => {
    assert.deepEqual(forward(0n, BITS, 0), new Uint32Array(0));
  });
  test('inverse of no axes is index 0', () => {
    assert.equal(inverse(new Uint32Array(0), BITS), 0n);
  });
  test('rescale is 0, whatever the index', () => {
    assert.equal(rescale(5n, BITS, 0), 0);
  });
});

// ---------------------------------------------------------------------------------------------
// Comparison with the wasm package in `src/pkg`, which `src/lib/hilbert.ts` replaces. Checkpoint 3
// of the port deletes `src/pkg`; delete this block, its three imports included, in the same
// commit. Nothing above this line depends on the wasm.
// ---------------------------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import initWasm, {
  hilbert_axes_wasm_from_str,
  hilbert_index_wasm_to_str,
} from '../src/pkg/hilbert.js';

await initWasm(readFileSync(new URL('../src/pkg/hilbert_bg.wasm', import.meta.url)));

describe('comparison with the wasm package', () => {
  for (const dims of DIMENSIONS) {
    test(`${dims} dimensions`, () => {
      for (const index of sampleIndices(dims)) {
        const axes = forward(index, BITS, dims);
        const wasmAxes = hilbert_axes_wasm_from_str(index.toString(), BITS, dims);
        assert.deepEqual(axes, wasmAxes, `forward of ${index}`);
        const wasmIndex = BigInt(hilbert_index_wasm_to_str(axes, BITS));
        assert.equal(inverse(axes, BITS), wasmIndex, `inverse of the axes of ${index}`);
      }
      for (const axes of sampleAxes(dims)) {
        const wasmIndex = BigInt(hilbert_index_wasm_to_str(axes, BITS));
        assert.equal(inverse(axes, BITS), wasmIndex, `inverse of [${axes}]`);
      }
    });
  }
});
