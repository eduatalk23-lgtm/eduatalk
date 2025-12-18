"use client";

import { useState, useEffect } from "react";
import Button from "@/components/atoms/Button";
import { Copy, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { regenerateConnectionCode } from "@/app/(admin)/actions/studentManagementActions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ConnectionCodeSectionProps = {
  studentId: string;
};

type ConnectionCodeData = {
  connection_code: string;
  expires_at: string;
  used_at: string | null;
};

export function ConnectionCodeSection({ studentId }: ConnectionCodeSectionProps) {
  const [connectionCode, setConnectionCode] = useState<ConnectionCodeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { showSuccess, showError } = useToast();

  // 연결 코드 조회
  useEffect(() => {
    async function fetchConnectionCode() {
      try {
        const supabase = await createSupabaseServerClient();
        const { data, error } = await supabase
          .from("student_connection_codes")
          .select("connection_code, expires_at, used_at")
          .eq("student_id", studentId)
          .is("used_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("[ConnectionCodeSection] 연결 코드 조회 실패", error);
          return;
        }

        setConnectionCode(data);
      } catch (error) {
        console.error("[ConnectionCodeSection] 연결 코드 조회 중 오류", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchConnectionCode();
  }, [studentId]);

  // 연결 코드 복사
  const handleCopy = async () => {
    if (!connectionCode?.connection_code) return;

    try {
      await navigator.clipboard.writeText(connectionCode.connection_code);
      showSuccess("연결 코드가 클립보드에 복사되었습니다.");
    } catch (error) {
      showError("연결 코드 복사에 실패했습니다.");
    }
  };

  // 연결 코드 재발급
  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const result = await regenerateConnectionCode(studentId);
      if (result.success && result.connectionCode) {
        // 새 코드로 업데이트
        const supabase = await createSupabaseServerClient();
        const { data } = await supabase
          .from("student_connection_codes")
          .select("connection_code, expires_at, used_at")
          .eq("student_id", studentId)
          .eq("connection_code", result.connectionCode)
          .maybeSingle();

        if (data) {
          setConnectionCode(data);
          showSuccess("연결 코드가 재발급되었습니다.");
        }
      } else {
        showError(result.error || "연결 코드 재발급에 실패했습니다.");
      }
    } catch (error) {
      showError("연결 코드 재발급 중 오류가 발생했습니다.");
    } finally {
      setIsRegenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 border rounded-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const isExpired = connectionCode
    ? new Date(connectionCode.expires_at) < new Date()
    : false;
  const isUsed = connectionCode?.used_at !== null;

  return (
    <div className="p-6 border rounded-lg bg-gray-50">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">연결 코드</h3>
          <p className="text-sm text-gray-600">
            학생이 회원가입 시 이 코드를 입력하여 계정을 연결할 수 있습니다.
          </p>
        </div>

        {connectionCode && !isUsed && !isExpired ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 p-3 bg-white border rounded-lg font-mono text-lg">
                {connectionCode.connection_code}
              </div>
              <Button
                variant="outline"
                onClick={handleCopy}
                className="flex items-center gap-2"
              >
                <Copy size={16} />
                복사
              </Button>
            </div>
            <div className="text-sm text-gray-600">
              만료일: {new Date(connectionCode.expires_at).toLocaleDateString("ko-KR")}
            </div>
            <Button
              variant="outline"
              onClick={handleRegenerate}
              isLoading={isRegenerating}
              className="flex items-center gap-2 w-fit"
            >
              <RefreshCw size={16} />
              재발급
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {isUsed && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                이 연결 코드는 이미 사용되었습니다.
              </div>
            )}
            {isExpired && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                이 연결 코드는 만료되었습니다.
              </div>
            )}
            {!connectionCode && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                연결 코드가 없습니다.
              </div>
            )}
            <Button
              variant="primary"
              onClick={handleRegenerate}
              isLoading={isRegenerating}
              className="flex items-center gap-2 w-fit"
            >
              <RefreshCw size={16} />
              연결 코드 생성
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

