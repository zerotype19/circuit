/**
 * Optional: set SKIP_BUNDLING_METRO_IP=1 when running prebuild / run:ios so
 * expo/scripts/react-native-xcode.sh does not write CONFIGURATION_BUILD_DIR/.../ip.txt.
 * That write can fail under sandboxed shells (e.g. Cursor) with deny file-write-create on DerivedData.
 *
 * Default (no env): ip.txt is written with your Mac's LAN IP. Physical devices need this
 * for DEBUG builds; otherwise RCTBundleURLProvider returns nil → "No script URL provided".
 *
 * After changing this, run: npx expo prebuild --platform ios (or --clean) then rebuild the app.
 */
const { withXcodeProject } = require("@expo/config-plugins");

function withSkipMetroIp(config) {
  return withXcodeProject(config, async (cfg) => {
    if (process.env.SKIP_BUNDLING_METRO_IP === "1") {
      cfg.modResults.addBuildProperty("SKIP_BUNDLING_METRO_IP", "YES");
    } else {
      cfg.modResults.removeBuildProperty("SKIP_BUNDLING_METRO_IP");
    }
    return cfg;
  });
}

module.exports = withSkipMetroIp;
