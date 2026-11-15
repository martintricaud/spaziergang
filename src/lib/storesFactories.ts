import { writable, derived } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';
import * as R from 'ramda';
import { constant, filter, fromEntries, map, mapValues, merge, pick, prop } from 'remeda';
import * as U from './utils';
import { forward, inverse } from './hilbert';
import { deriveInputSpace, rewrite } from './hydra-rewrite';
import type { FunctionTable, ParamFields } from './hydra-rewrite';
import type { Template } from './data';
import { constraintsPreset } from './constraints';
import * as vec from './vec';

interface Vec {
  x: number;
  y: number;
  movementX: number;
  movementY: number;
}

type P<T> = Record<string, T>; //record with fields of type t

/** The parameter store: a writable record of parameter records, plus `evolve`, which applies an evolver through the constraint solver. */
export interface ParamsStore {
  subscribe: Readable<Record<string, Required<ParamFields>>>['subscribe'];
  set: (X: P<P<number | boolean>>) => void;
  update: (updater: (value: P<P<any>>) => P<P<any>>) => void;
  evolve: (transformer: P<P<(x: any) => any>>) => void;
}

export function liftedConstraintStore(
  ranges: Array<[string, P<any>]>,
  _epsilon: number = 0.01,
): [ParamsStore, Writable<string[]>] {
  //compute a default value for a parameter if the required attributes aren't all specified
  function computeDefault(p) {
    let r = p;
    r.z ??= p.c1 - p.c0;
    r.b ??= (p.c1 - p.c0) / 2;
    r.a ??= U.lerp(0, 1, r.b - r.z / 2, r.b + r.z / 2, Math.random());
    r.locked ??= false;
    return r;
  }

  //initialize object with default args in each field.
  let X0: P<P<any>> = mapValues(fromEntries(ranges), computeDefault);
  let F0 = U.deepAlways(fromEntries(ranges));

  const Params = writable(U.liftSolve(U.solve(constraintsPreset), F0, X0)); //store of records
  const Keys: Writable<string[]> = writable(map(ranges, (x) => x[0]));

  function evolve(transformer) {
    Params.update(U.liftSolve(U.solve(constraintsPreset), transformer));
  }
  function set_S(X: P<P<number | boolean>>) {
    evolve(U.deepAlways(X));
  }

  return [
    { subscribe: Params.subscribe, set: set_S, update: Params.update, evolve: evolve },
    { subscribe: Keys.subscribe, set: Keys.set, update: Keys.update },
  ];
}

/**
 * Builds the stores of one preset. When the preset carries no input space, its parameters are derived from its Hydra source, which needs hydra's function table.
 * The table is undefined until the first renderer exists; the input space is empty until then.
 */
export function MuesliStore(data: Template, table?: FunctionTable) {
  // B = bits per dimensions, P = parameters, K = Keys, HF = Hilbert Forward, HR = Hilbert Reverse
  const inputSpace =
    data.inputSpace ??
    (table ? deriveInputSpace(rewrite(data.code, table).params, {}, data.ranges) : []);
  /** The parameter store completes each record in place, so it receives copies. */
  const [Params, Keys] = liftedConstraintStore(
    inputSpace.map(([key, fields]) => [key, { ...fields }]),
  );
  const Bits: Writable<number> = writable(32);
  const Unlocked = derived([Keys, Params], ([$K, $P]) => filter($K, (x: string) => !$P[x].locked));
  const MaxH = derived([Unlocked, Bits], ([$U, $B]) => (1n << BigInt($U.length * $B)) - 1n);
  let $Params, $Bits: number, $Unlocked: Array<string>, $H_global, $H_local, $MaxH: bigint;

  Bits.subscribe((b: number) => {
    $Bits = b;
  });
  Params.subscribe((p) => {
    $Params = p;
  });
  Unlocked.subscribe((u: Array<string>) => {
    $Unlocked = u;
  });
  MaxH.subscribe((u: bigint) => {
    $MaxH = u;
  });

  //initialize Hilbert indices to half of their max values if they aren't declared in the "data" argument
  const [H_local, H_global] = [
    writable<bigint>(data.h_local ?? U.prod(0.5, $MaxH, 9)),
    writable<bigint>(data.h_global ?? U.prod(0.5, $MaxH, 9)),
  ];

  H_global.subscribe((h) => {
    $H_global = h;
  });
  H_local.subscribe((h) => {
    $H_local = h;
  });

  //lens pattern to have a 2 way interpolation between the the parameter range and the hilbert coordinate
  let lensA = U.lerpLens('a', ({ b, z }) => [b - z / 2, b + z / 2], [0, 2 ** $Bits - 1]);
  let lensB = U.lerpLens('b', ({ c0, c1, z }) => [c0 + z / 2, c1 - z / 2], [0, 2 ** $Bits - 1]);

  //setters just pass their arguments to an "Always" function then call the update with that function
  function setH_local(h) {
    updateH_local(constant(R.clamp(0n, $MaxH, h)));
  }

  function setH_global(h) {
    updateH_global(constant(R.clamp(0n, $MaxH, h)));
  }

  function updateH_local(f_h) {
    H_local.update((x) => R.clamp(0n, $MaxH, f_h(x)));
    let hx = R.zipObj($Unlocked, forward($H_local, $Bits, $Unlocked.length));
    Params.set(R.mergeWith(R.set(lensA), hx, $Params));
  }

  function updateH_global(f_h) {
    H_global.update((x) => R.clamp(0n, $MaxH, f_h(x)));
    let hx = R.zipObj($Unlocked, forward($H_global, $Bits, $Unlocked.length));
    Params.set(R.mergeWith(R.set(lensB), hx, $Params));
  }

  function evolveParams(X) {
    updateParams(U.liftSolve(U.solve(constraintsPreset), pick(X, $Unlocked)));
  }

  function updateParams(X) {
    Params.update(X);
    let [H_global_setters, H_local_setters] = [
      mapValues($Params, R.view(lensB)),
      mapValues($Params, R.view(lensA)),
    ];
    //compute inverse for the subset of unlocked keys only
    H_local.set(inverse(Uint32Array.from(map($Unlocked, (key) => H_local_setters[key])), $Bits));
    //compute inverse for the subset of unlocked keys only
    H_global.set(inverse(Uint32Array.from(map($Unlocked, (key) => H_global_setters[key])), $Bits));
  }
  return [
    { subscribe: H_global.subscribe, set: setH_global, update: updateH_global },
    { subscribe: H_local.subscribe, set: setH_local, update: updateH_local },
    { subscribe: Params.subscribe, set: Params.set, update: updateParams, evolve: evolveParams },
    Bits,
    Unlocked,
    derived(Params, (params: P<any>) => mapValues(params, prop('a'))),
    MaxH,
  ] as const;
}

