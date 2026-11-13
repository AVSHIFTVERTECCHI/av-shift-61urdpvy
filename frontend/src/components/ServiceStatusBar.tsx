import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import type { BulkResult, BulkStatusUpdate, PayStatus, Shift } from "@/lib/types";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/types";
import { fmtEur } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "__all";
const STATUSES: PayStatus[] = ["da_fatturare", "fatturato", "pagato"];

interface Props {
  month: string;
  shifts: Shift[]; // all shifts of the month
  service: string; // "" = all
  onServiceChange: (s: string) => void;
}

/** Service filter + "set status for all days of this service in the month". */
export default function ServiceStatusBar({ month, shifts, service, onServiceChange }: Props) {
  const qc = useQueryClient();
  const names = useMemo(() => [...new Set(shifts.map((s) => s.service_name))].sort(), [shifts]);
  const [pending, setPending] = useState<PayStatus | null>(null);
  const rows = shifts.filter((s) => s.service_name === service);
  const total = rows.reduce((a, s) => a + s.gross, 0);

  const mut = useMutation({
    mutationFn: (body: BulkStatusUpdate) => apiPost<BulkResult>("/shifts/bulk-status", body),
    onSuccess: (r, v) => {
      toast.success(`${r.updated} giornate di ${v.service_name} segnate come "${STATUS_LABEL[v.status]}"`);
      setPending(null);
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
    onError: () => toast.error("Aggiornamento non riuscito"),
  });

  if (names.length === 0) return null;

  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-card p-3" data-testid="service-status-bar">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Service</span>
        <Select value={service || ALL} onValueChange={(v: string) => { setPending(null); onServiceChange(v === ALL ? "" : v); }}>
          <SelectTrigger className="min-w-48 flex-1 sm:flex-none" data-testid="service-filter-select">
            <SelectValue>{(v) => (v === ALL ? "Tutti i service" : (v as string))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} data-testid="service-filter-all">Tutti i service</SelectItem>
            {names.map((n) => (
              <SelectItem key={n} value={n} data-testid={`service-filter-option-${n}`}>
                {n} · {shifts.filter((s) => s.service_name === n).length} gg
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {service && (
        <div className="animate-rise space-y-2 border-t border-border pt-2.5">
          <p className="text-sm">
            Segna <b>tutte le {rows.length} giornate</b> di <b>{service}</b> del mese ({fmtEur(total)}) come:
          </p>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((st) => {
              const already = rows.length > 0 && rows.every((r) => r.status === st);
              return (
                <button
                  key={st}
                  type="button"
                  disabled={already || mut.isPending}
                  onClick={() => setPending(st)}
                  data-testid={`bulk-status-${st}`}
                  className={`h-9 rounded-full border px-4 text-sm font-semibold transition-opacity duration-200 disabled:opacity-40 ${STATUS_CLASS[st]} ${
                    pending === st ? "ring-2 ring-white/70" : ""
                  }`}
                >
                  {STATUS_LABEL[st]} {already && "✓"}
                </button>
              );
            })}
          </div>
          {pending && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[#0B0D13]/70 p-2 text-sm" data-testid="bulk-status-confirm">
              <span>
                Confermi: {rows.length} giornate → <b>{STATUS_LABEL[pending]}</b>?
              </span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPending(null)} data-testid="bulk-status-cancel">Annulla</Button>
                <Button
                  size="sm"
                  disabled={mut.isPending}
                  onClick={() => mut.mutate({ month, service_name: service, status: pending })}
                  data-testid="bulk-status-confirm-button"
                >
                  Conferma
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
