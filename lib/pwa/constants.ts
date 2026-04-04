export const PWA_SESSION_DISMISS_KEY = "cozyberries-admin:pwa-install-dismissed";

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return true;
  const byMedia = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in window.navigator &&
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return byMedia || iosStandalone;
}

/** True for iPhone, iPod, and iPad (including iPadOS Safari that masquerades as desktop). */
export function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ Safari reports as Mac with touch
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) {
    return true;
  }
  return false;
}
