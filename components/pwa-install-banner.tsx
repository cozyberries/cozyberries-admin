"use client";

import { useAuth } from "@/components/supabase-auth-provider";
import { Button } from "@/components/ui/button";
import type { BeforeInstallPromptEvent } from "@/lib/pwa/before-install-prompt";
import {
  PWA_SESSION_DISMISS_KEY,
  isIosDevice,
  isStandaloneDisplay,
} from "@/lib/pwa/constants";
import { useCallback, useEffect, useState } from "react";

export function PwaInstallBanner() {
  const { isAuthenticated, loading } = useAuth();
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(PWA_SESSION_DISMISS_KEY) === "1") {
        setSessionDismissed(true);
      }
    } catch {
      /* private mode or blocked storage */
    }
    setSessionChecked(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || isIosDevice()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as unknown as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  useEffect(() => {
    const onInstalled = () => setSessionDismissed(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(PWA_SESSION_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setSessionDismissed(true);
  }, []);

  const onInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  if (!sessionChecked || loading || !isAuthenticated) return null;
  if (isStandaloneDisplay() || sessionDismissed) return null;

  const ios = isIosDevice();
  const showIos = ios;
  const showChromium = !ios && deferredPrompt !== null;

  if (!showIos && !showChromium) return null;

  return (
    <div
      role="region"
      aria-label="Install CozyBerries Admin"
      data-testid="pwa-install-banner"
      className="fixed top-0 left-0 right-0 z-[100] border-b border-border bg-background/95 p-4 pt-[max(1rem,env(safe-area-inset-top))] shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground">
          {showIos ? (
            <>
              Install this app: tap <strong>Share</strong>, then{" "}
              <strong>Add to Home Screen</strong>.
            </>
          ) : (
            <>
              Install CozyBerries Admin for quick access from your home screen or
              desktop.
            </>
          )}
        </p>
        <div className="flex shrink-0 gap-2">
          {!showIos && (
            <Button type="button" size="sm" onClick={onInstallClick}>
              Install
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" onClick={dismiss}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
