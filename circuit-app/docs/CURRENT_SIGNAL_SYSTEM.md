# Circuit — current signal schedule, dayparts, and full copy library

This document describes **everything implemented in code today** for psychological anchors: wall-clock schedule, selection logic (including day-of-week), all `SignalLine` records, Home “focus” lines, notifications behavior, persistence, haptics, silence rules, and QA helpers.

**Source of truth:** TypeScript under `circuit-app/src/` (and `app.json` / `plugins/` where noted). If this file drifts from the repo, the repo wins.

---

## 1. Product model (implemented)

- **Four scheduled anchors** (`AnchorSlotKind`): `morning`, `evening`, `sunday`, `lateNight`. These drive wall-clock notifications, haptics, and `signalHistory.slot`.
- **Synthetic bank key** `reset` exists on `SignalKind` for `SIGNAL_BANKS.reset` only — **not** a schedule slot, never in notification payload `kind`.
- **Local-only:** AsyncStorage persistence, local notification scheduling, **no** backend, **no** analytics, **no** account, **no** app monitoring / surveillance.
- **Copy:** Curated `SignalLine` banks with `id`, `text`, `tone`, `theme`, `intensity`, optional `microStates` (see `THEME_MICRO_DEFAULTS` + `microStatesForLine()` in `signalBanks.ts`).
- **Selection:** Deterministic **scoring** from (a) **calendar context** of the *next* anchor fire, (b) **tone mode**, (c) **local delivery history** — not uniform random.
- **Settings tone mode (stored):** `direct` | `brutal` (UI labels: **Steady** / **Edged**). Edged restricts the pool to lines with `intensity >= 2` **or** `tone === "directive"`.

---

## 2. Notification copy shape (implemented)

**File:** `src/data/signalBanks.ts` (header comment documents intent).

- **Single-line bodies:** All `SignalLine.text` values are **one line** (no embedded `\n\n`). iOS notification **banners/popups** often show only the first line when the body contains newlines; the list/notification center may still show more, so copy is authored as a **single string** per signal.
- **Two beats in one line (most lines):** Still mirror → release, usually as two sentences joined after a period (e.g. `First beat. Second beat.`).
- **Cadence mix:** Some lines are a **single** short beat so every signal does not feel identical.
- **Late night:** Deliberately shorter, simpler clauses than other dayparts.
- **`theme`:** Internal-only for `selectSignalLine` scoring; **never** shown in UI. User-facing text avoids clinical / framework jargon.
- **Length:** Current bank lines are kept **compact** (well under ~120 characters per body; many shorter) so wrapping stays controlled on narrow phones.

---

## 3. Wall-clock schedule (device local timezone)

Defined in `src/logic/signalSchedule.ts` as `SIGNAL_SLOTS`:

| Slot `id`   | `kind`     | Schedule   | Wall time (base) | Notes |
|------------|------------|------------|------------------|--------|
| `morning`  | `morning`  | **daily**  | **08:15**        | Every calendar day |
| `evening`  | `evening`  | **daily**  | **20:15**        | Every calendar day |
| `sunday`   | `sunday`   | **weekly** | **19:30**        | Expo `weekday: 1` = **Sunday** only |
| `lateNight`| `lateNight`| **daily**  | **23:00**        | Every calendar day |

**Next fire helpers**

- `nextFireDateForSlot(slot, from)` — next occurrence of one slot after `from`.
- `nextSignalAfter(from)` — earliest among all slots after `from` (used for Home “next signal” preview and dev preview).
- `dayModeLabel()` — `"Weekend"` if JS `getDay()` is 0 or 6 (Sun/Sat), else `"Workday"` (Home UI only).

**Expo trigger note:** Daily/weekly triggers use the **jittered** hour/minute computed in `src/services/notifications.ts` at schedule time (see §6).

---

## 4. Day-of-week and “daypart” — how it maps to selection

**Important:** There is **one primary bank per anchor `kind`** (expanded pools: universal-load lines plus **perspective / re-entry** lines `p01`–`p24`; counts vary by slot). Day-of-week does **not** swap banks; it changes **which `theme` values are preferred** when scoring candidates for the upcoming fire. A separate **`reset`** bank (20 lines) is used only when `selectSignalLine` chooses a rare environmental / body tether (see §5); the OS payload `kind` is still the anchor slot.

JavaScript weekday: **`getDay()` → 0 = Sunday … 6 = Saturday.**

### 4.1 `sunday` slot (`kind === "sunday"`)

Fires only on **Sunday** at the weekly time. Preferred themes (always this list for this kind):

`anticipatory_anxiety`, `time_travel`, `anticipation`, `boundaries`, `comparison`, `premature_activation`, `cognitive`, `meta`, `control`, `presence`, `separation`, `cost`, `calendar_stress`, `urgency_illusion`

