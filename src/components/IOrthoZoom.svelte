<script>
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { orthoZoom } from 'orthozoom';
  import { linearChart, step } from 'instrument';

  export let name, equipped;
  /** Returns the number of steps of a target, from the number of the store it belongs to (its `data-store` attribute). */
  export let steps;

  const dispatch = createEventDispatcher();

  /**
   * `dMax` is the distance from the press, across the track, at which one pixel along the track moves the target by one step.
   * `edgeRate` is the speed at which the target keeps moving while the pointer is past an end of the track, in track pixels per second at the current zoom.
   */
  const definition = orthoZoom({ dMax: 500, edgeRate: 200 });
  let instrument = definition.instrument;
  /** The element held since the last press; undefined when no button is down or the press was on no target. */
  let held;

  /** Feeds one input to the instrument and returns the shift it asks for, in steps of the held target. */
  function feed(input) {
    const [next, endo] = step(instrument, input);
    instrument = next;
    return endo(0);
  }

  /** Moves the held target by `shift` steps. */
  function apply(shift) {
    if (equipped && held && shift !== 0) {
      dispatch('effect', {
        targetPath: held.getAttribute('data-path'),
        targetStore: held.getAttribute('data-store'),
        shift,
      });
    }
  }

  /** The instrument follows the pointer even when it is not equipped, so that a press starts from the pointer's position. */
  function move(ev) {
    apply(feed({ kind: 'move', p: { x: ev.x, y: ev.y } }));
  }

  /** While a target is held, the instrument receives one `frame` input per animation frame: past an end of the track it answers with a shift even when the pointer does not move. */
  let frameRequest;
  let frameTime;
  function frame(time) {
    apply(feed({ kind: 'frame', dt: time - frameTime }));
    frameTime = time;
    frameRequest = requestAnimationFrame(frame);
  }
  function stopFrames() {
    cancelAnimationFrame(frameRequest);
    frameRequest = undefined;
  }
  onDestroy(stopFrames);

  /** On press, the held element is the topmost thumb or range under the pointer. Its chart maps its steps onto its track. */
  function press(ev) {
    if (!equipped) return;
    held = document
      .elementsFromPoint(ev.x, ev.y)
      .find((x) => x.classList.contains('thumb') || x.classList.contains('range'));
    const track = held?.closest('.track')?.getBoundingClientRect();
    const chart = track
      ? linearChart([0, steps(held.getAttribute('data-store'))], [track.left, track.right])
      : null;
    /** The target's value, in steps, is read from the position of the held element's centre on the track. */
    const box = held?.getBoundingClientRect();
    feed({
      kind: 'press',
      target: chart ? { chart, value: chart.fromPixel(box.left + box.width / 2) } : null,
    });
    if (track && frameRequest === undefined) {
      frameTime = performance.now();
      frameRequest = requestAnimationFrame(frame);
    }
    if (!track) held = undefined;
    /** Without this, the browser treats the press and the drag that follows as the start of a text selection and shows the text cursor. */
    else ev.preventDefault();
  }

  function release() {
    stopFrames();
    held = undefined;
    feed({ kind: 'release' });
  }
</script>

<svelte:window on:mousemove={move} on:mousedown={press} on:mouseup={release} />

<!-- The package's appearance: a label next to the pointer that shows the zoom while a target is held. -->
<svg
  class:inactive={!equipped}
  aria-label={name}
  style="position:fixed; top:0; left:0; pointer-events:none"
  width="100vw"
  height="100vh"
>
  {@render definition.appearance(instrument.attrs)}
</svg>
