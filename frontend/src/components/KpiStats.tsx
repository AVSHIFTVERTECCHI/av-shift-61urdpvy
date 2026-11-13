import { Clock, Euro, Hourglass, Wallet } from "lucide-react";
import type { Summary } from "@/lib/types";
import { fmtEur, fmtHours } from "@/lib/format";

export default function KpiStats({ summary }: { summary: Summary | undefined }) {
  const s = summary;
  const items = [
    {
      id: "kpi-total-gross",
      label: "Tot lordo mese",
      value: s ? fmtEur(s.gross) : "—",
      sub: s ? `straordinari ${fmtEur(s.overtime_pay)}` : "",
      icon: Euro,
      accent: "text-primary",
      big: true,
    },
    {
      id: "kpi-total-net",
      label: "Tot netto mese",
      value: s ? fmtEur(s.net) : "—",
      sub: "al netto della ritenuta",
      icon: Wallet,
      accent: "text-[#6EE7B7]",
    },
    {
      id: "kpi-pending",
      label: "Da incassare",
      value: s ? fmtEur(s.pending) : "—",
      sub: s ? `incassato ${fmtEur(s.paid)}` : "",
      icon: Hourglass,
      accent: "text-[#FDE68A]",
    },
    {
      id: "kpi-days",
      label: "Giornate · ore",
      value: s ? `${s.days} · ${fmtHours(s.hours)}` : "—",
      sub: s ? `+${fmtHours(s.overtime_hours)} straordinari` : "",
      icon: Clock,
      accent: "text-foreground",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      {items.map((it, i) => (
        <div
          key={it.id}
          style={{ animationDelay: `${i * 60}ms` }}
          className={`animate-rise relative overflow-hidden rounded-xl border border-border bg-card p-4 md:p-5 ${
            it.big ? "border-primary/40 bg-gradient-to-br from-primary/10 to-card" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{it.label}</span>
            <it.icon className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className={`mt-2 font-mono text-xl font-bold tracking-tight tabular-nums md:text-2xl ${it.accent}`} data-testid={it.id}>
            {it.value}
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{it.sub}</div>
        </div>
      ))}
    </div>
  );
}