**Avoid:** theme `somatic` (never preferred for Sunday slot selection).

### 4.2 `morning` — preferred themes by JS weekday

| JS day | Day        | Preferred themes |
|--------|------------|------------------|
| 0 | Sunday     | `presence`, `pacing`, `sensory`, `overload`, `somatic`, `perfectionism` |
| 1 | Monday     | `anticipatory_stress`, `urgency_illusion`, `activation`, `time_travel`, `focus`, `anticipation`, `device_habit`, `reactivity` |
| 2 | Tuesday    | `calendar_stress`, `agency`, `control`, `overload`, `scope_creep`, `permission` |
| 3 | Wednesday  | `nervous_system`, `sensory`, `overload`, `activation`, `somatic` |
| 4 | Thursday   | `anticipation`, `worth`, `overload`, `comparison`, `time_travel` |
| 5 | Friday     | `pacing`, `sensory`, `comparison`, `activation`, `overload` |
| 6 | Saturday   | `comparison`, `sensory`, `pacing`, `overload`, `passive_drift` |

### 4.3 `evening` — preferred themes by JS weekday

| JS day | Day        | Preferred themes |
|--------|------------|------------------|
| 0 | Sunday     | `anticipation`, `separation`, `closure`, `carryover`, `rumination`, `time_travel`, `fatigue` |
| 1 | Monday     | `carryover`, `closure`, `rumination`, `replay`, `body`, `fatigue` |
| 2 | Tuesday    | `rumination`, `closure`, `replay`, `carryover`, `cognitive_dead_end`, `fatigue` |
| 3 | Wednesday  | `rumination`, `closure`, `recovery`, `overload`, `body`, `performance` |
| 4 | Thursday   | `rumination`, `anticipation`, `worth`, `closure`, `release`, `performance` |
| 5 | Friday     | `permission`, `recovery`, `mode_shift`, `worth`, `release`, `fatigue` |
| 6 | Saturday   | `comparison`, `recovery`, `worth`, `passive_drift`, `closure`, `performance` |

### 4.4 `lateNight` — preferred themes by JS weekday

| JS day | Day        | Preferred themes |
|--------|------------|------------------|
| 0 | Sunday     | `revenge_bedtime`, `doomscroll`, `time_travel`, `loneliness`, `somatic`, `algorithmic_pull`, `emotional_avoidance` |
| 1 | Monday     | `revenge_bedtime`, `doomscroll`, `device_boundary`, `fatigue_mismatch`, `future_self`, `algorithmic_pull` |
| 2 | Tuesday    | `revenge_bedtime`, `doomscroll`, `device_boundary`, `cognitive_dead_end`, `emotional_avoidance` |
| 3 | Wednesday  | `revenge_bedtime`, `doomscroll`, `fatigue_mismatch`, `somatic`, `algorithmic_pull` |
| 4 | Thursday   | `revenge_bedtime`, `doomscroll`, `tradeoff`, `consequence`, `emotional_avoidance` |
| 5 | Friday     | `revenge_bedtime`, `doomscroll`, `passive_drift`, `comparison`, `algorithmic_pull` |
| 6 | Saturday   | `revenge_bedtime`, `doomscroll`, `comparison`, `passive_drift`, `loneliness`, `emotional_avoidance` |

---

## 5. Selection engine (`selectSignalLine`) — rules implemented

**File:** `src/logic/signalEngine.ts`

**Inputs:** `kind` is an **`AnchorSlotKind`** (scheduled slot only). `toneMode` (`direct` | `brutal`), `fireContext` (**Date** of the anchor being scheduled / fired — drives weekday), `history` (`SignalDeliveryRecord[]`), optional `lastMessageText`, optional **`feedbackRecords`** (local `SignalFeedbackRecord[]` for light scoring nudges).

**0. Rare `reset` bank injection (evening / late night only)**  
Before building the anchor pool, the engine may **replace** this pick with a line from `SIGNAL_BANKS.reset` (`r01`–`r20`) when **all** hold:

- `kind` is `evening` or `lateNight`.
- The newest delivery is **not** already a reset line (`lineId` is `r01`–`r20`).
- **No** reset line in the last **~82 minutes** of history.
- The **last 2–3** resolved deliveries (when history allows) **all** share at least one heavy micro-state from: **`doomscroll`**, **`rumination`**, **`anticipatory_anxiety`**, **`hypervigilance`**, **`stimulation_overload`** (same state present on each of those deliveries — stricter than “any mix”).
- A random roll succeeds (base **~11%**, slightly higher when the shared state is **`doomscroll`**, modestly higher for **`rumination`** / **`anticipatory_anxiety`**).