export function AlignmentStore(P1: Partial<Vec>, P2: Partial<Vec>, P3: Partial<Vec>) {
  const [A, B, C] = [writable(P1), writable(P2), writable(P3)];
  const K = writable(P2);
  const [Shift, Click] = [writable(false), writable(false)];
  const [AB, AC, BC] = [
    derived([A, B], ([a, b]) => vec.sub(a, b)),
    derived([A, C], ([a, c]) => vec.sub(a, c)),
    derived([B, C], ([b, c]) => vec.sub(b, c)),
  ];
  const Target = writable(undefined);
  let $Shift, $Click, $A, $B, $C, $AB, $AC, $BC, $Target, $K;

  Shift.subscribe((x) => {
    $Shift = x;
  });
  Click.subscribe((x) => {
    $Click = x;
  });
  A.subscribe((x) => {
    $A = x;
  });
  B.subscribe((x) => {
    $B = x;
  });
  C.subscribe((x) => {
    $C = x;
  });
  AB.subscribe((x) => {
    $AB = x;
  });
  AC.subscribe((x) => {
    $AC = x;
  });
  BC.subscribe((x) => {
    $BC = x;
  });
  Target.subscribe((x) => {
    $Target = x;
  });
  K.subscribe((x) => {
    $K = x;
  });
  function ClickSet(value: boolean) {
    /** retrieve the list of movable elements at B's position */
    let targetList = document
      .elementsFromPoint($B.x, $B.y)
      .filter((x) => x.classList.contains('thumb') || x.classList.contains('range'));

    // let targetList = U.targetAcquisition(document)($B.x, $B.y,x=>U.containsAny(x.classList,["thumb","range"]))
    /** set target to undefined if targetList is empty */
    let res = targetList.length > 0 ? targetList[0] : undefined;
    let rect = res?.getBoundingClientRect();

    /** set TargetStore to res on mouseDown, and to undefined on mouseUp */
    value
      ? Target.set({
          elem: res,
          offset: {
            offsetX: $B.x - rect?.x - rect?.width / 2,
            offsetY: $B.y - rect?.y - rect?.height / 2,
          },
        })
      : Target.set(undefined);

    /** set Click to true on mouseDown, and to false on mouseUp */
    Click.set(value);
    K.set($B);
  }
  function ASet(v: any) {
    AUpdate((a) => merge(a, v));
  }

  function AUpdate(u) {
    if ($Click) {
      if ($Shift) {
        A.set(vec.projectXAB(u($A), $A, $C));
      } else {
        A.update(u);
        let Bnew =
          Math.abs($AC.y) - 0.01 > Math.abs($C.y - $K.y)
            ? {
                x: (($K.y - $C.y) * $AC.x) / $AC.y + $C.x,
                y: $K.y,
              }
            : vec.add($A, vec.scale(0.01, $AC));
        B.update((b) => merge(b, Bnew));
      }
    } else {
      if ($Shift) {
        let u3 = $AC;
        A.update(u);
        let newC =
          vec.norm($AB) >= vec.norm($AC) + 0.01
            ? vec.add($B, vec.setNorm(0.01, $AB))
            : vec.add($A, vec.setNorm(vec.norm(u3), $AB));
        C.set(newC);
      } else {
        let [u2, u3] = [$AB, $AC];
        A.update(u);
        B.set(vec.add($A, u2));
        C.set(vec.add($A, u3));
      }
    }
  }

  return [
    { subscribe: A.subscribe, set: ASet, update: AUpdate },
    { subscribe: B.subscribe, set: ClickSet },
    { subscribe: C.subscribe, set: Shift.set },
    { subscribe: Target.subscribe },
  ] as const;
}
