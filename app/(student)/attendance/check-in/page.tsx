import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { CheckInPageContent } from "./_components/CheckInPageContent";


type CheckInPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function CheckInPage({ searchParams }: CheckInPageProps) {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "student") {
    redirect("/login");
  }

  const params = await searchParams;
  const success = params.success;
  const error = params.error;

  return <CheckInPageContent success={success} error={error} />;
}
