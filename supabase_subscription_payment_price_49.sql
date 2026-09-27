-- Current Pro checkout pricing is 49 BDT/month. Preserve legacy 199 BDT
-- payment rows while allowing current checkouts to be recorded correctly.
ALTER TABLE public.subscription_payments
  DROP CONSTRAINT IF EXISTS subscription_payments_amount_check;

ALTER TABLE public.subscription_payments
  ADD CONSTRAINT subscription_payments_amount_check
  CHECK (amount IN (49, 199));

ALTER TABLE public.subscription_payments
  ALTER COLUMN amount SET DEFAULT 49;
