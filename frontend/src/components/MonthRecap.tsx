import type { Summary } from "@/lib/types";
import { fmtEur, fmtHours } from "@/lib/format";

/** Same recap block as the user's spreadsheet: Giornate / Ordinario / Straordinario / Totale mese. */
export default function MonthRecap({ summary }: { summary: Summary | undefined }) {
  const s = summary;
  const rows = [
    { id: "ordinary", label: "Ordinario", qty: s ? `${s.days} gg` : "", gross: s?.ordinary, net: s?.ordinary_net },
    { id: "overtime", label: "Straordinario", qty: s ? fmtHours(s.overtime_hours) : "", gross: s?.overtime_pay, net: s?.overtime_net },
  ];
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card" data-testid="month-recap">
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground md:px-5">
        <span>Riepilogo mese</span>
        <span className="w-12 text-right">Q.tà</span>
        <span className="w-[5.75rem] text-right">Tot lordo</span>
        <span className="w-[5.75rem] text-right">Tot netto</span>
      </div>
      {rows.map((r) => (
        <div key={r.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 border-t border-border px-4 py-2.5 text-sm md:px-5" data-testid={`recap-${r.id}`}>
          <span>{r.label}</span>
          <span className="w-12 text-right font-mono text-muted-foreground tabular-nums">{r.qty}</span>
          <span className="w-[5.75rem] text-right font-mono tabular-nums">{s ? fmtEur(r.gross ?? 0) : "—"}</span>
          <span className="w-[5.75rem] text-right font-mono text-[#6EE7B7] tabular-nums">{s ? fmtEur(r.net ?? 0) : "—"}</span>
        </div>
      ))}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 border-t border-primary/40 bg-primary/10 px-4 py-3 text-sm font-semibold md:px-5" data-testid="recap-total">
        <span className="font-heading">Totale mese</span>
        <span className="w-12 text-right font-mono text-muted-foreground tabular-nums">{s ? fmtHours(s.hours) : ""}</span>
        <span className="w-[5.75rem] text-right font-mono text-primary tabular-nums">{s ? fmtEur(s.gross) : "—"}</span>
        <span className="w-[5.75rem] text-right font-mono text-[#6EE7B7] tabular-nums">{s ? fmtEur(s.net) : "—"}</span>
      </div>
      {s && s.expenses > 0 && (
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground md:px-5">
          + rimborsi spese (non tassati): <span className="font-mono">{fmtEur(s.expenses)}</span>
        </div>
      )}
    </section>
  );
}
