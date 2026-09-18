import Dashboard from "@/components/Dashboard";
import { verifySession } from "@/lib/dal";

export default async function Home() {
  await verifySession();
  return <Dashboard />;
}
