// Draws the Direct app icon files into app/assets with Playwright (Chromium).
// Needs:  npm i --no-save playwright   (and its browser: npx playwright install chromium)
// Run:    node scripts/make-icons.js
// Fonts come from the Cinzel package that the app already depends on.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'app');
const font = path.join(root, 'node_modules/@expo-google-fonts/cinzel/700Bold/Cinzel_700Bold.ttf');
const out = path.join(root, 'assets');

const GOLD = '#E8B04A', GOLD_DIM = '#8A6D2E', GOLD_PALE = '#F3D9A0', MINT = '#5FC4B4', BG = '#0B1416', HALO = '#0F2326';

// scale k: 1 = ring radius 300 on a 1024 canvas
function mark(k, { mono = false } = {}) {
  const c = 512, r = 300 * k, o = 212 * k; // o = distance of a peer from the center along each axis (r * cos 45)
  const g = mono ? '#fff' : GOLD, g2 = mono ? '#fff' : GOLD_DIM, a = mono ? '#fff' : MINT, b = mono ? '#fff' : GOLD_PALE;
  return `
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${g}" stroke-width="${22 * k}"/>
    <circle cx="${c}" cy="${c}" r="${248 * k}" fill="none" stroke="${g2}" stroke-width="${7 * k}" ${mono ? 'stroke-opacity=".7"' : ''}/>
    <text x="${c}" y="${c + 120 * k}" text-anchor="middle" font-family="Cinzel" font-weight="700" font-size="${340 * k}" fill="${g}">D</text>
    ${mono ? '' : `<circle cx="${c - o}" cy="${c - o}" r="${58 * k}" fill="${HALO}"/>`}
    <circle cx="${c - o}" cy="${c - o}" r="${34 * k}" fill="${a}"/>
    ${mono ? '' : `<circle cx="${c + o}" cy="${c + o}" r="${58 * k}" fill="${HALO}"/>`}
    <circle cx="${c + o}" cy="${c + o}" r="${34 * k}" fill="${b}"/>`;
}
const bgDefs = `
  <defs>
    <radialGradient id="bg" cx="512" cy="460" r="660" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#1D4A50"/><stop offset=".62" stop-color="#112528"/><stop offset="1" stop-color="${BG}"/>
    </radialGradient>
    <radialGradient id="glow" cx="512" cy="512" r="460" gradientUnits="userSpaceOnUse">
      <stop offset=".55" stop-color="${GOLD}" stop-opacity="0"/><stop offset=".78" stop-color="${GOLD}" stop-opacity=".16"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
  </defs>`;
const bgRect = `<rect width="1024" height="1024" fill="url(#bg)"/><circle cx="512" cy="512" r="460" fill="url(#glow)"/>`;

const files = {
  'icon.png': { size: 1024, transparent: false, body: bgDefs + bgRect + mark(1) },
  'android-icon-background.png': { size: 1024, transparent: false, body: bgDefs + bgRect },
  'android-icon-foreground.png': { size: 1024, transparent: true, body: mark(0.86) },
  'android-icon-monochrome.png': { size: 1024, transparent: true, body: mark(0.86, { mono: true }) },
  'favicon.png': { size: 48, transparent: false, body: bgDefs + bgRect + mark(1), view: 1024 },
  'splash-blank.png': { size: 1024, transparent: true, body: '' }, // the native start screen is only the dark background
};

(async () => {
  const browser = await chromium.launch();
  for (const [name, f] of Object.entries(files)) {
    const page = await browser.newPage({ viewport: { width: f.size, height: f.size } });
    const html = `<!doctype html><style>@font-face{font-family:Cinzel;font-weight:700;src:url(file://${font})}html,body{margin:0;background:transparent}</style>
      <svg xmlns="http://www.w3.org/2000/svg" width="${f.size}" height="${f.size}" viewBox="0 0 ${f.view || f.size} ${f.view || f.size}">${f.body}</svg>`;
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(out, name), omitBackground: f.transparent });
    await page.close();
    console.log('wrote', name);
  }
  await browser.close();
  // The old placeholder from the Expo template is no longer used
  const old = path.join(out, 'splash-icon.png');
  if (fs.existsSync(old)) fs.unlinkSync(old);
})();
