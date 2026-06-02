/**
 * Family Controls entitlement: OFF by default so automatic Xcode signing works.
 * Opt in only after Apple enables the capability on your App ID:
 *   CIRCUIT_FAMILY_CONTROLS_ENTITLEMENT=1 npx expo prebuild --platform ios
 *
 * When OFF, this plugin strips any leftover com.apple.developer.family-controls from entitlements
 * (e.g. after removing it from app.json or reusing an old ios/ tree).
 */
const { withEntitlementsPlist, withInfoPlist } = require("@expo/config-plugins");

const USAGE =
  "Circuit uses Screen Time APIs only to observe app activity you explicitly allow, for urgency awareness on device.";

function withOptionalFamilyControlsEntitlement(config) {
  const enabled = process.env.CIRCUIT_FAMILY_CONTROLS_ENTITLEMENT === "1";

  let next = withEntitlementsPlist(config, (cfg) => {
    if (enabled) {
      cfg.modResults["com.apple.developer.family-controls"] = true;
    } else {
      delete cfg.modResults["com.apple.developer.family-controls"];
    }
    return cfg;
  });

  next = withInfoPlist(next, (cfg) => {
    if (enabled) {
      cfg.modResults.NSFamilyControlsUsageDescription = USAGE;
    } else {
      delete cfg.modResults.NSFamilyControlsUsageDescription;
    }
    return cfg;
  });

  return next;
}

module.exports = withOptionalFamilyControlsEntitlement;