When chosen, scoring uses synthetic `kind === "reset"` preferred themes (environment / body / screen / overload family). **Micro-streak avoidance is skipped** for this pick so reset-tagged lines can still fire after a matching streak. **Rhythm variety** still applies. If the reset pool yields no candidate, the normal anchor path runs.

**`behaviorLayer` (internal, optional on each `SignalLine`):** `mirror` (default), `interrupt`, `reality_anchor`, `perspective_reset`. All **`reset`** lines use **`reality_anchor`**. Catalog **`p01`–`p24`** use **`perspective_reset`** (stakes / absorbed stress), **`reality_anchor`** (room / body re-entry), or **`interrupt`** (tiny non-performative disengagement). When the same heavy micro pattern persists across recent deliveries, **`perspective_reset`** / **`reality_anchor`** / **`interrupt`** lines get a **small extra score boost** so selection shifts toward exit loops, not only mirroring.

**Mirror + doomscroll guard:** If the **last three** deliveries were all **`behaviorLayer: mirror`** and all carried **`doomscroll`** in resolved micro-states, the anchor pool **prefers non-`mirror`** lines when any exist (avoids endless validation-only streaks in that state).

**Steps (anchor path — same structure when scoring `reset` pool):**

1. **Pool by tone mode**  
   - `direct`: all lines in the bank for `kind`.  
   - `brutal`: only lines with `intensity >= 2` **or** `tone === "directive"` (fallback to full bank if empty).

2. **14-day line repeat guard**  
   Exclude any line whose `lineId` appears in `history` with `at >= now - 14 days`.

3. **Theme fatigue**  
   From the 6 most recent deliveries (any slot), take the **last 3** resolved themes; exclude candidates whose `theme` is in that set (unless that would empty the pool — then relax).

4. **Directive streak**  
   If the **last two** deliveries (by time) were both `directive`, prefer non-`directive` lines if any remain.

5. **Micro-state streak avoidance (anchor path only)**  
   If the last two deliveries **share** any of `doomscroll`, `screen_trance`, `rumination`, `time_travel`, `revenge_bedtime`, `digital_trance`, drop candidates that still include that shared state (unless that empties the pool).

6. **Rhythm variety**  
   If the last two bodies were both **medium** length (trimmed character buckets), prefer non-medium when possible.

7. **Score** each candidate:  
   - `+4` if `theme` is in **preferred** list for `(jsDay, kind)` — for the reset pool, `kind` is treated as `"reset"` and all reset themes are preferred.  
   - `-6` if `theme` is in **avoid** list (Sunday anchor: `somatic`).  
   - Tone mode tweaks: `direct` → small bonus for `grounding`/`observational`, small penalty for `directive`; `brutal` → small bonus for `directive` or `intensity >= 2`.  
   - **`feedbackScoreAdjustment(line, feedbackRecords)`** — small local nudge from recent **`SignalFeedbackRecord`** rows (see §7.1); does not override hard guards (14-day repeat, reset cooldown, etc.).  
   - **Exit-loop boost:** when recent deliveries share a heavy micro pattern (see §5.0), extra score for non-mirror **`behaviorLayer`** lines (`perspective_reset`, `reality_anchor`, `interrupt`).  
   - Tiny tie-break from last char of `id`.

8. **Pick** via **weighted random** among candidates within **1.25** points of the top score (higher scores more likely, not uniform).  
9. **Opener / layer variety:** if the last two deliveries share the same sentence opener bucket (e.g. “Your body…”) or same **`behaviorLayer`**, prefer candidates that differ when possible.  
10. **Per-slot repeat:** same `lineId` on the same anchor slot blocked for **7 days** (in addition to global **14-day** `lineId` guard).  
11. If `lastMessageText` equals chosen `text` and alternatives exist, re-pick weighted among the rest.

**Scheduling batch:** `scheduleSignalAnchors` builds all four slot plans in one pass using a **scratch** copy of `signalHistory`, appending each planned pick before the next slot — so the same reschedule does not pick four thematically identical lines.

12. **Fallback** if no candidates: `{ id: "fallback", text: "Pause.", tone: "grounding", theme: "reset", intensity: 1, microStates: ["fatigue"] }`.

---

## 6. Notifications — scheduling, jitter, silence, payload, iOS attachment

**File:** `src/services/notifications.ts`

