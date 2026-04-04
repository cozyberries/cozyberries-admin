# PWA installability and install banner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make cozyberries-admin installable as a PWA (manifest, icons, minimal network-only service worker) and show a post-auth install banner on mobile and desktop with Chromium install prompts and iOS instructional copy, per the approved spec.

**Architecture:** Add `app/manifest.ts` for the Web App Manifest, static PNG icons and `public/sw.js` with a fetch-through-network-only handler, register the SW from a client-only helper mounted in the layout, and implement `PwaInstallBanner` that uses `useAuth()` from `components/supabase-auth-provider.tsx`, `beforeinstallprompt` on Chromium, and iOS-specific copy elsewhere. No Next PWA plugin — avoids accidental caching.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind, Playwright (optional e2e).

**Spec:** `docs/superpowers/specs/2026-04-03-pwa-install-banner-design.md`

**Note:** The spec mentions `useAdminAuth()` in places; this codebase exports **`useAuth()`** from `components/supabase-auth-provider.tsx` — use `useAuth()` in implementation.

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `app/manifest.ts` | Create | `MetadataRoute.Manifest` — name, icons, colors, `start_url`, `display: standalone` |
| `public/sw.js` | Create | Minimal SW: `install` no-op; `fetch` → `fetch(event.request)` only |
| `public/icon-192.png` | Create | 192×192 manifest icon (see Task 1) |
| `public/icon-512.png` | Create | 512×512 manifest icon |
| `public/maskable-icon-512.png` | Optional | Maskable 512 if time; else omit `purpose: maskable` from manifest |
| `lib/pwa/constants.ts` | Create | `SESSION_DISMISS_KEY`, `SW_URL`, shared strings / detection helpers |
| `components/pwa-install-banner.tsx` | Create | Client banner: auth gate, standalone check, session dismiss, platform UI |
| `components/pwa-service-worker-register.tsx` | Create | `useEffect` → `navigator.serviceWorker.register('/sw.js')` once; dev-only `console` on failure |
| `app/layout.tsx` | Modify | Import metadata extensions; nest `PwaServiceWorkerRegister` + `PwaInstallBanner` inside `AdminAuthProvider` |
| `tests/pwa.spec.ts` | Create (optional) | Login page: banner hidden; document has manifest link |
| `playwright.config.ts` | Modify | Align default `use.baseURL` with `webServer.url` (both port **4000**) — today default is `4001` while `webServer` uses `4000` |
| `TESTING.md` | Modify (small) | Short “PWA / install banner” manual checklist if not redundant |

---

### Task 1: Web App Manifest + PNG icons

**Files:**
- Create: `app/manifest.ts`
- Create: `public/icon-192.png`, `public/icon-512.png`

- [ ] **Step 1: Add icon assets**

Add two PNG files at `public/icon-192.png` and `public/icon-512.png`. If no designer assets exist yet, generate solid branded placeholders (e.g. CozyBerries wordmark or “CB” on brand-colored background) at exact dimensions — manifest installability requires real image files, not missing 404s.

- [ ] **Step 2: Implement `app/manifest.ts`**

```typescript
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CozyBerries Admin",
    short_name: "CB Admin",
    description: "Admin panel for CozyBerries e-commerce platform",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#292524",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
```

Adjust `theme_color` / `background_color` to match product (light theme defaults above align with neutral admin chrome).

- [ ] **Step 3: Verify locally**

Run `npm run dev`, open `http://localhost:4000/manifest.webmanifest` (Next serves the manifest at this path for `app/manifest.ts`). Expected: JSON with `icons` and `display`.

- [ ] **Step 4: Commit**

```bash
git add app/manifest.ts public/icon-192.png public/icon-512.png
git commit -m "feat(pwa): add web app manifest and icons"
```

---

### Task 2: Root metadata alignment

**Files:**
- Modify: `app/layout.tsx` (metadata export only)

- [ ] **Step 1: Extend `metadata`**

Add `manifest` if not auto-linked (Next 13+ often injects from `app/manifest.ts` — confirm in View Source; if duplicate omit). Add:

```typescript
export const metadata: Metadata = {
  // ...existing
  themeColor: "#292524",
  appleWebApp: {
    capable: true,
    title: "CozyBerries Admin",
    statusBarStyle: "default",
  },
};
```

Keep existing `icons` block; ensure `apple-touch-icon` path exists in `public/` or align `metadata.icons.apple` with a real file (fix 404s if current favicon paths are missing).

- [ ] **Step 2: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(pwa): align root metadata with manifest"
```

---

### Task 3: Minimal service worker

**Files:**
- Create: `public/sw.js`
- Create: `components/pwa-service-worker-register.tsx`

- [ ] **Step 1: Add `public/sw.js`**

No imports; plain ES5-compatible SW for maximum compatibility:

```javascript
/* cozyberries-admin — install-only SW; no caching */
self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", function (event) {
  event.respondWith(fetch(event.request));
});
```

- [ ] **Step 2: Add `components/pwa-service-worker-register.tsx`**

```typescript
"use client";

import { useEffect } from "react";

