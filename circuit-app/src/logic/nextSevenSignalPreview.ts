import type { SignalLine } from "../data/signalBanks";
import { createSignalDeliveryId } from "../services/storage";
import { selectSignalLine } from "./signalEngine";
import { nextSignalAfter } from "./signalSchedule";
import type { AnchorSlotKind, SignalDeliveryRecord, SignalFeedbackRecord } from "../types";

export type NextSignalPreviewRow = {
  at: Date;
  slot: AnchorSlotKind;
  line: SignalLine;
};

/**
 * Simulates the next seven anchor fires using the real selection engine.
 * Appends each pick to a scratch history so repetition / tone rules show through in QA.
 */
export function computeNextSevenSignalPreviews(input: {
  toneMode: "direct" | "brutal";
  signalHistory: readonly SignalDeliveryRecord[];
  feedbackRecords?: readonly SignalFeedbackRecord[];
}): NextSignalPreviewRow[] {
  const simHistory: SignalDeliveryRecord[] = [...input.signalHistory];
  let from = new Date();
  const out: NextSignalPreviewRow[] = [];

  for (let i = 0; i < 7; i++) {
    const n = nextSignalAfter(from);
    if (!n) {
      break;
    }
    const line = selectSignalLine({
      kind: n.slot.kind,
      toneMode: input.toneMode,
      fireContext: n.at,
      history: simHistory,
      feedbackRecords: input.feedbackRecords,
    });
    out.push({ at: n.at, slot: n.slot.kind, line });
    simHistory.push({
      id: createSignalDeliveryId(),
      at: n.at.getTime(),
      slot: n.slot.kind,
      lineId: line.id,
    });
    from = new Date(n.at.getTime() + 1000);
  }

  return out;
}
