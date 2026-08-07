import { CheckoutForm } from "@/components/CheckoutForm";

type PageProps = {
  searchParams: Promise<{ plano?: string }>;
};

export default async function CheckoutPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return <CheckoutForm initialPlanSlug={params.plano} />;
}
