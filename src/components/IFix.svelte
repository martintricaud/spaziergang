<script>
    import { createEventDispatcher } from 'svelte';
    import { EventStore } from '../lib/UIState';
    export let ev, name, equipped;
    const dispatch = createEventDispatcher();
</script>

<svelte:window on:click={(e) => (equipped ? dispatch('effect', ev) : e)} />
<div
    class="infobox instrument"
    class:inactive={!equipped}
    style="top:{$EventStore.y + 20}px; left:{$EventStore.x + 20}px"
>
    {name}
</div>

<style>
</style>
