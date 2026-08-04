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

/** Junta campos paralelos (name="a" e name="b") em uma lista de objetos. */
function zipFields<T extends Record<string, string>>(formData: FormData, keys: (keyof T & string)[]): T[] {
  const columns = keys.map((key) => formData.getAll(key).map(String));
  const rows = Math.max(...columns.map((column) => column.length), 0);

  return Array.from({ length: rows }, (_, index) => {
    const row = {} as T;

    keys.forEach((key, keyIndex) => {
      row[key] = (columns[keyIndex][index] ?? "") as T[typeof key];
    });

    return row;
  });
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
    socialProofLabel: String(formData.get("socialProofLabel") ?? ""),
    metrics: zipFields<{ value: string; label: string }>(formData, ["value", "label"]),
    testimonials: zipFields<{ quote: string; author: string; role: string }>(formData, ["quote", "author", "role"]),
    guarantee: String(formData.get("guarantee") ?? ""),
    faq: zipFields<{ question: string; answer: string }>(formData, ["question", "answer"]),
    finalCtaTitle: String(formData.get("finalCtaTitle") ?? ""),
    finalCtaDescription: String(formData.get("finalCtaDescription") ?? ""),
  });

  revalidatePath("/");
  redirect("/admin/conteudo?salvo=1");
}
