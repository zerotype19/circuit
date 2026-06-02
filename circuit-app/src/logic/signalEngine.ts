import {
  behaviorLayerForLine,
  ELITE_LINE_IDS,
  microStatesForLine,
  SIGNAL_BANKS,
  type MicroState,
  type SignalLine,
} from "../data/signalBanks";
import type { AnchorSlotKind, SignalDeliveryRecord, SignalFeedbackRecord, SignalKind } from "../types";

const MS_DAY = 86400000;
const MS_HOUR = 3600000;

function tonePool(lines: readonly SignalLine[], toneMode: "direct" | "brutal"): readonly SignalLine[] {
  if (toneMode !== "brutal") {
    return lines;
  }
  const harsh = lines.filter((l) => l.intensity >= 2 || l.tone === "directive");
  return harsh.length > 0 ? harsh : lines;
}

function recentTooMuchAny(feedback: readonly SignalFeedbackRecord[] | undefined, windowMs: number): boolean {
  if (!feedback?.length) {
    return false;
  }
  const now = Date.now();
  return feedback.some((f) => {
    if (f.feedback !== "too_much") {
      return false;
    }
    const t = Date.parse(f.respondedAt);
    return !Number.isNaN(t) && now - t <= windowMs;
  });
}

/** Brutal pool: optionally soften directive / intensity-3 after recent "too_much" feedback. */
function tonePoolWithFeedback(
  lines: readonly SignalLine[],
  toneMode: "direct" | "brutal",
  feedback: readonly SignalFeedbackRecord[] | undefined
): SignalLine[] {
  if (toneMode !== "brutal") {
    return [...lines];
  }
  const harsh = lines.filter((l) => l.intensity >= 2 || l.tone === "directive");
  let pool = harsh.length > 0 ? [...harsh] : [...lines];
  if (!recentTooMuchAny(feedback, 36 * MS_HOUR)) {
    return pool;
  }
  const noDir = pool.filter((l) => l.tone !== "directive");
  if (noDir.length >= 3) {
    return noDir;
  }
  const noI3 = pool.filter((l) => l.intensity !== 3);
  if (noI3.length >= 3) {
    return noI3;
  }
  return pool;
}

function recentDeliveries(history: readonly SignalDeliveryRecord[], limit: number): SignalDeliveryRecord[] {
  return [...history].sort((a, b) => b.at - a.at).slice(0, limit);
}

function lineById(id: string): SignalLine | undefined {
  for (const bank of Object.values(SIGNAL_BANKS)) {
    const hit = bank.find((l) => l.id === id);
    if (hit) {
      return hit;
    }
  }
  return undefined;
}

