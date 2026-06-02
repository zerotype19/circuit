/**
 * expo-notifications adds `aps-environment` (Push / APNs). That requires Push on the App ID
 * and a matching profile — automatic signing often fails for local-only apps.
 *
 * Circuit MVP uses only **local** scheduled notifications; they do not need `aps-environment`.
 *
 * Must be listed **before** `expo-notifications` in app.json: Expo chains entitlements mods so the
 * last-listed plugin runs first; `expo-notifications` adds `aps-environment`, then this plugin’s
 * pass (via `nextMod`) removes it.
 *
 * For remote push later: enable Push on the App Identifier, then remove this plugin.
 */
const { withEntitlementsPlist } = require("@expo/config-plugins");

function withLocalNotificationsOnlyEntitlements(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults["aps-environment"];
    return cfg;
  });
}

module.exports = withLocalNotificationsOnlyEntitlements;
