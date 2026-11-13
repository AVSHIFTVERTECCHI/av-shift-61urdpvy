import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Check, ChevronLeft, ChevronRight, Link2, Share2, X } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Booking, Service, Settings, Shift, Today } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { fmtMonth, shiftMonth } from "@/lib/format";
import { monthDays } from "@/lib/availability";
import type { DayState } from "@/lib/availability";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import Header from "@/components/Header";
import SettingsDialog from "@/components/SettingsDialog";
import BookingDialog from "@/components/BookingDialog";
import ShareDialog from "@/components/ShareDialog";
import FamilyWallDialog from "@/components/FamilyWallDialog";
import IosInstallBanner from "@/components/IosInstallBanner";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const CELL: Record<DayState, string> = {
  free: "bg-[#065F46]/25 hover:bg-[#065F46]/45 text-[#D1FAE5]",
  opzione: "bg-[#92400E]/55 hover:bg-[#92400E]/75 text-[#FEF3C7]",
  lavoro: "bg-[#7F1D1D]/60 hover:bg-[#7F1D1D]/80 text-[#FECACA]",
  past: "bg-[#0B0D13]/50 text-muted-foreground/50",
};
const STATE_LABEL: Record<DayState, string> = { free: "Libero", opzione: "Opzione", lavoro: "Lavoro", past: "" };

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const todayQ = useQuery({ queryKey: ["today"], queryFn: () => apiGet<Today>("/today") });
  const today = todayQ.data?.today ?? localToday();
  const [picked, setPicked] = useState<string | null>(null);
  const month = picked ?? today.slice(0, 7);
  const [editing, setEditing] = useState<string[] | null>(null);
  const [multi, setMulti] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleMulti = () => {
    setMulti((m) => !m);
    setSelected(new Set());
  };
  const onDay = (iso: string) => {
    if (!multi) return setEditing([iso]);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  };
  const goMonth = (m: string | null) => {
    setPicked(m);
    setSelected(new Set());
  };
  const [shareOpen, setShareOpen] = useState(false);
  const [fwOpen, setFwOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: () => apiGet<Settings>("/settings") });
  const servicesQ = useQuery({ queryKey: ["services"], queryFn: () => apiGet<Service[]>("/services") });
  const bookingsQ = useQuery({ queryKey: ["bookings", month], queryFn: () => apiGet<Booking[]>(`/bookings?month=${month}`) });
  const shiftsQ = useQuery({ queryKey: ["shifts", month], queryFn: () => apiGet<Shift[]>(`/shifts?month=${month}`) });

  const settings = settingsQ.data ?? DEFAULT_SETTINGS;
  const services = servicesQ.data ?? [];
  const bookings = bookingsQ.isError ? [] : bookingsQ.data ?? [];
  const shiftDates = useMemo(() => new Set((shiftsQ.isError ? [] : shiftsQ.data ?? []).map((s) => s.date)), [shiftsQ.data, shiftsQ.isError]);
  const days = useMemo(() => monthDays(month, today, bookings, shiftDates), [month, today, bookings, shiftDates]);
  // counters describe what can still be offered/booked: upcoming days only
  const count = (s: DayState) => days.filter((d) => d.state === s).length;
  const lead = days[0]?.weekday ?? 0;

  return (
    <div className="min-h-screen pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-12 lg:pl-64">
      <Header onSettings={() => setSettingsOpen(true)} />
      <main className="mx-auto max-w-4xl space-y-5 px-4 pt-6 md:px-6 md:pt-8 xl:max-w-6xl xl:px-10">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Calendario impegni</p>
            <h1 className="font-heading text-3xl font-bold capitalize tracking-tight md:text-4xl" data-testid="calendar-month-label">
              {fmtMonth(month)}
            </h1>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <Button variant="ghost" size="icon" onClick={() => goMonth(shiftMonth(month, -1))} aria-label="Mese precedente" data-testid="calendar-prev-button">
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => goMonth(null)} data-testid="calendar-today-button">Oggi</Button>
            <Button variant="ghost" size="icon" onClick={() => goMonth(shiftMonth(month, 1))} aria-label="Mese successivo" data-testid="calendar-next-button">
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-sm" data-testid="calendar-counts">
            <span className="rounded-full border border-[#10B981]/40 bg-[#065F46]/40 px-3 py-1 text-[#D1FAE5]">
              Liberi <b className="font-mono" data-testid="count-free">{count("free")}</b>
            </span>
            <span className="rounded-full border border-[#F59E0B]/40 bg-[#92400E]/40 px-3 py-1 text-[#FEF3C7]">
              Opzione <b className="font-mono" data-testid="count-option">{count("opzione")}</b>
            </span>
            <span className="rounded-full border border-[#EF4444]/40 bg-[#7F1D1D]/40 px-3 py-1 text-[#FECACA]">
              Lavoro <b className="font-mono" data-testid="count-busy">{count("lavoro")}</b>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
          <Button
            variant={multi ? "default" : "outline"}
            onClick={toggleMulti}
            className="h-10 font-semibold"
            data-testid="toggle-multi-button"
            aria-pressed={multi}
          >
            <CalendarRange aria-hidden="true" /> {multi ? "Selezione attiva" : "Più giorni"}
          </Button>
          <Button variant="outline" onClick={() => setFwOpen(true)} className="h-10 font-semibold" data-testid="open-familywall-button">
            <Link2 aria-hidden="true" /> FamilyWall
          </Button>
          <Button onClick={() => setShareOpen(true)} className="h-10 bg-[#25D366] font-semibold text-[#062E16] hover:bg-[#1EBE5A]" data-testid="open-share-button">
            <Share2 aria-hidden="true" /> Condividi disponibilità
          </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card" data-testid="booking-calendar">
          <div className="grid grid-cols-7 border-b border-border bg-[#0B0D13]/60">
            {WEEKDAYS.map((d, i) => (
              <div key={d} className={`py-2 text-center text-[11px] font-semibold uppercase tracking-widest ${i >= 5 ? "text-primary/80" : "text-muted-foreground"}`}>
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 p-1 md:gap-1.5 md:p-1.5">
            {Array.from({ length: lead }).map((_, i) => <div key={`pad-${i}`} />)}
            {days.map((d) => {
              const label = d.booking?.service_name;
              return (
                <button
                  type="button"
                  key={d.iso}
                  onClick={() => onDay(d.iso)}
                  aria-pressed={multi ? selected.has(d.iso) : undefined}
                  data-testid={`booking-day-${d.iso}`}
                  data-state={d.mark}
                  data-past={d.isPast || undefined}
                  className={`relative flex min-h-16 flex-col items-start rounded-lg p-1.5 text-left transition-[background-color,opacity] duration-150 md:min-h-24 md:p-2 xl:min-h-28 ${CELL[d.mark]} ${
                    d.isPast ? "opacity-55 hover:opacity-90" : ""
                  } ${
                    d.iso === today ? "ring-2 ring-primary" : ""
                  } ${selected.has(d.iso) ? "outline-3 outline-offset-[-3px] outline-white" : ""}`}
                >
                  <span className="font-mono text-sm font-bold tabular-nums md:text-lg">{d.day}</span>
                  {d.mark !== "free" && (
                    <span className="mt-auto w-full truncate text-[9px] font-semibold uppercase leading-tight tracking-wide md:text-[11px]">
                      {label || STATE_LABEL[d.mark]}
                    </span>
                  )}
                  {selected.has(d.iso) && (
                    <span className="absolute right-1 top-1 inline-flex size-5 items-center justify-center rounded-full bg-white text-[#0B0D13]" data-testid="day-selected-mark">
                      <Check className="size-3.5" aria-hidden="true" />
                    </span>
                  )}
                  {d.hasShift && !selected.has(d.iso) && (
                    <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" title="Giornata registrata nei compensi" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        {multi && (
          <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 lg:bottom-4 flex items-center gap-2 rounded-xl border border-primary/50 bg-[#131722]/95 p-2.5 pl-4 shadow-[0_10px_40px_rgb(0_0_0/0.5)] backdrop-blur" data-testid="multi-bar">
            <span className="text-sm">
              <b className="font-mono text-primary" data-testid="multi-count">{selected.size}</b> {selected.size === 1 ? "giorno selezionato" : "giorni selezionati"}
            </span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected(new Set())} disabled={!selected.size} data-testid="multi-clear-button">
              <X aria-hidden="true" /> Azzera
            </Button>
            <Button size="sm" className="font-semibold" disabled={!selected.size} onClick={() => setEditing([...selected].sort())} data-testid="multi-mark-button">
              Segna giorni
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Con <b className="text-foreground">Più giorni</b> puoi selezionare diverse date e segnarle insieme. Tocca un giorno per segnarlo come <b className="text-[#FECACA]">Lavoro</b> o <b className="text-[#FEF3C7]">Opzione</b>. I giorni
          già registrati nei compensi (pallino arancio) risultano occupati.
        </p>
      </main>

      {editing && (
        <BookingDialog
          key={editing.join(",")}
          dates={editing}
          bookings={bookings.filter((b) => editing.includes(b.date))}
          services={services}
          onClose={() => {
            setEditing(null);
            setSelected(new Set());
          }}
        />
      )}
      <FamilyWallDialog open={fwOpen} onOpenChange={setFwOpen} />
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} month={month} days={days} name={settings.display_name} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} services={services} key={settingsQ.dataUpdatedAt} />
      <IosInstallBanner />
      <Toaster position="bottom-right" richColors mobileOffset={{ bottom: 90 }} />
    </div>
  );
}
