import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ClipboardPen } from "lucide-react";
import type { Booking } from "@/lib/types";
import { Button } from "@/components/ui/button";

/** Calendar "Lavoro" days that still have no registered shift (hours, location, pause). */
export default function PendingBookings({ bookings, onComplete }: { bookings: Booking[]; onComplete: (b: Booking) => void }) {
  if (bookings.length === 0) return null;
  return (
    <div className="rounded-xl border border-[#EF4444]/40 bg-[#7F1D1D]/15 p-3 md:p-4" data-testid="pending-bookings">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-heading text-base font-semibold">
          Da completare <span className="font-mono text-sm text-[#FECACA]" data-testid="pending-count">{bookings.length}</span>
        </h3>
        <span className="text-xs text-muted-foreground">Giorni segnati nel calendario: aggiungi orari, location e pausa</span>
      </div>
      <ul className="space-y-2">
        {bookings.map((b) => (
          <li
            key={b.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 transition-colors duration-200 hover:border-[#EF4444]/50"
            data-testid="pending-booking-item"
          >
            <div className="flex w-12 shrink-0 flex-col items-center rounded-md border border-[#7F1D1D] bg-[#0B0D13] py-1">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                {format(parseISO(b.date), "EEE", { locale: it })}
              </span>
              <span className="font-heading text-lg font-bold leading-none">{format(parseISO(b.date), "d")}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{b.service_name || "Service da indicare"}</div>
              {b.note && <div className="truncate text-xs text-muted-foreground">{b.note}</div>}
            </div>
            <Button size="sm" onClick={() => onComplete(b)} className="shrink-0 font-semibold" data-testid="pending-complete-button">
              <ClipboardPen aria-hidden="true" /> Completa
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
