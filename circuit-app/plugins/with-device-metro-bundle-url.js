/**
 * DEBUG physical devices: RCTBundleURLProvider.packagerServerHostPort stays nil when the device cannot
 * GET http://<lan-ip>:8081/status (common with firewalls / VPN / AP isolation). Then jsBundleURL(...) is nil
 * and React Native shows "No script URL provided".
 *
 * We build the Metro URL from embedded ip.txt (and optional RCT_jsLocation from the dev menu) using the
 * class method that does not require the /status probe.
 */
const { withAppDelegate } = require("@expo/config-plugins");

const MARKER = "Physical devices: RCTBundleURLProvider only returns";

const LEGACY_BUNDLE_URL_BLOCK = `  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }`;

const PATCHED_BUNDLE_URL_BLOCK = `  override func bundleURL() -> URL? {
#if DEBUG
    // Physical devices: RCTBundleURLProvider only returns a URL if Metro answers GET /status from the phone.
    // That probe often fails (firewall, VPN, AP isolation) even when Metro works; then bundleURL is nil.
    let bundleRoot = ".expo/.virtual-metro-entry"
    let settings = RCTBundleURLProvider.sharedSettings()

    func metroURL(forHost host: String) -> URL? {
      RCTBundleURLProvider.jsBundleURL(
        forBundleRoot: bundleRoot,
        packagerHost: host,
        enableDev: true,
        enableMinification: false,
        inlineSourceMap: false
      )
    }

    if let manual = UserDefaults.standard.string(forKey: "RCT_jsLocation") {
      let host = manual.trimmingCharacters(in: .whitespacesAndNewlines)
      if !host.isEmpty, let url = metroURL(forHost: host) {
        return url
      }
    }

    if let ipPath = Bundle.main.path(forResource: "ip", ofType: "txt"),
       let ipContents = try? String(contentsOfFile: ipPath, encoding: .utf8) {
      let host = ipContents.trimmingCharacters(in: .whitespacesAndNewlines)
      if !host.isEmpty, let url = metroURL(forHost: host) {
        return url
      }
    }

    if let url = settings.jsBundleURL(forBundleRoot: bundleRoot) {
      return url
    }
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }`;

function withDeviceMetroBundleUrl(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== "swift") {
      return cfg;
    }
    let contents = cfg.modResults.contents;
    if (contents.includes(MARKER)) {
      return cfg;
    }
    if (!contents.includes("override func bundleURL()")) {
      return cfg;
    }
    if (!contents.includes(LEGACY_BUNDLE_URL_BLOCK)) {
      console.warn(
        "[with-device-metro-bundle-url] Default bundleURL() block not found; skipping patch. If Expo changed the template, update LEGACY_BUNDLE_URL_BLOCK in plugins/with-device-metro-bundle-url.js."
      );
      return cfg;
    }
    cfg.modResults.contents = contents.replace(LEGACY_BUNDLE_URL_BLOCK, PATCHED_BUNDLE_URL_BLOCK);
    return cfg;
  });
}

module.exports = withDeviceMetroBundleUrl;