/** JS: 0 Sun … 6 Sat — emotional “weather” map (deterministic, no ML). */
function preferredThemes(jsDay: number, kind: SignalKind): readonly string[] {
  if (kind === "reset") {
    return [
      "environmental_anchor",
      "environment",
      "body_interrupt",
      "sensory_reset",
      "physical_grounding",
      "screen_break",
      "nervous_system_reset",
      "stimulation_overload",
    ];
  }
  if (kind === "sunday") {
    return [
      "attention_shift",
      "mundane_reality",
      "environmental_anchor",
      "permission",
      "anticipatory_anxiety",
      "time_travel",
      "anticipation",
      "boundaries",
      "comparison",
      "premature_activation",
      "cognitive",
      "meta",
      "control",
      "presence",
      "separation",
      "cost",
      "calendar_stress",
      "urgency_illusion",
      "caregiving_load",
      "mental_load",
      "invisible_labor",
      "sensory_overload",
      "fragmentation",
      "perspective_reset",
      "stakes_distortion",
      "borrowed_urgency",
      "reality_anchor",
      "physical_reentry",
    ];
  }
  if (kind === "morning") {
    const map: Record<number, readonly string[]> = {
      0: [
        "presence",
        "pacing",
        "sensory",
        "overload",
        "somatic",
        "perfectionism",
        "caregiving_load",
        "mental_load",
        "fragmentation",
        "perspective_reset",
        "stakes_distortion",
        "false_emergency",
      ],
      1: [
        "anticipatory_stress",
        "urgency_illusion",
        "activation",
        "time_travel",
        "focus",
        "anticipation",
        "device_habit",
        "reactivity",
        "caregiving_load",
        "mental_load",
        "perspective_reset",
        "nervous_system_misperception",
      ],
      2: [
        "calendar_stress",
        "agency",
        "control",
        "overload",
        "scope_creep",
        "permission",
        "invisible_labor",
        "mental_load",
        "perspective_reset",
        "stakes_distortion",
      ],
      3: [
        "nervous_system",
        "sensory",
        "overload",
        "activation",
        "somatic",
        "fragmentation",
        "caregiving_load",
        "perspective_reset",
        "false_emergency",
      ],
      4: [
        "anticipation",
        "worth",
        "overload",
        "comparison",
        "time_travel",
        "mental_load",
        "invisible_labor",
        "stakes_distortion",
        "perspective_reset",
      ],
      5: [
        "pacing",
        "sensory",
        "comparison",
        "activation",
        "overload",
        "caregiving_load",
        "fragmentation",
        "perspective_reset",
        "borrowed_urgency",
      ],
      6: [
        "comparison",
        "sensory",
        "pacing",
        "overload",
        "passive_drift",
        "mental_load",
        "sensory_overload",
        "reality_anchor",
        "physical_reentry",
      ],
    };
    return map[jsDay] ?? map[1]!;
  }
  if (kind === "evening") {
    const eveReentry = [
      "attention_shift",
      "mundane_reality",
      "environmental_anchor",
      "permission",
    ] as const;
    const map: Record<number, readonly string[]> = {
      0: [
        ...eveReentry,
        "anticipation",
        "separation",
        "closure",
        "carryover",
        "rumination",
        "time_travel",
        "fatigue",
        "caregiving_load",
        "invisible_labor",
        "perspective_reset",
        "borrowed_urgency",
        "emotional_contagion",
      ],
      1: [
        ...eveReentry,
        "carryover",
        "closure",
        "rumination",
        "replay",
        "body",
        "fatigue",
        "mental_load",
        "sensory_overload",
        "perspective_reset",
        "emotional_contagion",
        "absorbed_stress",
      ],
      2: [
        ...eveReentry,
        "rumination",
        "closure",
        "replay",
        "carryover",
        "cognitive_dead_end",
        "fatigue",
        "fragmentation",
        "invisible_labor",
        "emotional_carryover",
        "perspective_reset",
      ],
      3: [
        ...eveReentry,
        "rumination",
        "closure",
        "recovery",
        "overload",
        "body",
        "performance",
        "caregiving_load",
        "mental_load",
        "stakes_distortion",
        "borrowed_urgency",
      ],
      4: [
        ...eveReentry,
        "rumination",
        "anticipation",
        "worth",
        "closure",
        "release",
        "performance",
        "sensory_overload",
        "invisible_labor",
        "perspective_reset",
        "emotional_contagion",
      ],
      5: [
        ...eveReentry,
        "recovery",
        "mode_shift",
        "worth",
        "release",
        "fatigue",
        "caregiving_load",
        "mental_load",
        "reality_anchor",
        "physical_reentry",
      ],
      6: [
        ...eveReentry,
        "comparison",
        "recovery",
        "worth",
        "passive_drift",
        "closure",
        "performance",
        "fragmentation",
        "sensory_overload",
        "perspective_reset",
        "borrowed_urgency",
      ],
    };
    return map[jsDay] ?? map[1]!;
  }
  /* lateNight — environment / permission first (~50% of preferred slots), doomscroll secondary */
  const envFirst = [
    "attention_shift",
    "mundane_reality",
    "environmental_anchor",
    "environment",
    "physical_reentry",
    "reality_anchor",
    "physical_grounding",
    "presence",
    "permission",
    "sensory_reset",
    "body_interrupt",
    "somatic",
  ] as const;
  const scrollSecond = [
    "doomscroll",
    "revenge_bedtime",
    "fatigue_mismatch",
    "device_boundary",
    "passive_drift",
    "algorithmic_pull",
    "rest_ethic",
    "tradeoff",
    "consequence",
  ] as const;
  const map: Record<number, readonly string[]> = {
    0: [...envFirst, ...scrollSecond, "loneliness", "emotional_avoidance", "time_travel"],
    1: [...envFirst, ...scrollSecond, "caregiving_load", "fragmentation", "screen_break"],
    2: [...envFirst, ...scrollSecond, "cognitive_dead_end", "mental_load", "sensory_overload"],
    3: [...envFirst, ...scrollSecond, "invisible_labor", "stimulation_overload"],
    4: [...envFirst, ...scrollSecond, "emotional_avoidance", "stakes_distortion"],
    5: [...envFirst, ...scrollSecond, "comparison", "mental_load"],
    6: [...envFirst, ...scrollSecond, "loneliness", "invisible_labor"],
  };
  return map[jsDay] ?? map[1]!;
}

