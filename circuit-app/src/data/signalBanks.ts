import type { SignalKind } from "../types";

/**
 * Human library: single-line notification bodies. Plain, present-tense reminders —
 * return attention to now, shrink the horizon, point at simple reality. No therapy voice.
 * `theme` / `behaviorLayer` / `microStates` are internal scoring only (never shown).
 */
export type SignalTone = "grounding" | "observational" | "directive";

/** Internal situational tags for habituation / routing (never shown). */
export type MicroState =
  | "rushing"
  | "tight_chest"
  | "doomscroll"
  | "time_travel"
  | "work_loop"
  | "loneliness"
  | "overload"
  | "self_pressure"
  | "revenge_bedtime"
  | "screen_trance"
  | "anticipatory_anxiety"
  | "fatigue"
  | "rumination"
  | "hypervigilance"
  | "dissociation"
  | "screen_fatigue"
  | "stimulation_overload"
  | "physical_freeze"
  | "breath_holding"
  | "absorbed_stress"
  | "stakes_distortion"
  | "ambient_urgency"
  | "digital_trance"
  | "emotional_carryover";

export type SignalBehaviorLayer =
  | "mirror"
  | "interrupt"
  | "reality_anchor"
  | "perspective_reset"
  | "environmental_anchor"
  | "attention_shift";

/** Early favorites — light score boost in {@link scoreLine} (see signalEngine). */
export const ELITE_LINE_IDS: ReadonlySet<string> = new Set([
  "m02",
  "m14",
  "e02",
  "e03",
  "e06",
  "s01",
  "s02",
  "l01",
  "l10",
  "l16",
  "l27",
  "r08",
]);

export type SignalLine = {
  id: string;
  text: string;
  tone: SignalTone;
  theme: string;
  intensity: 1 | 2 | 3;
  microStates?: readonly MicroState[];
  behaviorLayer?: SignalBehaviorLayer;
};

export function behaviorLayerForLine(line: SignalLine): SignalBehaviorLayer {
  return line.behaviorLayer ?? "mirror";
}

export const THEME_MICRO_DEFAULTS: Readonly<Record<string, readonly MicroState[]>> = {
  urgency_illusion: ["anticipatory_anxiety", "self_pressure"],
  anticipatory_stress: ["anticipatory_anxiety", "rushing"],
  anticipation: ["anticipatory_anxiety", "time_travel"],
  overload: ["overload", "self_pressure"],
  reframe: ["self_pressure", "anticipatory_anxiety"],
  pacing: ["rushing", "fatigue"],
  activation: ["rushing", "fatigue"],
  perfectionism: ["self_pressure", "rumination"],
  calendar_stress: ["anticipatory_anxiety", "work_loop"],
  time_travel: ["time_travel", "anticipatory_anxiety"],
  somatic: ["tight_chest", "fatigue"],
  sensory: ["screen_trance", "hypervigilance"],
  focus: ["work_loop", "self_pressure"],
  scope_creep: ["overload", "time_travel"],
  agency: ["work_loop", "self_pressure"],
  control: ["self_pressure", "anticipatory_anxiety"],
  transition: ["rushing", "anticipatory_anxiety"],
  closure: ["rumination", "fatigue"],
  rumination: ["rumination", "fatigue"],
  replay: ["rumination", "work_loop"],
  cognitive_dead_end: ["rumination", "fatigue"],
  carryover: ["work_loop", "rumination"],
  mode_shift: ["fatigue", "rumination"],
  passive_drift: ["doomscroll", "screen_trance"],
  anticipatory_anxiety: ["anticipatory_anxiety", "time_travel"],
  boundaries: ["anticipatory_anxiety", "self_pressure"],
  presence: ["time_travel", "fatigue"],
  cognitive: ["rumination", "anticipatory_anxiety"],
  device_boundary: ["doomscroll", "screen_trance"],
  device_habit: ["screen_trance", "hypervigilance"],
  environment: ["dissociation", "screen_fatigue"],
  sensory_reset: ["breath_holding", "tight_chest"],
  physical_grounding: ["dissociation", "tight_chest"],
  screen_break: ["screen_fatigue", "doomscroll"],
  perspective_reset: ["anticipatory_anxiety", "rumination"],
  reality_anchor: ["dissociation", "screen_trance"],
  environmental_anchor: ["dissociation", "screen_trance"],
  attention_shift: ["dissociation", "screen_trance"],
  reset: ["fatigue"],
};

export function microStatesForLine(line: SignalLine): readonly MicroState[] {
  if (line.microStates && line.microStates.length > 0) {
    return line.microStates;
  }
  return THEME_MICRO_DEFAULTS[line.theme] ?? ["anticipatory_anxiety"];
}

