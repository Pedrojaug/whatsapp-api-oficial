import { redirect } from "next/navigation";
import { AdminContentEditor } from "@/components/AdminContentEditor";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getSiteContent } from "@/lib/site-content";

type AdminContentPageProps = {
  searchParams: Promise<{
    salvo?: string;
  }>;
};

export default async function AdminContentPage({ searchParams }: AdminContentPageProps) {
  const [{ salvo }, isAuthenticated, content] = await Promise.all([
    searchParams,
    isAdminAuthenticated(),
    getSiteContent(),
  ]);

  if (!isAuthenticated) {
    redirect("/admin");
  }

  return <AdminContentEditor content={content} wasSaved={salvo === "1"} />;
}
