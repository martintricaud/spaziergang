<script>
    import { createEventDispatcher } from 'svelte';
    import { writable } from 'svelte/store';
    import { merge } from 'remeda';
    import { init, move, press, shift, setNorm, sub } from 'archie';
    import { EventStore } from '../lib/UIState';
    export let name, equipped;

    //dispatcher that will make the instrument "observable"
    const dispatch = createEventDispatcher();

    /** The lever's state: A is the handle (the pointer), B the selector, C the pivot. */
    const Lever = writable(init());
    /** The element held since the last press and the selector's offset from its centre; undefined when no button is down. */
    const Target = writable(undefined);

    /** The handle follows the pointer at every movement of the mouse. */
    $: Lever.update((s) => move(s, { x: $EventStore.x, y: $EventStore.y }));
    $: ({ A, B, C } = $Lever);

    /** On press, the held element is the topmost thumb or range under the selector. */
    function setPress(down) {
        const elem = document
            .elementsFromPoint(B.x, B.y)
            .find((x) => x.classList.contains('thumb') || x.classList.contains('range'));
        const rect = elem?.getBoundingClientRect();
        Target.set(
            down
                ? {
                      elem,
                      offset: {
                          offsetX: B.x - rect?.x - rect?.width / 2,
                          offsetY: B.y - rect?.y - rect?.height / 2,
                      },
                  }
                : undefined,
        );
        Lever.update((s) => press(s, down));
    }

    /** Unit vector along the lever, turned by a quarter turn; it offsets the white line that outlines the lever. */
    $: along = setNorm(1, sub(C, A));
    $: ortho = { x: along.y, y: -along.x };
    $: if (equipped) {
        let effectValue = {
            targetPath: $Target?.elem?.dataset?.path,
            targetStore: $Target?.elem?.dataset?.store,
            offset: $Target?.offset,
            P2: B,
        };
        if ($Target?.elem != undefined) {
            dispatch('effect', merge($EventStore, effectValue));
        }
    }
</script>

<svelte:window
    on:mousedown={(ev) => {
        if (equipped) {
            setPress(true);
        }
    }}
    on:mouseup={(ev) => {
        if (equipped) {
            setPress(false);
        }
    }}
    on:keydown={(ev) => {
        if (equipped && ev.shiftKey) {
            Lever.update((s) => shift(s, true));
        }
    }}
    on:keyup={(ev) => {
        if (equipped && !ev.shiftKey) {
            Lever.update((s) => shift(s, false));
        }
    }}
/>

<svg
    class:inactive={!equipped}
    aria-label={name}
    style="position:fixed; top:0; left:0"
    width="100vw"
    height="100vh"
>
    <line
        x1="{C.x + 2 * ortho.x}px"
        y1="{C.y + 2 * ortho.y}px"
        x2="{A.x + 2 * ortho.x}px"
        y2="{A.y + 2 * ortho.y}px"
        stroke="white"
        stroke-width="2px"
    />
    <line
        x1="{C.x}px"
        y1="{C.y}px"
        x2="{A.x}px"
        y2="{A.y}px"
        stroke="black"
        stroke-width="1px"
    />
</svg>
<!-- <div
    class:inactive={!equipped}
    class="round red"
    style="left:{A.x}px; top:{A.y}px; position:fixed; "
/> -->
<div
    class:inactive={!equipped}
    class="round green"
    style="left:{B.x}px; top:{B.y}px; position:fixed; "
></div>
<div
    class:inactive={!equipped}
    class="round blue"
    style="left:{C.x}px; top:{C.y}px; position:fixed;  "
></div>

<style>
    /* The circle is 10px wide with its border, so an offset of -5px centres it on the point. */
    .round:after {
        content: '';
        position: absolute;
        top: -5px;
        left: -5px;
        width: 8px;
        height: 8px;
        border-radius: 6px;
        background-color: white;
        border: 1px solid black;
    }
</style>
