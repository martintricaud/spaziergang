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
  export interface EvalSandbox {
    add(name: string): void;
    set(property: string, value: unknown): void;
    eval(code: string): void;
  }
  export default class HydraRenderer {
    constructor(options?: HydraOptions);
    synth: any;
    sandbox: EvalSandbox;
    eval(code: string): void;
    tick(dt: number): void;
  }
}
