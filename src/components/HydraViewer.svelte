<script>
    import { onMount, onDestroy, afterUpdate } from 'svelte';
    import HydraRenderer from 'hydra-synth';

    let hydracanvas
    export let synth;
    export let data;
    export let w;
    export let h;
    export let autoloop;

    /** Frames rendered after each update when the viewer does not loop, so that feedback-based synths settle before the frame is shown. */
    const SETTLE_FRAMES = 30;

    let hydrasynth;
    let h0

    onMount(() => {
        h0 = new HydraRenderer({
            makeGlobal: false,
            autoLoop: autoloop,
            detectAudio: false,
            precision: 'highp',
            canvas: hydracanvas,
        })
        hydrasynth = h0.synth;
    });

    /** Rendering on a lost context (the browser drops the oldest one past its cap) throws inside Svelte's update cycle, so such a viewer is skipped. */
    afterUpdate(() => {
        if (hydracanvas.getContext('webgl')?.isContextLost()) return;
        synth(data)(hydrasynth);
        if (!autoloop) {
            for (let i = 0; i < SETTLE_FRAMES; i++) hydrasynth.tick(16);
        }
    });

    /** Releases the WebGL context; browsers cap the number of live contexts per page. */
    onDestroy(() => {
        hydracanvas?.getContext('webgl')?.getExtension('WEBGL_lose_context')?.loseContext();
    });
</script>

<canvas
    bind:this={hydracanvas}
    width={w}
    height={h}
></canvas>
