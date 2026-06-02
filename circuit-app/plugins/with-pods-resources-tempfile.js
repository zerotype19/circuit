/**
 * CocoaPods' Copy Pods Resources script writes `resources-to-copy-${TARGET}.txt` under
 * `ios/Pods/`. Sandboxed environments may deny that write.
 *
 * Injects a Podfile `post_install` step that rewrites each `Pods-*-resources.sh` to use
 * `TARGET_TEMP_DIR` instead (writable during Xcode builds).
 */
const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

const MARKER = "# CIRCUIT_RESOURCES_COPY_TEMPFILE";

function patchPodfile(podfilePath) {
  let contents = fs.readFileSync(podfilePath, "utf8");
  if (contents.includes(MARKER)) {
    return;
  }

  const rubyBlock =
    "\n" +
    MARKER +
    "\n" +
    "    Dir.glob(File.join(__dir__, 'Pods', 'Target Support Files', 'Pods-*', 'Pods-*-resources.sh')).each do |script|\n" +
    "      body = File.read(script)\n" +
    "      old = 'RESOURCES_TO_COPY=${PODS_ROOT}/resources-to-copy-${TARGETNAME}.txt'\n" +
    '      neu = \'RESOURCES_TO_COPY="${TARGET_TEMP_DIR}/resources-to-copy-${TARGETNAME}.txt"\'\n' +
    "      File.write(script, body.gsub(old, neu)) if body.include?(old)\n" +
    "    end\n";

  const anchor = `    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
  end`;

  if (!contents.includes(anchor)) {
    throw new Error(
      "[with-pods-resources-tempfile] Podfile post_install anchor not found; update this plugin for your Expo template."
    );
  }

  contents = contents.replace(
    anchor,
    `    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )${rubyBlock}
  end`
  );

  fs.writeFileSync(podfilePath, contents);
}

function withPodsResourcesTempfile(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      if (fs.existsSync(podfile)) {
        patchPodfile(podfile);
      }
      return cfg;
    },
  ]);
}

module.exports = withPodsResourcesTempfile;
