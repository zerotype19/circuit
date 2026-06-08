# Circuit — all messaging statements and when they fire

Generated from `src/data/signalBanks.ts` and scheduling/selection code. **78 signal lines** plus **6 Home focus lines** and a few fixed UI strings.

**Source of truth:** the TypeScript repo wins if this file drifts.

---

## 1. Where user-facing text appears

| Channel | What the user sees | When it fires |
|---------|-------------------|---------------|
| **OS notification** | Title: `Circuit`. Body: one `SignalLine.text` (chosen at schedule time). | At anchor wall time ± jitter (see §2). |
| **In-app interrupt overlay** | Same line + optional feedback (`Did this help?`). | On signal notification receive/tap unless suppressed (§5). |
| **Home screen** | One random `DAILY_FOCUS_LINES` string. | On Home mount; not a notification. |
| **Settings test** | Immediate notification + overlay for chosen slot. | Manual only. |
| **Fallback** | `Pause.` | Rare engine exhaust. |

Lines are **baked at schedule time** (`scheduleSignalAnchors`), not re-rolled at fire time.

---

## 2. Wall-clock schedule (device local)

| Slot | Base time | Jitter ± |
|------|-----------|----------|
| `morning` | **08:15** daily | 5 min |
| `evening` | **20:15** daily | 7 min |
| `sunday` | **19:30** Sundays only | 10 min |
| `lateNight` | **23:00** daily | 20 min |

Late night stays **≥ 90 min** after evening on the same cycle.

---

## 3. Banks

| `kind` | Lines |
|----------|------:|
| `morning` | 16 |
| `evening` | 15 |
| `sunday` | 12 |
| `lateNight` | 28 |
| `reset` (inject only) | 7 |

**Reset injection:** evening / late night only, ~11% when recent deliveries share a heavy loop micro-state. OS `kind` stays the anchor slot.

**Selection:** `selectSignalLine` in `signalEngine.ts` — weekday theme scoring, repeat bans, variety guards, weighted pick among top scores, local feedback nudges.

---

## 4. Home focus lines

1. Most things can wait.
2. Tomorrow can wait until tomorrow.
3. Enough for tonight.
4. The screen can wait.
5. This can be smaller.
6. Monday is not here yet.

---

## 5. Full library


### Morning (`morning`) — daily 08:15

| id | text | theme | layer | tone |
|----|------|-------|-------|------|
| m01 | Most things can wait. | urgency_illusion | mirror | observational |
| m02 | The day has barely started. | anticipatory_stress | mirror | observational |
| m03 | Start with one thing, not the whole day. | pacing | mirror | grounding |
| m04 | Not everything urgent is important. | urgency_illusion | mirror | observational |
| m05 | Keep the first hour small. | pacing | mirror | grounding |
| m06 | The morning does not need a sprint. | activation | mirror | observational |
| m07 | You do not need the whole week this morning. | scope_creep | mirror | observational |
| m08 | One thing at a time. | pacing | mirror | grounding |
| m09 | Today only. | scope_creep | mirror | grounding |
| m10 | The list can wait a few minutes. | focus | mirror | grounding |
| m11 | Waking up is not the same as rushing. | activation | mirror | observational |
| m12 | The day has not asked for much yet. | anticipatory_stress | mirror | observational |
| m13 | Smaller is enough for now. | reframe | mirror | grounding |
| m14 | This can be smaller. | perspective_reset | perspective_reset | grounding |
| m15 | The loudest thing can wait. | reframe | mirror | observational |
| m16 | Begin with the next step only. | agency | mirror | directive |

### Evening (`evening`) — daily 20:15

| id | text | theme | layer | tone |
|----|------|-------|-------|------|
| e01 | The workday is over. | closure | mirror | observational |
| e02 | Enough for tonight. | closure | mirror | grounding |
| e03 | Tomorrow can wait until tomorrow. | anticipation | mirror | observational |
| e04 | Some things can stay unfinished. | closure | mirror | grounding |
| e05 | This can wait until morning. | carryover | mirror | observational |
| e06 | Nothing needs to be solved right now. | cognitive_dead_end | mirror | grounding |
| e08 | The next thing will still be there tomorrow. | anticipation | mirror | observational |
| e09 | Nothing needs fixing tonight. | mode_shift | mirror | observational |
| e10 | The email is tomorrow. | anticipation | mirror | observational |
| e11 | The screen can wait. | screen_break | mirror | grounding |
| e12 | This can be smaller than it feels. | perspective_reset | perspective_reset | grounding |
| e13 | You can stop here. | closure | mirror | grounding |
| e15 | Look at something far away for a second. | attention_shift | attention_shift | directive |
| e16 | Notice one thing that is already still. | attention_shift | attention_shift | directive |
| e17 | The meeting is over. | closure | mirror | observational |

