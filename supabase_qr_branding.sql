-- Feedback DEO QR branding settings. Safe to apply more than once.
-- Existing QR links are not changed; legacy workspaces receive the default theme.
alter table public.workspaces
  add column if not exists qr_theme text not null default 'default',
  add column if not exists qr_logo text,
  add column if not exists qr_business_name text,
  add column if not exists qr_brand_color text not null default '#132b26',
  add column if not exists qr_layout text not null default 'stacked',
  add column if not exists qr_brand_text text not null default '';

update public.workspaces set qr_theme = 'default' where qr_theme is null;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_qr_theme_allowed') THEN
    ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_qr_theme_allowed
      CHECK (qr_theme IN ('default','modern','minimal','gradient','neon','dark','elegant','business','glass','premium','rounded','soft','luxury','vibrant','custom-brand'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_qr_brand_color_hex') THEN
    ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_qr_brand_color_hex
      CHECK (qr_brand_color ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_qr_layout_allowed') THEN
    ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_qr_layout_allowed
      CHECK (qr_layout IN ('stacked','compact','centered'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_qr_business_name_length') THEN
    ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_qr_business_name_length
      CHECK (qr_business_name IS NULL OR char_length(qr_business_name) <= 80);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_qr_brand_text_length') THEN
    ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_qr_brand_text_length
      CHECK (char_length(qr_brand_text) <= 60);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_qr_logo_length') THEN
    ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_qr_logo_length
      CHECK (qr_logo IS NULL OR char_length(qr_logo) <= 180000);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_workspace_qr_theme_plan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.qr_theme := COALESCE(NEW.qr_theme, 'default');
  NEW.qr_brand_color := COALESCE(NEW.qr_brand_color, '#132b26');
  NEW.qr_layout := COALESCE(NEW.qr_layout, 'stacked');
  NEW.qr_brand_text := COALESCE(NEW.qr_brand_text, '');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_workspace_qr_theme_plan ON public.workspaces;
CREATE TRIGGER enforce_workspace_qr_theme_plan
BEFORE INSERT OR UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_qr_theme_plan();
