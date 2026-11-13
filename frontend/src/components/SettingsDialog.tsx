import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, LogOut, Plus, Trash2 } from "lucide-react";
import { endSession } from "@/lib/session";
import { ApiError, apiDelete, apiPost, apiPut } from "@/lib/api";
import type { Service, ServiceInput, Settings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HoursPicker, RatePicker } from "@/components/ServicePickers";

const toNum = (v: string) => {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function ServiceRow({ service }: { service: Service }) {
  const qc = useQueryClient();
  const [name, setName] = useState(service.name);
  const [rate, setRate] = useState(String(service.day_rate));
  const [hours, setHours] = useState(service.standard_hours ?? 9);
  const dirty = name !== service.name || toNum(rate) !== service.day_rate || hours !== service.standard_hours;
  const inv = () => {
    qc.invalidateQueries({ queryKey: ["services"] });
    qc.invalidateQueries({ queryKey: ["shifts"] });
    qc.invalidateQueries({ queryKey: ["summary"] });
  };
  const upd = useMutation({
    mutationFn: (b: ServiceInput) => apiPut<Service>(`/services/${service.id}`, b),
    onSuccess: () => { toast.success("Service aggiornato"); inv(); },
    onError: () => toast.error("Aggiornamento non riuscito"),
  });
  const del = useMutation({
    mutationFn: () => apiDelete<void>(`/services/${service.id}`),
    onSuccess: () => { toast.success("Service eliminato"); inv(); },
  });
  return (
    <li className="space-y-2.5 rounded-xl border border-border bg-[#0B0D13]/50 p-3" data-testid="service-row">
      <div className="flex items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome service" className="font-medium" data-testid="service-name-input" />
        <Button
          size="sm"
          variant={dirty ? "default" : "ghost"}
          disabled={!dirty || !name.trim() || upd.isPending}
          onClick={() => upd.mutate({ name: name.trim(), day_rate: toNum(rate), standard_hours: hours, notes: service.notes })}
          aria-label="Salva service"
          data-testid="service-save-button"
        >
          <Check aria-hidden="true" /> {dirty ? "Salva" : ""}
        </Button>
        <Button size="icon" variant="ghost" onClick={() => del.mutate()} aria-label="Elimina service" data-testid="service-delete-button">
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <RatePicker value={rate} onChange={setRate} testid="service-rate" />
        <HoursPicker value={hours} onChange={setHours} testid="service-hours" />
      </div>
    </li>
  );
}

function ServicesTab({ services }: { services: Service[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [rate, setRate] = useState("200");
  const [hours, setHours] = useState(9);
  const add = useMutation({
    mutationFn: (b: ServiceInput) => apiPost<Service>("/services", b),
    onSuccess: () => {
      toast.success("Service aggiunto");
      setName("");
      qc.invalidateQueries({ queryKey: ["services"] });
    },
    onError: () => toast.error("Inserisci nome e tariffa"),
  });
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        <span className="font-mono text-foreground">8+1</span> = straordinari dopo 9 ore ·{" "}
        <span className="font-mono text-foreground">9+1</span> = straordinari dopo 10 ore (dall'inizio alla fine, pausa inclusa).
      </p>
      <form
        className="space-y-2.5 rounded-xl border border-dashed border-primary/40 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          add.mutate({ name: name.trim(), day_rate: toNum(rate), standard_hours: hours, notes: "" });
        }}
      >
        <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">Nuovo service</Label>
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome azienda" data-testid="new-service-name-input" />
          <Button type="submit" data-testid="add-service-button"><Plus aria-hidden="true" /> Aggiungi</Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <RatePicker value={rate} onChange={setRate} testid="new-service-rate" />
          <HoursPicker value={hours} onChange={setHours} testid="new-service-hours" />
        </div>
      </form>
      <ul className="space-y-2" data-testid="service-list">
        {services.length === 0 && <li className="text-sm text-muted-foreground">Nessun service ancora.</li>}
        {services.map((s) => <ServiceRow key={`${s.id}-${s.day_rate}-${s.standard_hours}`} service={s} />)}
      </ul>
    </div>
  );
}

function ParamsTab({ settings }: { settings: Settings }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    standard_hours: String(settings.standard_hours),
    overtime_pct: String(settings.overtime_pct),
    tax_pct: String(settings.tax_pct),
    km_rate: String(settings.km_rate),
    meal_allowance: String(settings.meal_allowance),
    default_role: settings.default_role,
    display_name: settings.display_name ?? "",
  });
  const save = useMutation({
    mutationFn: (b: Settings) => apiPut<Settings>("/settings", b),
    onSuccess: () => { toast.success("Parametri predefiniti aggiornati"); qc.invalidateQueries({ queryKey: ["settings"] }); },
    onError: () => toast.error("Valori non validi"),
  });
  const fields: { k: keyof typeof f; label: string; mono?: boolean }[] = [
    { k: "standard_hours", label: "Ore prima dello straord. (se service senza impostazione)", mono: true },
    { k: "overtime_pct", label: "Straordinario orario (% tariffa)", mono: true },
    { k: "tax_pct", label: "Ritenuta % (lordo → netto)", mono: true },
    { k: "km_rate", label: "Rimborso € / km", mono: true },
    { k: "meal_allowance", label: "Vitto predefinito €", mono: true },
    { k: "default_role", label: "Ruolo predefinito" },
    { k: "display_name", label: "Il tuo nome (firma messaggi disponibilità)" },
  ];
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({
          standard_hours: toNum(f.standard_hours),
          overtime_pct: toNum(f.overtime_pct),
          tax_pct: toNum(f.tax_pct),
          km_rate: toNum(f.km_rate),
          meal_allowance: toNum(f.meal_allowance),
          default_role: f.default_role,
          display_name: f.display_name,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((x) => (
          <div key={x.k} className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">{x.label}</Label>
            <Input
              value={f[x.k]}
              onChange={(e) => setF((p) => ({ ...p, [x.k]: e.target.value }))}
              className={x.mono ? "font-mono" : ""}
              data-testid={`settings-${x.k}-input`}
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Esempio: tariffa 200 € e straordinario al 10% → ogni ora oltre le 9 ore vale 20 €. Netto = lordo − 28%.
      </p>
      <Button type="submit" disabled={save.isPending} data-testid="save-settings-button">Salva parametri</Button>
    </form>
  );
}

function SecurityTab() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const change = useMutation({
    mutationFn: () => apiPost<void>("/auth/change-pin", { current, new: next }),
    onSuccess: () => {
      toast.success("PIN cambiato. Gli altri dispositivi dovranno reinserirlo");
      setCurrent("");
      setNext("");
    },
    onError: (e) => {
      const d = e instanceof ApiError ? (e.body as { detail?: unknown } | null)?.detail : null;
      toast.error(typeof d === "string" ? d : "Il nuovo PIN deve avere da 4 a 6 cifre");
    },
  });
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);
  return (
    <div className="space-y-5">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          change.mutate();
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">PIN attuale</Label>
            <Input type="password" inputMode="numeric" autoComplete="current-password" value={current} onChange={(e) => setCurrent(digits(e.target.value))} className="font-mono tracking-[0.4em]" data-testid="current-pin-input" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">Nuovo PIN (4–6 cifre)</Label>
            <Input type="password" inputMode="numeric" autoComplete="new-password" value={next} onChange={(e) => setNext(digits(e.target.value))} className="font-mono tracking-[0.4em]" data-testid="new-pin-input" />
          </div>
        </div>
        <Button type="submit" disabled={current.length < 4 || next.length < 4 || change.isPending} data-testid="change-pin-button">
          Cambia PIN
        </Button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">Su questo dispositivo il PIN resta valido 90 giorni.</p>
        <Button variant="outline" onClick={() => endSession("/")} data-testid="logout-button">
          <LogOut aria-hidden="true" /> Blocca app
        </Button>
      </div>
    </div>
  );
}

export default function SettingsDialog({
  open, onOpenChange, settings, services,
}: { open: boolean; onOpenChange: (o: boolean) => void; settings: Settings; services: Service[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl" data-testid="settings-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Service & tariffe</DialogTitle>
          <DialogDescription>Ogni service ha la sua tariffa giornaliera. Gli straordinari si calcolano in automatico.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="services">
          <TabsList className="w-full">
            <TabsTrigger value="services" data-testid="settings-tab-services">Service</TabsTrigger>
            <TabsTrigger value="params" data-testid="settings-tab-params">Parametri</TabsTrigger>
            <TabsTrigger value="security" data-testid="settings-tab-security">Sicurezza</TabsTrigger>
          </TabsList>
          <TabsContent value="services" className="pt-3"><ServicesTab services={services} /></TabsContent>
          <TabsContent value="params" className="pt-3"><ParamsTab settings={settings} /></TabsContent>
          <TabsContent value="security" className="pt-3"><SecurityTab /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
