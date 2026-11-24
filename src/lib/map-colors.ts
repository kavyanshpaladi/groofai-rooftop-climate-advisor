// Map outlines are drawn on a canvas, which can't read CSS variables itself,
// so resolve the theme colour at runtime (browser only).
export function themeColor(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
