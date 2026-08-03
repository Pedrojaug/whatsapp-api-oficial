import { AdminDashboard } from "@/components/AdminDashboard";
import { AdminLogin } from "@/components/AdminLogin";
import { isAdminAuthenticated } from "@/lib/admin-auth";

type AdminPageProps = {
  searchParams: Promise<{
    erro?: string;
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const [{ erro }, isAuthenticated] = await Promise.all([searchParams, isAdminAuthenticated()]);

  if (!isAuthenticated) {
    return <AdminLogin hasError={erro === "credenciais"} />;
  }

  return <AdminDashboard />;
}
