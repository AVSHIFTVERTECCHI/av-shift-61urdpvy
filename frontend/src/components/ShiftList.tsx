import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Pencil, Trash2 } from "lucide-react";
import { parseISO, format } from "date-fns";
import { it } from "date-fns/locale";
import { apiDelete } from "@/lib/api";
import type { Shift } from "@/lib/types";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/types";
import { fmtEur, fmtHours } from "@/lib/format";
import { Button } from "@/components/ui/button";


function ShiftCard({ shift, onEdit, index }: { shift: Shift; onEdit: (s: Shift) => void; index: number }) {
  const qc = useQueryClient();
  const [confirmDel, setConfirmDel] = useState(false);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["shifts"] });
    qc.invalidateQueries({ queryKey: ["summary"] });
  };
  const delMut = useMutation({
    mutationFn: () => apiDelete<void>(`/shifts/${shift.id}`),
    onSuccess: () => {
      toast.success("Giornata eliminata");
      invalidate();
    },
    onError: () => toast.error("Eliminazione non riuscita"),
  });
  const d = parseISO(shift.date);

  return (
    <li
      data-testid="shift-item"
      style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}
      className="animate-rise group grid grid-cols-[auto_1fr] gap-3 rounded-xl border border-border bg-card p-3 transition-colors duration-200 hover:border-primary/40 hover:bg-[#161B28] md:grid-cols-[auto_1fr_auto] md:gap-5 md:p-4"
    >
      <div className="flex w-14 flex-col items-center justify-center rounded-lg border border-[#2E384D] bg-[#0B0D13] py-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {format(d, "EEE", { locale: it })}
        </span>
        <span className="font-heading text-2xl font-bold leading-none">{format(d, "d")}</span>
        <span className="text-[10px] uppercase tracking-wider text-primary">{format(d, "MMM", { locale: it })}</span>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="truncate font-heading text-base font-semibold" data-testid="shift-service-name">
            {shift.service_name}
          </h3>
          {shift.event && <span className="truncate text-sm text-muted-foreground">· {shift.event}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {shift.role && <span className="text-foreground/80">{shift.role}</span>}
          {shift.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" aria-hidden="true" />
              {shift.location}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs tabular-nums">
          <span className="rounded border border-[#2E384D] bg-[#0B0D13] px-1.5 py-0.5" data-testid="shift-times">
            {shift.start_time} → {shift.end_time}
          </span>
          <span data-testid="shift-hours">{fmtHours(shift.hours)}</span>
          {shift.pause_taken === false && (
            <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-red-300" data-testid="shift-nopause-badge">
              no pausa
            </span>
          )}
          {shift.overtime_hours > 0 && (
            <span
              className="rounded bg-primary/15 px-1.5 py-0.5 text-primary"
              data-testid="shift-overtime"
            >
              +{fmtHours(shift.overtime_hours)} straord. · {fmtEur(shift.overtime_pay)}
            </span>
          )}
          {shift.expenses_total > 0 && (
            <span className="text-muted-foreground">rimborsi {fmtEur(shift.expenses_total)}</span>
          )}
        </div>
      </div>

      <div className="col-span-2 flex items-center justify-between gap-2 border-t border-border pt-3 md:col-span-1 md:flex-col md:items-end md:justify-center md:border-0 md:pt-0">
        <div className="text-left md:text-right">
          <div className="font-mono text-lg font-bold tabular-nums" data-testid="shift-total">
            {fmtEur(shift.gross)}
          </div>
          <div className="font-mono text-[11px] text-[#6EE7B7]" data-testid="shift-net">netto {fmtEur(shift.net)}</div>
          <div className="font-mono text-[11px] text-muted-foreground">tariffa {fmtEur(shift.day_rate)}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            data-testid="shift-status-badge"
            className={`inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-semibold ${STATUS_CLASS[shift.status]}`}
          >
            {STATUS_LABEL[shift.status]}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(shift)}
            aria-label="Modifica giornata"
            data-testid="shift-edit-button"
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            variant={confirmDel ? "destructive" : "ghost"}
            size={confirmDel ? "sm" : "icon"}
            onClick={() => (confirmDel ? delMut.mutate() : setConfirmDel(true))}
            onBlur={() => setConfirmDel(false)}
            aria-label="Elimina giornata"
            data-testid="shift-delete-button"
          >
            {confirmDel ? "Conferma" : <Trash2 aria-hidden="true" />}
          </Button>
        </div>
      </div>
    </li>
  );
}

export default function ShiftList({ shifts, onEdit }: { shifts: Shift[]; onEdit: (s: Shift) => void }) {
  return (
    <ul className="space-y-3" data-testid="shift-list">
      {shifts.map((s, i) => (
        <ShiftCard key={s.id} shift={s} onEdit={onEdit} index={i} />
      ))}
    </ul>
  );
}
