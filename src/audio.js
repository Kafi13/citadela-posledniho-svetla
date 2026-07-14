const CUES = {
  jump: [310, 510, 0.09, "triangle", 0.13],
  land: [105, 65, 0.08, "sine", 0.16],
  step: [150, 105, 0.035, "sine", 0.045],
  grab: [220, 170, 0.07, "triangle", 0.09],
  climb: [190, 340, 0.1, "triangle", 0.08],
  slash: [720, 155, 0.09, "sawtooth", 0.08],
  parry: [1280, 760, 0.11, "square", 0.08],
  hit: [115, 58, 0.16, "sawtooth", 0.14],
  hurt: [170, 72, 0.22, "sawtooth", 0.12],
  shard: [520, 1040, 0.28, "sine", 0.11],
  switch: [185, 330, 0.22, "triangle", 0.1],
  gate: [72, 48, 0.4, "sawtooth", 0.06],
  checkpoint: [330, 660, 0.38, "sine", 0.08],
  warning: [240, 240, 0.08, "square", 0.055],
  fall: [190, 45, 0.45, "sine", 0.08],
  room: [260, 390, 0.32, "sine", 0.07],
  complete: [392, 784, 0.7, "sine", 0.12],
};

export class CitadelAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.ambience = null;
    this.ambienceGain = null;
    this.volume = 0.7;
    this.muted = false;
    this.combat = false;
  }

  async unlock() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.context.destination);
      this.#startAmbience();
    }

    if (this.context.state === "suspended") {
      await this.context.resume().catch(() => {});
    }
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, Number(volume)));
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.03);
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.setVolume(this.volume);
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setCombat(active) {
    this.combat = Boolean(active);
    if (this.ambienceGain && this.context) {
      this.ambienceGain.gain.setTargetAtTime(active ? 0.045 : 0.022, this.context.currentTime, 0.5);
    }
  }

  cue(name, options = {}) {
    if (!this.context || this.muted || !CUES[name]) return;
    const [start, end, duration, type, baseGain] = CUES[name];
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const pan = this.context.createStereoPanner?.();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start * (options.pitch ?? 1), now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end * (options.pitch ?? 1)), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(baseGain * (options.gain ?? 1), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);

    if (pan) {
      pan.pan.value = Math.max(-1, Math.min(1, options.pan ?? 0));
      gain.connect(pan);
      pan.connect(this.master);
    } else {
      gain.connect(this.master);
    }

    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  suspend() {
    if (this.context?.state === "running") this.context.suspend().catch(() => {});
  }

  #startAmbience() {
    const now = this.context.currentTime;
    this.ambience = this.context.createOscillator();
    this.ambienceGain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    this.ambience.type = "sine";
    this.ambience.frequency.value = 54;
    this.ambienceGain.gain.value = 0.022;
    filter.type = "lowpass";
    filter.frequency.value = 180;
    this.ambience.connect(filter);
    filter.connect(this.ambienceGain);
    this.ambienceGain.connect(this.master);
    this.ambience.start(now);
  }
}
