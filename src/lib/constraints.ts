import { clamp } from 'remeda';

let e = 0.000001;

export const constraintsPreset = [
  {
    predicate: (obj) => obj.c1 - obj.c0 >= e,
    g: (f, v) => {
      return {
        c0: (x) => f.c1(x - e / 2) - e / 2,
        c1: (x) => f.c0(x + e / 2) + e / 2,
      };
    },
  },
  {
    predicate: (obj) => obj.z >= obj.c1 - obj.c0 && obj.z <= e,
    g: (f, v) => {
      return {
        z: (x) => clamp(x, { min: e, max: f.c1(v.c1) - f.c0(v.c0) }),
      };
    },
  },
  {
    /** This rule is applied at every change. A rule whose predicate holds on the current values is skipped, and the range must also be scaled when it currently fills the track. */
    predicate: () => false,
    /**
     * The range stays inside the track. When the width of the range changes and the caller moves neither the range nor
     * the thumb, the range is scaled around the thumb: the thumb keeps its value and its relative position in the range.
     * When an end of the track stops the range, the thumb still keeps its value, and its relative position changes.
     */
    g: (f, v) => {
      const z = f.z(v.z);
      const scaled = z !== v.z && f.b(v.b) === v.b && f.a(v.a) === v.a;
      return {
        b: (x) =>
          clamp(scaled ? v.a + ((v.b - v.a) * z) / v.z : x, {
            min: f.c0(v.c0) + z / 2,
            max: f.c1(v.c1) - z / 2,
          }),
      };
    },
  },
  {
    predicate: (obj) => obj.a <= obj.b - obj.z / 2 && obj.a >= obj.b + obj.z / 2,
    /**
     * The thumb stays inside the range. When the range moves without a change of its width and the caller does not move
     * the thumb, the thumb moves by the same amount as the range, so it keeps its relative position in the range.
     */
    g: (f, v) => {
      const [b, z] = [f.b(v.b), f.z(v.z)];
      const carried = z === v.z && b !== v.b && f.a(v.a) === v.a;
      return {
        a: (x) => clamp(carried ? v.a + b - v.b : x, { min: b - z / 2, max: b + z / 2 }),
      };
    },
  },
];