const MORNING: readonly SignalLine[] = [
  {
    id: "m01",
    text: "Most things can wait.",
    tone: "observational",
    theme: "urgency_illusion",
    intensity: 1,
  },
  {
    id: "m02",
    text: "The day has barely started.",
    tone: "observational",
    theme: "anticipatory_stress",
    intensity: 1,
  },
  {
    id: "m03",
    text: "Start with one thing, not the whole day.",
    tone: "grounding",
    theme: "pacing",
    intensity: 1,
  },
  {
    id: "m04",
    text: "Not everything urgent is important.",
    tone: "observational",
    theme: "urgency_illusion",
    intensity: 1,
  },
  {
    id: "m05",
    text: "Keep the first hour small.",
    tone: "grounding",
    theme: "pacing",
    intensity: 1,
  },
  {
    id: "m06",
    text: "The morning does not need a sprint.",
    tone: "observational",
    theme: "activation",
    intensity: 1,
  },
  {
    id: "m07",
    text: "You do not need the whole week this morning.",
    tone: "observational",
    theme: "scope_creep",
    intensity: 1,
  },
  {
    id: "m08",
    text: "One thing at a time.",
    tone: "grounding",
    theme: "pacing",
    intensity: 1,
  },
  {
    id: "m09",
    text: "Today only.",
    tone: "grounding",
    theme: "scope_creep",
    intensity: 1,
  },
  {
    id: "m10",
    text: "The list can wait a few minutes.",
    tone: "grounding",
    theme: "focus",
    intensity: 1,
  },
  {
    id: "m11",
    text: "Waking up is not the same as rushing.",
    tone: "observational",
    theme: "activation",
    intensity: 1,
  },
  {
    id: "m12",
    text: "The day has not asked for much yet.",
    tone: "observational",
    theme: "anticipatory_stress",
    intensity: 1,
  },
  {
    id: "m13",
    text: "Smaller is enough for now.",
    tone: "grounding",
    theme: "reframe",
    intensity: 1,
  },
  {
    id: "m14",
    text: "This can be smaller.",
    tone: "grounding",
    theme: "perspective_reset",
    intensity: 1,
    behaviorLayer: "perspective_reset",
  },
  {
    id: "m15",
    text: "The loudest thing can wait.",
    tone: "observational",
    theme: "reframe",
    intensity: 1,
  },
  {
    id: "m16",
    text: "Begin with the next step only.",
    tone: "directive",
    theme: "agency",
    intensity: 1,
  },
];

const EVENING: readonly SignalLine[] = [
  {
    id: "e01",
    text: "The workday is over.",
    tone: "observational",
    theme: "closure",
    intensity: 1,
  },
  {
    id: "e02",
    text: "Enough for tonight.",
    tone: "grounding",
    theme: "closure",
    intensity: 1,
  },
  {
    id: "e03",
    text: "Tomorrow can wait until tomorrow.",
    tone: "observational",
    theme: "anticipation",
    intensity: 1,
  },
  {
    id: "e04",
    text: "Some things can stay unfinished.",
    tone: "grounding",
    theme: "closure",
    intensity: 1,
  },
  {
    id: "e05",
    text: "This can wait until morning.",
    tone: "observational",
    theme: "carryover",
    intensity: 1,
  },
  {
    id: "e06",
    text: "Nothing needs to be solved right now.",
    tone: "grounding",
    theme: "cognitive_dead_end",
    intensity: 1,
  },
  {
    id: "e08",
    text: "The next thing will still be there tomorrow.",
    tone: "observational",
    theme: "anticipation",
    intensity: 1,
  },
  {
    id: "e09",
    text: "Nothing needs fixing tonight.",
    tone: "observational",
    theme: "mode_shift",
    intensity: 1,
  },
  {
    id: "e10",
    text: "The email is tomorrow.",
    tone: "observational",
    theme: "anticipation",
    intensity: 1,
  },
  {
    id: "e11",
    text: "The screen can wait.",
    tone: "grounding",
    theme: "screen_break",
    intensity: 1,
  },
  {
    id: "e12",
    text: "This can be smaller than it feels.",
    tone: "grounding",
    theme: "perspective_reset",
    intensity: 1,
    behaviorLayer: "perspective_reset",
  },
  {
    id: "e13",
    text: "You can stop here.",
    tone: "grounding",
    theme: "closure",
    intensity: 1,
  },
  {
    id: "e15",
    text: "Look at something far away for a second.",
    tone: "directive",
    theme: "attention_shift",
    intensity: 1,
    behaviorLayer: "attention_shift",
  },
  {
    id: "e16",
    text: "Notice one thing that is already still.",
    tone: "directive",
    theme: "attention_shift",
    intensity: 1,
    behaviorLayer: "attention_shift",
  },
  {
    id: "e17",
    text: "The meeting is over.",
    tone: "observational",
    theme: "closure",
    intensity: 1,
  },
];

