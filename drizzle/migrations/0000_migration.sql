CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Emails that become admin once verified. Not reachable from the app.
CREATE TABLE public.admin_emails (email text PRIMARY KEY);
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

CREATE TRIGGER on_auth_user_created_grant_admin
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_listed_email();
CREATE TRIGGER on_auth_user_confirmed_grant_admin
AFTER UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_admin_for_listed_email();

CREATE TABLE public.roof_reports (
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
CREATE POLICY "Anyone can add a report" ON public.roof_reports FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins read reports" ON public.roof_reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete reports" ON public.roof_reports FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.round_report_coords()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.latitude := round(NEW.latitude, 3);
  NEW.longitude := round(NEW.longitude, 3);
  RETURN NEW;
END;
$$;
CREATE TRIGGER roof_reports_round BEFORE INSERT ON public.roof_reports FOR EACH ROW EXECUTE FUNCTION public.round_report_coords();

CREATE OR REPLACE FUNCTION public.get_roof_count()
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*) FROM public.roof_reports
$$;
GRANT EXECUTE ON FUNCTION public.get_roof_count() TO anon, authenticated;