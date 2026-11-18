// Synthesized sound for Solmar City: no audio files, everything is built
// with the Web Audio API. A laid-back chord loop (Am – F – C – G) with a
// syncopated bass and hats plays under the game; effects are short blips
// and noise bursts. Everything is a no-op until the first user gesture
// creates the AudioContext, and M mutes it all.

const CHORDS = [
  { root: 110.0, pad: [220.0, 261.63, 329.63] }, // Am
  { root: 87.31, pad: [174.61, 220.0, 261.63] }, // F
  { root: 130.81, pad: [261.63, 329.63, 392.0] }, // C
  { root: 98.0, pad: [196.0, 246.94, 293.66] }, // G
];
const BASS_PATTERN = [0, 0, 1, 0, 0, 1, 0, 1]; // eighth-note steps, 1 = play
const BPM = 104;
const STEP_SECONDS = 60 / BPM / 2;

export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let muted = false;
  let musicTimer = null;
  let step = 0;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return true;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(context.destination);
      musicGain = context.createGain();
      musicGain.gain.value = 0.5;
      musicGain.connect(master);
      sfxGain = context.createGain();
      sfxGain.gain.value = 0.9;
      sfxGain.connect(master);
      startMusic();
      return true;
    } catch {
      context = null;
      return false;
    }
  }

  function tone(freq, dur, type, gainValue, when = 0, slideTo = 0) {
    if (!context) return;
    const t = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(gainValue, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noiseBurst(dur, filterFreq, gainValue, when = 0) {
    if (!context) return;
    const t = context.currentTime + when;
    const len = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, len, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.value = gainValue;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);
    source.start(t);
  }

  function musicStep() {
    if (!context || muted) return;
    const chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
    const inBar = step % 8;
    if (BASS_PATTERN[inBar] === 1) {
      const t = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'triangle';
      osc.frequency.value = chord.root;
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + STEP_SECONDS * 0.9);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start(t);
      osc.stop(t + STEP_SECONDS);
    }
    if (inBar === 0) {
      const t = context.currentTime;
      for (const freq of chord.pad) {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.linearRampToValueAtTime(0.07, t + 0.4);
        gain.gain.setValueAtTime(0.07, t + STEP_SECONDS * 8 - 0.4);
        gain.gain.linearRampToValueAtTime(0.001, t + STEP_SECONDS * 8);
        osc.connect(gain);
        gain.connect(musicGain);
        osc.start(t);
        osc.stop(t + STEP_SECONDS * 8);
      }
    }
    if (inBar % 2 === 1) noiseBurst(0.03, 8000, 0.05);
    step += 1;
  }

  function startMusic() {
    if (musicTimer !== null || !context) return;
    musicTimer = window.setInterval(musicStep, STEP_SECONDS * 1000);
  }

  return {
    ensure,
    get ready() {
      return context !== null;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.9;
      return muted;
    },
    get isMuted() {
      return muted;
    },
    // Car engine hum; speed01 is 0..1 of top speed. Call every frame.
    engine(speed01, driving) {
      if (!context || muted) return;
      if (!driving) {
        if (engineOsc) {
          try { engineOsc.stop(); } catch { /* already stopped */ }
          engineOsc = null;
          engineGain = null;
        }
        return;
      }
      if (!engineOsc) {
        engineOsc = context.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = context.createGain();
        engineGain.gain.value = 0.05;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 900;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(sfxGain);
        engineOsc.start();
      }
      engineOsc.frequency.value = 55 + speed01 * 130;
      engineGain.gain.value = 0.03 + speed01 * 0.05;
    },
    // Two-tone police siren while any cop is near.
    siren(active) {
      if (!context || muted) return;
      if (!active) {
        if (sirenOsc) {
          try { sirenOsc.stop(); sirenLfo.stop(); } catch { /* already stopped */ }
          sirenOsc = null;
          sirenGain = null;
          sirenLfo = null;
        }
        return;
      }
      if (sirenOsc) return;
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0.035;
      sirenLfo = context.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.9;
      const lfoGain = context.createGain();
      lfoGain.gain.value = 220;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(sirenGain);
      sirenGain.connect(sfxGain);
      sirenOsc.start();
      sirenLfo.start();
    },
    click() { tone(660, 0.07, 'sine', 0.2); },
    punch() { tone(140, 0.12, 'sine', 0.5, 0, 60); noiseBurst(0.08, 500, 0.25); },
    shot() { noiseBurst(0.14, 2600, 0.5); tone(180, 0.1, 'square', 0.2, 0, 60); },
    hurt() { tone(220, 0.18, 'sawtooth', 0.3, 0, 90); },
    crash() { noiseBurst(0.25, 900, 0.5); tone(90, 0.2, 'sine', 0.4, 0, 45); },
    pickup() { tone(880, 0.09, 'sine', 0.25); tone(1318, 0.14, 'sine', 0.25, 0.08); },
    complete() {
      tone(523, 0.12, 'triangle', 0.3);
      tone(659, 0.12, 'triangle', 0.3, 0.12);
      tone(784, 0.2, 'triangle', 0.3, 0.24);
      tone(1046, 0.3, 'triangle', 0.3, 0.36);
    },
    wanted() { tone(392, 0.16, 'square', 0.18); tone(311, 0.22, 'square', 0.18, 0.16); },
    denied() { tone(160, 0.15, 'square', 0.2); },
  };
}
