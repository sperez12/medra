import { getCardPaymentDueContext, type CardPaymentDueContext } from "@/lib/periods";
import type { CreditCard, Expense, Payment } from "@/types/finance";

export type CardPaymentDueBalance = {
  context: CardPaymentDueContext;
  spent: number;
  paid: number;
  pending: number;
};

export function calculateCardPaymentDueBalance({
  card,
  expenses,
  payments,
  today = new Date(),
}: {
  card: Pick<CreditCard, "id" | "statement_cut_day" | "payment_due_day">;
  expenses: Expense[];
  payments: Payment[];
  today?: Date;
}): CardPaymentDueBalance {
  const context = getCardPaymentDueContext(card.statement_cut_day, card.payment_due_day, today);
  const spent = sumExpensesForCardPeriod(expenses, card.id, context.payablePeriod.start, context.payablePeriod.end);
  const paid = sumPaymentsForCardPeriod(payments, card.id, context.paymentPeriod.start, context.paymentPeriod.end);

  return {
    context,
    spent,
    paid,
    pending: Math.max(spent - paid, 0),
  };
}

function sumExpensesForCardPeriod(expenses: Expense[], cardId: string, start: Date, end: Date) {
  return expenses
    .filter((expense) => {
      const expenseDate = new Date(`${expense.expense_date}T00:00:00`);
      return expense.credit_card_id === cardId && expenseDate >= start && expenseDate <= end;
    })
    .reduce((total, expense) => total + Number(expense.amount), 0);
}

function sumPaymentsForCardPeriod(payments: Payment[], cardId: string, start: Date, end: Date) {
  return payments
    .filter((payment) => {
      const paymentDate = new Date(`${payment.payment_date}T00:00:00`);
      return payment.credit_card_id === cardId && paymentDate >= start && paymentDate <= end;
    })
    .reduce((total, payment) => total + Number(payment.amount), 0);
}
