/**
 * One-off: Read public/logo.png, convert to dark black on transparent, write public/logo-black.png.
 * - Pixels that are very dark (background) become fully transparent (alpha 0).
 * - All other pixels become black (#000) with alpha binarized to 255 (opaque).
 */
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "public", "logo.png");
const OUT = path.join(ROOT, "public", "logo-black.png");

const DARK_THRESHOLD = 35; // R,G,B all below this => treat as background (transparent)

async function main() {
  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const out = Buffer.alloc(data.length);

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = channels === 4 ? data[i + 3] : 255;

    // Treat very dark pixels (e.g. black background) as transparent
    const isBackground =
      r <= DARK_THRESHOLD && g <= DARK_THRESHOLD && b <= DARK_THRESHOLD;

    out[i] = 0;
    out[i + 1] = 0;
    out[i + 2] = 0;
    out[i + 3] = isBackground ? 0 : (a > 0 ? 255 : 0); // binarize alpha: opaque or transparent
  }

  await sharp(out, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toFile(OUT);

  console.log("Written:", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
