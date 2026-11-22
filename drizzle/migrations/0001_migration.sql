INSERT INTO public.admin_emails (email) VALUES ('paladikavyansh@gmail.com') ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE lower(email) = 'paladikavyansh@gmail.com' AND email_confirmed_at IS NOT NULL
ON CONFLICT DO NOTHING;