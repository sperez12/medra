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
  currency: "MXN" | "USD";
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
  movement_date: string;
  amount: number;
  movement_type: AccountMovementType;
  description: string | null;
  created_at: string;
};
