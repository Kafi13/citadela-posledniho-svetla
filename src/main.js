import { CitadelAudio } from "./audio.js";
import { formatTime } from "./core.js";
import { CitadelGame } from "./game.js";
import { ROOMS } from "./levels.js";

const SAVE_KEY = "citadel:last-light:save:v1";
const SETTINGS_KEY = "citadel:last-light:settings:v1";
const RESULTS_KEY = "citadel:last-light:results:v1";

const $ = (selector, root = document) => root.querySelector(selector);

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The game stays fully playable when storage is unavailable.
  }
}

const storedSettingsValue = readJson(SETTINGS_KEY, {});
const storedSettings = storedSettingsValue && typeof storedSettingsValue === "object" && !Array.isArray(storedSettingsValue)
  ? storedSettingsValue
  : {};
const validShardIds = new Set(ROOMS.flatMap((room) => room.shards.map((shard) => shard.id)));

function readSave() {
  const candidate = readJson(SAVE_KEY, null);
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const room = Number(candidate.room);
  if (!Number.isInteger(room) || room < 0 || room >= ROOMS.length) return null;
  return {
    version: 1,
    room,
    elapsed: Number.isFinite(Number(candidate.elapsed)) ? Math.max(0, Number(candidate.elapsed)) : 0,
    deaths: Number.isFinite(Number(candidate.deaths)) ? Math.max(0, Math.floor(Number(candidate.deaths))) : 0,
    shards: Array.isArray(candidate.shards) ? candidate.shards.filter((id) => validShardIds.has(id)) : [],
    checkpointActive: candidate.checkpointActive === true,
  };
}
const settings = {
  reducedMotion: typeof storedSettings.reducedMotion === "boolean"
    ? storedSettings.reducedMotion
    : window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  slowTraps: storedSettings.slowTraps === true,
  storyMode: storedSettings.storyMode === true,
  autoGrab: storedSettings.autoGrab !== false,
  volume: Number.isFinite(storedSettings.volume) ? Math.max(0, Math.min(1, storedSettings.volume)) : 0.75,
  muted: storedSettings.muted === true,
};

const elements = {
  shell: $("#game-shell"),
  canvas: $("#game-canvas"),
  hud: $("#hud"),
  health: $("#health"),
  healthFill: $(".health__fill"),
  healthValue: $(".health__value"),
  roomName: $("#room-name"),
  shardCount: $("#shard-count"),
  runTime: $("#run-time"),
  title: $("#title-screen"),
  pause: $("#pause-screen"),
  complete: $("#complete-screen"),
  settingsPanel: $("#settings-panel"),
  controlsPanel: $("#controls-panel"),
  toast: $("#toast"),
  prompt: $("#interact-prompt"),
  promptText: $("#interact-prompt span"),
  transition: $("#transition"),
  touch: $("#touch-controls"),
  continueButton: $('[data-action="continue"]'),
  muteButtons: [...document.querySelectorAll('[data-action="mute"]')],
  volume: $("#master-volume"),
  volumeOutput: $('output[for="master-volume"]'),
  reducedMotion: $("#reduced-motion"),
  slowTraps: $("#slow-traps"),
  storyMode: $("#story-mode"),
  autoGrab: $("#auto-grab"),
};

const audio = new CitadelAudio();
audio.setVolume(settings.volume);
audio.setMuted(settings.muted);

let toastTimer = 0;
let hintTimer = 0;
let lastFocusedElement = null;

const game = new CitadelGame(elements.canvas, {
  audio,
  settings,
  onEvent(type, payload) {
    switch (type) {
      case "hud":
        updateHud(payload);
        break;
      case "room":
        showRoom(payload);
        break;
      case "toast":
        showToast(payload);
        break;
      case "prompt":
        showPrompt(payload);
        break;
      case "transition":
        playTransition();
        break;
      case "save":
        writeJson(SAVE_KEY, payload);
        updateContinueButton();
        break;
      case "pause-toggle":
        if (game.mode === "playing") showPause();
        else if (game.mode === "paused" && elements.settingsPanel.hidden && elements.controlsPanel.hidden) resumeGame();
        break;
      case "complete":
        showComplete(payload);
        break;
      default:
        break;
    }
  },
});

