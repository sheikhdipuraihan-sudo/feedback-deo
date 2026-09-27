-- Generalize Feedback Deo workspaces beyond food businesses.
-- Existing workspaces default to restaurant to preserve their current classification.
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'restaurant';

UPDATE public.workspaces
SET business_type = 'restaurant'
WHERE business_type IS NULL OR business_type NOT IN (
  'restaurant','cafe','barbershop','salon','hotel','retail_store','fashion_store',
  'ecommerce','grocery','pharmacy','gym','clinic','dental_clinic','coaching_center',
  'school','college_university','spa_wellness','real_estate','automotive',
  'professional_services','repair_service','travel_hospitality','event_venue',
  'nonprofit','other'
);

ALTER TABLE public.workspaces
  ALTER COLUMN business_type SET DEFAULT 'restaurant',
  ALTER COLUMN business_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workspaces_business_type_allowed'
      AND conrelid = 'public.workspaces'::regclass
  ) THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_business_type_allowed
      CHECK (business_type IN (
        'restaurant','cafe','barbershop','salon','hotel','retail_store','fashion_store',
        'ecommerce','grocery','pharmacy','gym','clinic','dental_clinic','coaching_center',
        'school','college_university','spa_wellness','real_estate','automotive',
        'professional_services','repair_service','travel_hospitality','event_venue',
        'nonprofit','other'
      ));
  END IF;
END $$;
