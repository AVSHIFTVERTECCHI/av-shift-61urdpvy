import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import type { AuthStatus } from "@/lib/types";
import PinPad from "@/components/PinPad";

const errMsg = (e: unknown, fallback: string) => {
  const d = e instanceof ApiError ? (e.body as { detail?: unknown } | null)?.detail : null;
  return typeof d === "string" ? d : fallback;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]" data-testid="pin-screen">
      <div className="mb-10 flex items-center gap-2.5">
        <span className="size-2.5 rounded-full bg-red-500 animate-rec" aria-hidden="true" />
        <span className="font-heading text-2xl font-extrabold tracking-tight">
          AV<span className="text-primary">SHIFT</span>
        </span>
      </div>
      {children}
    </div>
  );
}

function SetupPin({ onDone }: { onDone: () => void }) {
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);

  const submit = async (pin: string) => {
    if (!first) {
      setFirst(pin);
      setError("");
      return;
    }
    if (pin !== first) {
      setFirst(null);
      setError("I PIN non coincidono, riprova");
      setReset((r) => r + 1);
      return;
    }
    setBusy(true);
    try {
      await apiPost<AuthStatus>("/auth/setup", { pin });
      onDone();
    } catch (e) {
      setError(errMsg(e, "Impossibile salvare il PIN"));
      setFirst(null);
      setReset((r) => r + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PinPad
      key={first ? "confirm" : "choose"}
      title={first ? "Conferma il PIN" : "Crea il tuo PIN"}
      subtitle={first ? "Digita di nuovo lo stesso PIN" : "Scegli da 4 a 6 cifre: servirà per aprire AV SHIFT"}
      length={first ? first.length : null}
      error={error}
      busy={busy}
      onSubmit={submit}
      resetKey={reset}
    />
  );
}

function LoginPin({ length, onDone }: { length: number; onDone: () => void }) {
  const [error, setError] = useState("");
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const submit = async (pin: string) => {
    setBusy(true);
    try {
      await apiPost<AuthStatus>("/auth/login", { pin });
      onDone();
    } catch (e) {
      setError(errMsg(e, "PIN errato"));
      setReset((r) => r + 1);
    } finally {
      setBusy(false);
    }
  };
  return (
    <PinPad title="Inserisci il PIN" length={length || null} error={error} busy={busy} onSubmit={submit} resetKey={reset} />
  );
}

/** Layout route: renders the app only with a valid PIN session. */
export default function PinGate() {
  const qc = useQueryClient();
  const statusQ = useQuery({ queryKey: ["auth-status"], queryFn: () => apiGet<AuthStatus>("/auth/status"), retry: 1 });

  useEffect(() => {
    const onUnauth = () => qc.invalidateQueries({ queryKey: ["auth-status"] });
    window.addEventListener("avshift:unauthorized", onUnauth);
    return () => window.removeEventListener("avshift:unauthorized", onUnauth);
  }, [qc]);

  // New session: drop any cached data (like lib/session beginSession) but keep the auth-status
  // query PinGate is observing — clearing it too would leave this component stuck on the PIN screen.
  const done = () => {
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth-status" });
    qc.setQueryData<AuthStatus>(["auth-status"], (s) => ({ pin_set: true, authenticated: true, pin_length: s?.pin_length ?? 0 }));
  };

  if (statusQ.data?.authenticated) return <Outlet />;
  if (statusQ.isLoading) return <Shell><span className="text-sm text-muted-foreground">Caricamento…</span></Shell>;
  if (statusQ.isError || !statusQ.data)
    return (
      <Shell>
        <p className="text-center text-sm text-muted-foreground" data-testid="pin-offline">
          Server non raggiungibile. Controlla la connessione e riapri l'app.
        </p>
      </Shell>
    );
  return <Shell>{statusQ.data.pin_set ? <LoginPin length={statusQ.data.pin_length} onDone={done} /> : <SetupPin onDone={done} />}</Shell>;
}
