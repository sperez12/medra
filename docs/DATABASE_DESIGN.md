# Diseno de Base de Datos

La base de datos usa PostgreSQL en Supabase. Cada tabla principal incluye `user_id` para que las politicas RLS puedan separar los datos de cada usuario.

## usuarios

Supabase Auth crea los usuarios en `auth.users`. La tabla `profiles` guarda informacion adicional.

Campos principales:
- `id`: mismo id del usuario en Supabase Auth.
- `email`: correo.
- `full_name`: nombre opcional.
- `created_at`: fecha de creacion.

## tarjetas de credito

Tabla: `credit_cards`

Campos:
- `name`
- `bank`
- `last_four_digits`
- `credit_limit`
- `statement_cut_day`
- `payment_due_day`
- `currency`
- `color`
- `is_active`

## gastos

Tabla: `expenses`

Campos:
- `credit_card_id`
- `category_id`
- `expense_date`
- `amount`
- `description`
- `expense_type`: unico o recurrente.
- `is_installment_purchase`
- `installment_months`

## categorias

Tabla: `categories`

Campos:
- `name`
- `type`: gasto o ingreso.
- `color`

## pagos

Tabla: `payments`

Campos:
- `credit_card_id`
- `account_id`
- `payment_date`
- `amount`
- `notes`

## compras a meses sin intereses

Tabla: `installment_purchases`

Campos:
- `expense_id`
- `credit_card_id`
- `total_amount`
- `months`
- `monthly_amount`
- `start_date`
- `end_date`
- `status`

## cuentas

Tabla: `accounts`

Campos:
- `name`
- `institution`
- `account_type`
- `currency`
- `initial_balance`
- `is_active`

## movimientos de cuentas

Tabla: `account_movements`

Campos:
- `account_id`
- `movement_date`
- `amount`
- `movement_type`
- `description`

## plataformas

Tabla: `platforms`

Campos:
- `name`
- `platform_type`
- `currency`
- `is_active`

## activos

Tabla: `assets`

Campos:
- `symbol`
- `name`
- `asset_type`
- `currency`

## holdings

Tabla: `holdings`

Campos:
- `platform_id`
- `asset_id`
- `quantity`
- `average_cost`

## transacciones de inversion

Tabla: `investment_transactions`

Campos:
- `platform_id`
- `asset_id`
- `transaction_date`
- `transaction_type`
- `quantity`
- `price`
- `fees`

## precios de activos

Tabla: `asset_prices`

Campos:
- `asset_id`
- `price_date`
- `price`
- `currency`

## presupuestos

Tabla: `budgets`

Campos:
- `category_id`
- `month`
- `amount`
- `currency`

## metas

Tabla: `goals`

Campos:
- `name`
- `goal_type`
- `target_amount`
- `current_amount`
- `target_date`
- `status`

## eventos del calendario financiero

Tabla: `financial_events`

Campos:
- `title`
- `event_date`
- `event_type`
- `amount`
- `related_credit_card_id`
- `related_account_id`
- `notes`
