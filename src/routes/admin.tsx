import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/admin/login" });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
    return { isAdmin: isAdmin === true, email: data.user.email ?? "" };
  },
  head: () => ({
    meta: [
      { title: "Admin dashboard — groofai" },
      { name: "description", content: "Anonymous roof statistics for groofai." },
      { property: "og:title", content: "Admin dashboard — groofai" },
      { property: "og:description", content: "Anonymous roof statistics for groofai." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminRoute,
});

function AdminRoute() {
  const { isAdmin, email } = Route.useRouteContext();
  return <AdminDashboard isAdmin={isAdmin} email={email} />;
}
