import type { CurrencyCode } from "@/lib/currencies";

export type CreditCard = {
  id: string;
  user_id: string;
  name: string;
  bank: string;
  last_four_digits: string;
  credit_limit: number;
  statement_cut_day: number;
  payment_due_day: number;
  currency: string;
  color: string | null;
  is_active: boolean;
  created_at: string;
};

export type Expense = {
  id: string;
  user_id: string;
  credit_card_id: string;
  category_id: string | null;
  expense_date: string;
  amount: number;
  description: string;
  expense_type: "one_time" | "recurring";
  is_installment_purchase: boolean;
  installment_months: number | null;
  created_at: string;
};

export type PaymentType = "minimum" | "partial" | "no_interest" | "total" | "other";

export type Payment = {
  id: string;
  user_id: string;
  credit_card_id: string | null;
  account_id: string | null;
  payment_date: string;
  amount: number;
  payment_type: PaymentType;
  notes: string | null;
  created_at: string;
};

export type Category = {
  id: string;
  user_id: string;
  name: string;
  type: "expense" | "income";
  color: string | null;
};

export type AccountType = "bank" | "cash" | "savings" | "manual_investment" | "other";

export type Account = {
  id: string;
  user_id: string;
  name: string;
  institution: string | null;
  account_type: AccountType;
  currency: CurrencyCode | string;
  initial_balance: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type AccountMovementType = "income" | "expense" | "transfer" | "adjustment";

export type AccountMovement = {
  id: string;
  user_id: string;
  account_id: string;
  payment_id: string | null;
  transfer_id: string | null;
  goal_contribution_id: string | null;
  movement_date: string;
  amount: number;
  movement_type: AccountMovementType;
  description: string | null;
  created_at: string;
};

export type AccountTransfer = {
  id: string;
  user_id: string;
  from_account_id: string;
  to_account_id: string;
  transfer_date: string;
  amount: number;
  currency: CurrencyCode | string;
  description: string | null;
  created_at: string;
};

export type BudgetPeriod = "monthly";

export type Budget = {
  id: string;
  user_id: string;
  name: string;
  category_id: string;
  month: string;
  amount: number;
  currency: CurrencyCode | string;
  period: BudgetPeriod;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type GoalType = "savings" | "debt_payment" | "emergency_fund" | "travel" | "large_purchase" | "other";

export type Goal = {
  id: string;
  user_id: string;
  name: string;
  goal_type: GoalType;
  target_amount: number;
  current_amount: number;
  currency: CurrencyCode | string;
  account_id: string | null;
  target_date: string | null;
  description: string | null;
  is_active: boolean;
  status: "active" | "completed" | "paused" | "cancelled";
  created_at: string;
};

export type GoalContribution = {
  id: string;
  user_id: string;
  goal_id: string;
  account_id: string | null;
  contribution_date: string;
  amount: number;
  description: string | null;
  created_at: string;
};

export type InvestmentPlatformType = "broker" | "crypto_exchange" | "wallet" | "bank" | "retirement" | "other";

export type InvestmentPlatform = {
  id: string;
  user_id: string;
  name: string;
  platform_type: InvestmentPlatformType;
  country: string | null;
  currency: CurrencyCode | string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type InvestmentAssetType = "crypto" | "stock" | "etf" | "fund" | "bond" | "investment_cash" | "other";
export type InvestmentPriceSource = "manual" | "coingecko";

export type InvestmentAsset = {
  id: string;
  user_id: string;
  symbol: string;
  name: string;
  asset_type: InvestmentAssetType;
  currency: CurrencyCode | string;
  current_price: number;
  price_source: InvestmentPriceSource;
  coingecko_id: string | null;
  last_price_updated_at: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type Holding = {
  id: string;
  user_id: string;
  platform_id: string;
  asset_id: string;
  quantity: number;
  average_cost: number | null;
  notes: string | null;
  created_at: string;
};

export type InvestmentTransactionType = "buy" | "sell" | "dividend" | "interest" | "deposit" | "withdrawal" | "adjustment";

export type InvestmentTransaction = {
  id: string;
  user_id: string;
  platform_id: string;
  asset_id: string;
  transaction_date: string;
  transaction_type: InvestmentTransactionType;
  quantity: number;
  price: number;
  total_amount: number;
  fees: number;
  description: string | null;
  created_at: string;
};