export function PwaServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => {
        if (process.env.NODE_ENV === "development") {
          console.info("[pwa] service worker registered");
        }
      })
      .catch((err) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[pwa] service worker registration failed", err);
        }
      });
  }, []);

  return null;
}
```

Remove unused `cancelled` or use it to ignore late resolutions — optional cleanup.

- [ ] **Step 3: Commit**

```bash
git add public/sw.js components/pwa-service-worker-register.tsx
git commit -m "feat(pwa): add minimal network-only service worker"
```

---

### Task 4: PWA constants + install banner

**Files:**
- Create: `lib/pwa/constants.ts`
- Create: `components/pwa-install-banner.tsx`

- [ ] **Step 1: Add `lib/pwa/constants.ts`**

```typescript
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
```

- [ ] **Step 2: Implement `components/pwa-install-banner.tsx`**

Requirements:

- `"use client"`.
- `useAuth()` → render `null` unless `isAuthenticated && !loading`.
- If `isStandaloneDisplay()` → `null`.
- Read `sessionStorage.getItem(PWA_SESSION_DISMISS_KEY)` in `useEffect` or `useState` + effect; if `"1"` → `null` (handle try/catch).
- iOS (`isIosDevice()`): show bottom fixed banner with short copy: Share → Add to Home Screen; primary actions: **Dismiss** only (no fake Install).
- Non-iOS: listen `window.addEventListener('beforeinstallprompt', ...)`; `e.preventDefault()`; store event in `useRef`; show **Install** + **Dismiss**. Install button calls `deferredPrompt.prompt()` and await `userChoice`.
- If non-iOS and no `beforeinstallprompt` yet, optionally show nothing or a subtle “Install may be available from the browser menu” — YAGNI: hide until event fires OR iOS branch (spec: Chromium may show nothing until criteria met — prefer hiding when no install path to avoid noise; **exception:** iOS always shows instructional if not standalone and not dismissed).
- Styling: Tailwind, fixed `bottom-0` inset-x, `pb-safe` / `env(safe-area-inset-bottom)`, z-index above content, `role="region"` + `aria-label` for the bar.
- `data-testid="pwa-install-banner"` when visible for tests.

Dismiss handler: `sessionStorage.setItem(PWA_SESSION_DISMISS_KEY, '1')` in try/catch, then hide.

- [ ] **Step 3: Commit**

```bash
git add lib/pwa/constants.ts components/pwa-install-banner.tsx
git commit -m "feat(pwa): add install banner with auth and platform branches"
```

---

### Task 5: Layout integration

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Nest components inside `AdminAuthProvider`**

Order (suggested): after `AdminAuthProvider` opens, render `PwaServiceWorkerRegister` and `PwaInstallBanner` **before** or **after** `ReactQueryProvider` — both must stay inside `AdminAuthProvider`. Example:

```tsx
<AdminAuthProvider>
  <PwaServiceWorkerRegister />
  <PwaInstallBanner />
  <ReactQueryProvider>
    ...
```

`PwaServiceWorkerRegister` does not need auth but may run on login page too (SW registers for whole origin — acceptable per spec).

- [ ] **Step 2: Manual test**

1. Log out → `/login` → banner should not appear (not authenticated).
2. Log in → banner may appear (non-standalone) if iOS or after `beforeinstallprompt`.
3. Dismiss → refresh → banner hidden same tab; new tab → may show again.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(pwa): mount PWA registration and install banner"
```

---

### Task 6: Playwright smoke (optional)

**Files:**
- Modify: `playwright.config.ts` (baseURL alignment)
- Create: `tests/pwa.spec.ts`

- [ ] **Step 0: Align Playwright `baseURL` with dev server**

In `playwright.config.ts`, `webServer.url` is `http://localhost:4000` but `use.baseURL` defaults to `http://localhost:4001`. Change the fallback to match:

```typescript
baseURL: process.env.BASE_URL || "http://localhost:4000",
```

Alternatively keep code as-is and set `BASE_URL=http://localhost:4000` in `.env.test` (and document). Pick one approach so `npx playwright test` hits the same server Playwright starts.

- [ ] **Step 1: Login page has no banner**

```typescript
import { test, expect } from "@playwright/test";

test.describe("PWA install banner", () => {
  test("login page does not show install banner", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("pwa-install-banner")).toHaveCount(0);
  });

  test("document references manifest", async ({ page }) => {
    await page.goto("/login");
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(manifestHref).toBeTruthy();
  });
});
```

Because the root `app/layout.tsx` wraps all routes, the manifest `<link>` is present on `/login` without logging in — sufficient for this smoke test.

- [ ] **Step 2: Run**

```bash
npx playwright test tests/pwa.spec.ts
```

Expected: PASS with dev server on port **4000** (after Step 0).

- [ ] **Step 3: Commit**

```bash
git add tests/pwa.spec.ts
git commit -m "test(e2e): add PWA banner smoke tests"
```

---

### Task 7: Documentation touch-up (optional)

**Files:**
- Modify: `TESTING.md`

- [ ] **Step 1:** Add a short subsection: verify manifest URL, SW in Application tab, install on HTTPS staging, iOS Share → Add to Home Screen.

- [ ] **Step 2: Commit**

```bash
git add TESTING.md
git commit -m "docs: add PWA manual verification notes"
```

---

## Verification before merge

- [ ] `npm run build` succeeds.
- [ ] `npm run lint` clean for touched files.
- [ ] Staging/production HTTPS: Chrome “Install app” or install icon appears after engagement heuristic; Application → Manifest shows no errors.
- [ ] No Workbox or `next-pwa` added without explicit follow-up (avoid accidental caching).

---

## Risks / notes

- **Install prompt timing:** Chromium may delay `beforeinstallprompt` — banner might appear only after interaction; acceptable.
- **Icons:** Replace placeholders with final brand assets before wide release.
- **Hook name:** Use `useAuth()` (not `useAdminAuth`) — matches `components/supabase-auth-provider.tsx`.
