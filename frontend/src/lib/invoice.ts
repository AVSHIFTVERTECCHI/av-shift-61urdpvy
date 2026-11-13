import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import type { Shift } from "@/lib/types";
import { fmtHours } from "@/lib/format";

export type InvoiceFormat = "tabella" | "elenco";

export interface InvoiceTotals {
  days: number;
  hours: number;
  overtimeHours: number;
  ordinary: number;
  overtimePay: number;
  gross: number;
  expenses: number;
}

const n2 = (n: number) => n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur = (n: number) => `${n2(n)} €`;
const h1 = (h: number) => h.toLocaleString("it-IT", { maximumFractionDigits: 1 });
const pad = (s: string, w: number, right = false) => {
  const t = s.length > w ? s.slice(0, w - 1) + "…" : s;
  return right ? t.padStart(w) : t.padEnd(w);
};

export function invoiceTotals(shifts: Shift[]): InvoiceTotals {
  const sum = (f: (s: Shift) => number) => Math.round(shifts.reduce((a, s) => a + f(s), 0) * 100) / 100;
  return {
    days: shifts.length,
    hours: sum((s) => s.hours),
    overtimeHours: sum((s) => s.overtime_hours),
    ordinary: sum((s) => s.day_rate),
    overtimePay: sum((s) => s.overtime_pay),
    gross: sum((s) => s.gross),
    expenses: sum((s) => s.expenses_total),
  };
}

export const sortByDate = (shifts: Shift[]) =>
  [...shifts].sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

export function invoiceText(
  shifts: Shift[],
  opts: { service: string; month: string; name: string; fmt: InvoiceFormat },
): string {
  const rows = sortByDate(shifts);
  const t = invoiceTotals(rows);
  const monthLabel = format(parseISO(`${opts.month}-01`), "MMMM yyyy", { locale: it });
  const head = [`*Riepilogo ${monthLabel} - ${opts.service}*`];
  if (opts.name) head.push(opts.name);
  head.push("");

  let body: string[];
  if (opts.fmt === "tabella") {
    const line = (c: string[]) =>
      [pad(c[0], 5), pad(c[1], 10), pad(c[2], 11), pad(c[3], 5, true), pad(c[4], 2), pad(c[5], 4, true), pad(c[6], 8, true)].join(" ");
    const header = line(["DATA", "LOCATION", "ORARIO", "ORE", "P", "STR", "TOTALE"]);
    body = [
      "```",
      header,
      "-".repeat(header.length),
      ...rows.map((s) =>
        line([
          format(parseISO(s.date), "dd/MM"),
          s.location || "-",
          `${s.start_time}-${s.end_time}`,
          h1(s.hours),
          s.pause_taken === false ? "No" : "Sì",
          s.overtime_hours ? h1(s.overtime_hours) : "-",
          n2(s.gross),
        ]),
      ),
      "-".repeat(header.length),
      line(["TOT", `${t.days} gg`, "", h1(t.hours), "", h1(t.overtimeHours), n2(t.gross)]),
      "```",
      "P = pausa · STR = ore di straordinario",
    ];
  } else {
    body = rows.flatMap((s) => [
      `📅 *${format(parseISO(s.date), "EEE dd/MM", { locale: it })}*${s.location ? ` - ${s.location}` : ""}${s.event ? ` (${s.event})` : ""}`,
      `⏰ ${s.start_time}-${s.end_time} (${fmtHours(s.hours)}) · Pausa: ${s.pause_taken === false ? "No" : "Sì"}`,
      s.overtime_hours > 0
        ? `➕ Straordinario: ${fmtHours(s.overtime_hours)} x ${eur(s.overtime_rate)} = ${eur(s.overtime_pay)}`
        : "➕ Straordinario: nessuno",
      `💶 Tariffa ${eur(s.day_rate)} · *Totale ${eur(s.gross)}*`,
      "",
    ]);
    body.pop();
  }

  const totals = [
    "",
    `*TOTALE ${monthLabel.toUpperCase()}*`,
    `Giornate: ${t.days} · Ore: ${fmtHours(t.hours)}`,
    `Ordinario: ${eur(t.ordinary)}`,
    `Straordinario: ${fmtHours(t.overtimeHours)} = ${eur(t.overtimePay)}`,
    `*TOTALE: ${eur(t.gross)}*`,
  ];
  if (t.expenses > 0) totals.push(`Rimborsi spese: ${eur(t.expenses)}`);
  return [...head, ...body, ...totals].join("\n");
}

