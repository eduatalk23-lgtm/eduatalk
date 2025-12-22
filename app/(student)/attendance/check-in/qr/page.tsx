import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { checkInWithQRCode } from "@/app/(student)/actions/attendanceActions";
import { service } from "@/lib/domains/qrCode";


type QRCheckInPageProps = {
  searchParams: Promise<{ code?: string }>;
};

export default async function QRCheckInPage({
  searchParams,
}: QRCheckInPageProps) {
  const params = await searchParams;
  const code = params.code;

  // code 파라미터 확인
  if (!code) {
    redirect("/attendance/check-in?error=QR 코드를 인식할 수 없습니다.");
  }

  // 로그인 상태 확인
  const { userId, role } = await getCurrentUserRole();

  // 미로그인 시 로그인 페이지로 리다이렉트 (returnUrl 포함)
  if (!userId || role !== "student") {
    const returnUrl = encodeURIComponent(`/attendance/check-in/qr?code=${code}`);
    redirect(`/login?returnUrl=${returnUrl}`);
  }

  try {
    // DB에서 QR 코드 조회
    const qrCodeRecord = await service.getQRCodeById(code);

    // QR 코드 데이터 추출 (JSON 형식)
    if (!qrCodeRecord.qr_data) {
      redirect("/attendance/check-in?error=QR 코드 데이터를 찾을 수 없습니다.");
    }

    // QR 코드 검증 및 출석 처리
    const result = await checkInWithQRCode(qrCodeRecord.qr_data);

    if (result.success) {
      // 성공 시 출석 체크인 페이지로 리다이렉트
      redirect("/attendance/check-in?success=true");
    } else {
      // 실패 시 에러 메시지와 함께 리다이렉트
      const errorMessage = encodeURIComponent(
        result.error || "출석 체크에 실패했습니다."
      );
      redirect(`/attendance/check-in?error=${errorMessage}`);
    }
  } catch (error: any) {
    // 에러 발생 시 에러 메시지와 함께 리다이렉트
    const errorMessage = encodeURIComponent(
      error.message || "QR 코드 처리 중 오류가 발생했습니다."
    );
    redirect(`/attendance/check-in?error=${errorMessage}`);
  }
}

