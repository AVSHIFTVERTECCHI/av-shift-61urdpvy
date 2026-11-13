import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, FileText, Plus } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Booking, PayStatus, Service, Settings, Shift, Summary, Today } from "@/lib/types";
import { DEFAULT_SETTINGS, STATUS_LABEL } from "@/lib/types";
import { exportCsv, fmtEur, fmtMonth, shiftMonth } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import Header from "@/components/Header";
import KpiStats from "@/components/KpiStats";
import EarningsChart from "@/components/EarningsChart";
import ShiftList from "@/components/ShiftList";
import ShiftDialog from "@/components/ShiftDialog";
import SettingsDialog from "@/components/SettingsDialog";
import MonthRecap from "@/components/MonthRecap";
import InvoiceDialog from "@/components/InvoiceDialog";
import ServiceStatusBar from "@/components/ServiceStatusBar";
import PendingBookings from "@/components/PendingBookings";
import IosInstallBanner from "@/components/IosInstallBanner";
import ServiceGroups from "@/components/ServiceGroups";
import type { ShiftPrefill } from "@/components/ShiftDialog";

const FILTERS: (PayStatus | "all")[] = ["all", "da_fatturare", "fatturato", "pagato"];

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Dashboard() {
  const todayQ = useQuery({ queryKey: ["today"], queryFn: () => apiGet<Today>("/today") });
  const today = todayQ.data?.today ?? localToday();
  const [pickedMonth, setPickedMonth] = useState<string | null>(null);
  const month = pickedMonth ?? today.slice(0, 7);
  const [filter, setFilter] = useState<PayStatus | "all">("all");
  const [serviceFilter, setServiceFilter] = useState("");
  const goMonth = (m: string | null) => {
    setPickedMonth(m);
    setServiceFilter("");
  };
  const [dialog, setDialog] = useState<{
    open: boolean;
    shift: Shift | null;
    key: number;
    date: string | null;
    prefill?: ShiftPrefill;
  }>({
    open: false, shift: null, key: 0, date: null,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [invoice, setInvoice] = useState<{ open: boolean; service?: string; key: number }>({ open: false, key: 0 });
  const openInvoice = (service?: string) => setInvoice((i) => ({ open: true, service, key: i.key + 1 }));

  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: () => apiGet<Settings>("/settings") });
  const servicesQ = useQuery({ queryKey: ["services"], queryFn: () => apiGet<Service[]>("/services") });
  const summaryQ = useQuery({ queryKey: ["summary", month], queryFn: () => apiGet<Summary>(`/summary?month=${month}`) });
  const shiftsQ = useQuery({ queryKey: ["shifts", month], queryFn: () => apiGet<Shift[]>(`/shifts?month=${month}`) });
  const bookingsQ = useQuery({ queryKey: ["bookings", month], queryFn: () => apiGet<Booking[]>(`/bookings?month=${month}`) });

  const settings = settingsQ.data ?? DEFAULT_SETTINGS;
  const services = servicesQ.data ?? [];
  const allShifts = shiftsQ.isError ? [] : shiftsQ.data ?? [];
  const shiftDates = new Set(allShifts.map((s) => s.date));
  // calendar "Lavoro" days not yet registered as a shift
  const pendingAll = (bookingsQ.isError || shiftsQ.isError ? [] : bookingsQ.data ?? [])
    .filter((b) => b.kind === "lavoro" && !shiftDates.has(b.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const pending = serviceFilter ? pendingAll.filter((b) => b.service_name === serviceFilter) : pendingAll;
  const byService = serviceFilter ? allShifts.filter((s) => s.service_name === serviceFilter) : allShifts;
  const shifts = filter === "all" ? byService : byService.filter((s) => s.status === filter);
  const summary = summaryQ.isError ? undefined : summaryQ.data;

  const openNew = (date: string | null = null) => setDialog((d) => ({ open: true, shift: null, key: d.key + 1, date }));
  const openEdit = (shift: Shift) => setDialog((d) => ({ open: true, shift, key: d.key + 1, date: null }));
  const openFromBooking = (b: Booking) =>
    setDialog((d) => ({ open: true, shift: null, key: d.key + 1, date: b.date, prefill: { service_name: b.service_name, event: b.note } }));
  const defaultDate = month === today.slice(0, 7) ? today : `${month}-01`;

  const onExport = () => {
    if (shifts.length === 0) {
      toast.error("Nessuna giornata da esportare");
      return;
    }
    exportCsv(shifts, `av-shift-${serviceFilter ? `${serviceFilter.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-` : ""}${month}.csv`);
    toast.success("Report CSV scaricato");
  };

  return (
    <div className="min-h-screen pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-12 lg:pl-64">
      <Header onAdd={() => openNew()} onSettings={() => setSettingsOpen(true)} />

      <main className="mx-auto max-w-6xl space-y-6 px-4 pt-6 md:space-y-8 md:px-6 md:pt-8 xl:max-w-7xl xl:px-10">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Il tuo mese</p>
            <h1 className="font-heading text-3xl font-bold capitalize tracking-tight md:text-4xl" data-testid="current-month-label">
              {fmtMonth(month)}
            </h1>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <Button variant="ghost" size="icon" onClick={() => goMonth(shiftMonth(month, -1))} aria-label="Mese precedente" data-testid="month-prev-button">
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => goMonth(null)} data-testid="month-today-button">
              Oggi
            </Button>
            <Button variant="ghost" size="icon" onClick={() => goMonth(shiftMonth(month, 1))} aria-label="Mese successivo" data-testid="month-next-button">
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </section>

        <KpiStats summary={summary} />

        <div className="grid grid-cols-1 gap-6 md:gap-8 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-xl font-semibold">Giornate</h2>
            <div className="flex items-center gap-2">
              <Button onClick={() => openInvoice()} className="font-semibold" data-testid="open-invoice-button">
                <FileText aria-hidden="true" /> Riepilogo fattura
              </Button>
              <Button variant="outline" onClick={onExport} data-testid="export-csv-button">
                <Download aria-hidden="true" /> <span className="hidden sm:inline">Esporta CSV</span>
              </Button>
            </div>
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist">
            {FILTERS.map((f) => {
              const count = f === "all" ? byService.length : byService.filter((s) => s.status === f).length;
              const active = filter === f;
              return (
                <button
                  key={f}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(f)}
                  data-testid={`filter-${f}`}
                  className={`h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors duration-200 ${
                    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "all" ? "Tutte" : STATUS_LABEL[f]} <span className="ml-1 font-mono text-xs opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
          {filter === "all" && (
            <>
              <PendingBookings bookings={pending} onComplete={openFromBooking} />
              <ServiceStatusBar month={month} shifts={allShifts} service={serviceFilter} onServiceChange={setServiceFilter} />
            </>
          )}

          {filter !== "all" ? (
            <ServiceGroups
              shifts={shifts}
              status={filter}
              month={month}
              onShowDays={(svc) => {
                setFilter("all");
                setServiceFilter(svc);
              }}
            />
          ) : shiftsQ.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-card" />)}
            </div>
          ) : shifts.length === 0 && pending.length > 0 ? null : shifts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center" data-testid="empty-shifts">
              <p className="font-heading text-lg">Nessuna giornata</p>
              <p className="mt-1 text-sm text-muted-foreground">Aggiungi la tua prima giornata di lavoro per questo mese.</p>
              <Button className="mt-4" onClick={() => openNew()} data-testid="empty-add-shift-button">
                <Plus aria-hidden="true" /> Nuova giornata
              </Button>
            </div>
          ) : (
            <ShiftList shifts={shifts} onEdit={openEdit} />
          )}
        </section>

        <aside className="min-w-0 space-y-4 md:space-y-6 xl:sticky xl:top-6" data-testid="dashboard-side-panel">
        <MonthRecap summary={summary} />

        <section className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3 xl:grid-cols-1">
          <div className="rounded-xl border border-border bg-card p-4 md:p-5 lg:col-span-2 xl:col-span-1">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-heading text-lg font-semibold">Andamento compensi</h2>
              <span className="text-xs text-muted-foreground">ultimi 6 mesi</span>
            </div>
            <EarningsChart trend={summary?.trend ?? []} month={month} />
          </div>
          <div className="rounded-xl border border-border bg-card p-4 md:p-5">
            <h2 className="mb-4 font-heading text-lg font-semibold">Per service</h2>
            <ul className="space-y-3" data-testid="by-service-list">
              {(summary?.by_service ?? []).length === 0 && (
                <li className="text-sm text-muted-foreground">Nessuna giornata questo mese.</li>
              )}
              {(summary?.by_service ?? []).map((s) => {
                const pct = summary && summary.gross > 0 ? (s.gross / summary.gross) * 100 : 0;
                return (
                  <li
                    key={s.service_name}
                    data-testid="by-service-item"
                    role="button"
                    tabIndex={0}
                    title="Apri riepilogo per fattura"
                    onClick={() => openInvoice(s.service_name)}
                    onKeyDown={(e) => e.key === "Enter" && openInvoice(s.service_name)}
                    className="-mx-2 cursor-pointer rounded-lg px-2 py-1 transition-colors duration-200 hover:bg-[#1C2233]"
                  >
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{s.service_name}</span>
                      <span className="font-mono tabular-nums">{fmtEur(s.gross)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#1A2030]">
                      <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                      <span>{s.days} {s.days === 1 ? "giornata" : "giornate"}</span>
                      <span className="font-mono text-[#6EE7B7]">netto {fmtEur(s.net)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
        </aside>
        </div>
      </main>

      <Button
        onClick={() => openNew()}
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 h-14 rounded-full px-5 text-base font-semibold shadow-[0_8px_30px_rgb(245_158_11/0.35)] sm:hidden"
        data-testid="fab-add-shift-button"
      >
        <Plus aria-hidden="true" /> Giornata
      </Button>

      {dialog.open && (
        <ShiftDialog
          key={dialog.key}
          open={dialog.open}
          onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
          shift={dialog.shift}
          defaultDate={dialog.date ?? defaultDate}
          prefill={dialog.prefill}
          settings={settings}
          services={services}
        />
      )}
      {invoice.open && (
        <InvoiceDialog
          key={invoice.key}
          open={invoice.open}
          onOpenChange={(o) => setInvoice((i) => ({ ...i, open: o }))}
          month={month}
          shifts={allShifts}
          name={settings.display_name}
          initialService={invoice.service}
          pending={pendingAll}
        />
      )}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} services={services} key={settingsQ.dataUpdatedAt} />
      <IosInstallBanner />
      <Toaster position="bottom-right" richColors mobileOffset={{ bottom: 90 }} />
    </div>
  );
}
