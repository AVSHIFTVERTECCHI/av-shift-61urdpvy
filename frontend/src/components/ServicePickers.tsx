import { Input } from "@/components/ui/input";

export const RATE_PRESETS = [200, 220, 250];
export const HOURS_PRESETS = [
  { value: 9, label: "8+1" },
  { value: 10, label: "9+1" },
];

export const hoursLabel = (h: number) => HOURS_PRESETS.find((p) => p.value === h)?.label ?? `${h}h`;

const chip = (active: boolean) =>
  `h-9 min-w-14 rounded-md border px-3 font-mono text-sm font-semibold transition-colors duration-200 ${
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-[#0B0D13] text-muted-foreground hover:border-primary/50 hover:text-foreground"
  }`;

/** Rate as a string so the custom field can hold partial input like "23". */
export function RatePicker({ value, onChange, testid }: { value: string; onChange: (v: string) => void; testid: string }) {
  const n = parseFloat(value.replace(",", "."));
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid={testid}>
      {RATE_PRESETS.map((r) => (
        <button type="button" key={r} className={chip(n === r)} onClick={() => onChange(String(r))} data-testid={`${testid}-${r}`}>
          {r}€
        </button>
      ))}
      <div className="relative w-24">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          aria-label="Tariffa personalizzata"
          className="h-9 pr-6 font-mono"
          data-testid={`${testid}-custom`}
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
      </div>
    </div>
  );
}

export function HoursPicker({ value, onChange, testid }: { value: number; onChange: (v: number) => void; testid: string }) {
  return (
    <div className="flex gap-1.5" data-testid={testid}>
      {HOURS_PRESETS.map((p) => (
        <button type="button" key={p.value} className={chip(value === p.value)} onClick={() => onChange(p.value)} data-testid={`${testid}-${p.label.replace("+", "-")}`}>
          {p.label}
        </button>
      ))}
    </div>
  );
}
