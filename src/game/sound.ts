// Tiny sound effects made with the Web Audio API, so there are no audio files to load.
// Browsers only allow sound after a touch or key press, which driving always provides first.
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function note(freq: number, start: number, length: number, volume = 0.16) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  const t = a.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

/** A bay turned green: two happy notes going up. */
export function playParked() {
  note(659.25, 0, 0.18);
  note(987.77, 0.12, 0.3);
}

/** A level was finished: a little rising tune. */
export function playLevelComplete() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, i * 0.13, 0.34, 0.18));
  note(1318.5, 0.58, 0.6, 0.16);
}

/** A star was collected; each one is a little higher than the last. */
export function playStar(n: number) {
  note(784 * Math.pow(1.1225, n), 0, 0.22, 0.17);
  note(1174.7 * Math.pow(1.1225, n), 0.08, 0.28, 0.14);
}

/** The parcel was picked up. */
export function playPickup() {
  note(523.25, 0, 0.14);
  note(783.99, 0.1, 0.3);
}

/** The parcel was delivered. */
export function playDeliver() {
  [659.25, 783.99, 987.77].forEach((f, i) => note(f, i * 0.1, 0.3, 0.17));
}
