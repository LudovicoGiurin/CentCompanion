import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "./Modal";
import { computeCropRect, cropImageToDataUrl } from "../lib/avatar";

export type CropMode = "avatar" | "cover";

type Props = {
  open: boolean;
  mode: CropMode;
  imageUrl: string;
  img: HTMLImageElement;
  /** Equipped medal frame — only used for avatar preview */
  frame?: string | null;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
  busy?: boolean;
};

/**
 * Pan/zoom crop editor. Avatar mode shows a square viewport with the medal
 * frame overlay; cover mode uses a wide banner viewport.
 */
export function ImageCropModal({
  open,
  mode,
  imageUrl,
  img,
  frame,
  onCancel,
  onConfirm,
  busy = false,
}: Props) {
  const { t } = useTranslation(["dashboard", "common"]);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [vp, setVp] = useState({ w: mode === "avatar" ? 240 : 360, h: mode === "avatar" ? 240 : 120 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originPanX: number;
    originPanY: number;
  } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, [open, imageUrl]);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el || !open) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setVp({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, mode]);

  const aspectW = mode === "avatar" ? 1 : 3;
  const aspectH = 1;

  const crop = computeCropRect(img.naturalWidth, img.naturalHeight, aspectW, aspectH, zoom, panX, panY);

  const scale = vp.w / crop.w;
  const imgLeft = -crop.x * scale;
  const imgTop = -crop.y * scale;
  const imgDispW = img.naturalWidth * scale;
  const imgDispH = img.naturalHeight * scale;

  const onPointerDown = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originPanX: panX,
      originPanY: panY,
    };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const z = Math.max(1, zoom);
    const slackFrac = 1 - 1 / z;
    if (slackFrac < 0.001) return;
    const dx = (e.clientX - d.startX) / vp.w;
    const dy = (e.clientY - d.startY) / vp.h;
    // Dragging right moves image right → crop goes left → panX decreases
    const nextX = Math.max(-1, Math.min(1, d.originPanX - (dx * 2) / slackFrac));
    const nextY = Math.max(-1, Math.min(1, d.originPanY - (dy * 2) / slackFrac));
    setPanX(nextX);
    setPanY(nextY);
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const handleConfirm = useCallback(() => {
    const rect = computeCropRect(img.naturalWidth, img.naturalHeight, aspectW, aspectH, zoom, panX, panY);
    if (mode === "avatar") {
      onConfirm(cropImageToDataUrl(img, rect, { outWidth: 512, outHeight: 512, quality: 0.85 }));
    } else {
      onConfirm(cropImageToDataUrl(img, rect, { outWidth: 1200, outHeight: 400, quality: 0.82 }));
    }
  }, [img, aspectW, aspectH, zoom, panX, panY, mode, onConfirm]);

  const title = mode === "avatar" ? t("profile.crop.avatarTitle") : t("profile.crop.coverTitle");

  return (
    <Modal
      open={open}
      title={title}
      confirmLabel={t("profile.crop.apply")}
      cancelLabel={t("common:actions.cancel")}
      onConfirm={handleConfirm}
      onCancel={onCancel}
      busy={busy}
    >
      <p className="cc-crop__hint">
        {mode === "avatar" ? t("profile.crop.hintAvatar") : t("profile.crop.hintCover")}
      </p>

      <div
        className={`cc-crop__viewport cc-crop__viewport--${mode}`}
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="cc-crop__stage"
          style={{
            width: imgDispW,
            height: imgDispH,
            transform: `translate(${imgLeft}px, ${imgTop}px)`,
          }}
        >
          <img src={imageUrl} alt="" draggable={false} />
        </div>
        {mode === "avatar" && (
          <div
            className={["cc-crop__frame", frame ? `cc-avatar--${frame}` : ""].filter(Boolean).join(" ")}
            aria-hidden="true"
          />
        )}
      </div>

      <label className="cc-crop__zoom">
        <span>{t("profile.crop.zoom")}</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          disabled={busy}
        />
      </label>
    </Modal>
  );
}
