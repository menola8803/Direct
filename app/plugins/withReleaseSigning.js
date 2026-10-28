// Expo config plugin: sign the release APK with Direct's own key.
//
// `expo prebuild` generates android/app/build.gradle and signs release builds with the public Expo debug key. This plugin
// adds a "release" signing config that reads the key from environment variables, and uses it for release builds:
//   DIRECT_KEYSTORE_FILE      path of the keystore (.jks / .p12)
//   DIRECT_KEYSTORE_PASSWORD  password of the keystore
//   DIRECT_KEY_ALIAS          name of the key in it
//   DIRECT_KEY_PASSWORD       password of the key (the same as the keystore password for a PKCS12 file)
// Without DIRECT_KEYSTORE_FILE the build is signed with the debug key as before, so a local test build still works.
// If the generated file does not look as expected the plugin throws: a release must never be signed with the wrong key
// without anybody noticing.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = 'DIRECT_KEYSTORE_FILE';

const RELEASE_CONFIG = `
        release {
            // Direct's own key (see docs/SIGNING.md). Only used when DIRECT_KEYSTORE_FILE is set.
            if (System.getenv('${MARK}')) {
                storeFile file(System.getenv('${MARK}'))
                storePassword System.getenv('DIRECT_KEYSTORE_PASSWORD')
                keyAlias System.getenv('DIRECT_KEY_ALIAS')
                keyPassword System.getenv('DIRECT_KEY_PASSWORD')
            }
        }`;

// Index of the "}" that closes the "{" at `open`.
function closing(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return i;
  }
  throw new Error('withReleaseSigning: unbalanced braces in build.gradle');
}
const blockStart = (src, re, from = 0) => {
  const m = re.exec(src.slice(from));
  if (!m) return -1;
  return from + m.index + m[0].length - 1; // the "{"
};

function patchBuildGradle(src) {
  if (src.includes(MARK)) return src; // already patched

  // 1. signingConfigs { debug { ... }  +  release { ... } }
  const sc = blockStart(src, /signingConfigs\s*\{/);
  if (sc < 0) throw new Error('withReleaseSigning: signingConfigs block not found in build.gradle');
  const scEnd = closing(src, sc);
  const lineStart = src.lastIndexOf('\n', scEnd) + 1; // the release config goes on its own lines, before the closing brace
  let out = src.slice(0, lineStart) + RELEASE_CONFIG.slice(1) + '\n' + src.slice(lineStart);

  // 2. buildTypes { release { signingConfig ... } }
  const bt = blockStart(out, /buildTypes\s*\{/);
  if (bt < 0) throw new Error('withReleaseSigning: buildTypes block not found in build.gradle');
  const btEnd = closing(out, bt);
  const rel = blockStart(out, /\brelease\s*\{/, bt);
  if (rel < 0 || rel > btEnd) throw new Error('withReleaseSigning: release build type not found in build.gradle');
  const relEnd = closing(out, rel);
  const body = out.slice(rel, relEnd);
  const re = /signingConfig\s+signingConfigs\.debug/;
  if (!re.test(body)) throw new Error('withReleaseSigning: the release build type does not use the debug signing config as expected');
  const patched = body.replace(re, `signingConfig System.getenv('${MARK}') ? signingConfigs.release : signingConfigs.debug`);
  return out.slice(0, rel) + patched + out.slice(relEnd);
}

const withReleaseSigning = config => withAppBuildGradle(config, c => {
  if (c.modResults.language !== 'groovy') throw new Error('withReleaseSigning: build.gradle is not Groovy');
  c.modResults.contents = patchBuildGradle(c.modResults.contents);
  return c;
});

module.exports = withReleaseSigning;
module.exports.patchBuildGradle = patchBuildGradle;
