import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { dayModeLabel, nextSignalAfter } from "../logic/signalSchedule";
import { pauseUntilHoursFromNow, pauseUntilNextEarlyMorning, pauseUntilNextMondaySix } from "../logic/pauseBoundaries";
import { selectSignalLine } from "../logic/signalEngine";
import {
  appendLogEntry,
  appendSignalDelivery,
  BLANK_PERSISTED_STATE,
  createSignalDeliveryId,
  loadPersistedState,
  resetAllLocalData,
  setLastInterruptMessage,
  setOnboardingCompleted,
  updateSettings,
} from "../services/storage";
import { feedbackForDelivery, loadSignalFeedback, recordSignalFeedback } from "../services/signalFeedbackStorage";
import {
  cancelScheduledAnchors,
  parseSignalPayload,
  presentInterruptNotification,
  refreshAnchorsForShutdown,
  requestNotificationPermission,
  scheduleSignalAnchors,
} from "../services/notifications";
import type { AnchorSlotKind, PersistedCircuitState, SignalFeedbackRecord, SignalFeedbackValue } from "../types";

type CircuitContextValue = {
  hydrated: boolean;
  persisted: PersistedCircuitState;
  /** Next scheduled psychological anchor (local timezone). */
  nextSignalSummary: string | null;
  dayMode: "Weekend" | "Workday";
  interruptVisible: boolean;
  interruptMessage: string;
  interruptKind: AnchorSlotKind | null;
  /** Present when the current interrupt logged a delivery (feedback eligible). */
  interruptDeliveryId: string | null;
  interruptFeedback: SignalFeedbackRecord | undefined;
  submitInterruptFeedback: (value: SignalFeedbackValue) => Promise<void>;
  dismissInterrupt: () => void;
  completeOnboardingFlow: () => Promise<void>;
  setToneMode: (mode: "direct" | "brutal") => Promise<void>;
  startForceShutdown: () => Promise<void>;
  endForceShutdownEarly: () => Promise<void>;
  resetLocalData: () => Promise<void>;
  refreshPersisted: () => Promise<void>;
  /** Fires morning line + overlay + optional banner (for testing). */
  sendTestSignal: () => Promise<void>;
  /** Test interrupt for any slot — real engine + haptics for that kind. */
  sendTestSignalForKind: (kind: AnchorSlotKind) => Promise<void>;
  /** Refresh “next signal” preview (e.g. when Home gains focus). */
  bumpSchedulePreview: () => void;
  /** Pause recurring anchors (local only). */
  pauseSignalsTonight: () => Promise<void>;
  pauseSignals24Hours: () => Promise<void>;
  pauseSignalsThroughWeekend: () => Promise<void>;
  clearSignalPause: () => Promise<void>;
  /** Local feedback rows (AsyncStorage); used by selection + dev preview. */
  signalFeedback: readonly SignalFeedbackRecord[];
};

const CircuitContext = createContext<CircuitContextValue | undefined>(undefined);

