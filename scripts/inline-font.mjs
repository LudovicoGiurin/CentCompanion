import fs from "node:fs";

const b64 = fs.readFileSync("worker/assets/press-start-2p.woff").toString("base64");
const out = `/** Press Start 2P — inlined for Pages Functions esbuild (no .woff loader). */
const PRESS_START_2P_BASE64 = ${JSON.stringify(b64)};

let cachedFont: ArrayBuffer | null = null;

export function getPressStartFont(): ArrayBuffer {
  if (cachedFont) return cachedFont;
  const binary = atob(PRESS_START_2P_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  cachedFont = bytes.buffer;
  return cachedFont;
}
`;

fs.writeFileSync("worker/assets/press-start-2p-font.ts", out);
