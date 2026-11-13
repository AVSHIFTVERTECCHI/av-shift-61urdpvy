import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { apiDelete, apiPost, apiPut } from "@/lib/api";
import type { Booking, BookingInput, BookingKind, Service } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const KINDS: { v: BookingKind; label: string; cls: string }[] = [
  { v: "lavoro", label: "Lavoro", cls: "border-[#EF4444] bg-[#7F1D1D] text-[#FECACA]" },
  { v: "opzione", label: "Opzione", cls: "border-[#F59E0B] bg-[#92400E] text-[#FEF3C7]" },
];

interface Props {
  dates: string[];
  bookings: Booking[]; // existing bookings among `dates`
  services: Service[];
  onClose: () => void;
}

export default function BookingDialog({ dates, bookings, services, onClose }: Props) {
  const qc = useQueryClient();
  const multi = dates.length > 1;
  const date = dates[0];
  const booking = bookings[0];
  const [kind, setKind] = useState<BookingKind>(booking?.kind ?? "lavoro");
  const [service, setService] = useState(booking?.service_name ?? "");
  const [note, setNote] = useState(booking?.note ?? "");
  const done = (msg: string) => {
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["bookings"] });
    onClose();
  };
  const save = useMutation({
    mutationFn: (b: BookingInput) =>
      multi ? apiPost<unknown>("/bookings/bulk", { ...b, dates }) : apiPut<unknown>(`/bookings/${date}`, b),
    onSuccess: () => done(multi ? `${dates.length} giorni segnati` : "Giorno segnato"),
    onError: () => toast.error("Salvataggio non riuscito"),
  });
  const free = useMutation({
    mutationFn: () =>
      multi ? apiPost<void>("/bookings/bulk-delete", { dates }) : apiDelete<void>(`/bookings/${date}`),
    onSuccess: () => done(multi ? "Giorni di nuovo liberi" : "Giorno di nuovo libero"),
    onError: () => toast.error("Operazione non riuscita"),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="booking-dialog">
        <DialogHeader>
          <DialogTitle className={`font-heading text-xl ${multi ? "" : "capitalize"}`} data-testid="booking-dialog-title">
            {multi ? `${dates.length} giorni selezionati` : format(parseISO(date), "EEEE d MMMM", { locale: it })}
          </DialogTitle>
          <DialogDescription>
            {multi
              ? [...dates].sort().map((d) => format(parseISO(d), "EEE d", { locale: it })).join(" · ")
              : "Segna il giorno come occupato o in opzione."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button
                type="button"
                key={k.v}
                onClick={() => setKind(k.v)}
                data-testid={`booking-kind-${k.v}`}
                className={`h-12 rounded-lg border text-base font-semibold transition-colors duration-200 ${
                  kind === k.v ? k.cls : "border-border bg-[#0B0D13] text-muted-foreground hover:text-foreground"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">Service (facoltativo)</Label>
            <div className="flex flex-wrap gap-1.5" data-testid="booking-service-chips">
              {services.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setService(service === s.name ? "" : s.name)}
                  data-testid={`booking-service-${s.id}`}
                  className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors duration-200 ${
                    service === s.name
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-[#0B0D13] text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
            <Input value={service} onChange={(e) => setService(e.target.value)} placeholder="Oppure scrivi il nome" data-testid="booking-service-input" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">Nota</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. montaggio Forum" data-testid="booking-note-input" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {bookings.length > 0 ? (
            <Button variant="outline" onClick={() => free.mutate()} disabled={free.isPending} data-testid="booking-free-button">
              {multi ? "Segna tutti come liberi" : "Segna come libero"}
            </Button>
          ) : (
            <span />
          )}
          <Button
            onClick={() => save.mutate({ kind, service_name: service.trim(), note: note.trim() })}
            disabled={save.isPending}
            className="font-semibold"
            data-testid="booking-save-button"
          >
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
