import { SalesLanding } from "@/components/SalesLanding";
import { getSiteContent } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export default async function Home() {
  const content = await getSiteContent();
  return <SalesLanding content={content} />;
}
