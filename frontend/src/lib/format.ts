import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import type { Shift, ShiftInput } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";

const eur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
export const fmtEur = (n: number) => eur.format(n || 0);

export const fmtHours = (h: number) => {
  const total = Math.round((h || 0) * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return mm ? `${hh}h ${String(mm).padStart(2, "0")}m` : `${hh}h`;
};

export const fmtDay = (iso: string) => format(parseISO(iso), "EEE d MMM", { locale: it });
export const fmtMonth = (ym: string) => format(parseISO(`${ym}-01`), "MMMM yyyy", { locale: it });
export const fmtMonthShort = (ym: string) => format(parseISO(`${ym}-01`), "MMM", { locale: it });

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Client-side preview of the backend compute_shift (server stays the source of truth). */
export function previewShift(s: ShiftInput) {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  let span = toMin(s.end_time) - toMin(s.start_time);
  if (span <= 0) span += 24 * 60;
  const hours = Math.max(0, (span - s.break_minutes) / 60);
  const overtime = Math.max(0, hours - s.standard_hours) + (s.pause_taken ? 0 : 1);
  const otRate = (s.day_rate * s.overtime_pct) / 100;
  const otPay = overtime * otRate;
  const expenses = s.km * s.km_rate + s.meal + s.other_expenses;
  const gross = s.day_rate + otPay;
  const net = gross * (1 - s.tax_pct / 100);
  return { hours, overtime, otRate, otPay, expenses, gross, net, total: gross + expenses };
}

const num = (n: number) => n.toFixed(2).replace(".", ",");

export function exportCsv(shifts: Shift[], filename: string) {
  // Same columns as the user's "TABELLA ORARI" sheet, plus reimbursements and payment status.
  const header = [
    "Giorno", "Data", "Service", "Location", "Tariffa", "Ora inizio", "Ora fine", "Ore", "Pausa", "Ore Straord",
    "€ Straord", "Tariffa Netta", "Totale", "Tot netto", "Evento", "Rimborsi", "Stato",
  ];
  // Neutralise spreadsheet formulas (CSV injection): text starting with = + - @ tab/CR gets a leading apostrophe.
  const esc = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
  const rows = [...shifts]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => [
      format(parseISO(s.date), "EEE", { locale: it }), format(parseISO(s.date), "dd/MM/yyyy"),
      esc(s.service_name), esc(s.location), num(s.day_rate), s.start_time, s.end_time, num(s.hours),
      s.pause_taken === false ? "No" : "Sì", num(s.overtime_hours), num(s.overtime_pay), num(s.day_rate_net), num(s.gross), num(s.net),
      esc(s.event), num(s.expenses_total), STATUS_LABEL[s.status],
    ].join(";"));
  const blob = new Blob(["\uFEFF" + [header.join(";"), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
