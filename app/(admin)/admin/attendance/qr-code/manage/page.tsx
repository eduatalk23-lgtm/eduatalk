import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { QRCodeManageContent } from "./_components/QRCodeManageContent";


export default async function QRCodeManagePage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-8 p-6 md:p-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">QR 코드 관리</h1>
        <p className="text-sm text-gray-600">
          QR 코드 생성 이력 및 사용 통계를 확인하고 관리할 수 있습니다.
        </p>
      </div>

      <QRCodeManageContent />
    </div>
  );
}
