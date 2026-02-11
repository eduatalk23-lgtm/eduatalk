/**
 * 학부모 결제 페이지
 * 미납 결제 목록 + 결제 이력 확인
 */

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { ParentPaymentContent } from "./_components/ParentPaymentContent";

export default async function ParentPaymentsPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "parent") {
    redirect("/login");
  }

  return <ParentPaymentContent />;
}
