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
    predicate: (obj) => obj.b <= obj.c0 + obj.z / 2 && obj.b >= obj.c1 - obj.z / 2,
    g: (f, v) => {
      return {
        b: (x) => clamp(x, { min: f.c0(v.c0) + f.z(v.z) / 2, max: f.c1(v.c1) - f.z(v.z) / 2 }),
      };
    },
  },
  {
    predicate: (obj) => obj.a <= obj.b - obj.z / 2 && obj.a >= obj.b + obj.z / 2,
    /**
     * The thumb stays inside the range. When the width of the range changes and the caller does not move the
     * thumb itself, the thumb keeps its relative position in the range: at one quarter of a range, it stays at one quarter.
     */
    g: (f, v) => {
      const [b, z] = [f.b(v.b), f.z(v.z)];
      const carried = z !== v.z && f.a(v.a) === v.a;
      return {
        a: (x) => clamp(carried ? b + ((v.a - v.b) * z) / v.z : x, { min: b - z / 2, max: b + z / 2 }),
      };
    },
  },
];
