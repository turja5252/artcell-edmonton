"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "artcell-install-hint-dismissed";
const SEEN_KEY = "artcell-install-hint-seen";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function PwaBoot() {
  const [showHint, setShowHint] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(
    null
  );

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }

    if (isStandalone()) return;
    if (window.localStorage.getItem(DISMISS_KEY)) return;
    if (window.sessionStorage.getItem(SEEN_KEY)) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    setShowHint(true);
    window.sessionStorage.setItem(SEEN_KEY, "1");

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!showHint) return null;

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setShowHint(false);
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    setInstallEvent(null);
    dismiss();
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] mx-auto w-full max-w-3xl px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-primary/45 bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur-md">
        <p className="min-w-0 flex-1 text-sm leading-snug text-foreground">
          Add to Home Screen for a one-tap board.
        </p>
        {installEvent ? (
          <button
            type="button"
            className="shrink-0 text-sm font-semibold text-primary"
            onClick={() => void install()}
          >
            Install
          </button>
        ) : null}
        <button
          type="button"
          className="shrink-0 text-sm text-muted-foreground"
          onClick={dismiss}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
