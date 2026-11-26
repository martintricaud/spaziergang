<script>
  import { writable, derived } from 'svelte/store';
  import { MuesliStore } from './lib/storesFactories';
  import { rescale } from './lib/hilbert';
  import { examples } from './lib/data';
  import * as U from './lib/utils';
  import * as R from 'ramda';
  import {
    addProp,
    clamp,
    entries,
    findIndex,
    findLastIndex,
    fromEntries,
    groupByProp,
    keys,
    map,
    mapValues,
    merge,
    pick,
    pickBy,
    prop,
    set,
    splice,
    unique,
  } from 'remeda';
  import HydraViewer from './components/HydraViewer.svelte';
  import CodeEditor from './components/CodeEditor.svelte';
  import ILever from './components/ILever.svelte';
  import IFix from './components/IFix.svelte';
  import IEraser from './components/IEraser.svelte';
  import IResize from './components/IResize.svelte';
  import IOrthoZoom from './components/IOrthoZoom.svelte';
  import { EventStore, UIOptions } from './lib/UIState';
  import { Table } from './lib/hydra-runtime';
  import { deriveInputSpace, formatValue, rewrite, writeLiterals } from './lib/hydra-rewrite';
  import { STEPS_PER_PARAMETER, macroSteps, shiftIndex, shiftValue } from './lib/orthozoom-steps';

  /** Initialize a store containing the example presets*/
  const Templates = writable(examples);
  /** Derived store where examples are grouped by template for convenience*/
  const TemplateGroups = derived(Templates, (templates) => groupByProp(templates, 'templateName'));
  let SelectedTemplate = 'Grayscale Noise';
  /** By default, the selected example is the first that matches the selected template's name*/
  let SelectedExample = findIndex($Templates, (t) => t.templateName === SelectedTemplate);

  let ih, track_w, hidden, SelectedUI;
  /** True when the preset gallery shows only its buttons. */
  let presetsCollapsed = false;

  const palette = writable({ x: 0, y: 0 });

  let instruments = {
    /** The plain cursor has no component and no effect. */
    cursor: {
      name: 'none',
      equipped: true,
      component: null,
      ff: 'willNone',
      effect: () => {},
    },
    fix: {
      name: 'fix',
      equipped: false,
      component: IFix,
      ff: 'willFix',
      effect: fix_effect,
    },
    lever: {
      name: 'lever',
      equipped: false,
      component: ILever,
      ff: 'willNone',
      effect: lever_effect,
    },
    eraser: {
      name: 'erase',
      equipped: false,
      component: IEraser,
      ff: 'willErase',
      effect: erase_effect,
    },
    resize: {
      name: 'resize',
      equipped: false,
      component: IResize,
      ff: '',
      effect: wheel_effect,
    },
    orthozoom: {
      name: 'orthozoom',
      equipped: false,
      component: IOrthoZoom,
      ff: 'willNone',
      effect: orthozoom_effect,
      /** Props that only this instrument's component receives. */
      props: { steps: orthozoom_steps },
    },
  };

  /** Name of the currently equipped instrument. @type {string} */
  let equipped;
  $: equipped = keys(pickBy(instruments, (x) => x.equipped))[0];
  /** reactive value that returns the feedforward style for the selected instrument */
  $: ff = instruments[equipped].ff;

  /** The stores are rebuilt when the selected preset changes, and once when the first renderer publishes hydra's function table. */
  $: [H_global, H_local, InputSpace, Bits, Unlocked, Inputs, MaxH] = MuesliStore(
    $Templates[SelectedExample],
    $Table,
  );

  /** Text sent from the editor that the main viewer has not yet evaluated without error. The selected preset changes only after a successful evaluation. */
  let submitted;
  /** Message of the last parse or evaluation error of the main viewer. */
  let codeError = '';
  /** Selecting another preset discards a text that failed to evaluate. */
  $: clear_submitted(SelectedExample);
  $: viewerCode = submitted ?? $Templates[SelectedExample].code;
  /** The text that the editor showed when the user started the submitted text. Its literals tell which literals the user edited. */
  let submittedBase;
  /** Incremented when the editor must take `shownCode` even if its text has edits that were not evaluated. */
  let codeRevision = 0;
  /** The selected preset's code with each literal showing its slider's current value. The preset's own code is not rewritten at each slider move, because a change of the preset rebuilds the stores. */
  $: shownCode = shown_code($Templates[SelectedExample].code, $Table, $Inputs, $InputSpace);

  function clear_submitted(_) {
    submitted = undefined;
    codeRevision += 1;
  }

  function shown_code(code, table, values, space) {
    if (!table) return code;
    const format = (key, value) => formatValue(value, space[key].c0, space[key].c1);
    try {
      return writeLiterals(
        code,
        table,
        pickBy(values, (_, key) => key in space),
        format,
      );
    } catch {
      return code;
    }
  }

  /** EFFECTFUL FUNCTIONS modify reactive values, can be thought of has handlers */

  function fix_effect(ev) {
    let e = ev?.detail;
    const [key, field] = U.stringToPath(e?.target?.dataset?.path ?? '');
    const store = e?.target?.dataset?.store;
    if (store == 2) {
      InputSpace.update(R.modifyPath([key, 'locked'], R.not));
    }
  }

  function lever_effect(ev) {
    let [P2, offset, track] = [ev.detail.P2, ev.detail.offset, ev.detail.track];
    let [key, field] = U.stringToPath(ev.detail.targetPath);
    /** partial evaluation of the curried lerp function, where only the arguments representing the target range remain exposed */
    let lerpTo = U.lerp(track.left, track.left + track.width, R.__, R.__, P2.x - offset.offsetX);
    if (ev.detail.targetStore == 0) {
      H_global.set(lerpTo(0n, $MaxH));
    } else if (ev.detail.targetStore == 1) {
      H_local.set(lerpTo(0n, $MaxH));
    } else if (ev.detail.targetStore == 2) {
      InputSpace.evolve(
        U.deepObjOf([key, field], (x) => lerpTo($InputSpace[key].c0, $InputSpace[key].c1)),
      );
    }
  }

  /** The number of steps of a target of OrthoZoom: a macro slider (stores 0 and 1) has one step per Hilbert index, a parameter has 2^32. */
  function orthozoom_steps(store) {
    return store == 2 ? STEPS_PER_PARAMETER : macroSteps($MaxH);
  }

  /** Moves the held target by the number of steps OrthoZoom computed for the last pointer move. */
  function orthozoom_effect(ev) {
    const { targetPath, targetStore, shift } = ev.detail;
    if (targetStore == 0) {
      H_global.update((h) => shiftIndex(h, shift));
    } else if (targetStore == 1) {
      H_local.update((h) => shiftIndex(h, shift));
    } else if (targetStore == 2) {
      const [key, field] = U.stringToPath(targetPath);
      const { c0, c1 } = $InputSpace[key];
      InputSpace.evolve(U.deepObjOf([key, field], (x) => shiftValue(x, shift, c0, c1)));
    }
  }

  function erase_target(target) {
    if ($TemplateGroups[SelectedTemplate].length > 1) {
      if (target < SelectedExample) {
        Templates.update((templates) => splice(templates, target, 1, []));
        SelectedExample += -1;
      } else if (target > SelectedExample) {
        Templates.update((templates) => splice(templates, target, 1, []));
      } else if (target == SelectedExample) {
        SelectedExample = target - 1;
        erase_target(target);
      }
    }
  }
  function erase_effect(ev) {
    /** The target of the eraser is the preset label under the pointer, if any. */
    const label = document
      .elementsFromPoint(ev.detail.x, ev.detail.y)
      .find((x) => x.tagName == 'LABEL');
    if (label) {
      erase_target(Number(label.getAttribute('data-index')));
    }
  }

  /** HANDLERS
   * modify reactive values, but in a non instrumental way
   */
  function save_handler() {
    /** creates a new preset whose name is unique for the given template. */
    let presetName = U.assignDefaultName(
      map($TemplateGroups[SelectedTemplate], prop('presetName')),
    );
    let toAdd = {
      templateName: SelectedTemplate,
      presetName: presetName,
      inputSpace: entries($InputSpace),
      h_local: $H_local,
      h_global: $H_global,
      code: shownCode,
    };
    /** Add the new example at the end of the Template array store */
    Templates.update((templates) => [...templates, toAdd]);
    /** Shift the focus of SelectedExample to the newly saved preset*/
    SelectedExample = findLastIndex($Templates, (t) => t.templateName === SelectedTemplate);
  }

  /** Handles the result of each evaluation in the main viewer. After an error, the previous chain stays on screen and the preset is unchanged. */
  function evaluated_handler(ev) {
    if ('error' in ev.detail) {
      codeError = ev.detail.error;
      return;
    }
    codeError = '';
    if (submitted !== undefined) {
      commit_code(submitted, ev.detail.params, submittedBase);
      submitted = undefined;
      codeRevision += 1;
    }
  }

  /** Stores an evaluated text in the selected preset and derives its input space again. A parameter keeps its fields; one whose literal was edited takes the new literal as value. */
  function commit_code(code, params, base) {
    const current = $Templates[SelectedExample];
    /** An edit is detected against the text that the editor showed, whose literals follow the sliders. */
    const before = rewrite(base ?? current.code, $Table).params;
    const literals = fromEntries(map(before, (p) => [p.key, p.value]));
    const changed = new Set(
      params.filter((p) => p.key in literals && literals[p.key] !== p.value).map((p) => p.key),
    );
    const sameKeys =
      params.length === before.length && params.every((p, i) => p.key === before[i].key);
    const edited = {
      ...current,
      code,
      inputSpace: deriveInputSpace(params, $InputSpace, current.ranges, changed),
      /** A Hilbert index is valid for one list of parameters only; without it the store starts at the midpoint. */
      h_global: sameKeys ? $H_global : undefined,
      h_local: sameKeys ? $H_local : undefined,
    };
    Templates.update((templates) => map(templates, (t, i) => (i === SelectedExample ? edited : t)));
  }

  function equip_effect(name) {
    instruments = R.mapObjIndexed(
      (x, k) => R.modify('equipped', k == name ? R.T : R.F, x),
      instruments,
    );
  }

  function wheel_effect(ev) {
    /** Retrieve all elements located "beneath" the pointer */
    let targetList = document
      .elementsFromPoint(ev.x, ev.y)
      .filter((x) => x.hasAttribute('data-path'));
    /** Consider the target of the effect to be the top-most element */
    const target = targetList[0];
    const [targetKey, field] = U.stringToPath(target?.getAttribute('data-path') ?? '');
    /** A wheel delta of one third of the window height changes z by the full range. */
    let curr = clamp(U.lerp(0, ih, 1e-6, 1, 3 * ev.deltaY), { min: -1, max: 1 });

    InputSpace.evolve(
      mapValues(
        pickBy($InputSpace, (val, key) => key === targetKey),
        (val) => ({ z: (x) => x + curr * (val.c1 - val.c0) }),
      ),
    );
  }

  function feedback(e) {
    instruments[equipped] = addProp(instruments[equipped], 'ev', e);
  }