- **Handler:** Sound on; banner + list on; badge off.
- **Android:** Channels `circuit-default` and `circuit-interrupt` (interrupt channel has custom vibration pattern).
- **Schedule flow:** Build a **plan per slot**, then schedule:
  1. `anchor = nextFireDateForSlot(slot, now)`, optionally advanced once if **test-signal skip** applies (below).
  2. **Jitter** minutes from `slotJitterMinutes(slotId, kind, anchor)`; apply to wall clock `{ hour, minute }` for the Expo trigger.
  3. **Evening / late-night spacing:** After all slots are jittered, if **late-night** is **less than 90 minutes** after **evening** on the same repeating day pattern, **late-night** clock time is pushed later to enforce a **90-minute minimum** gap (capped before midnight).
  4. `selectSignalLine({ kind, toneMode, fireContext: anchor, history, lastMessageText, feedbackRecords })` chooses copy for that plan.

- **Jitter key:** `slotId` + local `YYYY-MM-DD` of **anchor** date (deterministic hash `djb2`).
- **Jitter ranges:** morning **±5**, evening **±7**, sunday **±10**, lateNight **±20** minutes.

### 6.1 Silence / restraint rules (implemented)

| Rule | Behavior |
|------|-----------|
| **Test signal → skip next anchor** | `settings.lastTestSignalAt` is set when the user sends a **Settings test signal** (`sendTestSignalForKind`). On reschedule, for each slot, if the **next** anchor time is **within 30 minutes after** `lastTestSignalAt`, that slot’s anchor is advanced **one occurrence** (`nextFireDateForSlot(slot, anchorTime)`) before jitter/selection so the immediate next scheduled fire is skipped once. |
| **Recent app open → suppress in-app overlay** | On every `AppState` → `active`, `settings.lastAppBecameActiveAt` is updated. When a **scheduled** signal notification is **received** or opened (`addNotificationReceivedListener` / `addNotificationResponseReceivedListener`), if `Date.now() - lastAppBecameActiveAt <= 20 minutes`, **`presentSignal` is not called** — no full-screen overlay, no delivery log for that path. **OS banner/list/sound may still occur**; the app does not cancel the underlying scheduled notification at fire time. |
| **Evening vs late-night** | See schedule flow above (`enforceEveningLateNightGap`). |

- **`scheduleSignalAnchors` / `refreshAnchorsForShutdown` options** include `lastTestSignalAt?: number` (read from settings whenever anchors are rebuilt) and optional **`feedbackRecords`** (local feedback rows; same store as §7.1).

- **Content:** `title: "Circuit"`, `body: <selected line text>` (single-line copy from banks), `sound: true`, `data`: `{ circuit: "signal", kind, lineId }`.

- **iOS:** `interruptionLevel: "active"` on scheduled + immediate test notifications.
- **iOS attachment:** If `Image.resolveAssetSource(icon.png).uri` starts with `file:`, attach `assets/icon.png` as `UNNotificationAttachment` (`identifier: circuit-logo`, `type: public.png`, both `url` and `uri` for Expo). Skipped when URI is not `file:` (e.g. some Metro dev URLs).

**Parse helpers:** `parseSignalPayload`, `parseSignalKindFromData` — payload `kind` is **`AnchorSlotKind` only** (rejects unknown strings; `reset` never appears in notifications).

**Pause / shutdown:** `refreshAnchorsForShutdown` cancels all signal notifications when `shutdownUntil` **or** `pauseSignalsUntil` is in the future; otherwise reschedules with current tone, history, `lastTestSignalAt`, and **feedback** when provided.

---

## 7. Persistence & history

**File:** `src/types/index.ts`, `src/services/storage.ts`

- **Key:** `circuit.persisted.v2` (migrates from `v1` if present).
- **State:** `settings` includes `toneMode`, `notificationsEnabled`, `shutdownUntil?`, `pauseSignalsUntil?`, **`lastTestSignalAt?`**, **`lastAppBecameActiveAt?`**, plus `onboardingCompleted`, `logs`, `lastInterruptMessage?`, **`signalHistory`** (capped, last 200 entries).
- **`SignalDeliveryRecord`:** `{ id, at, slot, lineId }` — `slot` is always an **`AnchorSlotKind`** (the scheduled slot). A rare **`reset`** bank body still logs under the anchor slot (e.g. `lateNight`) with `lineId` `r01`…`r20`. **`id`** is a stable delivery key (UUID or fallback); legacy persisted rows without `id` normalize to `legacy-{slot}-{lineId}-{at}`. Appended when a signal is presented **with** a `lineId` (scheduled + test paths that pass id). Suppressed scheduled deliveries (recent-open rule) **do not** append.

**Pause windows** (`src/logic/pauseBoundaries.ts`):

- Until **next local 06:00** after now (“tonight”).
- **+24h** from now.
- **Next Monday 06:00** after now (“through weekend” style).

### 7.1 Signal feedback (local v1)

