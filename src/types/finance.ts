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

export type Category = {
  id: string;
  user_id: string;
  name: string;
  type: "expense" | "income";
  color: string | null;
};
