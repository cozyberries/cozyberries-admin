export const PWA_SESSION_DISMISS_KEY = "cozyberries-admin:pwa-install-dismissed";

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return true;
  const byMedia = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in window.navigator &&
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return byMedia || iosStandalone;
}

export function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}
