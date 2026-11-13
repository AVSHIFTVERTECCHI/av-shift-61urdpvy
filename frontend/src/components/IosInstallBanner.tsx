import { useState } from "react";
import { Share, SquarePlus, X } from "lucide-react";
import { isIOS, isStandalone } from "@/lib/install";

const KEY = "avshift-ios-install-dismissed";

/** On iPhone Safari (not yet installed) explain how to add AV SHIFT to the Home screen. */
export default function IosInstallBanner() {
  const [hidden, setHidden] = useState(() => !isIOS() || isStandalone() || localStorage.getItem(KEY) === "1");
  if (hidden) return null;
  return (
    <div
      className="animate-rise fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 rounded-2xl border border-primary/40 bg-[#131722]/95 p-4 shadow-[0_12px_40px_rgb(0_0_0/0.6)] backdrop-blur-xl lg:hidden"
      data-testid="ios-install-banner"
    >
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(KEY, "1");
          setHidden(true);
        }}
        aria-label="Chiudi"
        className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        data-testid="ios-install-dismiss"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
      <div className="flex gap-3">
        <img src="/apple-touch-icon.png" alt="" className="size-12 shrink-0 rounded-xl" />
        <div className="pr-6 text-sm">
          <p className="font-heading font-semibold">Installa AV SHIFT sull'iPhone</p>
          <p className="mt-1 text-muted-foreground">
            Tocca <Share className="inline size-4 text-[#0A84FF]" aria-label="Condividi" /> in Safari, poi{" "}
            <b className="text-foreground">
              <SquarePlus className="inline size-4" aria-hidden="true" /> Aggiungi alla schermata Home
            </b>
            . Si aprirà a schermo intero come un'app.
          </p>
        </div>
      </div>
    </div>
  );
}
