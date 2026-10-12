import * as THREE from "three";
const DEFAULT_KEY_BINDINGS: Record<string, string> = {
  moveForward: "KeyW",
  moveBackward: "KeyS",
  moveLeft: "KeyA",
  moveRight: "KeyD",
  hookLeft: "KeyQ",
  hookRight: "KeyE",
  jump: "Space",
  boost: "ShiftLeft",
  weaponSwitch: "KeyV",
  reload: "KeyR",
};
const KEY_ACTIONS: [string, string][] = [
  ["moveForward", "前進"],
  ["moveBackward", "後退"],
  ["moveLeft", "左移動"],
  ["moveRight", "右移動"],
  ["hookLeft", "左フック"],
  ["hookRight", "右フック"],
  ["jump", "ジャンプ／巻き取り"],
  ["boost", "ブースト"],
  ["weaponSwitch", "武器切り替え"],
  ["reload", "リロード"],
];
const keySettings = [...document.querySelectorAll<HTMLElement>("[data-key-settings]")];
const sensitivityInputs = [
  ...document.querySelectorAll<HTMLInputElement>("[data-vertical-sensitivity]"),
];
const sensitivityOutputs = [
  ...document.querySelectorAll<HTMLOutputElement>("[data-sensitivity-value]"),
];
let pendingBinding: string | null = null;
let verticalSensitivity = 1;

function loadKeyBindings(): Record<string, string> {
  try {
    const saved = JSON.parse(localStorage.getItem("omni-key-bindings") ?? "null");
    const values = KEY_ACTIONS.map(([action]) => saved?.[action]);
    if (
      values.every((code) => typeof code === "string" && code) &&
      new Set(values).size === values.length
    ) {
      return Object.fromEntries(KEY_ACTIONS.map(([action], index) => [action, values[index]]));
    }
  } catch {}
  return { ...DEFAULT_KEY_BINDINGS };
}

export const keyBindings: Record<string, string> = loadKeyBindings();

function formatKey(code: string): string {
  const labels: Record<string, string> = {
    Space: "SPACE",
    ShiftLeft: "SHIFT",
    ShiftRight: "SHIFT",
    ControlLeft: "CTRL",
    ControlRight: "CTRL",
    AltLeft: "ALT",
    AltRight: "ALT",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
  };
  return labels[code] ?? code.replace(/^Key|^Digit/, "").toUpperCase();
}

function updateKeySettings(): void {
  for (const settings of keySettings) {
    settings.querySelectorAll<HTMLButtonElement>("[data-bind-action]").forEach((button) => {
      const action = button.dataset.bindAction;
      if (!action) return;
      const key = pendingBinding === action ? "入力待ち…" : formatKey(keyBindings[action]);
      button.textContent = key;
      button.setAttribute(
        "aria-label",
        `${KEY_ACTIONS.find(([key]) => key === action)![1]}のキー: ${key}`,
      );
      button.setAttribute("aria-pressed", String(pendingBinding === action));
    });
  }
  document.querySelectorAll<HTMLElement>("[data-key-label]").forEach((element) => {
    const action = element.dataset.keyLabel;
    if (!action) return;
    element.textContent =
      action === "movement"
        ? ["moveForward", "moveLeft", "moveBackward", "moveRight"]
            .map((key) => formatKey(keyBindings[key]))
            .join(" ")
        : formatKey(keyBindings[action]);
  });
}

function setKeySettingsStatus(message: string): void {
  keySettings.forEach((settings) => {
    settings.querySelector<HTMLParagraphElement>("[data-key-setting-status]")!.textContent =
      message;
  });
}

function saveKeyBindings(): void {
  try {
    localStorage.setItem("omni-key-bindings", JSON.stringify(keyBindings));
  } catch {}
}

function setVerticalSensitivity(value: string | number): void {
  verticalSensitivity = THREE.MathUtils.clamp(Number(value), 0.2, 2);
  sensitivityInputs.forEach((input) => {
    input.value = String(verticalSensitivity);
  });
  sensitivityOutputs.forEach((output) => {
    output.textContent = `${verticalSensitivity.toFixed(1)}×`;
  });
}

for (const input of sensitivityInputs) {
  input.addEventListener("input", () => setVerticalSensitivity(input.value));
}
setVerticalSensitivity(verticalSensitivity);

for (const settings of keySettings) {
  const list = settings.querySelector<HTMLDivElement>("[data-key-binding-list]")!;
  for (const [action, label] of KEY_ACTIONS) {
    const row = document.createElement("div");
    row.className = "key-binding-row";
    const name = document.createElement("span");
    name.textContent = label;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.bindAction = action;
    row.append(name, button);
    list.append(row);
  }
  settings.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (button?.hasAttribute("data-reset-key-bindings")) {
      pendingBinding = null;
      Object.assign(keyBindings, DEFAULT_KEY_BINDINGS);
      saveKeyBindings();
      updateKeySettings();
      setKeySettingsStatus("初期設定に戻しました");
    } else if (button?.dataset.bindAction) {
      pendingBinding = button.dataset.bindAction;
      updateKeySettings();
      setKeySettingsStatus(
        `${KEY_ACTIONS.find(([action]) => action === pendingBinding)![1]}のキーを押してください（Escでキャンセル）`,
      );
    }
  });
}
updateKeySettings();

document.addEventListener(
  "keydown",
  (event) => {
    if (!pendingBinding) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    if (event.code === "Escape") {
      pendingBinding = null;
      updateKeySettings();
      setKeySettingsStatus("");
      return;
    }
    if (!event.code || event.code === "Unidentified") {
      setKeySettingsStatus("このキーは割り当てできません");
      return;
    }
    const conflict = KEY_ACTIONS.find(
      ([action]) =>
        action !== pendingBinding &&
        (keyBindings[action] === event.code ||
          (action === "boost" && keyBindings.boost === "ShiftLeft" && event.code === "ShiftRight")),
    );
    if (conflict) {
      setKeySettingsStatus(`${formatKey(event.code)}は「${conflict[1]}」に割り当て済みです`);
      return;
    }
    const action = pendingBinding;
    keyBindings[action] = event.code;
    pendingBinding = null;
    saveKeyBindings();
    updateKeySettings();
    setKeySettingsStatus(
      `${KEY_ACTIONS.find(([key]) => key === action)![1]}を${formatKey(event.code)}に設定しました`,
    );
  },
  true,
);

export function getVerticalSensitivity(): number {
  return verticalSensitivity;
}

export function clearPendingBinding(): void {
  pendingBinding = null;
  updateKeySettings();
  setKeySettingsStatus("");
}