### Sunday (`sunday`) — weekly Sunday 19:30

| id | text | theme | layer | tone |
|----|------|-------|-------|------|
| s01 | Monday is not here yet. | anticipatory_anxiety | mirror | observational |
| s02 | It is still Sunday. | presence | mirror | observational |
| s03 | The week has not started. | anticipatory_anxiety | mirror | observational |
| s04 | Tomorrow is not happening yet. | time_travel | mirror | observational |
| s05 | Sunday night is not an emergency. | urgency_illusion | mirror | grounding |
| s06 | Monday can wait until Monday. | anticipatory_anxiety | mirror | observational |
| s07 | The week has not touched you yet. | presence | mirror | grounding |
| s08 | Nothing needs to be decided tonight. | boundaries | mirror | grounding |
| s09 | Tomorrow will still be there in the morning. | rumination | mirror | observational |
| s10 | The week starts tomorrow, not tonight. | closure | mirror | grounding |
| s11 | The calendar can wait until morning. | calendar_stress | mirror | observational |
| s12 | This can be smaller. | perspective_reset | perspective_reset | grounding |

### Late night (`lateNight`) — daily 23:00

| id | text | theme | layer | tone |
|----|------|-------|-------|------|
| l01 | Enough for tonight. | closure | mirror | grounding |
| l02 | Nothing is asking for your attention right now. | environment | environmental_anchor | observational |
| l03 | Tomorrow can wait until tomorrow. | anticipation | mirror | observational |
| l04 | Nothing needs to be solved right now. | cognitive_dead_end | mirror | grounding |
| l05 | The next scroll will still be there. | screen_break | mirror | observational |
| l06 | This can be smaller. | perspective_reset | perspective_reset | grounding |
| l07 | The day is done. | closure | mirror | observational |
| l08 | The screen can wait. | screen_break | mirror | grounding |
| l09 | Most people are asleep. | environment | environmental_anchor | observational |
| l10 | Nobody is waiting on this right now. | closure | mirror | observational |
| l11 | The feed can wait. | screen_break | mirror | grounding |
| l12 | You can stop here. | closure | mirror | grounding |
| l13 | The house is quiet. | environment | environmental_anchor | grounding |
| l14 | The day ended. | environment | environmental_anchor | observational |
| l15 | Nothing is happening right now. | environment | environmental_anchor | grounding |
| l16 | Look at the farthest thing you can see. | attention_shift | attention_shift | directive |
| l17 | Find something in the room that is not glowing. | attention_shift | attention_shift | directive |
| l18 | Listen for the quietest sound you can hear. | attention_shift | attention_shift | directive |
| l19 | Look away from the screen for five seconds. | attention_shift | attention_shift | directive |
| l20 | Notice where your feet are. | attention_shift | attention_shift | directive |
| l21 | Feel your weight in the chair. | attention_shift | attention_shift | directive |
| l22 | Look at the edge of the room. | attention_shift | attention_shift | directive |
| l23 | Listen before you scroll again. | attention_shift | attention_shift | directive |
| l24 | Find one ordinary thing and look at it. | attention_shift | attention_shift | directive |
| l25 | Blink slowly. | attention_shift | attention_shift | directive |
| l26 | Notice the temperature of the room. | attention_shift | attention_shift | directive |
| l27 | You are sitting down. | environment | environmental_anchor | grounding |
| l29 | Morning is not here yet. | anticipation | environmental_anchor | observational |

### Reset (`reset`) — synthetic; not a schedule slot

| id | text | theme | layer | tone |
|----|------|-------|-------|------|
| r01 | The room is quiet. | environment | environmental_anchor | grounding |
| r02 | There is weather outside this screen. | environment | environmental_anchor | grounding |
| r03 | The floor is still there. | physical_grounding | reality_anchor | grounding |
| r04 | Look farther away than this screen. | screen_break | attention_shift | directive |
| r05 | Put both feet on the floor for a second. | physical_grounding | attention_shift | directive |
| r07 | Nobody needs anything from you this minute. | closure | reality_anchor | grounding |
| r08 | You have enough for tonight. | closure | reality_anchor | grounding |

---

*Run `node scripts/gen-messaging-doc.js` to regenerate.*
