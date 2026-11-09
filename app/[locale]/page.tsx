import { setRequestLocale } from "next-intl/server";
import { HomeView } from "@/components/HomeView";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HomeView />;
}
