import { useMemo, useState } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Copy, FileText, ImageIcon, MessageCircle } from "lucide-react";
import type { Booking, Shift } from "@/lib/types";
import { fmtEur, fmtHours, fmtMonth } from "@/lib/format";
import { invoiceImage, invoiceText, invoiceTotals, sortByDate } from "@/lib/invoice";
import type { InvoiceFormat } from "@/lib/invoice";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  month: string;
  shifts: Shift[]; // all shifts of the month
  name: string;
  initialService?: string;
  pending: Booking[]; // calendar work days without a registered shift
}

export default function InvoiceDialog({ open, onOpenChange, month, shifts, name, initialService, pending }: Props) {
  const serviceNames = useMemo(() => [...new Set(shifts.map((s) => s.service_name))].sort(), [shifts]);
  const pendingCount = (svc: string) => pending.filter((b) => b.service_name === svc).length;
  const [service, setService] = useState(initialService ?? serviceNames[0] ?? "");
  const [fmt, setFmt] = useState<InvoiceFormat>("tabella");
  const rows = useMemo(() => sortByDate(shifts.filter((s) => s.service_name === service)), [shifts, service]);
  const t = invoiceTotals(rows);
  const text = rows.length ? invoiceText(rows, { service, month, name, fmt }) : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Riepilogo copiato");
    } catch {
      toast.error("Copia non riuscita");
    }
  };
  const slug = service.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const [busyImg, setBusyImg] = useState(false);
  const shareImage = async () => {
    setBusyImg(true);
    try {
      const blob = await invoiceImage(rows, { service, month, name });
      const file = new File([blob], `riepilogo-${slug}-${month}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Tabella scaricata: allegala su WhatsApp");
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Impossibile creare l'immagine");
    } finally {
      setBusyImg(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl [&>*]:min-w-0" data-testid="invoice-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Riepilogo per fattura</DialogTitle>
          <DialogDescription className="capitalize">{fmtMonth(month)}</DialogDescription>
        </DialogHeader>

        {serviceNames.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground" data-testid="invoice-empty">
            Nessuna giornata registrata in questo mese.
          </p>
        ) : (
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1 basis-56 space-y-1.5">
                <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">Service</Label>
                <Select value={service} onValueChange={(v: string) => setService(v)}>
                  <SelectTrigger className="w-full" data-testid="invoice-service-select">
                    <SelectValue>{(v) => v as string}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {serviceNames.map((s) => (
                      <SelectItem key={s} value={s} data-testid={`invoice-service-option-${s}`}>
                        {s} · {shifts.filter((x) => x.service_name === s).length} gg
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex rounded-lg border border-border bg-[#0B0D13] p-0.5" data-testid="invoice-format-toggle">
                {(["tabella", "elenco"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFmt(f)}
                    data-testid={`invoice-format-${f}`}
                    className={`h-8 rounded-md px-3 text-sm font-medium capitalize transition-colors duration-200 ${
                      fmt === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {pendingCount(service) > 0 && (
              <p className="rounded-lg border border-[#EF4444]/40 bg-[#7F1D1D]/20 px-3 py-2 text-sm text-[#FECACA]" data-testid="invoice-pending-warning">
                Attenzione: {pendingCount(service)} {pendingCount(service) === 1 ? "giorno segnato" : "giorni segnati"} nel calendario per {service} non{" "}
                {pendingCount(service) === 1 ? "è ancora completato" : "sono ancora completati"} e non {pendingCount(service) === 1 ? "è incluso" : "sono inclusi"}. Completali dalla sezione "Da completare".
              </p>
            )}
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[520px] text-sm" data-testid="invoice-table">
                <thead className="bg-[#0B0D13]/70 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    {["Data", "Location", "Orario", "Ore", "Pausa", "Straord.", "Totale"].map((h, i) => (
                      <th key={h} className={`px-3 py-2 font-semibold ${i >= 3 ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {rows.map((s) => (
                    <tr key={s.id} className="border-t border-border" data-testid="invoice-row">
                      <td className="px-3 py-2 font-sans capitalize">{format(parseISO(s.date), "EEE dd/MM", { locale: it })}</td>
                      <td className="max-w-40 truncate px-3 py-2 font-sans">{s.location || "—"}</td>
                      <td className="px-3 py-2">{s.start_time}–{s.end_time}</td>
                      <td className="px-3 py-2 text-right">{fmtHours(s.hours)}</td>
                      <td className={`px-3 py-2 text-right font-sans ${s.pause_taken === false ? "text-red-300" : ""}`}>
                        {s.pause_taken === false ? "No" : "Sì"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {s.overtime_hours ? (
                          <span className="text-primary">{fmtHours(s.overtime_hours)} · {fmtEur(s.overtime_pay)}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-primary">{fmtEur(s.gross)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-primary/40 bg-primary/10 font-mono font-semibold tabular-nums">
                  <tr data-testid="invoice-totals">
                    <td className="px-3 py-2.5 font-heading" colSpan={3}>Totale · {t.days} giornate</td>
                    <td className="px-3 py-2.5 text-right">{fmtHours(t.hours)}</td>
                    <td />
                    <td className="px-3 py-2.5 text-right text-primary">{fmtHours(t.overtimeHours)} · {fmtEur(t.overtimePay)}</td>
                    <td className="px-3 py-2.5 text-right text-primary" data-testid="invoice-total-gross">{fmtEur(t.gross)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="rounded-xl border border-primary/40 bg-primary/10 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Totale da fatturare a {service}</div>
              <div className="mt-1 font-mono text-3xl font-bold text-primary" data-testid="invoice-gross-highlight">{fmtEur(t.gross)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Ordinario {fmtEur(t.ordinary)} + straordinario {fmtEur(t.overtimePay)}
                {t.expenses > 0 ? ` · rimborsi ${fmtEur(t.expenses)}` : ""}
              </div>
            </div>

            <details className="rounded-xl border border-border">
              <summary className="cursor-pointer px-4 py-2.5 text-sm text-muted-foreground" data-testid="invoice-text-toggle">
                <FileText className="mr-1.5 inline size-4" aria-hidden="true" /> Anteprima testo da inviare
              </summary>
              <pre className="overflow-x-auto whitespace-pre border-t border-border p-4 font-mono text-xs leading-relaxed" data-testid="invoice-text-preview">
                {text}
              </pre>
            </details>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button onClick={copy} className="h-11 font-semibold" data-testid="invoice-copy-button">
                <Copy aria-hidden="true" /> Copia testo
              </Button>
              <Button
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener")}
                className="h-11 bg-[#25D366] font-semibold text-[#062E16] hover:bg-[#1EBE5A]"
                data-testid="invoice-whatsapp-button"
              >
                <MessageCircle aria-hidden="true" /> Invia su WhatsApp
              </Button>
              <Button variant="outline" className="h-11 border-primary/50" onClick={shareImage} disabled={busyImg} data-testid="invoice-image-button">
                <ImageIcon aria-hidden="true" /> {busyImg ? "Creazione…" : "Tabella per cellulare"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              "Tabella per cellulare" crea un'immagine leggibile da inviare su WhatsApp (dal telefono si apre la condivisione).
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
