export type CropRect = {
  /** Source image x of the crop top-left (natural pixels) */
  x: number;
  y: number;
  /** Crop width/height in natural pixels */
  w: number;
  h: number;
};

export function loadImageFromFile(file: File): Promise<{ img: HTMLImageElement; objectUrl: string }> {
  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve({ img: el, objectUrl });
    el.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image"));
    };
    el.src = objectUrl;
  });
}

/**
 * Renders a crop of `img` into a JPEG data URL.
 * For avatar: square output. For cover: keep crop aspect, cap longest side.
 */
export function cropImageToDataUrl(
  img: HTMLImageElement,
  crop: CropRect,
  opts: { outWidth: number; outHeight: number; quality?: number } = {
    outWidth: 512,
    outHeight: 512,
  },
): string {
  const canvas = document.createElement("canvas");
  canvas.width = opts.outWidth;
  canvas.height = opts.outHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, opts.outWidth, opts.outHeight);
  return canvas.toDataURL("image/jpeg", opts.quality ?? 0.85);
}

/**
 * Given image size, viewport aspect (w/h), zoom (1 = fit-cover min), and pan
 * offsets in [-1, 1] relative to remaining slack, compute the source crop rect.
 */
export function computeCropRect(
  imgW: number,
  imgH: number,
  aspectW: number,
  aspectH: number,
  zoom: number,
  panX: number,
  panY: number,
): CropRect {
  const aspect = aspectW / aspectH;
  // Fit-cover base crop (zoom = 1)
  let baseW: number;
  let baseH: number;
  if (imgW / imgH > aspect) {
    baseH = imgH;
    baseW = imgH * aspect;
  } else {
    baseW = imgW;
    baseH = imgW / aspect;
  }
  const z = Math.max(1, zoom);
  const w = Math.min(imgW, baseW / z);
  const h = Math.min(imgH, baseH / z);
  const slackX = Math.max(0, imgW - w);
  const slackY = Math.max(0, imgH - h);
  // panX/Y in [-1, 1]: 0 = centered
  const x = slackX * (0.5 + panX * 0.5);
  const y = slackY * (0.5 + panY * 0.5);
  return {
    x: Math.max(0, Math.min(slackX, x)),
    y: Math.max(0, Math.min(slackY, y)),
    w,
    h,
  };
}