</script>

<svelte:window
  bind:innerHeight={ih}
  on:keydown={(ev) => {
    UIOptions.update((options) => set(options, 'noscroll', ev.altKey));
    hidden = ev.key == ' ' ? true : hidden && true;
    /** No choice but to blur some DOM elements to avoid triggering default DOM handlers. */
    document.getElementById('select-ui').blur();
    document.getElementById('select-template').blur();
  }}
  on:keyup={(ev) => {
    UIOptions.update((options) => set(options, 'noscroll', ev.altKey));
    hidden = ev.key == ' ' ? false : hidden || false;
    document.getElementById('save').blur();
  }}
  on:mousemove={(ev) => {
    /** Make the instrument palette follows the cursor when hidden */
    hidden ? palette.update((x) => x) : ($palette = { x: ev.x, y: ev.y });
    feedback(ev);
    EventStore.update((state) => merge(state, pick(ev, ['x', 'y', 'movementX', 'movementY'])));
  }}
  on:wheel={(ev) => wheel_effect(ev)}
/>
<!-- Text can be selected only with the plain cursor: with an instrument, a drag must not select text. -->
<main class="grid" class:no-selection={equipped !== 'cursor'} id="main">
  <div class="ui">
    {#if SelectedUI != 'default'}
      <ul class="sliders macro">
        <li class="macro slider-grid">
          <div class="param-name">Global macro</div>
          <div>min</div>
          <div class="track" bind:clientWidth={track_w}>
            <div
              class="unlocked thumb"
              data-store="0"
              data-path="h b"
              data-test
              style="left:{rescale($H_global, $Bits, $Unlocked.length) * track_w - 5}px"
            ></div>
          </div>
          <div>max</div>
        </li>
        <li class="macro slider-grid">
          <div class="param-name">Local macro</div>
          <div>min</div>
          <div class="track" bind:clientWidth={track_w}>
            <div
              data-store="1"
              data-path="h a"
              class="unlocked thumb"
              style="left:{rescale($H_local, $Bits, $Unlocked.length) * track_w - 5}px"
            ></div>
          </div>
          <div>max</div>
        </li>
      </ul>
    {/if}
    <ul class="sliders single">
      {#each Object.entries($InputSpace) as [key, { a, b, c0, c1, z, locked }]}
        <li class:fixed={locked} class="erasable slider-grid {ff}" data-path={key} data-store="2">
          <div class:unlocked={!locked} class="param-name" data-store="2" data-path={key}>
            {key.replaceAll('_', ' ')}
          </div>
          <div data-store="2" data-path="{key} c0" class:unlocked={!locked} class="bound c0">
            {c0}
          </div>
          <div data-path={key} class="track" bind:clientWidth={track_w}>
            <div
              data-store="2"
              data-path="{key} b"
              class:unlocked={!locked}
              class="range"
              style="width:{(track_w * z) / (c1 - c0)}px; 
              left:{(track_w * (b - z / 2 - c0)) / (c1 - c0)}px;"
            ></div>
            <div class="middle" style="width:{2}px; left:{U.scale(c0, c1, 0, track_w, b)}px;"></div>
            <div
              data-store="2"
              data-path="{key} a"
              class:unlocked={!locked}
              class="thumb"
              style="left: calc({(100 * (a - c0)) / (c1 - c0)}% - 5px)"
            ></div>
          </div>
          <div data-store="2" data-path="{key} c1" class:unlocked={!locked} class="bound c1">
            {c1}
          </div>
        </li>
      {/each}
    </ul>
  </div>
  <!-- The output: the canvas fills this container; the editor and the preset gallery are the two columns of its grid, drawn over the canvas. -->
  <div class="output">
    <div class="viewport">
      <HydraViewer
        code={viewerCode}
        values={$Inputs}
        w={1000}
        h={1000}
        autoloop={true}
        on:evaluated={evaluated_handler}
      />
    </div>
    <CodeEditor
      code={shownCode}
      revision={codeRevision}
      original={examples.find((t) => t.templateName === SelectedTemplate).code}
      error={codeError}
      table={$Table}
      on:evaluate={(ev) => ([submitted, submittedBase] = [ev.detail.code, ev.detail.base])}
    />
    <div class="snapshots" class:collapsed={presetsCollapsed}>
      <!-- The button gives up the focus so that the space bar, which opens the palette, does not click it. -->
      <button
        id="toggle-presets"
        aria-expanded={!presetsCollapsed}
        on:click={(ev) => {
          presetsCollapsed = !presetsCollapsed;
          ev.currentTarget.blur();
        }}><u>{presetsCollapsed ? 'show presets' : 'hide presets'}</u></button
      >
      <button id="save" data-path="" on:click={() => save_handler()}><u>save</u></button>
      {#each $Templates as { templateName, presetName, code, inputSpace }, i}
        <label
          class:hidden={templateName != SelectedTemplate}
          class="erasable canvas {ff}"
          data-index={i}
        >
          <input type="radio" bind:group={SelectedExample} value={i} />
          <span>{presetName}</span>
          <HydraViewer
            {code}
            values={mapValues(fromEntries(inputSpace ?? []), prop('a'))}
            w={150}
            h={150}
            autoloop={false}
          />
        </label>
      {/each}
    </div>
  </div>
  <div style="width: 100vw; background: none; position: absolute; z-index: 1000; top:0; left:0">
    <div
      class:hidden={!hidden}
      class="palette"
      role="menu"
      style="left:{$palette.x}px; top:{$palette.y}px;"
    >
      {#each Object.entries(instruments) as [name, { equipped }]}
        <div class:equipped role="menuitem" tabindex="-1" on:mouseenter={() => equip_effect(name)}>
          {name}
        </div>
      {/each}
    </div>
    {#each Object.entries(instruments) as [name, { equipped, component, ev, effect, props }]}
      <svelte:component this={component} {equipped} {ev} {name} {...props} on:effect={effect} />
    {/each}
  </div>
  <div class="config">
    <select bind:value={SelectedUI} name="UI Mode" id="select-ui">
      <option value="hilbert">Hilbert</option>
      <option value="random">Random Walk</option>
      <option value="default">Default</option>
    </select>
    <select
      bind:value={SelectedTemplate}
      on:change={() =>
        (SelectedExample = findIndex($Templates, (t) => t.templateName === SelectedTemplate))}
      name="Presets"
      id="select-template"
    >
      {#each unique(map($Templates, prop('templateName'))) as templateName}
        <option value={templateName}>{templateName}</option>
      {/each}
    </select>
  </div>
</main>
