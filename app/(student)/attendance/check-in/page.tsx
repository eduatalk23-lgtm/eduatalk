import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { CheckInPageContent } from "./_components/CheckInPageContent";

export const dynamic = "force-dynamic";

export default async function CheckInPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "student") {
    redirect("/login");
  }

  return <CheckInPageContent />;
}

