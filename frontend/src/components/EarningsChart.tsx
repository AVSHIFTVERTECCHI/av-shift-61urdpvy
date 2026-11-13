import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthTrend } from "@/lib/types";
import { fmtEur, fmtMonth, fmtMonthShort } from "@/lib/format";

export default function EarningsChart({ trend, month }: { trend: MonthTrend[]; month: string }) {
  return (
    <div className="h-56 w-full md:h-64" data-testid="earnings-chart">
      {trend.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Nessun dato disponibile
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trend} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#232A3B" strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tickFormatter={(m: string) => fmtMonthShort(m)}
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#9CA3AF", fontSize: 11, fontFamily: "JetBrains Mono Variable" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${Math.round(v / 100) / 10}k`}
            />
            <Tooltip
              cursor={{ fill: "rgb(245 158 11 / 0.08)" }}
              contentStyle={{ background: "#131722", border: "1px solid #2E384D", borderRadius: 8 }}
              labelStyle={{ color: "#F3F4F6", textTransform: "capitalize" }}
              itemStyle={{ color: "#FBBF24", fontFamily: "JetBrains Mono Variable" }}
              formatter={(value: number) => [fmtEur(value), "Totale"]}
              labelFormatter={(label: string) => fmtMonth(label)}
            />
            <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={44}>
              {trend.map((t) => (
                <Cell key={t.month} fill={t.month === month ? "#F59E0B" : "#2E384D"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
