<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import HydraRenderer from 'hydra-synth';
  import { Table, attach, evaluate, syncParams } from '../lib/hydra-runtime';

  /** Hydra source text. It is evaluated once per change. */
  export let code;
  /** Current parameter values by key. A change writes into the evaluated chain's parameter record and evaluates nothing. */
  export let values = {};
  export let w;
  export let h;
  export let autoloop;

  /** Frames rendered after each update when the viewer does not loop, so that feedback-based synths settle before the frame is shown. */
  const SETTLE_FRAMES = 30;

  const dispatch = createEventDispatcher();
  let hydracanvas;
  let renderer;
  let evaluatedCode;

  onMount(() => {
    renderer = new HydraRenderer({
      makeGlobal: false,
      autoLoop: autoloop,
      detectAudio: false,
      precision: 'highp',
      canvas: hydracanvas,
    });
    attach(renderer, {});
    Table.update((table) => table ?? renderer.generator.glslTransforms);
  });

  /** Rendering on a lost context (the browser drops the oldest one past its cap) throws, so such a viewer is skipped. */
  function refresh(code, values) {
    if (hydracanvas.getContext('webgl')?.isContextLost()) return;
    if (code !== evaluatedCode) {
      evaluatedCode = code;
      const result = evaluate(renderer, code);
      if ('error' in result) console.error(`[muesli] ${result.error}`);
      dispatch('evaluated', result);
    }
    syncParams(renderer, values);
    if (!autoloop) {
      for (let i = 0; i < SETTLE_FRAMES; i++) renderer.tick(16);
    }
  }

  $: if (renderer) refresh(code, values);

  /** Releases the WebGL context; browsers cap the number of live contexts per page. */
  onDestroy(() => {
    hydracanvas?.getContext('webgl')?.getExtension('WEBGL_lose_context')?.loseContext();
  });
</script>

<canvas bind:this={hydracanvas} width={w} height={h}></canvas>