function avoidThemesForContext(kind: SignalKind): readonly string[] {
  if (kind === "reset") {
    return [];
  }
  if (kind === "sunday") {
    return ["somatic"];
  }
  return [];
}

function scoreLine(
  line: SignalLine,
  jsDay: number,
  kind: SignalKind,
  toneMode: "direct" | "brutal"
): number {
  let s = 0;
  const prefs = preferredThemes(jsDay, kind);
  if (prefs.includes(line.theme)) {
    s += 4;
  }
  const avoid = avoidThemesForContext(kind);
  if (avoid.includes(line.theme)) {
    s -= 6;
  }
  if (toneMode === "direct") {
    if (line.tone === "grounding") {
      s += 1;
    }
    if (line.tone === "observational") {
      s += 2;
    }
    if (line.tone === "directive") {
      s -= 1;
    }
  } else {
    if (line.tone === "directive" || line.intensity >= 2) {
      s += 1;
    }
  }
  if (ELITE_LINE_IDS.has(line.id)) {
    s += 1.5;
  }
  const layer = behaviorLayerForLine(line);
  if (layer === "environmental_anchor" || line.theme === "environmental_anchor") {
    if (kind === "lateNight" || kind === "evening") {
      s += 2.5;
    } else {
      s += 1;
    }
  }
  if (line.theme === "permission" && (kind === "lateNight" || kind === "evening")) {
    s += 1.5;
  }
  if (
    line.theme === "attention_shift" &&
    (kind === "lateNight" || kind === "evening" || kind === "sunday")
  ) {
    s += 2;
  }
  if (line.theme === "mundane_reality" && (kind === "lateNight" || kind === "evening")) {
    s += 1.5;
  }
  const thoughtHeavy = ["rumination", "replay", "time_travel", "cognitive", "meta", "anticipation"];
  if (kind === "lateNight" && thoughtHeavy.includes(line.theme)) {
    s -= 1.5;
  }
  s += (line.id.charCodeAt(line.id.length - 1) % 3) * 0.01;
  return s;
}

/**
 * Small score nudge from local feedback (does not override repeat / streak / reset cooldown rules).
 * Caps roughly to [-8, +4] per line candidate.
 */
