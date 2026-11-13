// Mirrors backend/models/shift.py — keep in sync by hand.
export type PayStatus = "da_fatturare" | "fatturato" | "pagato";

export interface Settings {
  standard_hours: number;
  overtime_pct: number;
  tax_pct: number;
  km_rate: number;
  meal_allowance: number;
  default_role: string;
  display_name: string;
}

// Mirrors backend/models/booking.py
export type BookingKind = "lavoro" | "opzione";

export interface BookingInput {
  kind: BookingKind;
  service_name: string;
  note: string;
}

export interface Booking extends BookingInput {
  id: string;
  date: string;
}

export interface ServiceInput {
  name: string;
  day_rate: number;
  /** 9 = "8+1", 10 = "9+1" — hours of presence before overtime */
  standard_hours: number;
  notes: string;
}

export interface Service extends ServiceInput {
  id: string;
}

export interface ShiftInput {
  date: string;
  service_id: string;
  service_name: string;
  event: string;
  location: string;
  role: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  /** false = pausa saltata -> +1h di straordinario */
  pause_taken: boolean;
  day_rate: number;
  overtime_pct: number;
  standard_hours: number;
  tax_pct: number;
  km: number;
  km_rate: number;
  meal: number;
  other_expenses: number;
  status: PayStatus;
  notes: string;
}

export interface Shift extends ShiftInput {
  id: string;
  hours: number;
  overtime_hours: number;
  overtime_rate: number;
  overtime_pay: number;
  gross: number;
  net: number;
  day_rate_net: number;
  expenses_total: number;
  total: number;
  created_at: string;
}

// POST /api/shifts/bulk-status
export interface BulkStatusUpdate {
  month: string;
  service_name: string;
  status: PayStatus;
  /** only move the days currently in this status */
  from_status?: PayStatus | null;
}

export interface BulkResult {
  updated: number;
}

export interface MonthTrend {
  month: string;
  total: number;
  hours: number;
}

export interface ServiceTotal {
  service_name: string;
  gross: number;
  net: number;
  days: number;
}

export interface Summary {
  month: string;
  gross: number;
  net: number;
  ordinary: number;
  ordinary_net: number;
  overtime_pay: number;
  overtime_net: number;
  expenses: number;
  pending: number;
  paid: number;
  hours: number;
  overtime_hours: number;
  days: number;
  trend: MonthTrend[];
  by_service: ServiceTotal[];
}

export interface Today {
  today: string;
}

// Mirrors backend/routers/auth.py AuthStatus
export interface AuthStatus {
  pin_set: boolean;
  authenticated: boolean;
  pin_length: number;
}

export const STATUS_LABEL: Record<PayStatus, string> = {
  da_fatturare: "Da fatturare",
  fatturato: "Fatturato",
  pagato: "Pagato",
};

export const STATUS_CLASS: Record<PayStatus, string> = {
  da_fatturare: "bg-[#78350F]/70 text-[#FDE68A] border-[#F59E0B]/30",
  fatturato: "bg-[#1E3A8A]/70 text-[#93C5FD] border-[#3B82F6]/30",
  pagato: "bg-[#064E3B]/70 text-[#6EE7B7] border-[#10B981]/30",
};

export const DEFAULT_SETTINGS: Settings = {
  standard_hours: 9, overtime_pct: 10, tax_pct: 28, km_rate: 0.35, meal_allowance: 0, default_role: "Tecnico Video", display_name: "",
};
