import * as Notifications from "expo-notifications";
import type { NotificationContentAttachmentIos, NotificationTriggerInput } from "expo-notifications";
import { Image, Platform } from "react-native";
import APP_ICON_PNG from "../../assets/icon.png";
import { selectSignalLine } from "../logic/signalEngine";
import { nextFireDateForSlot, SIGNAL_SLOTS, type SignalSlot } from "../logic/signalSchedule";
import { createSignalDeliveryId } from "./storage";
import type { AnchorSlotKind, SignalDeliveryRecord, SignalFeedbackRecord } from "../types";

const ANDROID_DEFAULT_CHANNEL = "circuit-default";
const ANDROID_INTERRUPT_CHANNEL = "circuit-interrupt";

/** Payload marker on scheduled local notifications. */
export const CIRCUIT_DATA_KEY = "circuit";
export const CIRCUIT_SIGNAL_MARKER = "signal";

/**
 * iOS: optional `assets/icon.png` attachment when `resolveAssetSource` is already a **file:** URL
 * (release / embedded bundle). Metro dev often returns **http:** — we skip attachment there
 * rather than block scheduling. If attachment payload is rejected by the OS, we retry without it.
 */
type IosLogoAttachment = NotificationContentAttachmentIos & { uri: string };

function getIosCircuitLogoAttachments(): IosLogoAttachment[] | undefined {
  if (Platform.OS !== "ios") {
    return undefined;
  }
  try {
    const resolved = Image.resolveAssetSource(APP_ICON_PNG);
    if (!resolved?.uri?.startsWith("file:")) {
      return undefined;
    }
    const u = resolved.uri;
    return [
      {
        identifier: "circuit-logo",
        url: u,
        uri: u,
        type: "public.png",
        typeHint: "public.png",
      },
    ];
  } catch {
    return undefined;
  }
}

/** Never let attachment/native errors leave anchors unscheduled (we cancel all first). */
async function scheduleNotificationOrFallback(
  identifier: string,
  trigger: NotificationTriggerInput | null,
  contentBase: Notifications.NotificationContentInput,
  iosAttachments: IosLogoAttachment[] | undefined
): Promise<void> {
  const withAttach =
    iosAttachments && iosAttachments.length > 0
      ? ({ ...contentBase, attachments: iosAttachments } satisfies Notifications.NotificationContentInput)
      : contentBase;
  try {
    await Notifications.scheduleNotificationAsync({ identifier, content: withAttach, trigger });
  } catch {
    await Notifications.scheduleNotificationAsync({ identifier, content: contentBase, trigger });
  }
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_DEFAULT_CHANNEL, {
    name: "Circuit",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function ensureAndroidInterruptChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_INTERRUPT_CHANNEL, {
    name: "Circuit — signals",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 220, 120, 220],
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  await ensureAndroidChannel();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === "granted") {
    return true;
  }
  const asked = await Notifications.requestPermissionsAsync();
  return asked.status === "granted";
}

function signalNotificationIds(): string[] {
  return SIGNAL_SLOTS.map((s) => `circuit-sig-${s.id}`);
}

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return Math.abs(h);
}

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Deterministic ± jitter from anchor calendar day — feels less robotic than exact wall times. */
export function slotJitterMinutes(slotId: string, kind: AnchorSlotKind, anchorDate: Date): number {
  const max = { morning: 5, evening: 7, sunday: 10, lateNight: 20 }[kind];
  const key = `${slotId}|${localYmd(anchorDate)}`;
  const h = djb2(key);
  return (h % (max * 2 + 1)) - max;
}

function applyClockJitter(hour: number, minute: number, deltaMin: number): { hour: number; minute: number } {
  let total = hour * 60 + minute + deltaMin;
  total = ((total % 1440) + 1440) % 1440;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

function buildSlotTrigger(
  slot: SignalSlot,
  hour: number,
  minute: number,
  androidExtra: Record<string, string>
): NotificationTriggerInput {
  if (slot.schedule === "daily") {
    const t: Notifications.DailyTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      ...androidExtra,
    };
    return t;
  }
  const w: Notifications.WeeklyTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday: slot.weekday,
    hour,
    minute,
    ...androidExtra,
  };
  return w;
}

export async function cancelAllSignalNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  for (const id of signalNotificationIds()) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
  }
}

/** @deprecated use cancelAllSignalNotifications */
export async function cancelScheduledAnchors(): Promise<void> {
  await cancelAllSignalNotifications();
}

/**
 * Schedules psychological anchors with narrative selection + light wall-clock jitter.
 * Reschedule periodically (foreground / tone change) so bodies track the next fire context.
 */
type SlotPlan = {
  slot: SignalSlot;
  anchor: Date;
  hour: number;
  minute: number;
  line: ReturnType<typeof selectSignalLine>;
};

function anchorAfterTestSkip(
  slot: SignalSlot,
  now: Date,
  lastTestSignalAt: number | undefined
): Date {
  let anchor = nextFireDateForSlot(slot, now);
  if (
    lastTestSignalAt !== undefined &&
    anchor.getTime() > lastTestSignalAt &&
    anchor.getTime() - lastTestSignalAt < 30 * 60 * 1000
  ) {
    anchor = nextFireDateForSlot(slot, new Date(anchor.getTime()));
  }
  return anchor;
}

/** Ensure late-night daily fire stays at least 90 minutes after evening on the same cycle. */
function enforceEveningLateNightGap(plans: SlotPlan[]): void {
  const evening = plans.find((p) => p.slot.kind === "evening");
  const late = plans.find((p) => p.slot.kind === "lateNight");
  if (!evening || !late) {
    return;
  }
  const evMin = evening.hour * 60 + evening.minute;
  let lateMin = late.hour * 60 + late.minute;
  let diff = lateMin - evMin;
  if (diff < 0) {
    diff += 24 * 60;
  }
  if (diff < 90) {
    const bumped = Math.min(evMin + 90, 23 * 60 + 59);
    late.hour = Math.floor(bumped / 60);
    late.minute = bumped % 60;
  }
}