export function feedbackScoreAdjustment(
  line: SignalLine,
  feedbackRecords: readonly SignalFeedbackRecord[] | undefined
): number {
  if (!feedbackRecords?.length) {
    return 0;
  }
  let s = 0;
  const now = Date.now();
  const helpCut = now - 14 * MS_DAY;
  const notCut = now - 7 * MS_DAY;
  const tooCut = now - 36 * MS_HOUR;
  const lineMicro = new Set(microStatesForLine(line));

  for (const f of feedbackRecords) {
    const t = Date.parse(f.respondedAt);
    if (Number.isNaN(t)) {
      continue;
    }
    const fl = lineById(f.lineId);
    if (f.feedback === "helped" && t >= helpCut) {
      if (f.lineId === line.id) {
        s += 2.5;
        continue;
      }
      if (fl && fl.theme === line.theme) {
        s += 1;
      }
      if (fl) {
        for (const m of microStatesForLine(fl)) {
          if (lineMicro.has(m)) {
            s += 0.45;
            break;
          }
        }
      }
    } else if (f.feedback === "not_now" && t >= notCut) {
      if (f.lineId === line.id) {
        s -= 2.5;
      } else if (fl && fl.theme === line.theme) {
        s -= 1.2;
      }
    } else if (f.feedback === "too_much" && t >= tooCut) {
      if (f.lineId === line.id) {
        s -= 4;
      }
    }
  }

  if (recentTooMuchAny(feedbackRecords, 36 * MS_HOUR)) {
    if (line.tone === "directive") {
      s -= 1.5;
    }
    if (line.intensity === 3) {
      s -= 1.5;
    }
  }

  return Math.max(-8, Math.min(4, s));
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** How far below the top score candidates stay in the weighted pool (wider = more variety). */
const SCORE_TIER_DELTA = 1.25;

/** Same anchor slot: do not repeat a lineId within this window (stricter than global 14d). */
const SLOT_LINE_REPEAT_MS = 7 * MS_DAY;

function pickWeightedByScore(scored: { l: SignalLine; s: number }[]): SignalLine {
  if (scored.length === 0) {
    throw new Error("pickWeightedByScore: empty");
  }
  const top = scored[0]!.s;
  const pool = scored.filter((x) => x.s >= top - SCORE_TIER_DELTA);
  const weights = pool.map((x) => {
    const w = Math.exp(x.s - top);
    return w > 0 ? w : 0.01;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]!;
    if (r <= 0) {
      return pool[i]!.l;
    }
  }
  return pool[pool.length - 1]!.l;
}

function openerKey(text: string): string {
  const t = text.trim();
  if (t.startsWith("Your body")) return "your_body";
  if (t.startsWith("Your brain")) return "your_brain";
  if (t.startsWith("You are ")) return "you_are";
  if (t.startsWith("You ")) return "you";
  if (t.startsWith("The room")) return "the_room";
  if (t.startsWith("The ")) return "the";
  if (t.startsWith("Nothing ")) return "nothing";
  return t.slice(0, 18).toLowerCase();
}

function applyOpenerVariety(candidates: SignalLine[], history: readonly SignalDeliveryRecord[]): SignalLine[] {
  const recent = recentDeliveries(history, 2)
    .map((h) => lineById(h.lineId))
    .filter((l): l is SignalLine => Boolean(l));
  if (recent.length < 2) {
    return candidates;
  }
  const banned = new Set(recent.map((l) => openerKey(l.text)));
  const filtered = candidates.filter((c) => !banned.has(openerKey(c.text)));
  return filtered.length > 0 ? filtered : candidates;
}

/** After two consecutive `attention_shift` themes, prefer other themes when available. */
function applyAttentionShiftThemeStreak(
  candidates: SignalLine[],
  history: readonly SignalDeliveryRecord[]
): SignalLine[] {
  const lastTwo = recentDeliveries(history, 2)
    .map((h) => lineById(h.lineId))
    .filter((l): l is SignalLine => Boolean(l));
  if (lastTwo.length < 2 || !lastTwo.every((l) => l.theme === "attention_shift")) {
    return candidates;
  }
  const filtered = candidates.filter((c) => c.theme !== "attention_shift");
  return filtered.length > 0 ? filtered : candidates;
}

function applyBehaviorLayerVariety(candidates: SignalLine[], history: readonly SignalDeliveryRecord[]): SignalLine[] {
  const lastTwo = recentDeliveries(history, 2)
    .map((h) => lineById(h.lineId))
    .filter((l): l is SignalLine => Boolean(l));
  if (lastTwo.length < 2) {
    return candidates;
  }
  const a = behaviorLayerForLine(lastTwo[0]!);
  const b = behaviorLayerForLine(lastTwo[1]!);
  if (a !== b) {
    return candidates;
  }
  const filtered = candidates.filter((c) => behaviorLayerForLine(c) !== a);
  return filtered.length > 0 ? filtered : candidates;
}

/** Character-length buckets to reduce same-length streaks (not shown to user). */
function rhythmBucket(text: string): "short" | "medium" | "long" {
  const n = text.trim().length;
  if (n <= 52) return "short";
  if (n <= 88) return "medium";
  return "long";
}

/** If the same heavy micro-state hit twice in a row, avoid serving it again when alternatives exist. */
const MICRO_STREAK_AVOID: ReadonlySet<MicroState> = new Set([
  "doomscroll",
  "screen_trance",
  "rumination",
  "time_travel",
  "revenge_bedtime",
  "digital_trance",
]);

function applyMicroStreakAvoidance(candidates: SignalLine[], history: readonly SignalDeliveryRecord[]): SignalLine[] {
  const lastTwo = recentDeliveries(history, 2)
    .map((h) => lineById(h.lineId))
    .filter((l): l is SignalLine => Boolean(l));
  if (lastTwo.length < 2) {
    return candidates;
  }
  const a = new Set(microStatesForLine(lastTwo[0]!));
  const b = new Set(microStatesForLine(lastTwo[1]!));
  const overlap = [...MICRO_STREAK_AVOID].filter((m) => a.has(m) && b.has(m));
  if (overlap.length === 0) {
    return candidates;
  }
  const filtered = candidates.filter((c) => {
    const ms = new Set(microStatesForLine(c));
    return !overlap.some((m) => ms.has(m));
  });
  return filtered.length > 0 ? filtered : candidates;
}

/** After two medium-length lines, prefer short or long when possible. */
function applyRhythmVariety(candidates: SignalLine[], history: readonly SignalDeliveryRecord[]): SignalLine[] {
  const lastTwo = recentDeliveries(history, 2)
    .map((h) => lineById(h.lineId))
    .filter((l): l is SignalLine => Boolean(l));
  if (lastTwo.length < 2) {
    return candidates;
  }
  if (rhythmBucket(lastTwo[0]!.text) !== "medium" || rhythmBucket(lastTwo[1]!.text) !== "medium") {
    return candidates;
  }
  const varied = candidates.filter((c) => rhythmBucket(c.text) !== "medium");
  return varied.length > 0 ? varied : candidates;
}

/** Micro-states that indicate a stuck loop; when shared across recent deliveries, favor exit-layer copy + reset. */
const EXIT_LOOP_MICRO: readonly MicroState[] = [
  "doomscroll",
  "rumination",
  "anticipatory_anxiety",
  "hypervigilance",
  "stimulation_overload",
];

/**
 * If the last N resolved deliveries all include the same heavy micro-state from {@link EXIT_LOOP_MICRO}, return it.
 * Uses N = 3 when history allows, else N = 2.
 */
function exitLoopSharedMicro(history: readonly SignalDeliveryRecord[]): MicroState | null {
  const recent = recentDeliveries(history, 3);
  if (recent.length < 2) {
    return null;
  }
  const n = recent.length >= 3 ? 3 : 2;
  const lines = recent
    .slice(0, n)
    .map((h) => lineById(h.lineId))
    .filter((l): l is SignalLine => Boolean(l));
  if (lines.length < n) {
    return null;
  }
  for (const m of EXIT_LOOP_MICRO) {
    if (lines.every((l) => microStatesForLine(l).includes(m))) {
      return m;
    }
  }
  return null;
}

function exitLayerScoreBoost(line: SignalLine, shared: MicroState | null): number {
  if (!shared) {
    return 0;
  }
  const layer = behaviorLayerForLine(line);
  if (layer === "reality_anchor" || layer === "perspective_reset" || layer === "environmental_anchor") {
    return 3;
  }
  if (layer === "attention_shift") {
    return 2.5;
  }
  if (layer === "interrupt") {
    return 2;
  }
  return 0;
}

function consecutiveMirrorFromHistory(history: readonly SignalDeliveryRecord[]): number {
  let n = 0;
  for (const h of recentDeliveries(history, 12)) {
    const l = lineById(h.lineId);
    if (!l || behaviorLayerForLine(l) !== "mirror") {
      break;
    }
    n += 1;
  }
  return n;
}

function lastNDeliveriesAllHaveMicro(
  history: readonly SignalDeliveryRecord[],
  n: number,
  micro: MicroState
): boolean {
  const lines = recentDeliveries(history, n)
    .map((h) => lineById(h.lineId))
    .filter((l): l is SignalLine => Boolean(l));
  return lines.length >= n && lines.every((l) => microStatesForLine(l).includes(micro));
}

const RESET_MIN_GAP_MS = 82 * 60 * 1000;
const RESET_INJECT_PROB = 0.11;

function isResetLineId(lineId: string): boolean {
  return /^r\d{2}$/.test(lineId);
}

function hasRecentResetDelivery(history: readonly SignalDeliveryRecord[], nowTs: number): boolean {
  const since = nowTs - RESET_MIN_GAP_MS;
  return history.some((h) => h.at >= since && isResetLineId(h.lineId));
}

function shouldInjectResetBank(
  kind: AnchorSlotKind,
  history: readonly SignalDeliveryRecord[],
  nowTs: number,
  feedback?: readonly SignalFeedbackRecord[]
): boolean {
  if (kind !== "lateNight" && kind !== "evening") {
    return false;
  }
  const newest = recentDeliveries(history, 1)[0];
  if (newest && isResetLineId(newest.lineId)) {
    return false;
  }
  if (hasRecentResetDelivery(history, nowTs)) {
    return false;
  }
  const shared = exitLoopSharedMicro(history);
  if (!shared) {
    return false;
  }
  let p = RESET_INJECT_PROB;
  if (shared === "doomscroll") {
    p *= 1.12;
  } else if (shared === "rumination" || shared === "anticipatory_anxiety") {
    p *= 1.06;
  }
  if (feedback?.length) {
    const since7 = nowTs - 7 * MS_DAY;
    const helpedReset = feedback.filter(
      (f) =>
        f.feedback === "helped" &&
        /^r\d{2}$/.test(f.lineId) &&
        !Number.isNaN(Date.parse(f.respondedAt)) &&
        Date.parse(f.respondedAt) >= since7
    ).length;
    p *= 1 + Math.min(0.08, helpedReset * 0.025);
    const since48 = nowTs - 48 * MS_HOUR;
    const tooMuchReset = feedback.some(
      (f) =>
        f.feedback === "too_much" &&
        /^r\d{2}$/.test(f.lineId) &&
        !Number.isNaN(Date.parse(f.respondedAt)) &&
        Date.parse(f.respondedAt) >= since48
    );
    if (tooMuchReset) {
      p *= 0.5;
    }
  }
  return Math.random() < p;
}

function pickLineFromPool(
  input: SignalSelectionInput,
  base: readonly SignalLine[],
  scoringKind: SignalKind,
  opts: { skipMicroStreak: boolean; skipRhythm: boolean }
): SignalLine | null {
  const { kind, toneMode, fireContext, history, lastMessageText, feedbackRecords } = input;
  const jsDay = fireContext.getDay();
  const now = Date.now();
  const cutoff14d = now - 14 * MS_DAY;
  const cutoffSlot = now - SLOT_LINE_REPEAT_MS;
  const usedIdsGlobal = new Set(history.filter((h) => h.at >= cutoff14d).map((h) => h.lineId));
  const usedIdsSlot = new Set(
    history.filter((h) => h.slot === kind && h.at >= cutoffSlot).map((h) => h.lineId)
  );
  const usedIds = new Set([...usedIdsGlobal, ...usedIdsSlot]);

  const recent = recentDeliveries(history, 6);
  const recentThemes = recent.slice(0, 3).map((h) => lineById(h.lineId)?.theme).filter(Boolean) as string[];
  const lastTones = recent
    .slice(0, 2)
    .map((h) => lineById(h.lineId)?.tone)
    .filter(Boolean) as SignalLine["tone"][];
  const blockDirectiveStreak = lastTones.length === 2 && lastTones[0] === "directive" && lastTones[1] === "directive";

  let pool = tonePoolWithFeedback(base, toneMode, feedbackRecords);

  const applyFilters = (relaxTheme: boolean, relaxId: boolean) => {
    let out = pool.filter((l) => relaxId || !usedIds.has(l.id));
    if (!relaxTheme) {
      const banned = new Set(recentThemes);
      const filtered = out.filter((l) => !banned.has(l.theme));
      if (filtered.length > 0) {
        out = filtered;
      }
    }
    if (blockDirectiveStreak) {
      const noDir = out.filter((l) => l.tone !== "directive");
      if (noDir.length > 0) {
        out = noDir;
      }
    }
    return out;
  };

  let candidates = applyFilters(false, false);
  if (candidates.length === 0) {
    candidates = applyFilters(true, false);
  }
  if (candidates.length === 0) {
    candidates = applyFilters(true, true);
  }
  if (candidates.length === 0) {
    return null;
  }

  if (consecutiveMirrorFromHistory(history) >= 3 && lastNDeliveriesAllHaveMicro(history, 3, "doomscroll")) {
    const nonMirror = candidates.filter((l) => behaviorLayerForLine(l) !== "mirror");
    if (nonMirror.length > 0) {
      candidates = nonMirror;
    }
  }

  if (!opts.skipMicroStreak) {
    candidates = applyMicroStreakAvoidance(candidates, history);
  }
  if (!opts.skipRhythm) {
    candidates = applyRhythmVariety(candidates, history);
  }
  candidates = applyOpenerVariety(candidates, history);
  candidates = applyBehaviorLayerVariety(candidates, history);
  candidates = applyAttentionShiftThemeStreak(candidates, history);

  const sharedLoop = exitLoopSharedMicro(history);
  const scored = candidates.map((l) => ({
    l,
    s:
      scoreLine(l, jsDay, scoringKind, toneMode) +
      feedbackScoreAdjustment(l, feedbackRecords) +
      exitLayerScoreBoost(l, sharedLoop),
  }));
  scored.sort((a, b) => b.s - a.s);
  let choice = pickWeightedByScore(scored);
  if (lastMessageText && choice.text === lastMessageText && scored.length > 1) {
    const altScored = scored.filter((x) => x.l.text !== lastMessageText);
    if (altScored.length > 0) {
      choice = pickWeightedByScore(altScored);
    }
  }
  return choice;
}

export type SignalSelectionInput = {
  kind: AnchorSlotKind;
  toneMode: "direct" | "brutal";
  /** Wall-clock context for the upcoming fire (usually `nextFireDateForSlot`). */
  fireContext: Date;
  history: readonly SignalDeliveryRecord[];
  lastMessageText?: string;
  /** Local signal feedback — light score nudges + reset injection tuning. */
  feedbackRecords?: readonly SignalFeedbackRecord[];
};

/**
 * Weekly theme map + repetition guards; weighted random among high-scoring candidates (not uniform random).
 * Rarely injects a line from the `reset` bank (evening / late night only) after a shared heavy micro-state streak across recent deliveries.
 */
export function selectSignalLine(input: SignalSelectionInput): SignalLine {
  const { kind, history, feedbackRecords } = input;
  const nowTs = Date.now();
  if (shouldInjectResetBank(kind, history, nowTs, feedbackRecords)) {
    const resetPick = pickLineFromPool(input, SIGNAL_BANKS.reset, "reset", {
      skipMicroStreak: true,
      skipRhythm: false,
    });
    if (resetPick) {
      return resetPick;
    }
  }

  const anchorPick = pickLineFromPool(input, SIGNAL_BANKS[kind], kind, {
    skipMicroStreak: false,
    skipRhythm: false,
  });
  if (anchorPick) {
    return anchorPick;
  }

  return {
    id: "fallback",
    text: "Pause.",
    tone: "grounding",
    theme: "reset",
    intensity: 1,
    microStates: ["fatigue"],
  };
}
