/** All signal banks: four scheduled anchors plus synthetic `reset` (environment / body tether — not a schedule slot). */
export type SignalKind = "morning" | "evening" | "sunday" | "lateNight" | "reset";

/** Scheduled anchor slots only (notifications, haptics, `signalHistory.slot`). Excludes synthetic `reset` bank. */
export type AnchorSlotKind = Exclude<SignalKind, "reset">;

export type CircuitSettings = {
  toneMode: "direct" | "brutal";
  notificationsEnabled: boolean;
  shutdownUntil?: number;
  /** Pauses recurring anchors only (separate from 15‑min force shutdown). */
  pauseSignalsUntil?: number;
  /** Last manual test signal (reschedule skips next anchor if within 30 min). */
  lastTestSignalAt?: number;
  /** Last transition to AppState `active` (suppress scheduled signal if user just opened app). */
  lastAppBecameActiveAt?: number;
};

export type LocalCircuitLog = {
  timestamp: number;
  eventType: "signal_fired" | "shutdown_started";
  reason?: string;
};

/** Local-only delivery log for repetition + sequencing (no cloud). */
export type SignalDeliveryRecord = {
  /** Stable id for feedback and dedupe; generated on append. Legacy rows use `legacy-{slot}-{lineId}-{at}`. */
  id: string;
  /** Anchor that fired; body may be a rare `reset` bank line (`r01`–`r20`) while slot stays the anchor. */
  slot: AnchorSlotKind;
  lineId: string;
  /** Epoch ms (device). */
  at: number;
};

export type SignalFeedbackValue = "helped" | "not_now" | "too_much";

export type SignalFeedbackRecord = {
  deliveryId: string;
  lineId: string;
  slot: AnchorSlotKind;
  feedback: SignalFeedbackValue;
  respondedAt: string;
  /** Reserved for future analytics (v1 unused in UI). */
  reason?: "wrong_time" | "too_direct" | "too_soft" | "seen_too_often" | "felt_right";
};

export type PersistedCircuitState = {
  settings: CircuitSettings;
  onboardingCompleted: boolean;
  logs: LocalCircuitLog[];
  lastInterruptMessage?: string;
  signalHistory: SignalDeliveryRecord[];
};
