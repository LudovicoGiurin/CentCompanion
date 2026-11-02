import type { CSSProperties } from "react";

/**
 * Square profile picture with an optional medal frame artwork
 * (`cc-avatar--<frame>` classes defined in styles/index.css).
 */
export function Avatar({
  src,
  name,
  frame,
  size = 96,
  className = "",
}: {
  src: string | null | undefined;
  name: string;
  frame?: string | null;
  size?: number;
  className?: string;
}) {
  const initials =
    name
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  const cls = ["cc-avatar", frame ? `cc-avatar--${frame}` : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} style={{ "--cc-avatar-size": `${size}px` } as CSSProperties}>
      {src ? (
        <img src={src} alt={name} />
      ) : (
        <span className="cc-avatar__initials" aria-hidden="true">
          {initials}
        </span>
      )}
    </div>
  );
}
