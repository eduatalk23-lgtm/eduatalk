"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getAttendanceSMSSettings,
  updateAttendanceSMSSettings,
} from "@/app/(admin)/actions/attendanceSettingsActions";
import Button from "@/components/atoms/Button";
import Label from "@/components/atoms/Label";
import { Card, CardContent, CardHeader } from "@/components/molecules/Card";
import { Badge } from "@/components/atoms/Badge";
import { AlertTriangle } from "lucide-react";

export function AttendanceSMSSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    attendance_sms_check_in_enabled: true,
    attendance_sms_check_out_enabled: true,
    attendance_sms_absent_enabled: true,
    attendance_sms_late_enabled: true,
    attendance_sms_student_checkin_enabled: false,
    attendance_sms_recipient: 'auto' as 'mother' | 'father' | 'both' | 'auto',
    attendance_sms_show_failure_to_user: false,
  });

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAttendanceSMSSettings();
      if (result.success && result.data) {
        setFormData({
          attendance_sms_check_in_enabled:
            result.data.attendance_sms_check_in_enabled ?? true,
          attendance_sms_check_out_enabled:
            result.data.attendance_sms_check_out_enabled ?? true,
          attendance_sms_absent_enabled:
            result.data.attendance_sms_absent_enabled ?? true,
          attendance_sms_late_enabled:
            result.data.attendance_sms_late_enabled ?? true,
          attendance_sms_student_checkin_enabled:
            result.data.attendance_sms_student_checkin_enabled ?? false,
          attendance_sms_recipient:
            result.data.attendance_sms_recipient ?? 'auto',
          attendance_sms_show_failure_to_user:
            result.data.attendance_sms_show_failure_to_user ?? false,
        });
      }
    } catch (err: any) {
      setError(err.message || "SMS 설정을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleRecipientChange = (value: string) => {
    setFormData({
      ...formData,
      attendance_sms_recipient: value as 'mother' | 'father' | 'both' | 'auto',
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    // 폼 데이터 유효성 검증
    const validRecipientValues = ['mother', 'father', 'both', 'auto'] as const;
    if (!validRecipientValues.includes(formData.attendance_sms_recipient)) {
      setError('SMS 수신자 선택 값이 올바르지 않습니다.');
      setSaving(false);
      return;
    }

    try {
      console.log('[AttendanceSMSSettingsForm] 폼 제출 데이터:', formData);
      const result = await updateAttendanceSMSSettings(formData);
      console.log('[AttendanceSMSSettingsForm] 서버 응답:', result);

      if (result.success) {
        setSuccess(true);
        setError(null);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        // 서버에서 반환된 에러 메시지 표시
        const errorMessage = result.error || "SMS 설정 저장에 실패했습니다.";
        console.error('[AttendanceSMSSettingsForm] 저장 실패:', errorMessage);
        setError(errorMessage);
      }
    } catch (err: any) {
      // 네트워크 에러 또는 예상치 못한 에러 처리
      console.error('[AttendanceSMSSettingsForm] 예외 발생:', err);
      
      let errorMessage = "SMS 설정 저장 중 오류가 발생했습니다.";
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      // 네트워크 에러인지 확인
      if (err?.name === 'NetworkError' || err?.code === 'ECONNREFUSED' || err?.code === 'ETIMEDOUT') {
        errorMessage = "네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.";
      }
      
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-sm text-gray-500">로딩 중...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="출석 SMS 알림 설정" />
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="check_in_enabled">입실 알림</Label>
                <p className="mt-1 text-xs text-gray-500">
                  학생이 입실할 때 학부모에게 SMS를 발송합니다.
                  <br />
                  <span className="text-gray-400">
                    ※ 관리자가 직접 체크인한 경우에만 발송됩니다. 학생이 직접
                    체크인한 경우는 "학생 직접 체크인 시 발송" 설정도 확인해야
                    합니다.
                  </span>
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="check_in_enabled"
                  checked={formData.attendance_sms_check_in_enabled}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      attendance_sms_check_in_enabled: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="check_out_enabled">퇴실 알림</Label>
                <p className="mt-1 text-xs text-gray-500">
                  학생이 퇴실할 때 학부모에게 SMS를 발송합니다.
                  <br />
                  <span className="text-gray-400">
                    ※ 관리자가 직접 체크아웃한 경우에만 발송됩니다. 학생이 직접
                    체크아웃한 경우는 "학생 직접 체크인 시 발송" 설정도 확인해야
                    합니다.
                  </span>
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="check_out_enabled"
                  checked={formData.attendance_sms_check_out_enabled}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      attendance_sms_check_out_enabled: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="absent_enabled">결석 알림</Label>
                <p className="mt-1 text-xs text-gray-500">
                  학생이 결석할 때 학부모에게 SMS를 발송합니다.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="absent_enabled"
                  checked={formData.attendance_sms_absent_enabled}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      attendance_sms_absent_enabled: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="late_enabled">지각 알림</Label>
                <p className="mt-1 text-xs text-gray-500">
                  학생이 지각할 때 학부모에게 SMS를 발송합니다.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="late_enabled"
                  checked={formData.attendance_sms_late_enabled}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      attendance_sms_late_enabled: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Label htmlFor="student_checkin_enabled">
                    학생 직접 체크인 시 발송
                  </Label>
                  {!formData.attendance_sms_student_checkin_enabled && (
                    <Badge variant="warning" size="xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      중요
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  학생이 QR코드나 위치로 직접 체크인/퇴실할 때도 SMS를
                  발송합니다.
                </p>
                {!formData.attendance_sms_student_checkin_enabled && (
                  <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2">
                    <p className="text-xs text-amber-800">
                      ⚠️ 이 설정이 꺼져 있으면 학생이 직접 체크인해도 SMS가
                      발송되지 않습니다. "입실 알림"이 켜져 있어도 이 설정이
                      꺼져 있으면 발송되지 않으니 주의하세요.
                    </p>
                  </div>
                )}
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="student_checkin_enabled"
                  checked={formData.attendance_sms_student_checkin_enabled}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      attendance_sms_student_checkin_enabled: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <Label htmlFor="show_failure_to_user">
                  SMS 발송 실패 시 사용자에게 알림
                </Label>
                <p className="mt-1 text-xs text-gray-500">
                  SMS 발송에 실패한 경우 사용자에게 경고 메시지를 표시합니다.
                  <br />
                  <span className="text-gray-400">
                    (출석 기록은 정상 저장됩니다.)
                  </span>
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="show_failure_to_user"
                  checked={formData.attendance_sms_show_failure_to_user}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      attendance_sms_show_failure_to_user: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="pt-4 border-t">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="sms_recipient">SMS 수신자 선택</Label>
                  <p className="mt-1 text-xs text-gray-500">
                    출석 알림 SMS를 받을 학부모를 선택하세요.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sms_recipient"
                      value="auto"
                      checked={formData.attendance_sms_recipient === 'auto'}
                      onChange={(e) => handleRecipientChange(e.target.value)}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      자동 (먼저 있는 번호)
                    </span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sms_recipient"
                      value="mother"
                      checked={formData.attendance_sms_recipient === 'mother'}
                      onChange={(e) => handleRecipientChange(e.target.value)}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">어머니만</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sms_recipient"
                      value="father"
                      checked={formData.attendance_sms_recipient === 'father'}
                      onChange={(e) => handleRecipientChange(e.target.value)}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">아버지만</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sms_recipient"
                      value="both"
                      checked={formData.attendance_sms_recipient === 'both'}
                      onChange={(e) => handleRecipientChange(e.target.value)}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">둘 다</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600">
              SMS 설정이 저장되었습니다.
            </div>
          )}

          <Button
            type="submit"
            disabled={saving}
            isLoading={saving}
            className="w-full"
          >
            저장
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