const SUNDAY: readonly SignalLine[] = [
  {
    id: "s01",
    text: "Monday is not here yet.",
    tone: "observational",
    theme: "anticipatory_anxiety",
    intensity: 1,
  },
  {
    id: "s02",
    text: "It is still Sunday.",
    tone: "observational",
    theme: "presence",
    intensity: 1,
  },
  {
    id: "s03",
    text: "The week has not started.",
    tone: "observational",
    theme: "anticipatory_anxiety",
    intensity: 1,
  },
  {
    id: "s04",
    text: "Tomorrow is not happening yet.",
    tone: "observational",
    theme: "time_travel",
    intensity: 1,
  },
  {
    id: "s05",
    text: "Sunday night is not an emergency.",
    tone: "grounding",
    theme: "urgency_illusion",
    intensity: 1,
  },
  {
    id: "s06",
    text: "Monday can wait until Monday.",
    tone: "observational",
    theme: "anticipatory_anxiety",
    intensity: 1,
  },
  {
    id: "s07",
    text: "The week has not touched you yet.",
    tone: "grounding",
    theme: "presence",
    intensity: 1,
  },
  {
    id: "s08",
    text: "Nothing needs to be decided tonight.",
    tone: "grounding",
    theme: "boundaries",
    intensity: 1,
  },
  {
    id: "s09",
    text: "Tomorrow will still be there in the morning.",
    tone: "observational",
    theme: "rumination",
    intensity: 1,
  },
  {
    id: "s10",
    text: "The week starts tomorrow, not tonight.",
    tone: "grounding",
    theme: "closure",
    intensity: 1,
  },
  {
    id: "s11",
    text: "The calendar can wait until morning.",
    tone: "observational",
    theme: "calendar_stress",
    intensity: 1,
  },
  {
    id: "s12",
    text: "This can be smaller.",
    tone: "grounding",
    theme: "perspective_reset",
    intensity: 1,
    behaviorLayer: "perspective_reset",
  },
];

const LATE_NIGHT: readonly SignalLine[] = [
  {
    id: "l01",
    text: "Enough for tonight.",
    tone: "grounding",
    theme: "closure",
    intensity: 1,
  },
  {
    id: "l02",
    text: "Nothing is asking for your attention right now.",
    tone: "observational",
    theme: "environment",
    intensity: 1,
    behaviorLayer: "environmental_anchor",
  },
  {
    id: "l03",
    text: "Tomorrow can wait until tomorrow.",
    tone: "observational",
    theme: "anticipation",
    intensity: 1,
  },
  {
    id: "l04",
    text: "Nothing needs to be solved right now.",
    tone: "grounding",
    theme: "cognitive_dead_end",
    intensity: 1,
  },
  {
    id: "l05",
    text: "The next scroll will still be there.",
    tone: "observational",
    theme: "screen_break",
    intensity: 1,
  },
  {
    id: "l06",
    text: "This can be smaller.",
    tone: "grounding",
    theme: "perspective_reset",
    intensity: 1,
    behaviorLayer: "perspective_reset",
  },
  {
    id: "l07",
    text: "The day is done.",
    tone: "observational",
    theme: "closure",
    intensity: 1,
  },
  {
    id: "l08",
    text: "The screen can wait.",
    tone: "grounding",
    theme: "screen_break",
    intensity: 1,
  },
  {
    id: "l09",
    text: "Most people are asleep.",
    tone: "observational",
    theme: "environment",
    intensity: 1,
    behaviorLayer: "environmental_anchor",
  },
  {
    id: "l10",
    text: "Nobody is waiting on this right now.",
    tone: "observational",
    theme: "closure",
    intensity: 1,
  },
  {
    id: "l11",
    text: "The feed can wait.",
    tone: "grounding",
    theme: "screen_break",
    intensity: 1,
  },
  {
    id: "l12",
    text: "You can stop here.",
    tone: "grounding",
    theme: "closure",
    intensity: 1,
  },
  {
    id: "l13",
    text: "The house is quiet.",
    tone: "grounding",
    theme: "environment",
    intensity: 1,
    behaviorLayer: "environmental_anchor",
  },
  {
    id: "l14",
    text: "The day ended.",
    tone: "observational",
    theme: "environment",
    intensity: 1,
    behaviorLayer: "environmental_anchor",
  },
  {
    id: "l15",
    text: "Nothing is happening right now.",
    tone: "grounding",
    theme: "environment",
    intensity: 1,
    behaviorLayer: "environmental_anchor",
  },
  {
    id: "l16",
    text: "Look at the farthest thing you can see.",
    tone: "directive",
    theme: "attention_shift",
    intensity: 1,
    behaviorLayer: "attention_shift",
  },
  {
    id: "l17",
    text: "Find something in the room that is not glowing.",
    tone: "directive",
    theme: "attention_shift",
    intensity: 1,
    behaviorLayer: "attention_shift",
  },
  {
    id: "l18",
    text: "Listen for the quietest sound you can hear.",
    tone: "directive",
    theme: "attention_shift",
    intensity: 1,
    behaviorLayer: "attention_shift",
  },
  {
    id: "l19",
    text: "Look away from the screen for five seconds.",
    tone: "directive",
    theme: "attention_shift",
    intensity: 1,
    behaviorLayer: "attention_shift",
  },
  {
    id: "l20",
    text: "Notice where your feet are.",
    tone: "directive",
    theme: "attention_shift",
    intensity: 1,
    behaviorLayer: "attention_shift",
  },
  {
    id: "l21",
    text: "Feel your weight in the chair.",
    tone: "directive",
    theme: "attention_shift",
    intensity: 1,
    behaviorLayer: "attention_shift",
  },
  {
    id: "l22",
    text: "Look at the edge of the room.",
    tone: "directive",
    theme: "attention_shift",
    intensity: 1,
    behaviorLayer: "attention_shift",
  },
  {
    id: "l23",
    text: "Listen before you scroll again.",
    tone: "directive",
    theme: "attention_shift",
    intensity: 1,
    behaviorLayer: "attention_shift",
  },
  {
    id: "l24",
    text: "Find one ordinary thing and look at it.",
    tone: "directive",
    theme: "attention_shift",
    intensity: 1,
    behaviorLayer: "attention_shift",
  },
  {
    id: "l25",
    text: "Blink slowly.",
    tone: "directive",
    theme: "attention_shift",
    intensity: 1,
    behaviorLayer: "attention_shift",
  },
  {
    id: "l26",
    text: "Notice the temperature of the room.",
    tone: "directive",
    theme: "attention_shift",
    intensity: 1,
    behaviorLayer: "attention_shift",
  },
  {
    id: "l27",
    text: "You are sitting down.",
    tone: "grounding",
    theme: "environment",
    intensity: 1,
    behaviorLayer: "environmental_anchor",
  },
  {
    id: "l29",
    text: "Morning is not here yet.",
    tone: "observational",
    theme: "anticipation",
    intensity: 1,
    behaviorLayer: "environmental_anchor",
  },
];