export async function scheduleSignalAnchors(options: {
  toneMode: "direct" | "brutal";
  lastMessage?: string;
  signalHistory: SignalDeliveryRecord[];
  lastTestSignalAt?: number;
  feedbackRecords?: readonly SignalFeedbackRecord[];
}): Promise<void> {
  await cancelAllSignalNotifications();
  if (Platform.OS === "web") {
    return;
  }
  await ensureAndroidChannel();
  await ensureAndroidInterruptChannel();
  const perm = await Notifications.getPermissionsAsync();
  if (perm.status !== "granted") {
    return;
  }

  const androidExtra =
    Platform.OS === "android"
      ? ({ channelId: ANDROID_INTERRUPT_CHANNEL } satisfies Record<string, string>)
      : ({} as Record<string, string>);

  const now = new Date();
  const plans: SlotPlan[] = [];
  /** So evening / late-night picks see morning's planned line (theme / opener / layer variety). */
  const scratchHistory: SignalDeliveryRecord[] = [...options.signalHistory];

  for (const slot of SIGNAL_SLOTS) {
    const anchor = anchorAfterTestSkip(slot, now, options.lastTestSignalAt);
    const jitter = slotJitterMinutes(slot.id, slot.kind, anchor);
    let { hour, minute } = applyClockJitter(slot.hour, slot.minute, jitter);
    const line = selectSignalLine({
      kind: slot.kind,
      toneMode: options.toneMode,
      fireContext: anchor,
      history: scratchHistory,
      lastMessageText: options.lastMessage,
      feedbackRecords: options.feedbackRecords,
    });
    plans.push({ slot, anchor, hour, minute, line });
    scratchHistory.push({
      id: createSignalDeliveryId(),
      at: anchor.getTime(),
      slot: slot.kind,
      lineId: line.id,
    });
  }

  enforceEveningLateNightGap(plans);

  const iosAttachments = getIosCircuitLogoAttachments();

  for (const p of plans) {
    const identifier = `circuit-sig-${p.slot.id}`;
    const trigger = buildSlotTrigger(p.slot, p.hour, p.minute, androidExtra);
    const contentBase: Notifications.NotificationContentInput = {
      title: "Circuit",
      body: p.line.text,
      sound: true,
      data: {
        [CIRCUIT_DATA_KEY]: CIRCUIT_SIGNAL_MARKER,
        kind: p.slot.kind,
        lineId: p.line.id,
      },
      ...(Platform.OS === "ios" ? { interruptionLevel: "active" as const } : {}),
    };
    await scheduleNotificationOrFallback(identifier, trigger, contentBase, iosAttachments);
  }
}

export function parseSignalKindFromData(data: Record<string, unknown> | undefined): AnchorSlotKind | null {
  const p = parseSignalPayload(data);
  return p?.kind ?? null;
}

export function parseSignalPayload(
  data: Record<string, unknown> | undefined
): { kind: AnchorSlotKind; lineId: string | null } | null {
  if (!data || data[CIRCUIT_DATA_KEY] !== CIRCUIT_SIGNAL_MARKER) {
    return null;
  }
  const k = data.kind;
  if (typeof k !== "string") {
    return null;
  }
  const allowed: AnchorSlotKind[] = ["morning", "evening", "sunday", "lateNight"];
  if (!allowed.includes(k as AnchorSlotKind)) {
    return null;
  }
  const lid = data.lineId;
  return { kind: k as AnchorSlotKind, lineId: typeof lid === "string" ? lid : null };
}

/** Daily anchors paused during force shutdown or user pause window. */
export async function refreshAnchorsForShutdown(
  shutdownUntil: number | undefined,
  pauseSignalsUntil: number | undefined,
  opts: {
    toneMode: "direct" | "brutal";
    lastMessage?: string;
    signalHistory: SignalDeliveryRecord[];
    lastTestSignalAt?: number;
    feedbackRecords?: readonly SignalFeedbackRecord[];
  }
): Promise<void> {
  const now = Date.now();
  const blocked =
    (shutdownUntil !== undefined && shutdownUntil > now) ||
    (pauseSignalsUntil !== undefined && pauseSignalsUntil > now);
  if (blocked) {
    await cancelAllSignalNotifications();
    return;
  }
  await scheduleSignalAnchors(opts);
}

/** Immediate banner (e.g. test interrupt) — not the recurring anchors. */
export async function presentInterruptNotification(
  body: string,
  notificationsEnabled: boolean
): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  if (!notificationsEnabled) {
    return;
  }
  const perm = await Notifications.getPermissionsAsync();
  if (perm.status !== "granted") {
    return;
  }
  await ensureAndroidChannel();
  await ensureAndroidInterruptChannel();

  const trimmed = body.trim().length ? body.trim() : "Pause.";

  const trigger =
    Platform.OS === "android" ? { channelId: ANDROID_INTERRUPT_CHANNEL } : null;

  const iosAttachments = getIosCircuitLogoAttachments();
  const contentBase: Notifications.NotificationContentInput = {
    title: "Circuit",
    body: trimmed,
    sound: true,
    ...(Platform.OS === "ios" ? { interruptionLevel: "active" as const } : {}),
  };
  await scheduleNotificationOrFallback(`circuit-interrupt-${Date.now()}`, trigger, contentBase, iosAttachments);
}
