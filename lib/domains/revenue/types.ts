export type RevenueSummary = {
  total_billed: number;
  total_paid: number;
  total_unpaid: number;
  collection_rate: number;
  payment_count: number;
  student_count: number;
};

export type MonthlyRevenue = {
  month: string;
  billed: number;
  paid: number;
  unpaid: number;
  rate: number;
};

export type ProgramRevenue = {
  program_id: string;
  program_name: string;
  total_billed: number;
  total_paid: number;
  enrollment_count: number;
  pct: number;
};

export type RevenueFilters = {
  startDate: string;
  endDate: string;
  programId?: string;
  consultantId?: string;
};
