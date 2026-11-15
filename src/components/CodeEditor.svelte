<script>
  import { createEventDispatcher } from 'svelte';

  /** The Hydra source of the selected preset. The draft restarts from it whenever it changes. */
  export let code;
  /** The text that the Reset button puts back into the draft. */
  export let original;
  /** The message of the last parse or evaluation error; empty when the last evaluation succeeded. */
  export let error = '';

  const dispatch = createEventDispatcher();
  let draft = code;
  $: draft = code;

  function keydown(ev) {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      dispatch('evaluate', draft);
    }
  }
</script>

<!-- Key events stop here: the app's window-level shortcuts (space, shift, alt) must not fire while the user types. -->
<div class="code-editor">
  <textarea
    bind:value={draft}
    rows="8"
    spellcheck="false"
    aria-label="Hydra code"
    on:keydown|stopPropagation={keydown}
    on:keyup|stopPropagation={() => {}}></textarea>
  <div class="code-actions">
    <button type="button" on:click={() => (draft = original)}><u>reset</u></button>
    <span>Ctrl+Enter or Cmd+Enter evaluates</span>
  </div>
  {#if error}
    <div class="code-error" role="alert">{error}</div>
  {/if}
</div>
