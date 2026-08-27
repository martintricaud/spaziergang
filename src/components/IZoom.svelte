<script>
    import { createEventDispatcher } from 'svelte';
    import { EventStore, UIOptions } from '../lib/UIState';
    export let name, equipped;

    const dispatch = createEventDispatcher();

    $: altDown = $UIOptions.noscroll;
    $: if (altDown) {
        dispatch('effect', $EventStore);
    }
</script>

<div
    class="infobox instrument"
    class:inactive={!equipped}
    style="top:{$EventStore.y + 20}px; left:{$EventStore.x + 20}px"
>
    {name}
</div>
