import { eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import type { Booking } from "@/lib/types";

export type DayState = "past" | "free" | "opzione" | "lavoro";

export interface DayInfo {
  iso: string;
  day: number;
  weekday: number; // 0 = lunedì
  state: DayState; // for sharing: past days are "past"
  mark: Exclude<DayState, "past">; // what is marked on the day, regardless of date (calendar display)
  isPast: boolean;
  booking?: Booking;
  hasShift: boolean;
}

/** Day-by-day state for a month. Registered shifts count as busy too. */
export function monthDays(month: string, today: string, bookings: Booking[], shiftDates: Set<string>): DayInfo[] {
  const first = parseISO(`${month}-01`);
  const byDate = new Map(bookings.map((b) => [b.date, b]));
  return eachDayOfInterval({ start: startOfMonth(first), end: endOfMonth(first) }).map((d) => {
    const iso = format(d, "yyyy-MM-dd");
    const booking = byDate.get(iso);
    const hasShift = shiftDates.has(iso);
    let mark: DayInfo["mark"] = "free";
    if (booking?.kind === "lavoro" || hasShift) mark = "lavoro";
    else if (booking?.kind === "opzione") mark = "opzione";
    const isPast = iso < today;
    const state: DayState = isPast ? "past" : mark;
    return { iso, day: d.getDate(), weekday: (d.getDay() + 6) % 7, state, mark, isPast, booking, hasShift };
  });
}

/** [1,2,3,5,7,8] -> "1-3, 5, 7-8" */
export function ranges(nums: number[]): string {
  const out: string[] = [];
  let i = 0;
  while (i < nums.length) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    out.push(j > i ? `${nums[i]}-${nums[j]}` : `${nums[i]}`);
    i = j + 1;
  }
  return out.join(", ");
}

export function availabilityText(
  month: string,
  days: DayInfo[],
  opts: { name: string; showBusy: boolean; showOptions: boolean },
): string {
  const label = format(parseISO(`${month}-01`), "MMMM yyyy", { locale: it });
  const pick = (s: DayState) => days.filter((d) => d.state === s).map((d) => d.day);
  const free = pick("free");
  const option = pick("opzione");
  const busy = pick("lavoro");
  const lines = [`*Disponibilità ${label}*${opts.name ? ` - ${opts.name}` : ""}`, ""];
  lines.push(free.length ? `✅ Disponibile: ${ranges(free)}` : "✅ Disponibile: nessun giorno libero");
  if (opts.showOptions && option.length) lines.push(`🟡 In opzione: ${ranges(option)}`);
  if (opts.showBusy && busy.length) lines.push(`❌ Occupato: ${ranges(busy)}`);
  lines.push("", "Scrivimi per bloccare una data 👍");
  return lines.join("\n");
}

const COLORS: Record<DayState, { bg: string; fg: string }> = {
  free: { bg: "#065F46", fg: "#D1FAE5" },
  opzione: { bg: "#92400E", fg: "#FEF3C7" },
  lavoro: { bg: "#7F1D1D", fg: "#FECACA" },
  past: { bg: "#151A26", fg: "#475569" },
};

/** Draws a 1080x1350 PNG (WhatsApp-friendly portrait) of the month availability. */
export async function availabilityImage(
  month: string,
  days: DayInfo[],
  opts: { name: string; showBusy: boolean; showOptions: boolean },
): Promise<Blob> {
  await document.fonts.ready;
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0B0D13";
  g.fillRect(0, 0, W, H);
  // amber glow
  const grad = g.createRadialGradient(W, 0, 0, W, 0, 700);
  grad.addColorStop(0, "rgba(245,158,11,0.18)");
  grad.addColorStop(1, "rgba(245,158,11,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  const pad = 72;
  g.fillStyle = "#EF4444";
  g.beginPath();
  g.arc(pad + 10, 96, 10, 0, Math.PI * 2);
  g.fill();
  g.font = "800 34px 'Outfit Variable', sans-serif";
  g.fillStyle = "#F3F4F6";
  g.fillText("AV", pad + 32, 108);
  g.fillStyle = "#F59E0B";
  g.fillText("SHIFT", pad + 32 + g.measureText("AV").width, 108);

  g.fillStyle = "#9CA3AF";
  g.font = "600 26px 'Plus Jakarta Sans Variable', sans-serif";
  g.fillText("DISPONIBILITÀ", pad, 200);
  const label = format(parseISO(`${month}-01`), "MMMM yyyy", { locale: it });
  g.fillStyle = "#F9FAFB";
  g.font = "700 76px 'Outfit Variable', sans-serif";
  g.fillText(label.charAt(0).toUpperCase() + label.slice(1), pad, 280);
  if (opts.name) {
    g.fillStyle = "#FBBF24";
    g.font = "600 32px 'Plus Jakarta Sans Variable', sans-serif";
    g.fillText(opts.name, pad, 334);
  }

  const gridTop = 400;
  const gap = 10;
  const cell = (W - pad * 2 - gap * 6) / 7;
  const wd = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"];
  g.font = "600 22px 'Plus Jakarta Sans Variable', sans-serif";
  g.textAlign = "center";
  wd.forEach((w, i) => {
    g.fillStyle = i >= 5 ? "#F59E0B" : "#9CA3AF";
    g.fillText(w, pad + i * (cell + gap) + cell / 2, gridTop);
  });

  const rowH = 118;
  const startRow = gridTop + 24;
  let row = 0;
  days.forEach((d, idx) => {
    if (idx > 0 && d.weekday === 0) row++;
    let state = d.state;
    if (state === "opzione" && !opts.showOptions) state = "free";
    if (state === "lavoro" && !opts.showBusy) state = "past";
    const x = pad + d.weekday * (cell + gap);
    const y = startRow + row * (rowH + gap);
    g.fillStyle = COLORS[state].bg;
    g.beginPath();
    g.roundRect(x, y, cell, rowH, 16);
    g.fill();
    g.fillStyle = COLORS[state].fg;
    g.font = "700 44px 'JetBrains Mono Variable', monospace";
    g.fillText(String(d.day), x + cell / 2, y + rowH / 2 + 16);
    if (state === "lavoro" || state === "past") {
      g.strokeStyle = state === "lavoro" ? "rgba(254,202,202,0.55)" : "rgba(71,85,105,0.5)";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x + cell * 0.28, y + rowH / 2 + 2);
      g.lineTo(x + cell * 0.72, y + rowH / 2 + 2);
      g.stroke();
    }
  });

  // legend
  g.textAlign = "left";
  const legend: [DayState, string][] = [["free", "Disponibile"]];
  if (opts.showOptions) legend.push(["opzione", "In opzione"]);
  if (opts.showBusy) legend.push(["lavoro", "Occupato"]);
  let lx = pad;
  const ly = H - 110;
  g.font = "600 28px 'Plus Jakarta Sans Variable', sans-serif";
  for (const [s, t] of legend) {
    g.fillStyle = COLORS[s].bg;
    g.beginPath();
    g.roundRect(lx, ly - 26, 34, 34, 8);
    g.fill();
    g.fillStyle = "#E5E7EB";
    g.fillText(t, lx + 48, ly);
    lx += 48 + g.measureText(t).width + 48;
  }
  g.fillStyle = "#64748B";
  g.font = "500 22px 'Plus Jakarta Sans Variable', sans-serif";
  g.fillText("Scrivimi per bloccare una data", pad, H - 52);

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/png"));
}
