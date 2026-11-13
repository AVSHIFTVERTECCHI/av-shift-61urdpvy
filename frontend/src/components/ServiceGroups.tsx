import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowRight, List } from "lucide-react";
import { apiPost } from "@/lib/api";
import type { BulkResult, BulkStatusUpdate, PayStatus, Shift } from "@/lib/types";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/types";
import { fmtEur, fmtHours } from "@/lib/format";
import { Button } from "@/components/ui/button";

const STATUSES: PayStatus[] = ["da_fatturare", "fatturato", "pagato"];

interface Group {
  service: string;
  days: Shift[];
  total: number;
  hours: number;
}

function GroupCard({ group, status, month, index, onShowDays }: {
  group: Group; status: PayStatus; month: string; index: number; onShowDays: (service: string) => void;
}) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<PayStatus | null>(null);
  const mut = useMutation({
    mutationFn: (body: BulkStatusUpdate) => apiPost<BulkResult>("/shifts/bulk-status", body),
    onSuccess: (r, v) => {
      toast.success(`${v.service_name}: ${r.updated} giornate → "${STATUS_LABEL[v.status]}"`);
      setTarget(null);
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
    onError: () => toast.error("Aggiornamento non riuscito"),
  });
  const dates = group.days.map((d) => format(parseISO(d.date), "d")).join(", ");
  const monthShort = format(parseISO(`${month}-01`), "MMM", { locale: it });

  return (
    <li
      className="animate-rise rounded-xl border border-border bg-card p-4 transition-colors duration-200 hover:border-primary/40"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      data-testid="service-group-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-heading text-lg font-semibold" data-testid="service-group-name">{group.service}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <b className="text-foreground" data-testid="service-group-days">{group.days.length}</b>{" "}
            {group.days.length === 1 ? "giornata" : "giornate"} · {fmtHours(group.hours)} · giorni {dates} {monthShort}
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-bold tabular-nums" data-testid="service-group-total">{fmtEur(group.total)}</div>
          <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">Sposta in:</span>
        {STATUSES.filter((s) => s !== status).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setTarget(s)}
            disabled={mut.isPending}
            data-testid={`service-group-move-${s}`}
            className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition-opacity duration-200 hover:opacity-85 ${STATUS_CLASS[s]} ${
              target === s ? "ring-2 ring-white/70" : ""
            }`}
          >
            <ArrowRight className="size-3" aria-hidden="true" /> {STATUS_LABEL[s]}
          </button>
        ))}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => onShowDays(group.service)} data-testid="service-group-show-days">
          <List aria-hidden="true" /> Giornate
        </Button>
      </div>

      {target && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-[#0B0D13]/70 p-2 text-sm" data-testid="service-group-confirm">
          <span>
            {group.days.length} giornate di <b>{group.service}</b> → <b>{STATUS_LABEL[target]}</b>?
          </span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setTarget(null)} data-testid="service-group-cancel">Annulla</Button>
            <Button
              size="sm"
              disabled={mut.isPending}
              onClick={() => mut.mutate({ month, service_name: group.service, status: target, from_status: status })}
              data-testid="service-group-confirm-button"
            >
              Conferma
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

/** Status tabs (Da fatturare / Fatturato / Pagato) show one card per service instead of single days. */
export default function ServiceGroups({ shifts, status, month, onShowDays }: {
  shifts: Shift[]; status: PayStatus; month: string; onShowDays: (service: string) => void;
}) {
  const map = new Map<string, Group>();
  for (const s of [...shifts].sort((a, b) => a.date.localeCompare(b.date))) {
    const g = map.get(s.service_name) ?? { service: s.service_name, days: [], total: 0, hours: 0 };
    g.days.push(s);
    g.total += s.gross;
    g.hours += s.hours;
    map.set(s.service_name, g);
  }
  const groups = [...map.values()].sort((a, b) => b.total - a.total);
  const grand = groups.reduce((a, g) => a + g.total, 0);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground" data-testid="service-groups-empty">
        Nessun service in "{STATUS_LABEL[status]}" questo mese.
      </div>
    );
  }
  return (
    <div className="space-y-3" data-testid="service-groups">
      <div className="flex items-baseline justify-between px-1 text-sm">
        <span className="text-muted-foreground">{groups.length} service</span>
        <span>
          Totale <b className="font-mono" data-testid="service-groups-grand-total">{fmtEur(grand)}</b>
        </span>
      </div>
      <ul className="space-y-3">
        {groups.map((g, i) => (
          <GroupCard key={g.service} group={g} status={status} month={month} index={i} onShowDays={onShowDays} />
        ))}
      </ul>
    </div>
  );
}
