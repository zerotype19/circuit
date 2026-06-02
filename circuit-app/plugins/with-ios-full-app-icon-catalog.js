/**
 * Expo prebuild emits a minimal App Icon set. We regenerate every slot from `assets/icon.png`
 * so the device has correct densities. We use opaque RGB output (black letterbox via
 * `backgroundColor` + `removeTransparency`) so the marketing 1024 and slots match App Store /
 * iOS expectations. We omit per-entry `platform` in Contents.json — the `platform: "ios"`
 * shape was associated with missing / wireframe icons in the field. Rebuild after prebuild.
 */
const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");
const { generateImageAsync } = require("@expo/image-utils");

/** @type {{ px: number; idiom: string; size: string; scale: string; file: string }[]} */
const VARIANTS = [
  { px: 40, idiom: "iphone", size: "20x20", scale: "2x", file: "AppIcon-20@2x.png" },
  { px: 60, idiom: "iphone", size: "20x20", scale: "3x", file: "AppIcon-20@3x.png" },
  { px: 58, idiom: "iphone", size: "29x29", scale: "2x", file: "AppIcon-29@2x.png" },
  { px: 87, idiom: "iphone", size: "29x29", scale: "3x", file: "AppIcon-29@3x.png" },
  { px: 80, idiom: "iphone", size: "40x40", scale: "2x", file: "AppIcon-40@2x.png" },
  { px: 120, idiom: "iphone", size: "40x40", scale: "3x", file: "AppIcon-40@3x.png" },
  { px: 120, idiom: "iphone", size: "60x60", scale: "2x", file: "AppIcon-60@2x.png" },
  { px: 180, idiom: "iphone", size: "60x60", scale: "3x", file: "AppIcon-60@3x.png" },
  { px: 20, idiom: "ipad", size: "20x20", scale: "1x", file: "AppIcon-20~ipad.png" },
  { px: 40, idiom: "ipad", size: "20x20", scale: "2x", file: "AppIcon-20@2x~ipad.png" },
  { px: 29, idiom: "ipad", size: "29x29", scale: "1x", file: "AppIcon-29~ipad.png" },
  { px: 58, idiom: "ipad", size: "29x29", scale: "2x", file: "AppIcon-29@2x~ipad.png" },
  { px: 40, idiom: "ipad", size: "40x40", scale: "1x", file: "AppIcon-40~ipad.png" },
  { px: 80, idiom: "ipad", size: "40x40", scale: "2x", file: "AppIcon-40@2x~ipad.png" },
  { px: 76, idiom: "ipad", size: "76x76", scale: "1x", file: "AppIcon-76~ipad.png" },
  { px: 152, idiom: "ipad", size: "76x76", scale: "2x", file: "AppIcon-76@2x~ipad.png" },
  { px: 167, idiom: "ipad", size: "83.5x83.5", scale: "2x", file: "AppIcon-83.5@2x~ipad.png" },
  { px: 1024, idiom: "ios-marketing", size: "1024x1024", scale: "1x", file: "AppIcon-1024.png" },
];

function findAppIconAppiconsetDir(iosRoot) {
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return null;
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      let st;
      try {
        st = fs.statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (name === "AppIcon.appiconset") return p;
        const hit = walk(p);
        if (hit) return hit;
      }
    }
    return null;
  };
  return walk(iosRoot);
}

module.exports = function withIosFullAppIconCatalog(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const src = path.join(projectRoot, "assets", "icon.png");
      const iosRoot = path.join(projectRoot, "ios");
      if (!fs.existsSync(src) || !fs.existsSync(iosRoot)) {
        return cfg;
      }
      const appIconDir = findAppIconAppiconsetDir(iosRoot);
      if (!appIconDir) {
        return cfg;
      }

      // Build all buffers first. Never delete existing PNGs until we have a full set — a
      // mid-loop failure used to leave an empty appiconset (blank home icon / generic glyph).
      const generated = [];
      for (const v of VARIANTS) {
        const { source } = await generateImageAsync(
          { projectRoot, cacheType: "circuit-full-appicon-v2" },
          {
            src,
            width: v.px,
            height: v.px,
            resizeMode: "cover",
            backgroundColor: "#000000",
            removeTransparency: true,
          }
        );
        generated.push({ file: v.file, source });
      }

      for (const name of fs.readdirSync(appIconDir)) {
        if (name.endsWith(".png")) {
          fs.unlinkSync(path.join(appIconDir, name));
        }
      }
      const images = [];
      for (const g of generated) {
        fs.writeFileSync(path.join(appIconDir, g.file), g.source);
        const v = VARIANTS.find((x) => x.file === g.file);
        if (!v) {
          throw new Error(`with-ios-full-app-icon-catalog: unknown variant ${g.file}`);
        }
        // Standard iOS App Icon catalog entries (no per-slot `platform` — that shape can
        // confuse the asset compiler and yield missing / wireframe icons on device).
        images.push({
          filename: v.file,
          idiom: v.idiom,
          size: v.size,
          scale: v.scale,
        });
      }

      const contents = { images, info: { version: 1, author: "expo" } };
      fs.writeFileSync(path.join(appIconDir, "Contents.json"), `${JSON.stringify(contents, null, 2)}\n`);
      return cfg;
    },
  ]);
};