/** Rare present-moment lines — selected only by `selectSignalLine` rules (not a schedule slot). */
const RESET: readonly SignalLine[] = [
  {
    id: "r01",
    text: "The room is quiet.",
    tone: "grounding",
    theme: "environment",
    intensity: 1,
    behaviorLayer: "environmental_anchor",
  },
  {
    id: "r02",
    text: "There is weather outside this screen.",
    tone: "grounding",
    theme: "environment",
    intensity: 1,
    behaviorLayer: "environmental_anchor",
  },
  {
    id: "r03",
    text: "The floor is still there.",
    tone: "grounding",
    theme: "physical_grounding",
    intensity: 1,
    behaviorLayer: "reality_anchor",
  },
  {
    id: "r04",
    text: "Look farther away than this screen.",
    tone: "directive",
    theme: "screen_break",
    intensity: 1,
    behaviorLayer: "attention_shift",
  },
  {
    id: "r05",
    text: "Put both feet on the floor for a second.",
    tone: "directive",
    theme: "physical_grounding",
    intensity: 1,
    behaviorLayer: "attention_shift",
  },
  {
    id: "r07",
    text: "Nobody needs anything from you this minute.",
    tone: "grounding",
    theme: "closure",
    intensity: 1,
    behaviorLayer: "reality_anchor",
  },
  {
    id: "r08",
    text: "You have enough for tonight.",
    tone: "grounding",
    theme: "closure",
    intensity: 1,
    behaviorLayer: "reality_anchor",
  },
];

export const SIGNAL_BANKS: Record<SignalKind, readonly SignalLine[]> = {
  morning: MORNING,
  evening: EVENING,
  sunday: SUNDAY,
  lateNight: LATE_NIGHT,
  reset: RESET,
};

/** One-line frames for Home (separate from anchors). */
export const DAILY_FOCUS_LINES: readonly string[] = [
  "Most things can wait.",
  "Tomorrow can wait until tomorrow.",
  "Enough for tonight.",
  "The screen can wait.",
  "This can be smaller.",
  "Monday is not here yet.",
];

export function pickDailyFocusLine(last?: string): string {
  const pool = [...DAILY_FOCUS_LINES];
  let choice = pool[Math.floor(Math.random() * pool.length)];
  if (last && choice === last && pool.length > 1) {
    choice = pool.filter((l) => l !== last)[0] ?? choice;
  }
  return choice;
}
