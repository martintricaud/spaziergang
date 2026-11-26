<script>
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { EditorState, Prec, Transaction } from '@codemirror/state';
  import { EditorView, keymap } from '@codemirror/view';
  import { acceptCompletion, autocompletion } from '@codemirror/autocomplete';
  import { javascript } from '@codemirror/lang-javascript';
  import { minimalSetup } from 'codemirror';
  import { hydraCompletionSource } from '../lib/hydra-completions';

  /** The Hydra source of the selected preset, with its literals at the sliders' current values. The editor takes it whenever it changes, unless its text has edits that were not evaluated. */
  export let code;
  /** When this number changes, the editor takes `code` and discards edits that were not evaluated. */
  export let revision = 0;
  /** The text that the Reset button puts back into the editor. */
  export let original;
  /** The message of the last parse or evaluation error; empty when the last evaluation succeeded. */
  export let error = '';
  /** Hydra's function table, from which the suggestions are computed. It is undefined until the first renderer exists. */
  export let table = undefined;

  const dispatch = createEventDispatcher();
  let host;
  let view;

  /** The last `code` that the editor took. The text has unevaluated edits when it differs from it. */
  let base = code;
  let seenRevision = revision;

  /** Sends the text, and the text it was edited from. */
  function evaluate() {
    dispatch('evaluate', { code: view.state.doc.toString(), base });
    return true;
  }

  /** Replaces only the part of the text that differs, so that the caret stays in place when a slider rewrites a literal. */
  function setText(text, userEvent = true) {
    const old = view.state.doc.toString();
    if (old === text) return;
    let from = 0;
    while (from < old.length && from < text.length && old[from] === text[from]) from += 1;
    let end = 0;
    while (
      end < old.length - from &&
      end < text.length - from &&
      old[old.length - 1 - end] === text[text.length - 1 - end]
    )
      end += 1;
    view.dispatch({
      changes: { from, to: old.length - end, insert: text.slice(from, text.length - end) },
      /** A text that comes from the sliders is not a step of the undo history. */
      annotations: userEvent ? [] : [Transaction.addToHistory.of(false)],
    });
  }

  function take(text, rev) {
    if (rev === seenRevision && view.state.doc.toString() !== base) return;
    setText(text, false);
    base = text;
    seenRevision = rev;
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

  $: if (view) take(code, revision);
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