export function CircuitProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [persisted, setPersisted] = useState<PersistedCircuitState>(BLANK_PERSISTED_STATE);
  const [interruptVisible, setInterruptVisible] = useState(false);
  const [interruptMessage, setInterruptMessage] = useState("");
  const [interruptKind, setInterruptKind] = useState<AnchorSlotKind | null>(null);
  const [interruptDeliveryId, setInterruptDeliveryId] = useState<string | null>(null);
  const [interruptLineId, setInterruptLineId] = useState<string | null>(null);
  const [signalFeedback, setSignalFeedback] = useState<SignalFeedbackRecord[]>([]);
  const [scheduleTick, setScheduleTick] = useState(0);

  const persistedRef = useRef<PersistedCircuitState>(BLANK_PERSISTED_STATE);
  persistedRef.current = persisted;

  const signalFeedbackRef = useRef<SignalFeedbackRecord[]>([]);
  signalFeedbackRef.current = signalFeedback;

  const presentSignalRef = useRef<
    (
      message: string,
      kind: AnchorSlotKind,
      opts?: { log?: boolean; notify?: boolean; lineId?: string }
    ) => void
  >(() => {});

  const lastSignalDedupe = useRef<{ at: number; message: string }>({ at: 0, message: "" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [loaded, fb] = await Promise.all([loadPersistedState(), loadSignalFeedback()]);
      if (cancelled) return;
      signalFeedbackRef.current = fb;
      setSignalFeedback(fb);
      setPersisted(loaded);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scheduleOpts = useCallback(() => {
    const p = persistedRef.current;
    return {
      toneMode: p.settings.toneMode,
      lastMessage: p.lastInterruptMessage,
      signalHistory: p.signalHistory,
      lastTestSignalAt: p.settings.lastTestSignalAt,
      feedbackRecords: signalFeedbackRef.current,
    };
  }, []);

  const interruptFeedback = useMemo(() => {
    if (!interruptDeliveryId) {
      return undefined;
    }
    return feedbackForDelivery(interruptDeliveryId, signalFeedback);
  }, [interruptDeliveryId, signalFeedback]);

  const presentSignal = useCallback(
    async (
      message: string,
      kind: AnchorSlotKind,
      opts?: { log?: boolean; notify?: boolean; lineId?: string }
    ) => {
      const log = opts?.log !== false;
      const notify = opts?.notify !== false;
      const now = Date.now();
      if (
        message === lastSignalDedupe.current.message &&
        now - lastSignalDedupe.current.at < 2000
      ) {
        return;
      }
      lastSignalDedupe.current = { at: now, message };

      const { shutdownUntil, pauseSignalsUntil } = persistedRef.current.settings;
      if (
        (shutdownUntil !== undefined && shutdownUntil > Date.now()) ||
        (pauseSignalsUntil !== undefined && pauseSignalsUntil > Date.now())
      ) {
        return;
      }
      const ts = Date.now();
      let cur = persistedRef.current;
      let deliveryId: string | null = null;
      let lineId: string | null = null;
      if (log) {
        cur = await appendLogEntry(cur, {
          timestamp: ts,
          eventType: "signal_fired",
          reason: kind,
        });
        if (opts?.lineId) {
          deliveryId = createSignalDeliveryId();
          lineId = opts.lineId;
          cur = await appendSignalDelivery(cur, {
            id: deliveryId,
            at: ts,
            slot: kind,
            lineId: opts.lineId,
          });
        }
      }
      cur = await setLastInterruptMessage(cur, message);
      setPersisted(cur);
      persistedRef.current = cur;
      setInterruptMessage(message);
      setInterruptKind(kind);
      setInterruptDeliveryId(deliveryId);
      setInterruptLineId(lineId);
      setInterruptVisible(true);
      if (notify) {
        void presentInterruptNotification(message, cur.settings.notificationsEnabled);
      }
      setScheduleTick((t) => t + 1);
    },
    []
  );

  useEffect(() => {
    presentSignalRef.current = (message, kind, opts) => {
      void presentSignal(message, kind, opts);
    };
  }, [presentSignal]);

  useEffect(() => {
    if (!hydrated || !persisted.onboardingCompleted) {
      return;
    }
    const shouldSuppressForRecentOpen = (): boolean => {
      const u = persistedRef.current.settings.lastAppBecameActiveAt;
      if (typeof u !== "number") {
        return false;
      }
      const elapsed = Date.now() - u;
      return elapsed >= 0 && elapsed <= 20 * 60 * 1000;
    };

    const received = Notifications.addNotificationReceivedListener((event) => {
      const data = event.request.content.data as Record<string, unknown> | undefined;
      const payload = parseSignalPayload(data);
      const body = event.request.content.body;
      if (payload && typeof body === "string") {
        if (shouldSuppressForRecentOpen()) {
          return;
        }
        presentSignalRef.current(body, payload.kind, {
          log: true,
          notify: false,
          lineId: payload.lineId ?? undefined,
        });
      }
    });
    const response = Notifications.addNotificationResponseReceivedListener((res) => {
      const data = res.notification.request.content.data as Record<string, unknown> | undefined;
      const payload = parseSignalPayload(data);
      const body = res.notification.request.content.body;
      if (payload && typeof body === "string") {
        if (shouldSuppressForRecentOpen()) {
          return;
        }
        presentSignalRef.current(body, payload.kind, {
          log: true,
          notify: false,
          lineId: payload.lineId ?? undefined,
        });
      }
    });
    return () => {
      received.remove();
      response.remove();
    };
  }, [hydrated, persisted.onboardingCompleted]);

  useEffect(() => {
    if (!hydrated || !persisted.onboardingCompleted) {
      return;
    }
    const { shutdownUntil, pauseSignalsUntil } = persisted.settings;
    void refreshAnchorsForShutdown(shutdownUntil, pauseSignalsUntil, scheduleOpts());
  }, [
    hydrated,
    persisted.onboardingCompleted,
    persisted.settings.shutdownUntil,
    persisted.settings.pauseSignalsUntil,
    scheduleOpts,
  ]);

  useEffect(() => {
    if (!hydrated || !persisted.onboardingCompleted) {
      return;
    }
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        return;
      }
      void (async () => {
        let p = persistedRef.current;
        p = await updateSettings(p, { lastAppBecameActiveAt: Date.now() });
        setPersisted(p);
        persistedRef.current = p;
        await refreshAnchorsForShutdown(p.settings.shutdownUntil, p.settings.pauseSignalsUntil, scheduleOpts());
        setScheduleTick((t) => t + 1);
      })();
    });
    return () => sub.remove();
  }, [hydrated, persisted.onboardingCompleted, scheduleOpts]);

  const dismissInterrupt = useCallback(() => {
    setInterruptVisible(false);
    setInterruptKind(null);
    setInterruptDeliveryId(null);
    setInterruptLineId(null);
  }, []);

  const submitInterruptFeedback = useCallback(async (value: SignalFeedbackValue) => {
    const id = interruptDeliveryId;
    const lid = interruptLineId;
    const slot = interruptKind;
    if (!id || !lid || !slot) {
      return;
    }
    const next = await recordSignalFeedback({
      deliveryId: id,
      lineId: lid,
      slot,
      feedback: value,
      respondedAt: new Date().toISOString(),
    });
    signalFeedbackRef.current = next;
    setSignalFeedback(next);
    const p = persistedRef.current;
    await refreshAnchorsForShutdown(p.settings.shutdownUntil, p.settings.pauseSignalsUntil, scheduleOpts());
    setScheduleTick((t) => t + 1);
  }, [interruptDeliveryId, interruptLineId, interruptKind, scheduleOpts]);

  const completeOnboardingFlow = useCallback(async () => {
    let cur = persistedRef.current;
    cur = await setOnboardingCompleted(cur, true);
    setPersisted(cur);
    persistedRef.current = cur;

    const granted = await requestNotificationPermission();
    cur = await updateSettings(cur, { notificationsEnabled: granted });
    setPersisted(cur);
    persistedRef.current = cur;

    await scheduleSignalAnchors(scheduleOpts());
    setScheduleTick((t) => t + 1);
  }, [scheduleOpts]);

  const setToneMode = useCallback(async (mode: "direct" | "brutal") => {
    let cur = persistedRef.current;
    cur = await updateSettings(cur, { toneMode: mode });
    setPersisted(cur);
    persistedRef.current = cur;
    await scheduleSignalAnchors({
      ...scheduleOpts(),
      toneMode: mode,
    });
    setScheduleTick((t) => t + 1);
  }, [scheduleOpts]);

  const startForceShutdown = useCallback(async () => {
    let cur = persistedRef.current;
    const until = Date.now() + 15 * 60 * 1000;
    cur = await updateSettings(cur, { shutdownUntil: until });
    setPersisted(cur);
    persistedRef.current = cur;
    let next = cur;
    next = await appendLogEntry(next, { timestamp: Date.now(), eventType: "shutdown_started", reason: "force_shutdown" });
    setPersisted(next);
    persistedRef.current = next;
    await refreshAnchorsForShutdown(until, next.settings.pauseSignalsUntil, scheduleOpts());
    setScheduleTick((t) => t + 1);
  }, [scheduleOpts]);

  const endForceShutdownEarly = useCallback(async () => {
    let cur = persistedRef.current;
    cur = await updateSettings(cur, { shutdownUntil: undefined });
    setPersisted(cur);
    persistedRef.current = cur;
    await refreshAnchorsForShutdown(undefined, cur.settings.pauseSignalsUntil, scheduleOpts());
    setScheduleTick((t) => t + 1);
  }, [scheduleOpts]);

  const resetLocalData = useCallback(async () => {
    await cancelScheduledAnchors();
    const fresh = await resetAllLocalData();
    setPersisted(fresh);
    persistedRef.current = fresh;
    signalFeedbackRef.current = [];
    setSignalFeedback([]);
    setInterruptVisible(false);
    setInterruptKind(null);
    setInterruptDeliveryId(null);
    setInterruptLineId(null);
  }, []);

  const refreshPersisted = useCallback(async () => {
    const cur = await loadPersistedState();
    setPersisted(cur);
    persistedRef.current = cur;
  }, []);

  const sendTestSignalForKind = useCallback(
    async (kind: AnchorSlotKind) => {
      let cur = persistedRef.current;
      cur = await updateSettings(cur, { lastTestSignalAt: Date.now() });
      setPersisted(cur);
      persistedRef.current = cur;
      const line = selectSignalLine({
        kind,
        toneMode: cur.settings.toneMode,
        fireContext: new Date(),
        history: cur.signalHistory,
        lastMessageText: cur.lastInterruptMessage,
        feedbackRecords: signalFeedbackRef.current,
      });
      await presentSignal(line.text, kind, { log: true, notify: true, lineId: line.id });
      const after = persistedRef.current;
      await refreshAnchorsForShutdown(after.settings.shutdownUntil, after.settings.pauseSignalsUntil, scheduleOpts());
      setScheduleTick((t) => t + 1);
    },
    [presentSignal, scheduleOpts]
  );

  const sendTestSignal = useCallback(async () => {
    await sendTestSignalForKind("morning");
  }, [sendTestSignalForKind]);

  const applyPauseUntil = useCallback(async (until: number | undefined) => {
    let cur = persistedRef.current;
    cur = await updateSettings(cur, { pauseSignalsUntil: until });
    setPersisted(cur);
    persistedRef.current = cur;
    await refreshAnchorsForShutdown(cur.settings.shutdownUntil, cur.settings.pauseSignalsUntil, scheduleOpts());
    setScheduleTick((t) => t + 1);
  }, [scheduleOpts]);

  const pauseSignalsTonight = useCallback(async () => {
    await applyPauseUntil(pauseUntilNextEarlyMorning());
  }, [applyPauseUntil]);

  const pauseSignals24Hours = useCallback(async () => {
    await applyPauseUntil(pauseUntilHoursFromNow(24));
  }, [applyPauseUntil]);

  const pauseSignalsThroughWeekend = useCallback(async () => {
    await applyPauseUntil(pauseUntilNextMondaySix());
  }, [applyPauseUntil]);

  const clearSignalPause = useCallback(async () => {
    await applyPauseUntil(undefined);
  }, [applyPauseUntil]);

  const bumpSchedulePreview = useCallback(() => {
    setScheduleTick((t) => t + 1);
  }, []);

  const nextSignalSummary = useMemo(() => {
    void scheduleTick;
    const n = nextSignalAfter();
    if (!n) {
      return null;
    }
    return n.at.toLocaleString(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  }, [scheduleTick, persisted.settings, hydrated]);

  const dayMode = useMemo(() => dayModeLabel(), [scheduleTick]);

  const value = useMemo<CircuitContextValue>(() => {
    return {
      hydrated,
      persisted,
      nextSignalSummary,
      dayMode,
      interruptVisible,
      interruptMessage,
      interruptKind,
      interruptDeliveryId,
      interruptFeedback,
      submitInterruptFeedback,
      dismissInterrupt,
      completeOnboardingFlow,
      setToneMode,
      startForceShutdown,
      endForceShutdownEarly,
      resetLocalData,
      refreshPersisted,
      sendTestSignal,
      sendTestSignalForKind,
      bumpSchedulePreview,
      pauseSignalsTonight,
      pauseSignals24Hours,
      pauseSignalsThroughWeekend,
      clearSignalPause,
      signalFeedback,
    };
  }, [
    hydrated,
    persisted,
    nextSignalSummary,
    dayMode,
    interruptVisible,
    interruptMessage,
    interruptKind,
    interruptDeliveryId,
    interruptFeedback,
    submitInterruptFeedback,
    dismissInterrupt,
    completeOnboardingFlow,
    setToneMode,
    startForceShutdown,
    endForceShutdownEarly,
    resetLocalData,
    refreshPersisted,
    sendTestSignal,
    sendTestSignalForKind,
    bumpSchedulePreview,
    pauseSignalsTonight,
    pauseSignals24Hours,
    pauseSignalsThroughWeekend,
    clearSignalPause,
    signalFeedback,
  ]);

  return <CircuitContext.Provider value={value}>{children}</CircuitContext.Provider>;
}

export function useCircuit(): CircuitContextValue {
  const ctx = useContext(CircuitContext);
  if (ctx === undefined) {
    throw new Error("useCircuit must be used within CircuitProvider");
  }
  return ctx;
}
