import { useState } from 'react';

/**
 * A college's logo, or — when none is uploaded (Settings → Colleges) or it
 * fails to load — a monogram disc in a colour derived from the name, so the
 * same college always gets the same colour.
 */
export function TeamLogo({
  name,
  logoUrl,
  label,
  size = 40,
}: {
  name: string;
  logoUrl?: string | null;
  /** Short text for the monogram (the college abbreviation). */
  label: string;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);

  if (logoUrl && !broken) {
    return (
      <img
        src={logoUrl}
        alt=""
        title={name}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setBroken(true)}
        className="shrink-0 rounded-full object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;

  return (
    <span
      aria-hidden
      title={name}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size / (label.length > 3 ? 3.6 : 2.8))),
        background: `hsl(${hue} 55% 38%)`,
      }}
    >
      {label.slice(0, 4)}
    </span>
  );
}
