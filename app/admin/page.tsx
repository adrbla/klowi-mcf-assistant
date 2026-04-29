import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/auth";
import { collectInventory, collectPromptSections } from "@/lib/admin-data";
import { AdminLogin } from "./AdminLogin";
import { AdminClient } from "./AdminClient";

export const runtime = "nodejs";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const authed = await verifyAdminToken(token);

  if (!authed) {
    return <AdminLogin />;
  }

  const [inventory, sections] = await Promise.all([
    collectInventory(),
    collectPromptSections(),
  ]);

  return <AdminClient inventory={inventory} sections={sections} />;
}
