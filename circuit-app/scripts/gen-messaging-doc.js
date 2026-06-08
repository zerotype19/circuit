#!/usr/bin/env node
/**
 * Regenerate docs/MESSAGING_AND_TIMING.md from signalBanks.ts + schedule metadata.
 * Usage: node scripts/gen-messaging-doc.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "src/data/signalBanks.ts"), "utf8");

const banks = ["MORNING", "EVENING", "SUNDAY", "LATE_NIGHT", "RESET"];
const bankKinds = {
  MORNING: "morning",
  EVENING: "evening",
  SUNDAY: "sunday",
  LATE_NIGHT: "lateNight",
  RESET: "reset",
};
const bankTitles = {
  morning: "Morning (`morning`) — daily 08:15",
  evening: "Evening (`evening`) — daily 20:15",
  sunday: "Sunday (`sunday`) — weekly Sunday 19:30",
  lateNight: "Late night (`lateNight`) — daily 23:00",
  reset: "Reset (`reset`) — synthetic; not a schedule slot",
};

function parseBank(b) {
  const re = new RegExp("const " + b + ": readonly SignalLine\\[\\] = \\[(.*?)\\];", "s");
  const m = src.match(re);
  const block = m[1];
  const lines = [];
  const chunks = block.split(/\n  \},\n  \{/);
  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i];
    if (i > 0) chunk = "{" + chunk;
    const idM = chunk.match(/id: "([^"]+)"/);
    const textM = chunk.match(/text: "((?:\\.|[^"\\])*)"/);
    const themeM = chunk.match(/theme: "([^"]+)"/);
    const layerM = chunk.match(/behaviorLayer: "([^"]+)"/);
    const toneM = chunk.match(/tone: "([^"]+)"/);
    if (idM) {
      lines.push({
        id: idM[1],
        text: textM ? textM[1].replace(/\\"/g, '"') : "",
        theme: themeM ? themeM[1] : "",
        layer: layerM ? layerM[1] : "mirror",
        tone: toneM ? toneM[1] : "",
      });
    }
  }
  return lines;
}

const all = {};
for (const b of banks) all[bankKinds[b]] = parseBank(b);

const focusMatch = src.match(/DAILY_FOCUS_LINES: readonly string\[\] = \[([\s\S]*?)\];/);
const focusLines = [...focusMatch[1].matchAll(/"((?:\\.|[^"\\])*)"/g)].map((m) => m[1]);
const total = Object.values(all).reduce((n, arr) => n + arr.length, 0);

let md = `# Circuit — all messaging statements and when they fire

Generated from \`src/data/signalBanks.ts\` and scheduling/selection code. **${total} signal lines** plus **${focusLines.length} Home focus lines** and a few fixed UI strings.

**Source of truth:** the TypeScript repo wins if this file drifts.

---

## 1. Where user-facing text appears

| Channel | What the user sees | When it fires |
|---------|-------------------|---------------|
| **OS notification** | Title: \`Circuit\`. Body: one \`SignalLine.text\` (chosen at schedule time). | At anchor wall time ± jitter (see §2). |
| **In-app interrupt overlay** | Same line + optional feedback (\`Did this help?\`). | On signal notification receive/tap unless suppressed (§5). |
| **Home screen** | One random \`DAILY_FOCUS_LINES\` string. | On Home mount; not a notification. |
| **Settings test** | Immediate notification + overlay for chosen slot. | Manual only. |
| **Fallback** | \`Pause.\` | Rare engine exhaust. |

Lines are **baked at schedule time** (\`scheduleSignalAnchors\`), not re-rolled at fire time.

---

## 2. Wall-clock schedule (device local)

| Slot | Base time | Jitter ± |
|------|-----------|----------|
| \`morning\` | **08:15** daily | 5 min |
| \`evening\` | **20:15** daily | 7 min |
| \`sunday\` | **19:30** Sundays only | 10 min |
| \`lateNight\` | **23:00** daily | 20 min |

Late night stays **≥ 90 min** after evening on the same cycle.

---

## 3. Banks

| \`kind\` | Lines |
|----------|------:|
| \`morning\` | ${all.morning.length} |
| \`evening\` | ${all.evening.length} |
| \`sunday\` | ${all.sunday.length} |
| \`lateNight\` | ${all.lateNight.length} |
| \`reset\` (inject only) | ${all.reset.length} |

**Reset injection:** evening / late night only, ~11% when recent deliveries share a heavy loop micro-state. OS \`kind\` stays the anchor slot.

**Selection:** \`selectSignalLine\` in \`signalEngine.ts\` — weekday theme scoring, repeat bans, variety guards, weighted pick among top scores, local feedback nudges.

---

## 4. Home focus lines

`;

for (const [i, line] of focusLines.entries()) {
  md += `${i + 1}. ${line}\n`;
}

md += `
---

## 5. Full library

`;

for (const kind of ["morning", "evening", "sunday", "lateNight", "reset"]) {
  md += `\n### ${bankTitles[kind]}\n\n| id | text | theme | layer | tone |\n|----|------|-------|-------|------|\n`;
  for (const l of all[kind]) {
    md += `| ${l.id} | ${l.text.replace(/\|/g, "\\|")} | ${l.theme} | ${l.layer} | ${l.tone} |\n`;
  }
}

md += `\n---\n\n*Run \`node scripts/gen-messaging-doc.js\` to regenerate.*\n`;

fs.writeFileSync(path.join(root, "docs/MESSAGING_AND_TIMING.md"), md);
console.log("Wrote docs/MESSAGING_AND_TIMING.md (" + total + " lines)");
