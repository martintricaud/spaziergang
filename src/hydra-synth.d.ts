/** hydra-synth ships no types; this declares the part of its API that the app uses. */
declare module 'hydra-synth' {
  export interface HydraOptions {
    canvas?: HTMLCanvasElement;
    width?: number;
    height?: number;
    autoLoop?: boolean;
    makeGlobal?: boolean;
    detectAudio?: boolean;
    precision?: 'highp' | 'mediump' | 'lowp';
  }
  export default class HydraRenderer {
    constructor(options?: HydraOptions);
    synth: any;
    /** `glslTransforms` lists every function with its JavaScript argument list; `combine` and `combineCoord` functions start with their implicit source argument. */
    generator: {
      glslTransforms: Record<
        string,
        { type: string; inputs: Array<{ type: string; name: string; default?: unknown }> }
      >;
    };
    tick(dt: number): void;
  }
}
