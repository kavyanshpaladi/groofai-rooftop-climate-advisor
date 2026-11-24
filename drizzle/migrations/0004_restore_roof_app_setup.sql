DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Emails that become admin once verified. Not reachable from the app.
CREATE TABLE IF NOT EXISTS public.admin_emails (email text PRIMARY KEY);
GRANT ALL ON public.admin_emails TO service_role;
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.grant_admin_for_listed_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.admin_emails WHERE lower(email) = lower(NEW.email)) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_admin
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_listed_email();
DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_admin ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_grant_admin
AFTER UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_admin_for_listed_email();

CREATE TABLE IF NOT EXISTS public.roof_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  latitude numeric,
  longitude numeric,
  roof_area numeric,
  usable_area numeric,
  answers jsonb,
  scores jsonb,
  best_option text,
  estimates jsonb
);
GRANT INSERT ON public.roof_reports TO anon, authenticated;
GRANT SELECT, DELETE ON public.roof_reports TO authenticated;
GRANT ALL ON public.roof_reports TO service_role;
ALTER TABLE public.roof_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can add a report" ON public.roof_reports;
DROP POLICY IF EXISTS "Anyone can add a valid report" ON public.roof_reports;
CREATE POLICY "Anyone can add a valid report" ON public.roof_reports
FOR INSERT TO anon, authenticated
WITH CHECK (
  created_at BETWEEN now() - interval '5 minutes' AND now() + interval '5 minutes'
  AND latitude IS NOT NULL AND latitude BETWEEN -90 AND 90
  AND longitude IS NOT NULL AND longitude BETWEEN -180 AND 180
  AND roof_area IS NOT NULL AND roof_area >= 0 AND roof_area <= 10000000
  AND usable_area IS NOT NULL AND usable_area >= 0 AND usable_area <= roof_area
  AND (best_option IS NULL OR best_option IN ('solar', 'green', 'reflective', 'rainwater', 'hybrid'))
  AND CASE WHEN answers IS NULL THEN true
           WHEN jsonb_typeof(answers) = 'object' THEN octet_length(answers::text) <= 4000
           ELSE false END
  AND CASE WHEN scores IS NULL THEN true
           WHEN jsonb_typeof(scores) = 'array' THEN jsonb_array_length(scores) <= 10 AND octet_length(scores::text) <= 2000
           ELSE false END
  AND CASE WHEN estimates IS NULL THEN true
           WHEN jsonb_typeof(estimates) = 'object' THEN octet_length(estimates::text) <= 2000
           ELSE false END
);
DROP POLICY IF EXISTS "Admins read reports" ON public.roof_reports;
CREATE POLICY "Admins read reports" ON public.roof_reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins delete reports" ON public.roof_reports;
CREATE POLICY "Admins delete reports" ON public.roof_reports FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.round_report_coords()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.latitude := round(NEW.latitude, 3);
  NEW.longitude := round(NEW.longitude, 3);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS roof_reports_round ON public.roof_reports;
CREATE TRIGGER roof_reports_round BEFORE INSERT ON public.roof_reports FOR EACH ROW EXECUTE FUNCTION public.round_report_coords();

CREATE OR REPLACE FUNCTION public.get_roof_count()
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*) FROM public.roof_reports
$$;
GRANT EXECUTE ON FUNCTION public.get_roof_count() TO anon, authenticated;

INSERT INTO public.admin_emails (email) VALUES ('paladikavyansh@gmail.com') ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE lower(email) = 'paladikavyansh@gmail.com' AND email_confirmed_at IS NOT NULL
ON CONFLICT DO NOTHING;