function updateHud(data) {
  const ratio = data.maxHealth > 0 ? data.health / data.maxHealth : 0;
  elements.health.style.setProperty("--health", String(ratio));
  elements.health.setAttribute("aria-valuemax", String(data.maxHealth));
  elements.health.setAttribute("aria-valuenow", String(data.health));
  elements.healthFill.style.setProperty("--health", String(ratio));
  elements.healthValue.textContent = `${data.health} / ${data.maxHealth}`;
  elements.roomName.textContent = data.room;
  elements.shardCount.textContent = `${data.shards} / ${data.totalShards}`;
  elements.runTime.textContent = data.time;
  elements.runTime.dateTime = `PT${Math.floor(data.elapsed / 60)}M${Math.floor(data.elapsed % 60)}S`;
}

function showRoom(data) {
  elements.roomName.textContent = data.name;
  showToast(`${data.kicker} · ${data.name}`, 1800);
  window.clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => showToast(data.hint, 5200), 2100);
}

function showToast(message, duration = 2800) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message || "";
  elements.toast.classList.toggle("is-visible", Boolean(message));
  if (message) {
    toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove("is-visible");
      elements.toast.textContent = "";
    }, duration);
  }
}

function showPrompt(message) {
  elements.prompt.hidden = !message;
  elements.promptText.textContent = message || "Interakce";
}

function playTransition() {
  elements.transition.classList.remove("is-opening");
  elements.transition.classList.add("is-active");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => elements.transition.classList.add("is-opening"));
  });
  window.setTimeout(() => {
    elements.transition.classList.remove("is-active", "is-opening");
  }, settings.reducedMotion ? 80 : 720);
}

function setPlayUi(active) {
  elements.hud.hidden = !active;
  elements.touch.hidden = !active;
  elements.canvas.tabIndex = active ? 0 : -1;
  elements.canvas.setAttribute("aria-hidden", String(!active));
  if (!active) showPrompt("");
}

function hidePanels() {
  elements.settingsPanel.hidden = true;
  elements.controlsPanel.hidden = true;
}

function startNew() {
  audio.unlock();
  elements.title.hidden = true;
  elements.pause.hidden = true;
  elements.complete.hidden = true;
  hidePanels();
  setPlayUi(true);
  playTransition();
  game.startNew();
}

function continueGame() {
  const save = readSave();
  if (!save) {
    showToast("Zatím tu není uložená výprava.");
    return;
  }
  audio.unlock();
  elements.title.hidden = true;
  elements.pause.hidden = true;
  elements.complete.hidden = true;
  hidePanels();
  setPlayUi(true);
  playTransition();
  game.continueFrom(save);
}

function showPause() {
  if (game.mode !== "playing") return;
  game.pause();
  elements.pause.hidden = false;
  elements.touch.hidden = true;
  showPrompt("");
  $('[data-action="resume"]', elements.pause)?.focus({ preventScroll: true });
}

function resumeGame() {
  hidePanels();
  elements.pause.hidden = true;
  elements.touch.hidden = false;
  audio.unlock();
  game.resume();
}

function showTitle() {
  game.returnToTitle();
  elements.title.hidden = false;
  elements.pause.hidden = true;
  elements.complete.hidden = true;
  hidePanels();
  setPlayUi(false);
  updateContinueButton();
  $('[data-action="new"]', elements.title)?.focus({ preventScroll: true });
}

function showComplete(result) {
  setPlayUi(false);
  elements.complete.hidden = false;
  $('[data-result="time"]', elements.complete).textContent = result.time;
  $('[data-result="shards"]', elements.complete).textContent = `${result.shards} / ${result.totalShards}`;
  $('[data-result="deaths"]', elements.complete).textContent = String(result.deaths);
  const previous = readJson(RESULTS_KEY, null);
  if (!previous || result.elapsed < previous.elapsed) writeJson(RESULTS_KEY, result);
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Ignore blocked storage.
  }
  updateContinueButton();
  $('[data-action="replay"]', elements.complete)?.focus({ preventScroll: true });
}

function openPanel(panel) {
  lastFocusedElement = document.activeElement;
  panel.hidden = false;
  $("button, input", panel)?.focus({ preventScroll: true });
}

function closePanel() {
  if (!elements.settingsPanel.hidden) elements.settingsPanel.hidden = true;
  else if (!elements.controlsPanel.hidden) elements.controlsPanel.hidden = true;
  lastFocusedElement?.focus?.({ preventScroll: true });
}

function updateContinueButton() {
  const hasSave = Boolean(readSave());
  elements.continueButton.disabled = !hasSave;
  elements.continueButton.setAttribute("aria-disabled", String(!hasSave));
  const detail = $("small", elements.continueButton);
  if (detail) detail.textContent = hasSave ? "Poslední bezpečná komnata" : "Zatím bez uložené výpravy";
}

