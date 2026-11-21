<script>
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { EditorState, Prec } from '@codemirror/state';
  import { EditorView, keymap } from '@codemirror/view';
  import { acceptCompletion, autocompletion } from '@codemirror/autocomplete';
  import { javascript } from '@codemirror/lang-javascript';
  import { minimalSetup } from 'codemirror';
  import { hydraCompletionSource } from '../lib/hydra-completions';

  /** The Hydra source of the selected preset. The editor's text restarts from it whenever it changes. */
  export let code;
  /** The text that the Reset button puts back into the editor. */
  export let original;
  /** The message of the last parse or evaluation error; empty when the last evaluation succeeded. */
  export let error = '';
  /** Hydra's function table, from which the suggestions are computed. It is undefined until the first renderer exists. */
  export let table = undefined;

  const dispatch = createEventDispatcher();
  let host;
  let view;

  function evaluate() {
    dispatch('evaluate', view.state.doc.toString());
    return true;
  }

  function setText(text) {
    if (view.state.doc.toString() === text) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  }

  onMount(() => {
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: code,
        extensions: [
          /** CodeMirror's default keymap binds Mod-Enter to another command, and `Mod` is the cmd key on macOS, so both keys are bound here with the highest precedence. */
          Prec.highest(
            keymap.of([
              { key: 'Mod-Enter', run: evaluate },
              { key: 'Ctrl-Enter', run: evaluate },
            ]),
          ),
          keymap.of([{ key: 'Tab', run: acceptCompletion }]),
          minimalSetup,
          javascript(),
          autocompletion({ override: [hydraCompletionSource(() => table)] }),
          EditorView.contentAttributes.of({ 'aria-label': 'Hydra code', spellcheck: 'false' }),
        ],
      }),
    });
  });

  onDestroy(() => view?.destroy());

  $: if (view) setText(code);
</script>

<!-- Key events stop here: the app's window-level shortcuts (space, shift, alt) must not fire while the user types. -->
<div class="code-editor">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="code-input"
    bind:this={host}
    on:keydown|stopPropagation={() => {}}
    on:keyup|stopPropagation={() => {}}
  ></div>
  <div class="code-actions">
    <button type="button" on:click={() => setText(original)}><u>reset</u></button>
    <button type="button" on:click={evaluate}><u>Evaluate (ctrl/cmd + Enter)</u></button>
  </div>
  {#if error}
    <div class="code-error" role="alert">{error}</div>
  {/if}
</div>
