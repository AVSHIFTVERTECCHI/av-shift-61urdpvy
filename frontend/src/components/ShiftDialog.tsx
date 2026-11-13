import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost, apiPut } from "@/lib/api";
import type { PayStatus, Service, Settings, Shift, ShiftInput } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { fmtEur, fmtHours, previewShift } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HoursPicker, RatePicker, hoursLabel } from "@/components/ServicePickers";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Form = { [K in keyof ShiftInput]: string };
const NUMERIC: (keyof ShiftInput)[] = [
  "break_minutes", "day_rate", "overtime_pct", "standard_hours", "tax_pct", "km", "km_rate", "meal", "other_expenses",
];
const OTHER = "__altro";

const toNum = (v: string) => {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function toInput(f: Form): ShiftInput {
  const out = { ...f } as Record<string, string | number>;
  for (const k of NUMERIC) out[k] = toNum(f[k]);
  out.break_minutes = Math.round(out.break_minutes as number);
  return { ...(out as unknown as ShiftInput), pause_taken: f.pause_taken !== "false" };
}

export interface ShiftPrefill {
  service_name?: string;
  event?: string;
}

function initialForm(shift: Shift | null, date: string, settings: Settings, services: Service[], prefill?: ShiftPrefill): Form {
  if (shift) {
    const f = {} as Form;
    for (const k of Object.keys(shift) as (keyof Shift)[]) {
      if (k in shift) (f as Record<string, string>)[k] = String(shift[k]);
    }
    f.pause_taken = shift.pause_taken === false ? "false" : "true";
    return f;
  }
  // a calendar booking may name a service: match it to get its rate and hours
  const named = prefill?.service_name?.trim();
  const svc = named ? services.find((s) => s.name.toLowerCase() === named.toLowerCase()) : services[0];
  return {
    date,
    service_id: svc?.id ?? "",
    service_name: svc?.name ?? named ?? "",
    event: prefill?.event ?? "",
    location: "",
    role: settings.default_role,
    start_time: "08:00",
    end_time: "17:00",
    break_minutes: "0",
    pause_taken: "true",
    day_rate: String(svc?.day_rate ?? 250),
    overtime_pct: String(settings.overtime_pct),
    standard_hours: String(svc?.standard_hours ?? settings.standard_hours),
    tax_pct: String(settings.tax_pct),
    km: "0",
    km_rate: String(settings.km_rate),
    meal: String(settings.meal_allowance),
    other_expenses: "0",
    status: "da_fatturare",
    notes: "",
  };
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  shift: Shift | null;
  defaultDate: string;
  prefill?: ShiftPrefill;
  settings: Settings;
  services: Service[];
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export default function ShiftDialog({ open, onOpenChange, shift, defaultDate, settings, services, prefill }: Props) {
  const qc = useQueryClient();
  const [f, setF] = useState<Form>(() => initialForm(shift, defaultDate, settings, services, prefill));
  const set = (k: keyof ShiftInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const p = previewShift(toInput(f));

  const save = useMutation({
    mutationFn: (body: ShiftInput) =>
      shift ? apiPut<Shift>(`/shifts/${shift.id}`, body) : apiPost<Shift>("/shifts", body),
    onSuccess: () => {
      toast.success(shift ? "Giornata aggiornata" : "Giornata salvata con successo");
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Controlla i campi: data, service e orari sono obbligatori"),
  });

  const onService = (v: string) => {
    if (v === OTHER) {
      setF((p) => ({ ...p, service_id: "", service_name: "" }));
      return;
    }
    const svc = services.find((s) => s.id === v);
    if (svc)
      setF((p) => ({
        ...p,
        service_id: svc.id,
        service_name: svc.name,
        day_rate: String(svc.day_rate),
        standard_hours: String(svc.standard_hours),
      }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.service_name.trim()) {
      toast.error("Indica il service");
      return;
    }
    save.mutate(toInput(f));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl" data-testid="shift-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">{shift ? "Modifica giornata" : "Nuova giornata"}</DialogTitle>
          <DialogDescription>
            Giornata {hoursLabel(toNum(f.standard_hours))}: straordinari oltre {f.standard_hours || "—"}h pagati al {f.overtime_pct || "—"}% della tariffa giornaliera.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
            <Field label="Data">
              <Input type="date" required value={f.date} onChange={set("date")} data-testid="shift-date-input" />
            </Field>
            <Field label="Service">
              <Select value={f.service_id || OTHER} onValueChange={onService}>
                <SelectTrigger className="w-full" data-testid="shift-service-select">
                  <SelectValue>
                    {(v) => (v === OTHER ? "Altro / nuovo" : services.find((s) => s.id === v)?.name ?? f.service_name)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id} data-testid={`shift-service-option-${s.id}`}>
                      {s.name} · {fmtEur(s.day_rate)} · {hoursLabel(s.standard_hours)}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTHER} data-testid="shift-service-option-other">Altro / nuovo</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {!f.service_id && (
              <Field label="Nome service" className="sm:col-span-2">
                <Input
                  value={f.service_name}
                  onChange={set("service_name")}
                  placeholder="Es. Studio Rental Milano"
                  data-testid="shift-service-name-input"
                />
              </Field>
            )}
            <Field label="Evento / produzione">
              <Input value={f.event} onChange={set("event")} placeholder="Es. Concerto Live" data-testid="shift-event-input" />
            </Field>
            <Field label="Location">
              <Input value={f.location} onChange={set("location")} placeholder="Es. Forum Assago" data-testid="shift-location-input" />
            </Field>
            <Field label="Ruolo" className="sm:col-span-2">
              <Input value={f.role} onChange={set("role")} placeholder="Es. Regia video, LED, camera" data-testid="shift-role-input" />
            </Field>
          </div>

          <div className="rounded-xl border border-border bg-[#0B0D13]/60 p-3 md:p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">Orari</span>
              {f.pause_taken === "false" && (
                <span className="text-xs text-primary" data-testid="shift-nopause-hint">Pausa saltata: +1h di straordinario</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Inizio">
                <Input type="time" step={1800} required value={f.start_time} onChange={set("start_time")} className="font-mono" data-testid="shift-start-input" />
              </Field>
              <Field label="Fine">
                <Input type="time" step={1800} required value={f.end_time} onChange={set("end_time")} className="font-mono" data-testid="shift-end-input" />
              </Field>
              <Field label="Pausa">
                <div className="flex gap-1.5" data-testid="shift-pause-toggle">
                  {[
                    { v: "true", label: "Sì" },
                    { v: "false", label: "No" },
                  ].map((o) => (
                    <button
                      type="button"
                      key={o.v}
                      onClick={() => setF((p) => ({ ...p, pause_taken: o.v }))}
                      data-testid={`shift-pause-${o.v === "true" ? "si" : "no"}`}
                      className={`h-9 flex-1 rounded-md border text-sm font-semibold transition-colors duration-200 ${
                        f.pause_taken === o.v
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-[#0B0D13] text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-[#0B0D13]/60 p-3 md:p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-primary">Compenso & rimborsi</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Tariffa giornaliera" className="col-span-2 sm:col-span-3">
                <RatePicker value={f.day_rate} onChange={(v) => setF((p) => ({ ...p, day_rate: v }))} testid="shift-dayrate" />
              </Field>
              <Field label="Giornata" className="col-span-2 sm:col-span-1">
                <HoursPicker
                  value={toNum(f.standard_hours)}
                  onChange={(v) => setF((p) => ({ ...p, standard_hours: String(v) }))}
                  testid="shift-hours"
                />
              </Field>
              <Field label="Straord. % / ora">
                <Input inputMode="decimal" value={f.overtime_pct} onChange={set("overtime_pct")} className="font-mono" data-testid="shift-otpct-input" />
              </Field>
              <Field label="Ritenuta % (netto)">
                <Input inputMode="decimal" value={f.tax_pct} onChange={set("tax_pct")} className="font-mono" data-testid="shift-tax-input" />
              </Field>
              <Field label="Km percorsi">
                <Input inputMode="decimal" value={f.km} onChange={set("km")} className="font-mono" data-testid="shift-km-input" />
              </Field>
              <Field label="€ / km">
                <Input inputMode="decimal" value={f.km_rate} onChange={set("km_rate")} className="font-mono" data-testid="shift-kmrate-input" />
              </Field>
              <Field label="Vitto €">
                <Input inputMode="decimal" value={f.meal} onChange={set("meal")} className="font-mono" data-testid="shift-meal-input" />
              </Field>
              <Field label="Altre spese €">
                <Input inputMode="decimal" value={f.other_expenses} onChange={set("other_expenses")} className="font-mono" data-testid="shift-other-input" />
              </Field>
            </div>
          </div>

          <Field label="Note">
            <Textarea value={f.notes} onChange={set("notes")} rows={2} data-testid="shift-notes-input" />
          </Field>

          <div className="grid grid-cols-2 gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 font-mono text-sm tabular-nums sm:grid-cols-4" data-testid="shift-preview">
            <div>
              <div className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground">Ore nette</div>
              <div data-testid="preview-hours">{fmtHours(p.hours)}</div>
            </div>
            <div>
              <div className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground">Straordinari</div>
              <div data-testid="preview-overtime">{fmtHours(p.overtime)} × {fmtEur(p.otRate)}</div>
            </div>
            <div>
              <div className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground">Totale lordo</div>
              <div className="text-lg font-bold text-primary" data-testid="preview-total">{fmtEur(p.gross)}</div>
            </div>
            <div>
              <div className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground">Totale netto</div>
              <div className="text-lg font-bold text-[#6EE7B7]" data-testid="preview-net">{fmtEur(p.net)}</div>
              {p.expenses > 0 && <div className="text-[11px] text-muted-foreground">+ rimborsi {fmtEur(p.expenses)}</div>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="shift-cancel-button">
              Annulla
            </Button>
            <Button type="submit" disabled={save.isPending} className="font-semibold" data-testid="save-shift-button">
              {save.isPending ? "Salvataggio…" : "Salva giornata"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