function persistSettings() {
  settings.reducedMotion = elements.reducedMotion.checked;
  settings.slowTraps = elements.slowTraps.checked;
  settings.storyMode = elements.storyMode.checked;
  settings.autoGrab = elements.autoGrab.checked;
  settings.volume = Number(elements.volume.value) / 100;
  audio.setVolume(settings.volume);
  game.updateSettings(settings);
  writeJson(SETTINGS_KEY, settings);
  elements.volumeOutput.textContent = `${Math.round(settings.volume * 100)} %`;
  elements.shell.classList.toggle("is-reduced-motion", settings.reducedMotion);
}

function syncSettingsControls() {
  elements.reducedMotion.checked = settings.reducedMotion;
  elements.slowTraps.checked = settings.slowTraps;
  elements.storyMode.checked = settings.storyMode;
  elements.autoGrab.checked = settings.autoGrab;
  elements.volume.value = String(Math.round(settings.volume * 100));
  elements.volumeOutput.textContent = `${Math.round(settings.volume * 100)} %`;
  elements.shell.classList.toggle("is-reduced-motion", settings.reducedMotion);
  updateMuteButtons();
}

function updateMuteButtons() {
  for (const button of elements.muteButtons) {
    button.setAttribute("aria-pressed", String(settings.muted));
    button.setAttribute("aria-label", settings.muted ? "Zapnout zvuk" : "Ztlumit zvuk");
    const label = $(".icon-button__label", button);
    if (label) label.textContent = settings.muted ? "Bez zvuku" : "Zvuk";
  }
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await elements.shell.requestFullscreen({ navigationUI: "hide" });
  } catch {
    showToast("Celou obrazovku tento prohlížeč nepovolil.");
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  audio.unlock();

  switch (action) {
    case "new":
    case "replay":
      startNew();
      break;
    case "continue":
      continueGame();
      break;
    case "resume":
      resumeGame();
      break;
    case "restart":
      elements.pause.hidden = true;
      elements.touch.hidden = false;
      playTransition();
      game.restartRoom();
      break;
    case "settings":
      syncSettingsControls();
      openPanel(elements.settingsPanel);
      break;
    case "controls":
      openPanel(elements.controlsPanel);
      break;
    case "close":
      closePanel();
      break;
    case "menu":
      showTitle();
      break;
    case "fullscreen":
      toggleFullscreen();
      break;
    case "mute":
      settings.muted = audio.toggleMuted();
      writeJson(SETTINGS_KEY, settings);
      updateMuteButtons();
      showToast(settings.muted ? "Zvuk vypnut" : "Zvuk zapnut");
      break;
    default:
      break;
  }
});

for (const control of [elements.volume, elements.reducedMotion, elements.slowTraps, elements.storyMode, elements.autoGrab]) {
  control.addEventListener("input", persistSettings);
  control.addEventListener("change", persistSettings);
}

$(".brand")?.addEventListener("click", (event) => {
  event.preventDefault();
  showTitle();
});

elements.canvas.addEventListener("pointerdown", () => {
  audio.unlock();
  elements.canvas.focus({ preventScroll: true });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!elements.settingsPanel.hidden || !elements.controlsPanel.hidden) {
      event.preventDefault();
      event.stopPropagation();
      closePanel();
    }
  }

  if (!elements.title.hidden && ["ArrowUp", "ArrowDown"].includes(event.key)) {
    const buttons = [...elements.title.querySelectorAll("button:not(:disabled)")];
    const index = buttons.indexOf(document.activeElement);
    if (index >= 0) {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      buttons[(index + direction + buttons.length) % buttons.length].focus();
    }
  }

  if (event.key === "Tab") {
    const dialog = [elements.settingsPanel, elements.controlsPanel, elements.pause, elements.complete]
      .find((candidate) => !candidate.hidden);
    if (dialog) {
      const focusable = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')];
      if (focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        } else if (!dialog.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        }
      }
    }
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.mode === "playing") {
    showPause();
    audio.suspend();
  }
});

window.addEventListener("blur", () => {
  if (game.mode === "playing") showPause();
});

document.addEventListener("fullscreenchange", () => {
  for (const button of document.querySelectorAll('[data-action="fullscreen"]')) {
    button.setAttribute("aria-pressed", String(Boolean(document.fullscreenElement)));
  }
});

syncSettingsControls();
updateContinueButton();
setPlayUi(false);
elements.title.hidden = false;

// Surface the previous best run without adding another permanent HUD element.
const bestResult = readJson(RESULTS_KEY, null);
if (bestResult?.elapsed) {
  const detail = $(".title-panel__lead");
  detail.title = `Nejlepší dokončený čas: ${formatTime(bestResult.elapsed)}`;
}
