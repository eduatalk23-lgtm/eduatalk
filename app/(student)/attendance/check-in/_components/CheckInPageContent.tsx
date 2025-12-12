"use client";

import { useState, useEffect } from "react";
import { getTodayAttendance } from "@/app/(student)/actions/attendanceActions";
import { AttendanceStatus } from "./AttendanceStatus";
import { QRCodeScanner } from "./QRCodeScanner";
import { LocationCheckIn } from "./LocationCheckIn";
import { LocationCheckOut } from "./LocationCheckOut";
import { checkOut } from "@/app/(student)/actions/attendanceActions";
import Button from "@/components/atoms/Button";
import { Card, CardContent, CardHeader } from "@/components/molecules/Card";
import { useToast } from "@/components/ui/ToastProvider";

type AttendanceRecord = {
  id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_method: string | null;
  check_out_method: string | null;
  status: string;
};

type CheckInMethod = "qr" | "location" | null;

type CheckInPageContentProps = {
  success?: string;
  error?: string;
};

export function CheckInPageContent({
  success,
  error,
}: CheckInPageContentProps) {
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkInMethod, setCheckInMethod] = useState<CheckInMethod>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    loadAttendance();
  }, []);

  // 성공/에러 메시지 표시
  useEffect(() => {
    if (success) {
      showSuccess("출석 체크가 완료되었습니다!");
    }
    if (error) {
      showError(decodeURIComponent(error));
    }
  }, [success, error, showSuccess, showError]);

  const loadAttendance = async () => {
    try {
      const result = await getTodayAttendance();
      if (result.success && result.data) {
        setAttendance(result.data);
      }
    } catch (error) {
      console.error("[CheckInPage] 출석 기록 조회 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setCheckingOut(true);
    try {
      const result = await checkOut();
      if (result.success) {
        await loadAttendance();
      } else {
        alert(result.error || "퇴실 체크에 실패했습니다.");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "퇴실 체크 중 오류가 발생했습니다.";
      alert(errorMessage);
    } finally {
      setCheckingOut(false);
    }
  };

  const handleCheckInSuccess = () => {
    loadAttendance();
    setCheckInMethod(null);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-gray-500">로딩 중...</div>
      </div>
    );
  }

  const hasCheckedIn = attendance != null && attendance.check_in_time !== null;
  const hasCheckedOut = attendance != null && attendance.check_out_time !== null;

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-h1 text-gray-900">출석 체크</h1>
          <p className="text-sm text-gray-600">
            QR 코드 또는 위치로 출석을 체크하세요.
          </p>
        </div>

        {/* 출석 상태 표시 */}
        <div>
          <AttendanceStatus attendance={attendance} />
        </div>

        {/* 체크인 방법 선택 */}
        {!hasCheckedIn && !checkInMethod && (
          <Card>
            <CardHeader title="체크인 방법 선택" />
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <button
                  onClick={() => setCheckInMethod("qr")}
                  className="rounded-lg border-2 border-gray-200 bg-white p-6 text-left transition hover:border-indigo-500 hover:bg-indigo-50"
                >
                  <div className="flex flex-col gap-2">
                    <div className="text-2xl">📱</div>
                    <div className="flex flex-col gap-1">
                      <h3 className="font-semibold text-gray-900">QR 코드</h3>
                      <p className="text-sm text-gray-600">
                        학원의 QR 코드를 스캔하여 출석 체크
                      </p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setCheckInMethod("location")}
                  className="rounded-lg border-2 border-gray-200 bg-white p-6 text-left transition hover:border-indigo-500 hover:bg-indigo-50"
                >
                  <div className="flex flex-col gap-2">
                    <div className="text-2xl">📍</div>
                    <div className="flex flex-col gap-1">
                      <h3 className="font-semibold text-gray-900">위치 기반</h3>
                      <p className="text-sm text-gray-600">
                        현재 위치를 확인하여 출석 체크
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* QR 코드 스캔 */}
        {!hasCheckedIn && checkInMethod === "qr" && (
          <Card>
            <CardHeader title="QR 코드 스캔" />
            <CardContent>
              <div className="flex flex-col gap-4">
                <QRCodeScanner onSuccess={handleCheckInSuccess} />
                <Button
                  onClick={() => setCheckInMethod(null)}
                  variant="outline"
                  className="w-full"
                >
                  취소
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 위치 기반 체크인 */}
        {!hasCheckedIn && checkInMethod === "location" && (
          <Card>
            <CardHeader title="위치로 출석 체크" />
            <CardContent>
              <div className="flex flex-col gap-4">
                <LocationCheckIn onSuccess={handleCheckInSuccess} />
                <Button
                  onClick={() => setCheckInMethod(null)}
                  variant="outline"
                  className="w-full"
                >
                  취소
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

      {/* 퇴실 처리 */}
      {hasCheckedIn && !hasCheckedOut && (
        <Card>
          <CardHeader
            title={
              attendance.check_in_method === "qr"
                ? "퇴실 QR 코드 스캔"
                : attendance.check_in_method === "location"
                ? "퇴실 방법 선택"
                : "퇴실 체크"
            }
          />
          <CardContent>
            {attendance.check_in_method === "qr" ? (
              // QR 입실인 경우: QR 스캔 필수
              <QRCodeScanner mode="check-out" onSuccess={handleCheckInSuccess} />
            ) : attendance.check_in_method === "location" ? (
              // 위치 입실인 경우: 위치로 퇴실 또는 버튼으로 퇴실 선택 가능
              <div className="space-y-3">
                <LocationCheckOut onSuccess={handleCheckInSuccess} />
                <Button
                  onClick={handleCheckOut}
                  disabled={checkingOut}
                  variant="outline"
                  className="w-full"
                >
                  {checkingOut ? "퇴실 처리 중..." : "버튼으로 퇴실 체크"}
                </Button>
              </div>
            ) : (
              // 수동 입실인 경우: 버튼 클릭으로 처리
              <Button
                onClick={handleCheckOut}
                disabled={checkingOut}
                className="w-full"
              >
                {checkingOut ? "퇴실 처리 중..." : "퇴실 체크"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