**Types** (`src/types/index.ts`): **`SignalFeedbackValue`** = `"helped"` | `"not_now"` | `"too_much"`. **`SignalFeedbackRecord`:** `{ deliveryId, lineId, slot, feedback, respondedAt }` plus optional **`reason`** (reserved union for future analytics — **no UI in v1**).

**Storage** (`src/services/signalFeedbackStorage.ts`): AsyncStorage key **`circuit.signalFeedback.v1`**, last **250** rows. Helpers: **`loadSignalFeedback`**, **`saveSignalFeedback`**, **`recordSignalFeedback`**, **`feedbackForDelivery`**, **`clearSignalFeedbackStorage`** (cleared on full local reset via `resetAllLocalData`). Same general pattern as persisted state (async, local-only, no sync).

**UI** (`InterruptOverlay` after the user lands from a notification / in-app interrupt): Below the line, a secondary row — **“Did this help?”** with text actions **Helped**, **Not now**, **Too much** (no thumbs/stars). On tap, **`recordSignalFeedback`** runs immediately; controls are replaced by **“Got it.”** The same delivery is not prompted again once answered. Feedback is optional; auto-dismiss stays longer (**20s**) while the question is shown, then **4s** once answered or when there is no delivery id. **No** feedback chrome on the native notification.

**Selection impact:** Conservative, local-only. **`feedbackScoreAdjustment`** in `signalEngine.ts` adjusts candidate scores; **`helped`** nudges theme / micro-states / reset-adjacent lines upward; **`not_now`** lightly down-weights the same `lineId` and theme for a short window; **`too_much`** softens directive / high-intensity / brutal pool pressure and, for reset lines, slightly lowers reset injection appetite. Hard rules (14-day repeat, reset timing gate, etc.) are unchanged. **`shouldInjectResetBank`** also reads feedback for light reset probability tweaks.

**Intentionally deferred:** Per-response **`reason`** capture in UI, cloud sync, analytics pipeline, stronger optimization loops.

---

## 8. In-app experience (implemented)

- **`CircuitContext`:** Hydration loads persisted state **and** `loadSignalFeedback()`, notification listeners (with **recent-open suppression** above), `presentSignal` (dedupe, respects shutdown + pause; assigns **`createSignalDeliveryId()`** per logged delivery for overlay feedback), `appendLog` + `appendSignalDelivery`, reschedules on foreground (`AppState` + `lastAppBecameActiveAt` update) with **`scheduleOpts()`** (includes **`feedbackRecords`**), tone change, onboarding, pause helpers, **`sendTestSignalForKind`** (sets `lastTestSignalAt`, presents real engine line + banner + overlay, then **refreshes anchors**), **`submitInterruptFeedback`**, exposes **`signalFeedback`** for dev preview parity.
- **`InterruptOverlay`** (`src/components/InterruptOverlay.tsx`), mounted from **`App.tsx`**: receives **`priorDeliveriesToday`** (same-calendar-day `signalHistory` count, **excluding** the delivery for the interrupt currently showing — so softening applies from the **fourth** same-day hit onward), **`interruptDeliveryId`**, **`interruptFeedback`**, **`onSubmitInterruptFeedback`** (§7.1).
  - **Haptic patterns per `kind`:** morning: Medium → 90ms → Medium; evening: Heavy → 220ms → Heavy; sunday: selection → 60ms → Heavy → 80ms → Heavy; **lateNight: Soft → 70ms → Soft always**.
  - **Haptic softening:** If `priorDeliveriesToday >= 3` **and** `kind !== "lateNight"`, each **impact** step is **one level lighter** (Heavy→Medium, Medium→Light). Late night is never escalated.
  - **Typography:** message `lineHeight: 34` for comfortable wrapping of single-line copy on the overlay.
  - **Feedback (v1):** Quiet “Did this help?” row with text choices; see §7.1 (not on the OS notification).

**Home (`HomeScreen`):** Next signal summary, `dayMode`, `pickDailyFocusLine()` (see §10), privacy line, Force Shutdown (15 min), Settings.

### 8.1 Settings — test signals (production)

**File:** `src/screens/SettingsScreen.tsx`

- Rows: **Test morning / evening / Sunday / late night signal**. Each opens a confirm alert: *“Uses the real signal engine, haptics, and overlay for this slot.”* On **Send**, calls `sendTestSignalForKind(kind)` (see `CircuitContext`).

### 8.2 Dev-only — next seven previews

- **`__DEV__`:** Settings row **“Next 7 signals preview (dev)”** navigates to `DevSignalPreviewScreen`.
- **`RootNavigator`:** `DevSignalPreview` stack screen is registered **only when `__DEV__`**.
- **`computeNextSevenSignalPreviews`** (`src/logic/nextSevenSignalPreview.ts`): walks the next seven anchor fires using **`nextSignalAfter`**, runs the real **`selectSignalLine`** each time (with optional **`feedbackRecords`** from context), and appends each pick to a **scratch** history with synthetic **`createSignalDeliveryId()`** ids so repetition / tone / feedback rules show in QA.