/** Phone-friendly PNG table (1080px wide) with gross (lordo) values only. */
export async function invoiceImage(shifts: Shift[], opts: { service: string; month: string; name: string }): Promise<Blob> {
  await document.fonts.ready;
  const rows = sortByDate(shifts);
  const t = invoiceTotals(rows);
  const W = 1080;
  const P = 48;
  const ROW = 78;
  const top = 360;
  const H = top + 70 + rows.length * ROW + 330;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const SANS = "'Plus Jakarta Sans Variable', sans-serif";
  const MONO = "'JetBrains Mono Variable', monospace";
  const HEAD = "'Outfit Variable', sans-serif";
  g.fillStyle = "#0B0D13";
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W, 0, 0, W, 0, 700);
  glow.addColorStop(0, "rgba(245,158,11,0.16)");
  glow.addColorStop(1, "rgba(245,158,11,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  // header
  g.fillStyle = "#EF4444";
  g.beginPath();
  g.arc(P + 10, 80, 10, 0, Math.PI * 2);
  g.fill();
  g.font = `800 32px ${HEAD}`;
  g.fillStyle = "#F3F4F6";
  g.fillText("AV", P + 30, 92);
  g.fillStyle = "#F59E0B";
  g.fillText("SHIFT", P + 30 + g.measureText("AV").width, 92);
  const monthLabel = format(parseISO(`${opts.month}-01`), "MMMM yyyy", { locale: it });
  g.fillStyle = "#9CA3AF";
  g.font = `600 26px ${SANS}`;
  g.fillText(`RIEPILOGO ${monthLabel.toUpperCase()}`, P, 170);
  g.fillStyle = "#F9FAFB";
  g.font = `700 64px ${HEAD}`;
  g.fillText(opts.service, P, 244, W - P * 2);
  if (opts.name) {
    g.fillStyle = "#FBBF24";
    g.font = `600 30px ${SANS}`;
    g.fillText(opts.name, P, 296);
  }

  // columns: [label, x, align]
  const cols: [string, number, CanvasTextAlign][] = [
    ["DATA", P, "left"],
    ["LOCATION", P + 130, "left"],
    ["ORARIO", P + 380, "left"],
    ["ORE", P + 660, "right"],
    ["PAUSA", P + 770, "right"],
    ["STR.", P + 860, "right"],
    ["TOTALE", W - P, "right"],
  ];
  g.fillStyle = "#131722";
  g.beginPath();
  g.roundRect(P - 16, top, W - (P - 16) * 2, 64, 12);
  g.fill();
  g.font = `700 22px ${SANS}`;
  g.fillStyle = "#9CA3AF";
  for (const [label, x, align] of cols) {
    g.textAlign = align;
    g.fillText(label, x, top + 41);
  }

  const fit = (text: string, max: number) => {
    let s = text;
    while (s.length > 1 && g.measureText(s).width > max) s = s.slice(0, -1);
    return s === text ? s : s.slice(0, -1) + "…";
  };
  rows.forEach((s, i) => {
    const y = top + 70 + i * ROW;
    if (i % 2 === 0) {
      g.fillStyle = "rgba(255,255,255,0.03)";
      g.fillRect(P - 16, y, W - (P - 16) * 2, ROW);
    }
    const base = y + ROW / 2 + 10;
    g.textAlign = "left";
    g.fillStyle = "#F3F4F6";
    g.font = `700 28px ${SANS}`;
    g.fillText(format(parseISO(s.date), "dd/MM"), cols[0][1], base);
    g.font = `500 26px ${SANS}`;
    g.fillStyle = "#D1D5DB";
    g.fillText(fit(s.location || "—", 235), cols[1][1], base);
    g.font = `500 24px ${MONO}`;
    g.fillText(`${s.start_time}-${s.end_time}`, cols[2][1], base);
    g.textAlign = "right";
    g.fillText(`${h1(s.hours)}h`, cols[3][1], base);
    g.font = `600 26px ${SANS}`;
    g.fillStyle = s.pause_taken === false ? "#FCA5A5" : "#9CA3AF";
    g.fillText(s.pause_taken === false ? "No" : "Sì", cols[4][1], base);
    g.font = `500 26px ${MONO}`;
    g.fillStyle = s.overtime_hours ? "#FBBF24" : "#4B5563";
    g.fillText(s.overtime_hours ? `${h1(s.overtime_hours)}h` : "—", cols[5][1], base);
    g.font = `700 28px ${MONO}`;
    g.fillStyle = "#FBBF24";
    g.fillText(n2(s.gross), cols[6][1], base);
  });

  // totals
  const fy = top + 70 + rows.length * ROW + 30;
  g.fillStyle = "rgba(245,158,11,0.12)";
  g.strokeStyle = "rgba(245,158,11,0.5)";
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(P - 16, fy, W - (P - 16) * 2, 230, 18);
  g.fill();
  g.stroke();
  g.textAlign = "left";
  g.fillStyle = "#FDE68A";
  g.font = `700 24px ${SANS}`;
  g.fillText("TOTALE", P + 8, fy + 52);
  g.fillStyle = "#F59E0B";
  g.font = `800 76px ${MONO}`;
  g.fillText(eur(t.gross), P + 8, fy + 136);
  g.fillStyle = "#D1D5DB";
  g.font = `500 26px ${SANS}`;
  g.fillText(
    `${t.days} giornate · ${fmtHours(t.hours)} · straordinario ${fmtHours(t.overtimeHours)} = ${eur(t.overtimePay)}`,
    P + 8,
    fy + 190,
    W - P * 2 - 16,
  );

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/png"));
}
