import { useCallback, useEffect, useRef, useState } from "react";
import { Delete } from "lucide-react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

interface Props {
  title: string;
  subtitle?: string;
  error?: string;
  busy?: boolean;
  /** fixed length → auto-submit when reached; null → 4-6 digits with a "Continua" button */
  length: number | null;
  onSubmit: (pin: string) => void;
  resetKey?: number; // change to clear the input (e.g. after an error)
}

export default function PinPad({ title, subtitle, error, busy, length, onSubmit, resetKey = 0 }: Props) {
  const [pin, setPin] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const max = length ?? 6;

  useEffect(() => {
    setPin("");
    if (resetKey) setShakeKey((k) => k + 1);
  }, [resetKey]);

  const press = useCallback(
    (k: string) => {
      if (busy) return;
      if (k === "del") return setPin((p) => p.slice(0, -1));
      setPin((p) => {
        if (p.length >= max) return p;
        return p + k;
      });
    },
    [busy, max],
  );

  // auto-submit once when a fixed-length PIN is complete (effect, not inside a state updater)
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (!length || pin.length !== length) {
      sent.current = null;
      return;
    }
    if (sent.current === pin) return;
    sent.current = pin;
    const t = setTimeout(() => onSubmit(pin), 120);
    return () => clearTimeout(t);
  }, [pin, length]); // eslint-disable-line react-hooks/exhaustive-deps

  // physical keyboard on PC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
      else if (e.key === "Enter" && !length && pin.length >= 4) onSubmit(pin);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, length, pin, onSubmit]);

  return (
    <div className="flex w-full max-w-xs flex-col items-center" data-testid="pin-pad">
      <h1 className="font-heading text-2xl font-bold" data-testid="pin-title">{title}</h1>
      {subtitle && <p className="mt-1.5 text-center text-sm text-muted-foreground">{subtitle}</p>}

      <div key={shakeKey} className={`mt-7 flex h-5 items-center gap-3.5 ${shakeKey ? "animate-shake" : ""}`} data-testid="pin-dots">
        {Array.from({ length: length ?? Math.max(4, pin.length) }).map((_, i) => (
          <span
            key={i}
            className={`size-3.5 rounded-full border-2 transition-colors duration-150 ${
              i < pin.length ? "border-primary bg-primary" : "border-[#475569]"
            }`}
          />
        ))}
      </div>
      <p className="mt-3 h-5 text-sm text-red-400" role="alert" data-testid="pin-error">{error}</p>

      <div className="mt-4 grid grid-cols-3 gap-4">
        {KEYS.map((k, i) =>
          k === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(k)}
              disabled={busy}
              aria-label={k === "del" ? "Cancella" : k}
              data-testid={k === "del" ? "pin-key-del" : `pin-key-${k}`}
              className={`inline-flex size-[4.5rem] items-center justify-center rounded-full font-heading text-3xl font-medium transition-[background-color,transform] duration-150 active:scale-95 disabled:opacity-50 ${
                k === "del" ? "text-muted-foreground hover:text-foreground" : "bg-[#1A2030] hover:bg-[#232A3B] active:bg-primary active:text-primary-foreground"
              }`}
            >
              {k === "del" ? <Delete className="size-7" aria-hidden="true" /> : k}
            </button>
          ),
        )}
      </div>

      {!length && (
        <button
          type="button"
          disabled={pin.length < 4 || busy}
          onClick={() => onSubmit(pin)}
          data-testid="pin-continue-button"
          className="mt-6 h-11 w-full rounded-lg bg-primary font-semibold text-primary-foreground transition-opacity duration-200 disabled:opacity-30"
        >
          Continua
        </button>
      )}
    </div>
  );
}
