import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CircuitSettings, LocalCircuitLog, PersistedCircuitState, SignalDeliveryRecord } from "../types";
import { clearSignalFeedbackStorage } from "./signalFeedbackStorage";

const KEY = "circuit.persisted.v2";

export function createSignalDeliveryId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return `d_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export const BLANK_PERSISTED_STATE: PersistedCircuitState = {
  settings: {
    toneMode: "direct",
    notificationsEnabled: true,
  },
  onboardingCompleted: false,
  logs: [],
  signalHistory: [],
};

const defaultSettings = (): CircuitSettings => ({
  toneMode: "direct",
  notificationsEnabled: true,
});

function migrateLegacy(raw: string): PersistedCircuitState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedCircuitState> & {
      settings?: { selectedWorkApps?: unknown; showcaseDemoEnabled?: unknown };
    };
    if (!parsed.settings) {
      return null;
    }
    return {
      settings: {
        toneMode: parsed.settings.toneMode === "brutal" ? "brutal" : "direct",
        notificationsEnabled: parsed.settings.notificationsEnabled !== false,
        shutdownUntil:
          typeof parsed.settings.shutdownUntil === "number"
            ? parsed.settings.shutdownUntil
            : undefined,
        pauseSignalsUntil:
          typeof (parsed.settings as { pauseSignalsUntil?: unknown }).pauseSignalsUntil === "number"
            ? (parsed.settings as { pauseSignalsUntil: number }).pauseSignalsUntil
            : undefined,
      },
      onboardingCompleted: Boolean(parsed.onboardingCompleted),
      logs: Array.isArray(parsed.logs) ? migrateLogs(parsed.logs as unknown[]) : [],
      lastInterruptMessage:
        typeof parsed.lastInterruptMessage === "string"
          ? parsed.lastInterruptMessage
          : undefined,
      signalHistory: normalizeSignalHistory((parsed as { signalHistory?: unknown }).signalHistory),
    };
  } catch {
    return null;
  }
}

function migrateLogs(logs: unknown[]): LocalCircuitLog[] {
  const out: LocalCircuitLog[] = [];
  for (const raw of logs) {
    const e = raw as { eventType?: string; timestamp?: number; reason?: string };
    if (e.eventType === "interrupt_fired") {
      out.push({
        timestamp: typeof e.timestamp === "number" ? e.timestamp : Date.now(),
        eventType: "signal_fired",
        reason: e.reason ?? "signal",
      });
      continue;
    }
    if (e.eventType === "signal_fired") {
      out.push({
        timestamp: typeof e.timestamp === "number" ? e.timestamp : Date.now(),
        eventType: "signal_fired",
        reason: e.reason,
      });
      continue;
    }
    if (e.eventType === "shutdown_started") {
      out.push({
        timestamp: typeof e.timestamp === "number" ? e.timestamp : Date.now(),
        eventType: "shutdown_started",
        reason: e.reason,
      });
    }
  }
  return out;
}

function normalizeSignalHistory(raw: unknown): SignalDeliveryRecord[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: SignalDeliveryRecord[] = [];
  for (const e of raw) {
    const o = e as { id?: unknown; at?: unknown; slot?: unknown; lineId?: unknown };
    const slots = ["morning", "evening", "sunday", "lateNight"] as const;
    if (
      typeof o.at !== "number" ||
      typeof o.slot !== "string" ||
      typeof o.lineId !== "string" ||
      !slots.includes(o.slot as (typeof slots)[number])
    ) {
      continue;
    }
    const slot = o.slot as SignalDeliveryRecord["slot"];
    const lineId = o.lineId;
    const at = o.at;
    const id =
      typeof o.id === "string" && o.id.length > 0 ? o.id : `legacy-${slot}-${lineId}-${at}`;
    out.push({ id, at, slot, lineId });
  }
  return out.slice(-200);
}

export async function loadPersistedState(): Promise<PersistedCircuitState> {
  try {
    let raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      raw = await AsyncStorage.getItem("circuit.persisted.v1");
      if (raw) {
        const migrated = migrateLegacy(raw);
        if (migrated) {
          await savePersistedState(migrated);
          await AsyncStorage.removeItem("circuit.persisted.v1");
          return migrated;
        }
      }
      return {
        settings: defaultSettings(),
        onboardingCompleted: false,
        logs: [],
        signalHistory: [],
      };
    }
    const parsed = JSON.parse(raw) as Partial<PersistedCircuitState>;
    return {
      settings: {
        ...defaultSettings(),
        ...parsed.settings,
        toneMode: parsed.settings?.toneMode === "brutal" ? "brutal" : "direct",
        notificationsEnabled: parsed.settings?.notificationsEnabled !== false,
        pauseSignalsUntil:
          typeof parsed.settings?.pauseSignalsUntil === "number"
            ? parsed.settings.pauseSignalsUntil
            : undefined,
      },
      onboardingCompleted: Boolean(parsed.onboardingCompleted),
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      lastInterruptMessage:
        typeof parsed.lastInterruptMessage === "string"
          ? parsed.lastInterruptMessage
          : undefined,
      signalHistory: normalizeSignalHistory(parsed.signalHistory),
    };
  } catch {
    return {
      settings: defaultSettings(),
      onboardingCompleted: false,
      logs: [],
      signalHistory: [],
    };
  }
}

export async function savePersistedState(state: PersistedCircuitState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

export async function appendLogEntry(
  current: PersistedCircuitState,
  entry: LocalCircuitLog
): Promise<PersistedCircuitState> {
  const logs = [...current.logs, entry].slice(-500);
  const next = { ...current, logs };
  await savePersistedState(next);
  return next;
}

export async function updateSettings(
  current: PersistedCircuitState,
  partial: Partial<CircuitSettings>
): Promise<PersistedCircuitState> {
  const next: PersistedCircuitState = {
    ...current,
    settings: { ...current.settings, ...partial },
  };
  await savePersistedState(next);
  return next;
}

export async function setOnboardingCompleted(
  current: PersistedCircuitState,
  completed: boolean
): Promise<PersistedCircuitState> {
  const next = { ...current, onboardingCompleted: completed };
  await savePersistedState(next);
  return next;
}

export async function setLastInterruptMessage(
  current: PersistedCircuitState,
  message: string | undefined
): Promise<PersistedCircuitState> {
  const next = { ...current, lastInterruptMessage: message };
  await savePersistedState(next);
  return next;
}

export async function resetAllLocalData(): Promise<PersistedCircuitState> {
  await clearSignalFeedbackStorage();
  const fresh: PersistedCircuitState = {
    settings: defaultSettings(),
    onboardingCompleted: false,
    logs: [],
    signalHistory: [],
  };
  await savePersistedState(fresh);
  return fresh;
}

export async function appendSignalDelivery(
  current: PersistedCircuitState,
  entry: SignalDeliveryRecord
): Promise<PersistedCircuitState> {
  const signalHistory = [...current.signalHistory, entry].slice(-200);
  const next = { ...current, signalHistory };
  await savePersistedState(next);
  return next;
}
