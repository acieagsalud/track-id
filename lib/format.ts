/** 240 → "4:00", 5244 → "1:27:24". */
export function formatCue(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function djHref(name: string): string {
  return `/dj/${encodeURIComponent(name)}`;
}
