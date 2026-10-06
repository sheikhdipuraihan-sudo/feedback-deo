-- Feedback Deo referral program: 5 qualified referrals earn 1 month of Pro.
-- Additive and safe to reapply. Referral Pro is separate from paid/manual plan state.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS referral_pro_until timestamptz;

CREATE TABLE IF NOT EXISTS public.referral_codes (
  owner_id text PRIMARY KEY REFERENCES public.auth_users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-F0-9]{16}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, code)
);

CREATE TABLE IF NOT EXISTS public.referral_owner_devices (
  owner_id text NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  device_hash text NOT NULL CHECK (device_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, device_hash)
);

CREATE TABLE IF NOT EXISTS public.referral_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  points_spent smallint NOT NULL DEFAULT 5 CHECK (points_spent = 5),
  months_granted smallint NOT NULL DEFAULT 1 CHECK (months_granted = 1),
  starts_at timestamptz NOT NULL,
  pro_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code text NOT NULL REFERENCES public.referral_codes(code) ON DELETE CASCADE,
  referrer_id text NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  invitee_id text NOT NULL UNIQUE REFERENCES public.auth_users(id) ON DELETE CASCADE,
  device_hash text NOT NULL UNIQUE CHECK (device_hash ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualified')),
  reward_claim_id uuid REFERENCES public.referral_reward_claims(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  qualified_at timestamptz,
  CONSTRAINT referrals_not_self CHECK (referrer_id <> invitee_id),
  CONSTRAINT referrals_code_owner_fkey FOREIGN KEY (referrer_id, referral_code)
    REFERENCES public.referral_codes(owner_id, code) ON DELETE CASCADE,
  CONSTRAINT referrals_status_qualified_at_check CHECK (
    (status = 'pending' AND qualified_at IS NULL) OR (status = 'qualified' AND qualified_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS referrals_referrer_status_idx
  ON public.referrals (referrer_id, status, qualified_at, created_at);
CREATE INDEX IF NOT EXISTS referral_reward_claims_owner_idx
  ON public.referral_reward_claims (owner_id, created_at DESC);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_owner_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_reward_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.referral_codes, public.referral_owner_devices, public.referrals, public.referral_reward_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.referral_codes, public.referral_owner_devices, public.referrals, public.referral_reward_claims TO service_role;

-- Effective Pro check used only inside trusted SECURITY DEFINER database functions.
CREATE OR REPLACE FUNCTION public.has_workspace_pro_access(target_workspace uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = target_workspace
      AND w.status = 'active'
      AND (w.plan = 'pro' OR w.referral_pro_until > now())
  );
$$;
REVOKE ALL ON FUNCTION public.has_workspace_pro_access(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_workspace_pro_access(uuid) TO service_role;

-- A referral counts only after the invitee verifies email and creates an active workspace.
CREATE OR REPLACE FUNCTION public.qualify_referral_if_ready(target_invitee_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.referrals r
     SET status = 'qualified', qualified_at = COALESCE(r.qualified_at, now())
    FROM public.auth_users u
   WHERE r.invitee_id = target_invitee_id
     AND r.status = 'pending'
     AND u.id = r.invitee_id
     AND u.email_verified IS TRUE
     AND EXISTS (
       SELECT 1 FROM public.workspaces w
       WHERE w.owner_id = target_invitee_id AND w.status = 'active'
     );
END;
$$;
REVOKE ALL ON FUNCTION public.qualify_referral_if_ready(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.qualify_referral_from_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    PERFORM public.qualify_referral_if_ready(NEW.owner_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.qualify_referral_from_workspace() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS qualify_referral_from_workspace ON public.workspaces;
CREATE TRIGGER qualify_referral_from_workspace
AFTER INSERT OR UPDATE OF status ON public.workspaces
FOR EACH ROW WHEN (NEW.status = 'active')
EXECUTE FUNCTION public.qualify_referral_from_workspace();

CREATE OR REPLACE FUNCTION public.qualify_referral_from_verified_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.email_verified IS TRUE AND OLD.email_verified IS DISTINCT FROM NEW.email_verified THEN
    PERFORM public.qualify_referral_if_ready(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.qualify_referral_from_verified_email() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS qualify_referral_from_verified_email ON public.auth_users;
CREATE TRIGGER qualify_referral_from_verified_email
AFTER UPDATE OF email_verified ON public.auth_users
FOR EACH ROW
EXECUTE FUNCTION public.qualify_referral_from_verified_email();

-- Codes are issued only to verified accounts. The API invokes these routines with service_role.
CREATE OR REPLACE FUNCTION public.get_or_create_referral_code(p_owner_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_verified boolean;
  v_code text;
  v_attempt integer;
BEGIN
  SELECT u.email_verified INTO v_verified
    FROM public.auth_users u WHERE u.id = p_owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'referral_owner_not_found'; END IF;
  IF v_verified IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'email_verification_required'; END IF;

  SELECT c.code INTO v_code FROM public.referral_codes c WHERE c.owner_id = p_owner_id;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;

  FOR v_attempt IN 1..8 LOOP
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
    BEGIN
      INSERT INTO public.referral_codes(owner_id, code) VALUES (p_owner_id, v_code);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      SELECT c.code INTO v_code FROM public.referral_codes c WHERE c.owner_id = p_owner_id;
      IF v_code IS NOT NULL THEN RETURN v_code; END IF;
    END;
  END LOOP;
  RAISE EXCEPTION 'referral_code_generation_failed';
END;
$$;
REVOKE ALL ON FUNCTION public.get_or_create_referral_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_referral_code(text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_referral_overview(p_owner_id text)
RETURNS TABLE (
  referral_code text,
  qualified_total bigint,
  spent_points bigint,
  available_points bigint,
  rewards_claimed bigint,
  referral_pro_until timestamptz,
  workspace_id uuid,
  workspace_plan text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_verified boolean;
  v_code text;
  v_qualified bigint := 0;
  v_spent bigint := 0;
  v_rewards bigint := 0;
  v_until timestamptz;
  v_workspace_id uuid;
  v_plan text;
BEGIN
  SELECT u.email_verified INTO v_verified FROM public.auth_users u WHERE u.id = p_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'referral_owner_not_found'; END IF;
  IF v_verified IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'email_verification_required'; END IF;
  v_code := public.get_or_create_referral_code(p_owner_id);

  SELECT count(*) FILTER (WHERE r.status = 'qualified'),
         count(*) FILTER (WHERE r.status = 'qualified' AND r.reward_claim_id IS NOT NULL)
    INTO v_qualified, v_spent
    FROM public.referrals r WHERE r.referrer_id = p_owner_id;
  SELECT count(*) INTO v_rewards FROM public.referral_reward_claims c WHERE c.owner_id = p_owner_id;
  SELECT w.id, w.plan, w.referral_pro_until
    INTO v_workspace_id, v_plan, v_until
    FROM public.workspaces w
   WHERE w.owner_id = p_owner_id AND w.status = 'active'
   ORDER BY w.created_at ASC LIMIT 1;

  RETURN QUERY SELECT v_code, v_qualified, v_spent, v_qualified - v_spent,
                      v_rewards, v_until, v_workspace_id, v_plan;
END;
$$;
REVOKE ALL ON FUNCTION public.get_referral_overview(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_overview(text) TO service_role;

CREATE OR REPLACE FUNCTION public.redeem_referral_reward(p_owner_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_verified boolean;
  v_workspace_id uuid;
  v_plan text;
  v_current_until timestamptz;
  v_referral_ids uuid[];
  v_claim_id uuid := gen_random_uuid();
  v_start timestamptz;
  v_until timestamptz;
  v_balance bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_owner_id, 0));

  SELECT u.email_verified INTO v_verified FROM public.auth_users u WHERE u.id = p_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'referral_owner_not_found'; END IF;
  IF v_verified IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'email_verification_required'; END IF;

  SELECT w.id, w.plan, w.referral_pro_until
    INTO v_workspace_id, v_plan, v_current_until
    FROM public.workspaces w
   WHERE w.owner_id = p_owner_id AND w.status = 'active'
   ORDER BY w.created_at ASC LIMIT 1 FOR UPDATE;
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'active_workspace_required'; END IF;
  IF v_plan = 'pro' THEN RAISE EXCEPTION 'workspace_already_pro'; END IF;

  SELECT count(*) INTO v_balance FROM public.referrals r
   WHERE r.referrer_id = p_owner_id AND r.status = 'qualified' AND r.reward_claim_id IS NULL;
  IF v_balance < 5 THEN RAISE EXCEPTION 'not_enough_referral_points'; END IF;

  SELECT COALESCE(array_agg(q.id), ARRAY[]::uuid[]) INTO v_referral_ids
    FROM (
      SELECT r.id FROM public.referrals r
       WHERE r.referrer_id = p_owner_id AND r.status = 'qualified' AND r.reward_claim_id IS NULL
       ORDER BY r.qualified_at ASC, r.created_at ASC
       LIMIT 5 FOR UPDATE
    ) q;
  IF cardinality(v_referral_ids) <> 5 THEN RAISE EXCEPTION 'not_enough_referral_points'; END IF;

  v_start := GREATEST(COALESCE(v_current_until, now()), now());
  v_until := v_start + interval '1 month';

  INSERT INTO public.referral_reward_claims(id, owner_id, workspace_id, starts_at, pro_until)
  VALUES (v_claim_id, p_owner_id, v_workspace_id, v_start, v_until);
  UPDATE public.referrals SET reward_claim_id = v_claim_id WHERE id = ANY(v_referral_ids);
  UPDATE public.workspaces SET referral_pro_until = v_until WHERE id = v_workspace_id;

  RETURN jsonb_build_object(
    'claim_id', v_claim_id,
    'workspace_id', v_workspace_id,
    'points_spent', 5,
    'months_granted', 1,
    'starts_at', v_start,
    'pro_until', v_until,
    'remaining_points', v_balance - 5
  );
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_referral_reward(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_referral_reward(text) TO service_role;

-- Prevent client-side alteration of the bonus timestamp and honor the temporary entitlement
-- when enforcing QR customization for workspaces with referral Pro.
CREATE OR REPLACE FUNCTION public.enforce_workspace_qr_theme_plan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  has_pro_access boolean;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.plan = 'pro' THEN
    IF current_user NOT IN ('postgres', 'service_role')
       AND NOT COALESCE(public.is_subscription_admin(), false) THEN
      RAISE EXCEPTION 'Subscription plan changes must use the approved billing workflow.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.referral_pro_until IS NOT NULL
     AND current_user NOT IN ('postgres', 'service_role')
     AND NOT COALESCE(public.is_subscription_admin(), false) THEN
    RAISE EXCEPTION 'Referral Pro access must use the approved rewards workflow.' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.plan IS DISTINCT FROM OLD.plan THEN
    IF current_user NOT IN ('postgres', 'service_role')
       AND NOT COALESCE(public.is_subscription_admin(), false) THEN
      RAISE EXCEPTION 'Subscription plan changes must use the approved billing workflow.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.referral_pro_until IS DISTINCT FROM OLD.referral_pro_until
     AND current_user NOT IN ('postgres', 'service_role')
     AND NOT COALESCE(public.is_subscription_admin(), false) THEN
    RAISE EXCEPTION 'Referral Pro access must use the approved rewards workflow.' USING ERRCODE = '42501';
  END IF;

  NEW.qr_theme := COALESCE(NEW.qr_theme, 'default');
  has_pro_access := NEW.plan = 'pro' OR COALESCE(NEW.referral_pro_until > now(), false);
  IF NOT has_pro_access THEN
    IF TG_OP = 'UPDATE' AND OLD.plan = 'pro' AND NEW.plan IS DISTINCT FROM 'pro' THEN
      NEW.qr_theme := 'default';
      NEW.qr_brand_color := '#132b26';
      NEW.qr_layout := 'stacked';
    ELSIF TG_OP = 'INSERT' THEN
      IF NEW.qr_theme <> 'default' THEN
        RAISE EXCEPTION 'Premium QR themes require a Pro workspace.' USING ERRCODE = '42501';
      END IF;
      IF NEW.qr_brand_color <> '#132b26' OR NEW.qr_layout <> 'stacked' THEN
        RAISE EXCEPTION 'Custom QR colors and layouts require a Pro workspace.' USING ERRCODE = '42501';
      END IF;
    ELSE
      -- Let unrelated updates pass when a previous referral month has expired, but
      -- block any attempt to change a QR field to a new premium value.
      IF NEW.qr_theme <> 'default' AND NEW.qr_theme IS DISTINCT FROM OLD.qr_theme THEN
        RAISE EXCEPTION 'Premium QR themes require a Pro workspace.' USING ERRCODE = '42501';
      END IF;
      IF (NEW.qr_brand_color <> '#132b26' AND NEW.qr_brand_color IS DISTINCT FROM OLD.qr_brand_color)
         OR (NEW.qr_layout <> 'stacked' AND NEW.qr_layout IS DISTINCT FROM OLD.qr_layout) THEN
        RAISE EXCEPTION 'Custom QR colors and layouts require a Pro workspace.' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Apply the temporary Pro entitlement consistently to SQL-enforced features.
CREATE OR REPLACE FUNCTION public.submit_public_feedback(workspace_slug text, feedback_rating integer, feedback_comment text, feedback_table_id uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_workspace uuid;
  target_plan text;
  target_status text;
  target_referral_pro_until timestamptz;
  month_count integer;
BEGIN
  IF feedback_rating < 1 OR feedback_rating > 5 THEN RAISE EXCEPTION 'rating must be between 1 and 5'; END IF;
  IF length(trim(feedback_comment)) < 1 OR length(trim(feedback_comment)) > 2000 THEN RAISE EXCEPTION 'comment must be between 1 and 2000 characters'; END IF;
  SELECT w.id, w.plan, w.status, w.referral_pro_until
    INTO target_workspace, target_plan, target_status, target_referral_pro_until
    FROM public.workspaces w WHERE w.slug = workspace_slug;
  IF target_workspace IS NULL OR target_status = 'banned' THEN RAISE EXCEPTION 'workspace not found'; END IF;
  IF feedback_table_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tables t WHERE t.id = feedback_table_id AND t.workspace_id = target_workspace) THEN RAISE EXCEPTION 'table does not belong to workspace'; END IF;
  IF target_plan = 'free' AND NOT COALESCE(target_referral_pro_until > now(), false) THEN
    SELECT count(*) INTO month_count FROM public.feedback f WHERE f.workspace_id = target_workspace AND f.created_at >= date_trunc('month', now());
    IF month_count >= 30 THEN RAISE EXCEPTION 'free monthly feedback limit reached'; END IF;
  END IF;
  INSERT INTO public.feedback (workspace_id, table_id, rating, comment)
  VALUES (target_workspace, feedback_table_id, feedback_rating, trim(feedback_comment));
END;
$$;

CREATE OR REPLACE FUNCTION public.create_telegram_link_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_workspace uuid;
  new_token text;
BEGIN
  SELECT id INTO current_workspace FROM public.workspaces
   WHERE owner_id = (auth.jwt() ->> 'sub') AND status = 'active'
   ORDER BY created_at ASC LIMIT 1;
  IF current_workspace IS NULL THEN RAISE EXCEPTION 'workspace not found'; END IF;
  IF NOT public.has_workspace_pro_access(current_workspace) THEN RAISE EXCEPTION 'telegram notifications require pro'; END IF;
  DELETE FROM public.telegram_link_tokens WHERE workspace_id = current_workspace OR expires_at < now();
  new_token := replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.telegram_link_tokens(token, workspace_id) VALUES (new_token, current_workspace);
  RETURN new_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_telegram_connection(link_token text, telegram_chat_id text, telegram_username text, notification_webhook_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_workspace uuid;
BEGIN
  IF length(coalesce(telegram_chat_id, '')) < 1 OR length(coalesce(notification_webhook_url, '')) < 20 THEN RAISE EXCEPTION 'invalid telegram connection'; END IF;
  SELECT t.workspace_id INTO target_workspace
    FROM public.telegram_link_tokens t
    JOIN public.workspaces w ON w.id = t.workspace_id
   WHERE t.token = link_token AND t.used_at IS NULL AND t.expires_at > now()
     AND w.status = 'active' AND public.has_workspace_pro_access(w.id)
   LIMIT 1;
  IF target_workspace IS NULL THEN RAISE EXCEPTION 'invalid or expired connection code'; END IF;
  INSERT INTO public.telegram_connections(workspace_id, chat_id, telegram_username, webhook_url)
  VALUES (target_workspace, telegram_chat_id, nullif(telegram_username, ''), notification_webhook_url)
  ON CONFLICT (workspace_id) DO UPDATE SET chat_id = excluded.chat_id, telegram_username = excluded.telegram_username,
    webhook_url = excluded.webhook_url, updated_at = now();
  UPDATE public.telegram_link_tokens SET used_at = now() WHERE token = link_token;
  RETURN jsonb_build_object('workspace_id', target_workspace);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_telegram_notification_target(workspace_slug text)
RETURNS TABLE(webhook_url text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.webhook_url
    FROM public.workspaces w
    JOIN public.telegram_connections c ON c.workspace_id = w.id
   WHERE w.slug = workspace_slug AND w.status = 'active'
     AND public.has_workspace_pro_access(w.id)
   LIMIT 1;
$$;

-- Preserve the existing Telegram RPC grants after function replacement.
GRANT EXECUTE ON FUNCTION public.create_telegram_link_token() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_telegram_connection(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_telegram_notification_target(text) TO anon, authenticated;
