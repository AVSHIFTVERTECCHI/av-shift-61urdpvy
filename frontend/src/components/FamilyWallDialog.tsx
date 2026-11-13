import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Download, RefreshCw } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Mirrors backend/routers/calendar_feed.py FeedInfo
interface FeedInfo {
  token: string;
  path: string;
}

export default function FamilyWallDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const feedQ = useQuery({ queryKey: ["calendar-feed"], queryFn: () => apiGet<FeedInfo>("/calendar/feed"), enabled: open });
  const url = feedQ.data ? `${window.location.origin}${feedQ.data.path}` : "";
  const rotate = useMutation({
    mutationFn: () => apiPost<FeedInfo>("/calendar/feed/rotate"),
    onSuccess: (d) => {
      qc.setQueryData(["calendar-feed"], d);
      toast.success("Nuovo link creato: il vecchio non funziona più");
    },
    onError: () => toast.error("Operazione non riuscita"),
  });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiato");
    } catch {
      toast.error("Copia non riuscita: tieni premuto sul link e copia");
    }
  };

  const steps = [
    "Copia il link qui sotto.",
    "Apri FamilyWall → Calendario → icona impostazioni (ingranaggio).",
    'Tocca "Aggiungi calendario da URL" e incolla il link. Dagli un nome, es. "Lavoro".',
    "Fatto: ogni giorno che segni in AV SHIFT (Lavoro, Opzione e giornate registrate) appare in FamilyWall in automatico.",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg [&>*]:min-w-0" data-testid="familywall-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Collega a FamilyWall</DialogTitle>
          <DialogDescription>Il tuo calendario di lavoro sincronizzato automaticamente con FamilyWall.</DialogDescription>
        </DialogHeader>

        <ol className="space-y-2.5">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>

        <div className="space-y-2">
          <Input
            readOnly
            value={feedQ.isError ? "Link non disponibile al momento" : url || "Caricamento…"}
            onFocus={(e) => e.currentTarget.select()}
            className="font-mono text-xs"
            data-testid="familywall-feed-url"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button onClick={copy} disabled={!url} className="h-11 font-semibold" data-testid="familywall-copy-button">
              <Copy aria-hidden="true" /> Copia link
            </Button>
            <a
              href={url || undefined}
              download="av-shift.ics"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium transition-colors duration-200 hover:bg-accent"
              data-testid="familywall-download-ics"
            >
              <Download className="size-4" aria-hidden="true" /> Scarica file .ics
            </a>
          </div>
        </div>

        <div className="space-y-1.5 rounded-xl border border-border bg-[#0B0D13]/60 p-3 text-xs text-muted-foreground">
          <p>
            ⚠️ In FamilyWall "Aggiungi calendario da URL" è una funzione <b className="text-foreground">Premium</b>. FamilyWall
            aggiorna il calendario da solo, di solito entro 15–60 minuti (non è istantaneo).
          </p>
          <p>
            Senza Premium puoi usare "Scarica file .ics" e importarlo dal sito di FamilyWall (Calendario → Importa da ICS), ma
            le modifiche successive non arrivano in automatico.
          </p>
          <p>Il link è personale: non condividerlo. Se finisce in mani sbagliate, creane uno nuovo.</p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="self-start text-muted-foreground"
          onClick={() => rotate.mutate()}
          disabled={rotate.isPending}
          data-testid="familywall-rotate-button"
        >
          <RefreshCw aria-hidden="true" /> Crea un nuovo link (disattiva il vecchio)
        </Button>
      </DialogContent>
    </Dialog>
  );
}