---


## 9. Signal banks (source of truth in `signalBanks.ts`)

**Do not duplicate full line tables here** — they go stale. Open `src/data/signalBanks.ts` for every `id`, `text`, `tone`, `theme`, `intensity`, and optional `microStates`.

| Bank | Role | Count |
|------|------|------:|
| `morning`, `evening`, `sunday`, `lateNight` | Scheduled anchor bodies | **50+** lines each (includes universal-load + perspective / re-entry ids) |
| `reset` | Synthetic — environmental / body tether (not a schedule slot) | **20** lines (`r01`–`r20`) |

- **`MicroState`:** Nervous-system / behavioral tags (never shown). Optional per-line `microStates`; else `microStatesForLine()` uses `THEME_MICRO_DEFAULTS` by `theme`.
- **Universal load copy:** Thirty additional lines across anchors: **`morning`** (`c03`–`c10`, `v02`, `v05`–`v07`, `v09`), **`evening`** (`c01`–`c06`, `v01`, `v03`–`v04`, `v08`, `v10`), **`lateNight`** (`h01`–`h10`) — caregiving / constant demand, mental load & invisible labor, sensory & fragmentation. New internal themes include **`caregiving_load`**, **`constant_response`**, **`invisible_labor`**, **`fragmentation`**, **`mental_load`**, **`sensory_overload`** (see `THEME_MICRO_DEFAULTS` + `preferredThemes` in `signalEngine.ts`).
- **Perspective / stakes / re-entry (`p01`–`p24`):** Morning (`p01`–`p08`), evening (`p09`–`p14`), late night (`p15`–`p24`) — scale correction, borrowed urgency / contagion, physical reality anchors, tiny **`interrupt`** disengagements. Themes include **`perspective_reset`**, **`stakes_distortion`**, **`borrowed_urgency`**, **`emotional_contagion`**, **`absorbed_stress`**, **`emotional_carryover`**, **`reality_anchor`**, **`physical_reentry`**, **`false_emergency`**, **`nervous_system_misperception`** (internal theme key only; visible copy avoids repeating “nervous system” phrasing), plus existing **`screen_break`** / **`stimulation_overload`**. New **`MicroState`** tags: **`absorbed_stress`**, **`stakes_distortion`**, **`ambient_urgency`**, **`digital_trance`**, **`emotional_carryover`** (used in defaults / routing; not shown in UI).
- **Pre-test interrupt batch (`q01`–`q10`):** **`evening`** — tiny embodied **`interrupt`**s plus rumination cutoffs and light social disengage; **`q11`–`q21`** on **`lateNight`** — room / weather / darkness / stillness / night pace (**`reality_anchor`**), plus one **`screen_break`** line framed as sensory load (`q20`), not productivity.
- **`environmental_anchor`:** explicit theme + **`behaviorLayer`** (`ea01`–`ea20` late night, `ea21`–`ea23` evening). Prefer **pure reality** (room, night, house) over lines that contrast anxiety (“not worried about tomorrow”). **`ELITE_LINE_IDS`** = manual seed set for early testing; late-night **`preferredThemes`** lists environment/permission before doomscroll; rumination-heavy themes get a small late-night score penalty.
- **Permission batch (`g01`–`g10`):** short “you can stop” lines on evening/late night (not reassurance essays).
- **Deduped (pre-test):** removed **`q19`** (duplicate of retired “room is quiet already” cluster); **`ea21`** → town-asleep; **`ea08` / `ea17` / `ea22`** retuned to avoid cross-bank repeats with **`q11` / `q18`**.
- **`attention_shift` (`as01`–`as16`):** directive look/listen/feel lines — **`lateNight`** `as01`–`as12`, **`evening`** `as13`–`as16`. Theme + **`behaviorLayer`** `attention_shift`. Heavy weight on **`evening` / `lateNight` / `sunday`**; streak guard after two consecutive `attention_shift` deliveries.
- **`mundane_reality` (`mr01`–`mr08`):** ordinary-room anchors on **`lateNight`** only (`behaviorLayer` **`environmental_anchor`**). Score boost below **`attention_shift`**, above doomscroll churn.
- **Deferred — `awe` theme:** tiny perspective-shift lines (moon, town asleep, stars not in a hurry). Do **not** bulk-add before feedback justifies it; a few seeds may ride on **`environmental_anchor`** until then.
- **Trimmed:** ~12 redundant “you’re thinking too much / tomorrow worry” lines (`m10`, `m28`, `e04`–`e05`, `e14`, `s02`–`s03`, `s17`–`s18`, `s23`, `s31`, `s33`, `s36`, `l29`).

