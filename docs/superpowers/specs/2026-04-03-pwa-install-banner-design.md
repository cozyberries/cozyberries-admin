# PWA installability and install banner — Design Spec

**Date:** 2026-04-03  
**Status:** Approved in chat (pending implementation plan)  
**Project:** cozyberries-admin  

---

## 1. Context

The admin app is a Next.js App Router application (`next` 16.x) with no Web App Manifest or service worker today. Root `app/layout.tsx` already defines basic `metadata` (title, description, favicon-related icons). The goal is to make the app **installable** as a PWA and to show an **install banner** on both mobile and desktop **after authentication**, without introducing offline admin workflows or caching sensitive API data.

---

## 2. Goals

- Meet **installability** requirements for Chromium-based browsers (manifest, icons, secure context, and a minimal service worker where required).
- Show a consistent **install banner** in the main app **only when the admin is signed in** (`AdminAuthProvider`: `isAuthenticated && !loading`).
- Support **platform-appropriate UX**: one-tap **Install** where `beforeinstallprompt` exists; **Share → Add to Home Screen** instructions on iOS Safari.
- Allow users to **dismiss** the banner for the **current browser session** (see §4); show again on a later visit.

## 3. Non-Goals

- Offline-first admin workflows, background sync, or web push notifications.
- Caching authenticated HTML, JSON, or API responses in the service worker.
- Showing the install banner on the login page or before authentication.

---

## 4. Decisions Captured From Brainstorming

| Topic | Decision |
|--------|-----------|
| Caching / SW | **Install-only:** no data caching; optional **minimal** SW whose `fetch` handler delegates to the network only, if needed for installability. |
| When to show banner | **After login only**, on any in-app route. |
| Dismiss behavior | **Session-scoped:** dismiss hides for the current session (e.g. `sessionStorage`); a later visit may show the banner again if still installable. |
| iOS / Safari | **Same banner pattern**, **different copy**: instructional steps instead of a fake Install button. |

---

## 5. Architecture

### 5.1 Web App Manifest

- Provide a manifest via the App Router-supported approach (e.g. `app/manifest.ts` exporting manifest metadata, or equivalent in this repo’s Next version).
- Required fields for install UX: `name`, `short_name`, `start_url`, `display` (`standalone` preferred), `theme_color`, `background_color`, and `icons` including at least **192×192** and **512×512** (maskable variants if assets exist).
- Align colors with the existing admin theme tokens where practical.

### 5.2 Metadata alignment

- Extend root `metadata` as needed (`themeColor`, `appleWebApp`, manifest link) so installed appearance and browser chrome stay consistent with the manifest.

### 5.3 Minimal service worker (install-only)

- Add a **minimal** service worker registered at **site scope** (e.g. `/`) that **does not** cache responses: **no precache list, no runtime caching** — `fetch` handler forwards to the network only (or equivalent no-op caching policy), so implementers must not enable Workbox-style defaults that cache HTML or API routes.
- The SW file typically lives under **`public/`** (e.g. `public/sw.js`) and is registered from **client** code via `navigator.serviceWorker.register` — the App Router does not provide a first-class service worker route; avoid assuming a built-in Next.js SW.
- Registration runs from client code once per load/session as appropriate; failures are non-fatal (see §7). After deploys, rely on normal **update** behavior (new SW activates on navigation); no offline cache invalidation is required because nothing is cached.

**Rationale:** Chromium historically ties installability to a registered service worker with a fetch handler; we satisfy that without storing admin data offline.

### 5.4 Install banner (client)

- New client component (e.g. `PwaInstallBanner`) marked `"use client"`.
- Render **`PwaInstallBanner` as a descendant of `AdminAuthProvider`** in `app/layout.tsx` (e.g. nested inside `<AdminAuthProvider>...</AdminAuthProvider>` next to `ReactQueryProvider` / `ThemeProvider`), **not** as a sibling outside the provider — `useAdminAuth()` only works on descendants of `AdminAuthProvider`.
- Only render when **`isAuthenticated && !loading`**.
- **Visibility rules — hide when:**
  - User is not authenticated or auth is still loading.
  - App runs in **standalone** / installed mode: `matchMedia('(display-mode: standalone)')` and iOS `navigator.standalone`.
  - User dismissed in this session (`sessionStorage` flag).
- **Chromium / Android Chrome:** listen for `beforeinstallprompt`, prevent default, store the event; primary action triggers `prompt()` and handles `userChoice`.
- **iOS Safari:** no `beforeinstallprompt`; show the same bar with **instructional copy** (Share → Add to Home Screen) and **Dismiss**; do not show a deceptive Install button.
- **Placement:** fixed **bottom** of the viewport, respecting safe-area insets; accessible labels and buttons.

### 5.5 Assets

- Add PNG (or generated) icons under `public/` for manifest icons (192, 512, optional maskable). Ensure existing `metadata.icons` paths in `layout.tsx` remain valid or are updated so favicon and PWA icons do not 404 in production.

---

## 6. Data Flow

1. App loads → auth provider resolves session.
2. When `isAuthenticated` becomes true, banner component mounts → registers SW (if implemented) → checks standalone / session dismiss / platform.
3. Chromium: on `beforeinstallprompt`, show Install + Dismiss.
4. iOS: show instructions + Dismiss.
5. User dismisses → set `sessionStorage` key; banner unmounts or hides until tab/session semantics clear storage (per browser).
6. User installs from prompt → standalone mode; banner hidden on next load.

---

## 7. Errors and Edge Cases

- **SW registration fails:** log in development; do not block rendering; banner may still be useful on iOS or degrade gracefully on Chromium if install criteria are unmet.
- **`sessionStorage` throws:** catch and treat as “not dismissed” or skip persisting dismiss to avoid infinite loops.
- **`sessionStorage` is per-tab:** dismissing in one tab does **not** hide the banner in other open tabs (unless out-of-scope sync via `storage` events / `localStorage` is added later).
- **Logout + login in the same tab:** the session dismiss key **remains** until the tab is closed (by design for “this session”). If product later wants the banner to reappear after every login, clear the dismiss key in **`signOut`** (implementation option — not required for v1).
- **`beforeinstallprompt` never fires:** do not crash; iOS path still works; Chromium users may see no primary install action until criteria are met (engagement, HTTPS, etc.).
- **Install prompt dismissed:** clear stored event; avoid repeated automatic prompts without a new user gesture where applicable.
- **Development:** install prompts often require HTTPS and real engagement; document for contributors in implementation notes or `TESTING.md` if useful.

---

## 8. Testing

- **Manual:** Chrome desktop (install), Android Chrome if available, iOS Safari (instructions only). Verify: no banner on `/login` or when logged out; banner after login; dismiss persists for session; no banner in standalone.
- **Automated (optional):** Playwright assertion that login route does not render the banner (`data-testid`), and authenticated page includes manifest link — avoid flakiness on `beforeinstallprompt`.

---

## 9. Security Notes

- Do not cache authenticated API responses or sensitive pages in the service worker.
- Treat the admin app as **online-only** for data; PWA scope is UX (install + home screen), not offline admin access.

---

## 10. Open Items for Implementation

- Confirm exact Next.js 16 API for `app/manifest.ts` and any `metadata` merge behavior.
- Verify installability checklist in a staging deployment (HTTPS, icons, manifest, SW).
- Final copy strings for iOS vs Chromium banners (product/legal tone).
- Service worker: implement as `public/sw.js` (or build output under `public/`) plus client registration; confirm no third-party PWA plugin injects caching.
