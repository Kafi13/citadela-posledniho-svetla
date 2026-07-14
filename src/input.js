const KEY_ACTIONS = new Map([
  ["ArrowLeft", "left"],
  ["KeyA", "left"],
  ["ArrowRight", "right"],
  ["KeyD", "right"],
  ["ArrowUp", "jump"],
  ["KeyW", "jump"],
  ["Space", "jump"],
  ["ArrowDown", "down"],
  ["KeyS", "down"],
  ["ShiftLeft", "walk"],
  ["ShiftRight", "walk"],
  ["KeyF", "attack"],
  ["KeyJ", "attack"],
  ["KeyR", "block"],
  ["KeyK", "block"],
  ["KeyE", "interact"],
  ["Enter", "interact"],
  ["Escape", "pause"],
  ["KeyP", "pause"],
]);

const GAMEPAD_BUTTONS = {
  0: "jump",
  1: "block",
  2: "attack",
  3: "interact",
  4: "walk",
  5: "block",
  9: "pause",
  12: "jump",
  13: "down",
  14: "left",
  15: "right",
};

export class InputManager {
  constructor(root = document) {
    this.held = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.keyboardHeld = new Set();
    this.virtualHeld = new Set();
    this.gamepadHeld = new Set();
    this.enabled = true;
    this.pauseOnly = false;

    this.onKeyDown = (event) => {
      const action = KEY_ACTIONS.get(event.code);
      if (!action || (!this.enabled && !(this.pauseOnly && action === "pause"))) return;
      event.preventDefault();
      const wasHeld = this.held.has(action);
      this.keyboardHeld.add(event.code);
      this.#rebuildHeld();
      if (!wasHeld) this.pressed.add(action);
    };

    this.onKeyUp = (event) => {
      const action = KEY_ACTIONS.get(event.code);
      if (!action || (!this.enabled && !(this.pauseOnly && action === "pause"))) return;
      event.preventDefault();
      this.keyboardHeld.delete(event.code);
      this.#rebuildHeld();
      if (!this.held.has(action)) this.released.add(action);
    };

    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp, { passive: false });
    window.addEventListener("blur", () => this.clear());

    for (const control of root.querySelectorAll("[data-input]")) {
      const action = control.dataset.input;
      const press = (event) => {
        event.preventDefault();
        control.setPointerCapture?.(event.pointerId);
        this.setVirtual(action, true);
      };
      const release = (event) => {
        event.preventDefault();
        this.setVirtual(action, false);
      };
      control.addEventListener("pointerdown", press);
      control.addEventListener("pointerup", release);
      control.addEventListener("pointercancel", release);
      control.addEventListener("lostpointercapture", release);
      control.addEventListener("contextmenu", (event) => event.preventDefault());
    }
  }

  setVirtual(action, down) {
    if (action === "up") action = "jump";
    if (down) {
      const wasHeld = this.held.has(action);
      this.virtualHeld.add(action);
      this.#rebuildHeld();
      if (!wasHeld) this.pressed.add(action);
    } else {
      this.virtualHeld.delete(action);
      this.#rebuildHeld();
      if (!this.held.has(action)) this.released.add(action);
    }
  }

  pollGamepad() {
    if (!this.enabled && !this.pauseOnly) {
      this.gamepadHeld.clear();
      this.#rebuildHeld();
      return;
    }
    const gamepad = [...(navigator.getGamepads?.() ?? [])].find(Boolean);
    const next = new Set();

    if (gamepad) {
      if (this.enabled) {
        const horizontal = gamepad.axes[0] ?? 0;
        const vertical = gamepad.axes[1] ?? 0;
        if (horizontal < -0.35) next.add("left");
        if (horizontal > 0.35) next.add("right");
        if (vertical < -0.55) next.add("jump");
        if (vertical > 0.55) next.add("down");
      }

      for (const [index, action] of Object.entries(GAMEPAD_BUTTONS)) {
        if (gamepad.buttons[index]?.pressed && (this.enabled || action === "pause")) next.add(action);
      }
    }

    const nonGamepadHeld = new Set([
      ...[...this.keyboardHeld].map((code) => KEY_ACTIONS.get(code)).filter(Boolean),
      ...this.virtualHeld,
    ]);

    for (const action of next) {
      if (!this.gamepadHeld.has(action) && !nonGamepadHeld.has(action)) {
        this.pressed.add(action);
      }
    }
    for (const action of this.gamepadHeld) {
      if (!next.has(action) && !nonGamepadHeld.has(action)) {
        this.released.add(action);
      }
    }

    this.gamepadHeld = next;
    this.#rebuildHeld();
  }

  isDown(action) {
    return this.held.has(action);
  }

  wasPressed(action) {
    return this.pressed.has(action);
  }

  consume(action) {
    if (!this.pressed.has(action)) return false;
    this.pressed.delete(action);
    return true;
  }

  wasReleased(action) {
    return this.released.has(action);
  }

  axis() {
    return (this.isDown("right") ? 1 : 0) - (this.isDown("left") ? 1 : 0);
  }

  endStep() {
    this.released.clear();
  }

  clearTransient() {
    this.pressed.clear();
    this.released.clear();
  }

  clear() {
    this.held.clear();
    this.pressed.clear();
    this.released.clear();
    this.keyboardHeld.clear();
    this.virtualHeld.clear();
    this.gamepadHeld.clear();
  }

  #rebuildHeld() {
    const keyboardActions = [...this.keyboardHeld].map((code) => KEY_ACTIONS.get(code)).filter(Boolean);
    this.held = new Set([...keyboardActions, ...this.virtualHeld, ...this.gamepadHeld]);
  }
}