---

## 10. Home “Today’s focus” lines (not slot-specific)

**File:** `src/data/signalBanks.ts` — `DAILY_FOCUS_LINES` (random on Home mount; avoids repeating previous line when possible).

1. Your body has been carrying a lot lately.  
2. Fast is not always necessary.  
3. You can leave things unfinished.  
4. Put down what you never chose to carry.  
5. You do not need another notification right now.  
6. You do not need to earn rest tonight.  

---

## 11. Native / branding (implemented, not copy)

- **`app.json`:** `expo.icon`, splash, Android adaptive icon, `expo.notification` + `expo-notifications` plugin (Android notification icon path), other config plugins (local notifications entitlements, Metro skip IP, device bundle URL, optional Family Controls, pods workaround, **iOS full App Icon catalog** plugin).
- **`assets/`:** `icon.png`, `adaptive-icon.png`, `splash-icon.png`, `favicon.png`, `notification-icon.png` (Android-style white-on-transparent), `scripts/gen-notification-icon.py` for regenerating Android small icon.
- **`plugins/with-ios-full-app-icon-catalog.js`:** After prebuild, regenerates `AppIcon.appiconset` from `assets/icon.png` (opaque RGB, multi-size), with **standard** `Contents.json` entries (**no** per-image `platform` field — avoids broken / wireframe icons on some iOS builds).

---

## 12. Explicitly **not** implemented (as of this doc)

### 12.1 Pre-broad-test QA focus (manual)

Before scaling users, deliberately watch for: **validation loops** (lines that over-reinforce “anxious identity” or feel addictive / “seen”-content); **habituation** (stop reading, predictable cadence, blur-together copy, weak interrupt force); **state mismatch** (heavy interrupt when calm, body-first line during relational stress, doomscroll routing during real work). The engine is a **state-transition** system, not a quote feed — trust failures will show up in mismatch more than in any single line.

**Testing lens:** strongest product moments aim at **attentional widening and interrupt mechanics**, not reassurance-as-content (widen attention, reduce compression/urgency, reconnect environment/body, weaken spirals, micro state shifts).

### 12.2 Copy library freeze (first cohort)

Treat `signalBanks.ts` as **frozen** for the first controlled test window: **no** bulk line adds, new emotional categories, or cleverness passes. **No more edits unless a specific `lineId` earns a reaction** (repeat **`too_much`**, wallpaper / “same kind of line again,” clear **`helped`** outlier worth promoting). Prefer learning from **timing, restraint, and selection** over new copy.

**Product shift (strategy):** library posture is **attention re-entry**, not stress commentary. Enough variety exists — **no more copy adds** this round; learn which **theme families** actually change state.

**Product trio (what a line should do):**

| Job | Layer / theme | Example posture |
|-----|----------------|-----------------|
| **Mirror** | mirror, rumination, cognitive | “you’re looping” |
| **Permit** | permission | “you can stop” |
| **Redirect** | **`attention_shift`** | “look / listen / feel something real” |

Plus **environmental_anchor** and **mundane_reality** for ordinary reality without coaching.

### 12.3 Outcome notes (internal, not dashboards yet)

During small-N tests, record what happened **after** a line (not “liked the text”): pause / disengagement / relief / annoyance / resistance / compulsive reread / dependence / trust. Watch especially for **“beautiful wallpaper syndrome”** — enjoyment, screenshots, agreement, but **no behavior change**.

### 12.4 Identity vs moment

Avoid reinforcing **trait identity** (“I am anxious / dysregulated / broken; this app gets me”). Prefer anchors to **moments**, **environment**, **temporary loops**, **attention** — copy that does not invite wearing the state as who someone is.

### 12.5 Late night as primary test surface

Prioritize signal on **`lateNight`**: doomscroll loops, room/stillness anchors, post-notification phone use, disengagement. Differentiation and harm/benefit both concentrate there — **focus overlay feedback here** (`helped` / `not_now` / `too_much` per `lineId`).

**During test — do not over-expand “awe”:** a few perspective-shift lines are enough (e.g. stars / town asleep / sky still there). More risks sounding poetic, not grounding.

**Habituation watch:** room / window / house / night clusters are acceptable for now; the signal is whether users feel **grounded** vs. “same kind of line again” (wallpaper), not raw duplicate text counts.

**Sunday (post-test only):** bank skews more cognitive (anticipatory anxiety may be correct). If data supports it, add **Sunday environmental anchors** — not more Monday/worry lines.

