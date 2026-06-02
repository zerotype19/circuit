import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SignalFeedbackRecord } from "../types";

export const SIGNAL_FEEDBACK_STORAGE_KEY = "circuit.signalFeedback.v1";

const MAX_FEEDBACK = 250;

export async function loadSignalFeedback(): Promise<SignalFeedbackRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(SIGNAL_FEEDBACK_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const out: SignalFeedbackRecord[] = [];
    for (const row of parsed) {
      const r = row as Partial<SignalFeedbackRecord>;
      if (
        typeof r.deliveryId !== "string" ||
        typeof r.lineId !== "string" ||
        typeof r.slot !== "string" ||
        typeof r.feedback !== "string" ||
        typeof r.respondedAt !== "string"
      ) {
        continue;
      }
      const slots = ["morning", "evening", "sunday", "lateNight"] as const;
      if (!slots.includes(r.slot as (typeof slots)[number])) {
        continue;
      }
      if (r.feedback !== "helped" && r.feedback !== "not_now" && r.feedback !== "too_much") {
        continue;
      }
      const reasons: NonNullable<SignalFeedbackRecord["reason"]>[] = [
        "wrong_time",
        "too_direct",
        "too_soft",
        "seen_too_often",
        "felt_right",
      ];
      const reason =
        r.reason !== undefined && reasons.includes(r.reason as NonNullable<SignalFeedbackRecord["reason"]>)
          ? (r.reason as NonNullable<SignalFeedbackRecord["reason"]>)
          : undefined;
      out.push({
        deliveryId: r.deliveryId,
        lineId: r.lineId,
        slot: r.slot as SignalFeedbackRecord["slot"],
        feedback: r.feedback,
        respondedAt: r.respondedAt,
        reason,
      });
    }
    return out.slice(-MAX_FEEDBACK);
  } catch {
    return [];
  }
}

export async function saveSignalFeedback(records: SignalFeedbackRecord[]): Promise<void> {
  const trimmed = records.slice(-MAX_FEEDBACK);
  await AsyncStorage.setItem(SIGNAL_FEEDBACK_STORAGE_KEY, JSON.stringify(trimmed));
}

export async function recordSignalFeedback(record: SignalFeedbackRecord): Promise<SignalFeedbackRecord[]> {
  const cur = await loadSignalFeedback();
  const next = [...cur.filter((x) => x.deliveryId !== record.deliveryId), record].slice(-MAX_FEEDBACK);
  await saveSignalFeedback(next);
  return next;
}

export function feedbackForDelivery(
  deliveryId: string,
  records: readonly SignalFeedbackRecord[]
): SignalFeedbackRecord | undefined {
  return records.find((r) => r.deliveryId === deliveryId);
}

export async function clearSignalFeedbackStorage(): Promise<void> {
  await AsyncStorage.removeItem(SIGNAL_FEEDBACK_STORAGE_KEY);
}

export type LineFeedbackAggregate = {
  lineId: string;
  helped: number;
  notNow: number;
  tooMuch: number;
  total: number;
  /** helped / total when total > 0 */
  helpRate: number;
};

/** Roll up overlay feedback by `lineId` for post-test Hall of Fame / ranking work. */
export function aggregateFeedbackByLineId(
  records: readonly SignalFeedbackRecord[]
): LineFeedbackAggregate[] {
  const byId = new Map<string, { helped: number; notNow: number; tooMuch: number }>();
  for (const r of records) {
    const cur = byId.get(r.lineId) ?? { helped: 0, notNow: 0, tooMuch: 0 };
    if (r.feedback === "helped") {
      cur.helped += 1;
    } else if (r.feedback === "not_now") {
      cur.notNow += 1;
    } else {
      cur.tooMuch += 1;
    }
    byId.set(r.lineId, cur);
  }
  const rows: LineFeedbackAggregate[] = [];
  for (const [lineId, counts] of byId) {
    const total = counts.helped + counts.notNow + counts.tooMuch;
    rows.push({
      lineId,
      ...counts,
      total,
      helpRate: total > 0 ? counts.helped / total : 0,
    });
  }
  return rows.sort((a, b) => b.helpRate - a.helpRate || b.total - a.total);
}

/**
 * Suggested promote list after a test window — does not mutate {@link ELITE_LINE_IDS} yet.
 * Wire into `scoreLine` once you have enough samples per line.
 */
export function suggestedHallOfFameLineIds(
  records: readonly SignalFeedbackRecord[],
  opts?: { minResponses?: number; minHelpRate?: number; topN?: number }
): string[] {
  const minResponses = opts?.minResponses ?? 5;
  const minHelpRate = opts?.minHelpRate ?? 0.65;
  const topN = opts?.topN ?? 12;
  return aggregateFeedbackByLineId(records)
    .filter((row) => row.total >= minResponses && row.helpRate >= minHelpRate)
    .slice(0, topN)
    .map((row) => row.lineId);
}
