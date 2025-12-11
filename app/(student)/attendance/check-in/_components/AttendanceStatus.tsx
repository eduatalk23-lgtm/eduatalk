"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/molecules/Card";
import { QrCode, MapPin, Hand, MessageSquare, CheckCircle2, XCircle, Clock } from "lucide-react";
import Badge from "@/components/atoms/Badge";
import { getTodayAttendanceSMSStatus } from "@/app/(student)/actions/attendanceActions";

type AttendanceRecord = {
  id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_method: string | null;
  check_out_method: string | null;
  status: string;
} | null;

type AttendanceStatusProps = {
  attendance: AttendanceRecord;
};

type SMSStatus = "pending" | "sent" | "delivered" | "failed";

type SMSStatusData = {
  checkInSMS?: {
    status: SMSStatus;
    sentAt: string | null;
    errorMessage: string | null;
  } | null;
  checkOutSMS?: {
    status: SMSStatus;
    sentAt: string | null;
    errorMessage: string | null;
  } | null;
} | null;

export function AttendanceStatus({ attendance }: AttendanceStatusProps) {
  const [smsStatus, setSmsStatus] = useState<SMSStatusData>(null);
  const [loadingSMS, setLoadingSMS] = useState(false);

  useEffect(() => {
    if (attendance) {
      loadSMSStatus();
    }
  }, [attendance?.id]);

  const loadSMSStatus = async () => {
    setLoadingSMS(true);
    try {
      const result = await getTodayAttendanceSMSStatus();
      if (result.success && result.data) {
        setSmsStatus(result.data);
      }
    } catch (error) {
      console.error("[AttendanceStatus] SMS 상태 조회 실패:", error);
    } finally {
      setLoadingSMS(false);
    }
  };

  if (!attendance) {
    return (
      <Card>
        <CardHeader title="오늘 출석 상태" />
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-gray-300" />
            <span className="text-sm font-medium text-gray-700">
              출석 체크 전
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasCheckedIn = attendance.check_in_time !== null;
  const hasCheckedOut = attendance.check_out_time !== null;

  const formatTime = (timeString: string | null) => {
    if (!timeString) return "-";
    try {
      return new Date(timeString).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return timeString;
    }
  };

  const getMethodLabel = (method: string | null) => {
    switch (method) {
      case "qr":
        return "QR 코드";
      case "location":
        return "위치 기반";
      case "manual":
        return "수동";
      default:
        return "-";
    }
  };

  const getMethodIcon = (method: string | null) => {
    switch (method) {
      case "qr":
        return QrCode;
      case "location":
        return MapPin;
      case "manual":
        return Hand;
      default:
        return null;
    }
  };

  // QR 입실인 경우 퇴실 시 QR 스캔 필요 여부 확인
  const requiresQRCheckOut = hasCheckedIn && !hasCheckedOut && attendance.check_in_method === "qr";

  const getSMSStatusIcon = (status: SMSStatus | undefined) => {
    if (!status) return null;
    switch (status) {
      case "sent":
      case "delivered":
        return <CheckCircle2 size={14} className="text-green-600" />;
      case "failed":
        return <XCircle size={14} className="text-red-600" />;
      case "pending":
        return <Clock size={14} className="text-yellow-600" />;
      default:
        return null;
    }
  };

  const getSMSStatusLabel = (status: SMSStatus | undefined) => {
    if (!status) return null;
    switch (status) {
      case "sent":
        return "발송 완료";
      case "delivered":
        return "전달 완료";
      case "failed":
        return "발송 실패";
      case "pending":
        return "발송 대기";
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader title="오늘 출석 상태" />
      <CardContent>
        <div className="space-y-4">
          {/* 출석 상태 배지 */}
          <div className="flex items-center gap-3">
            {hasCheckedIn ? (
              <>
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-green-700">
                  출석 완료
                </span>
              </>
            ) : (
              <>
                <div className="h-3 w-3 rounded-full bg-gray-300" />
                <span className="text-sm font-medium text-gray-700">
                  미체크
                </span>
              </>
            )}
          </div>

          {/* 입실 정보 */}
          {hasCheckedIn && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">입실</span>
                {smsStatus?.checkInSMS && (
                  <div className="flex items-center gap-1">
                    {getSMSStatusIcon(smsStatus.checkInSMS.status)}
                    <span className="text-xs text-gray-500">
                      {getSMSStatusLabel(smsStatus.checkInSMS.status)}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-900">
                  {formatTime(attendance.check_in_time)}
                </span>
                <div className="flex items-center gap-2">
                  {getMethodIcon(attendance.check_in_method) && (
                    <div className="text-gray-500">
                      {(() => {
                        const Icon = getMethodIcon(attendance.check_in_method);
                        return Icon ? <Icon size={16} /> : null;
                      })()}
                    </div>
                  )}
                  <span className="text-xs text-gray-500">
                    {getMethodLabel(attendance.check_in_method)}
                  </span>
                </div>
              </div>
              {smsStatus?.checkInSMS?.status === "failed" &&
                smsStatus.checkInSMS.errorMessage && (
                  <div className="mt-2 text-xs text-red-600">
                    {smsStatus.checkInSMS.errorMessage}
                  </div>
                )}
            </div>
          )}

          {/* QR 스캔 필요 안내 */}
          {requiresQRCheckOut && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="flex items-center gap-2">
                <QrCode size={16} className="text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  퇴실 시 QR 코드 스캔이 필요합니다
                </span>
              </div>
            </div>
          )}

          {/* 퇴실 정보 */}
          {hasCheckedOut && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">퇴실</span>
                {smsStatus?.checkOutSMS && (
                  <div className="flex items-center gap-1">
                    {getSMSStatusIcon(smsStatus.checkOutSMS.status)}
                    <span className="text-xs text-gray-500">
                      {getSMSStatusLabel(smsStatus.checkOutSMS.status)}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-900">
                  {formatTime(attendance.check_out_time)}
                </span>
                <div className="flex items-center gap-2">
                  {getMethodIcon(attendance.check_out_method) && (
                    <div className="text-gray-500">
                      {(() => {
                        const Icon = getMethodIcon(attendance.check_out_method);
                        return Icon ? <Icon size={16} /> : null;
                      })()}
                    </div>
                  )}
                  <span className="text-xs text-gray-500">
                    {getMethodLabel(attendance.check_out_method)}
                  </span>
                </div>
              </div>
              {smsStatus?.checkOutSMS?.status === "failed" &&
                smsStatus.checkOutSMS.errorMessage && (
                  <div className="mt-2 text-xs text-red-600">
                    {smsStatus.checkOutSMS.errorMessage}
                  </div>
                )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
