export interface PaycheckConfig {
  id: string;
  amount: number;
  start_date: string;
  transfer_amount: number;
  minimum_spending: number;
  created_at: string;
  updated_at: string;
  payDates?: string[];
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_default: number;
}

export interface RecurringBill {
  id: string;
  name: string;
  amount: number;
  category_id: string | null;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  due_day: number;
  frequency: string;
  is_active: number;
  auto_pay: number;
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  category_id: string | null;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  date: string;
  notes: string | null;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  amount: number;
  date: string;
  notes: string | null;
}

export interface Debt {
  id: string;
  name: string;
  total_amount: number;
  remaining_amount: number;
  minimum_payment: number;
  interest_rate: number;
  due_day: number | null;
  priority: number;
  is_active: number;
  payments: DebtPayment[];
  snowballEstimate: {
    payoffPeriod: string | null;
    payoffDate: string | null;
    paidOff: boolean;
    snowballRemaining: number;
  } | null;
  auto_pay: number;
}

export interface PeriodBreakdown {
  payDate: string;
  periodStart: string;
  periodEnd: string;
  bills: { name: string; amount: number; dueDate: string; frequency: string }[];
  debts: { name: string; amount: number; dueDate: string | null; remaining: number }[];
  totalBills: number;
  totalDebtMins: number;
  totalExpenses: number;
  transfer: number;
  committed: number;
  available: number;
}

export interface DashboardData {
  configured: boolean;
  message?: string;
  paycheck?: PaycheckConfig;
  nextPayDate?: string;
  currentPeriod?: { start: string; end: string };
  summary?: {
    monthlyIncome: number;
    monthlyBills: number;
    monthlyTransfer: number;
    monthlyDebtPayments: number;
    totalDebtRemaining: number;
    recentExpenses30d: number;
    freeCashPerPeriod: number;
    monthlySurplus: number;
  };
  periodBreakdowns?: PeriodBreakdown[];
  expensesByCategory?: Record<string, { total: number; count: number; icon: string; color: string }>;
  spendingTrend?: { month: string; total: number }[];
  debtProgress?: { name: string; total: number; remaining: number; paid: number; percentPaid: number; interestRate: number }[];
  recentExpenses?: Expense[];
}
