"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clearAdminSession, isAdminAuthenticated, setAdminSession, verifyAdminCredentials } from "@/lib/admin-auth";
import { saveSiteContent } from "@/lib/site-content";

export async function loginAdmin(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!verifyAdminCredentials(username, password)) {
    redirect("/admin?erro=credenciais");
  }

  await setAdminSession(username);
  redirect("/admin");
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/");
}

export async function updateHomeContent(formData: FormData) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin");
  }

  await saveSiteContent({
    announcement: String(formData.get("announcement") ?? ""),
    heroBadge: String(formData.get("heroBadge") ?? ""),
    heroTitle: String(formData.get("heroTitle") ?? ""),
    heroDescription: String(formData.get("heroDescription") ?? ""),
    primaryCta: String(formData.get("primaryCta") ?? ""),
    secondaryCta: String(formData.get("secondaryCta") ?? ""),
    proofItems: formData.getAll("proofItems").map(String),
    previewCampaign: String(formData.get("previewCampaign") ?? ""),
    templateMessage: String(formData.get("templateMessage") ?? ""),
    offerKicker: String(formData.get("offerKicker") ?? ""),
    offerTitle: String(formData.get("offerTitle") ?? ""),
    offerDescription: String(formData.get("offerDescription") ?? ""),
    inclusions: formData.getAll("inclusions").map(String),
  });

  revalidatePath("/");
  redirect("/admin/conteudo?salvo=1");
}
