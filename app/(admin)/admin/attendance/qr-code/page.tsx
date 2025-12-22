import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { QRCodeDisplay } from "./_components/QRCodeDisplay";


export default async function QRCodePage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-8 p-6 md:p-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">출석용 QR 코드</h1>
        <p className="text-sm text-gray-600">
          이 QR 코드를 출력하여 학원 입구에 부착하세요.
        </p>
      </div>

      <QRCodeDisplay />
    </div>
  );
}