**Sunday + `attention_shift` (watch during test):** `attention_shift` is in Sunday **`preferredThemes`** for scoring. Sunday is more emotionally specific than late night — a directive like “Look at the farthest thing you can see” may feel **less precise** than “Monday is not here yet.” Track: **helpful vs. oddly generic.** If generic wins, **remove `attention_shift` from Sunday scoring** in `signalEngine.ts` and keep redirect mostly **evening / lateNight**.

### 12.6 Active test window (10–14 days)

**Overlay (in-app):** `helped` · `not_now` · `too_much` per `lineId` — prioritize **`lateNight`**.

**Manual tag (not in overlay yet):** **Generic** — same psychological function as the last few lines; no state change. Use for outcome notes when wallpaper / “same kind of line again” shows up without wanting **`too_much`**.

**Families to compare (which actually change state):**

- `environmental_anchor`
- `permission`
- `attention_shift`
- `mundane_reality`
- `doomscroll`
- `rumination`

**Interpretation:**

- **`attention_shift` + helped** → key layer; consider Hall of Fame promotion later.
- **`attention_shift` + not_now`** → keep lines; **reduce scoring** (do not delete the family yet).
- **`too_much` clusters** on a family → thin that theme in `preferredThemes` / score boosts.

No dashboards, no new product systems — export feedback from device storage when ready (`aggregateFeedbackByLineId`).

### 12.7 Restraint evolution (roadmap)

Long-term moat may be **speaking less**: fewer words, more environmental-only delivery, automatic density drops after stability or repeated **`too_much`**, explicit **silence** when saturated. Cadence shifts over weeks are product design, not copy.

- **Silence tolerance / overstimulation pacing:** idea-space — skip, delay, or thin delivery when **`too_much`** clusters, opens drop off, or density spikes. Not implemented; validate in real testing first.

### 12.8 Copy direction after tests (avoid over-“You…”)

If tests show **“You are…” / “Your body…” / “Your brain…”** clustering or habituation, the next pass should **diversify subjects** toward **impersonal / environmental** openings (room, night, chair, window, silence) — *after* data justifies it, not as a pre-test bulk rewrite. A few surgical swaps (e.g. **`e12`**, **`e34`**, **`e35`**) may land during the freeze when a line is clearly therapy-voiced.

### 12.9 Hall of Fame from local feedback (next moat)

**Now:** overlay records **`helped` / `not_now` / `too_much`** per delivery (`signalFeedbackStorage.ts`). Helpers: **`aggregateFeedbackByLineId`**, **`suggestedHallOfFameLineIds`** (defaults: ≥5 responses, ≥65% helped) — **helpers only; do not wire into `scoreLine` until usage depth justifies it.**

**After 2–3 weeks:** promote high performers into ranking (merge with or replace static **`ELITE_LINE_IDS`** in `scoreLine`) — e.g. “Kevin-like user, 11:47 PM Wednesday, 45m scroll → chair line beats generic stop by 4.3×.” That personalization is harder to copy than the raw library. Until then, **`ELITE_LINE_IDS`** remains the manual seed; ranking is the moat, not more copy.

- Probabilistic “sometimes silence” anchor skips (deferred; would need different trigger strategy).
- Pre-canceling OS notifications when in-app overlay is suppressed (would require inspecting/canceling upcoming triggers on foreground).
- Cloud sync, accounts, analytics backend, mood check-ins, journaling, AI generation of lines, extra slots (midday / weekend / Friday-only), surveillance / Screen Time.

---

## 13. File index (implementation map)

| Area | Path |
|------|------|
| Slots + next fire | `src/logic/signalSchedule.ts` |
| Selection engine | `src/logic/signalEngine.ts` |
| Banks + focus lines | `src/data/signalBanks.ts` |
| All messages + fire timing (reference) | `docs/MESSAGING_AND_TIMING.md` |
| Schedule + parse + iOS attachment + silence | `src/services/notifications.ts` |
| Preview simulation | `src/logic/nextSevenSignalPreview.ts` |
| Pause timestamps | `src/logic/pauseBoundaries.ts` |
| Types + persistence | `src/types/index.ts`, `src/services/storage.ts` |
| Signal feedback (local) | `src/services/signalFeedbackStorage.ts` |
| Provider + listeners | `src/context/CircuitContext.tsx` |
| Overlay + haptics | `src/components/InterruptOverlay.tsx` |
| Overlay wiring + same-day count | `App.tsx` |
| Screens | `src/screens/*` |
| Navigation | `src/navigation/*` |
| Expo config | `app.json` |
| iOS icon catalog plugin | `plugins/with-ios-full-app-icon-catalog.js` |

---

*Regenerate tables from `signalBanks.ts` after large copy edits (see repo).*
