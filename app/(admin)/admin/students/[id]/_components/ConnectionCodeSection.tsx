"use client";

import { useState, useEffect } from "react";
import Button from "@/components/atoms/Button";
import { Copy, RefreshCw, Link2, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  regenerateConnectionCode,
  getStudentConnectionCode,
} from "@/lib/domains/student";

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
        const result = await getStudentConnectionCode(studentId);
        if (result.success) {
          setConnectionCode(result.data ?? null);
        } else {
          console.error("[ConnectionCodeSection] 연결 코드 조회 실패", result.error);
        }
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
    } catch {
      showError("연결 코드 복사에 실패했습니다.");
    }
  };

  // 로그인/회원가입 URL 생성 (로그인 페이지 기준)
  const getLoginUrl = () => {
    if (!connectionCode?.connection_code) return "";
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}/login?code=${connectionCode.connection_code}`;
  };

  // URL 복사
  const handleCopyUrl = async () => {
    const url = getLoginUrl();
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      showSuccess("가입 URL이 클립보드에 복사되었습니다.");
    } catch {
      showError("URL 복사에 실패했습니다.");
    }
  };

  // 연결 코드 재발급
  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const result = await regenerateConnectionCode(studentId);
      if (result.success && result.connectionCode) {
        // 새 코드로 업데이트
        const fetchResult = await getStudentConnectionCode(studentId);
        if (fetchResult.success) {
          setConnectionCode(fetchResult.data ?? null);
          showSuccess("연결 코드가 재발급되었습니다.");
        } else {
          showError(fetchResult.error || "연결 코드 조회에 실패했습니다.");
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
          <div className="flex flex-col gap-4">
            {/* 연결 코드 */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">연결 코드</label>
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
            </div>

            {/* 가입 URL */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">가입 URL</label>
              <div className="flex items-center gap-3">
                <div className="flex-1 p-3 bg-white border rounded-lg text-sm text-gray-600 truncate">
                  {getLoginUrl()}
                </div>
                <Button
                  variant="outline"
                  onClick={handleCopyUrl}
                  className="flex items-center gap-2"
                >
                  <Link2 size={16} />
                  복사
                </Button>
                <a
                  href={getLoginUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <ExternalLink size={16} />
                  열기
                </a>
              </div>
              <p className="text-xs text-gray-500">
                이 URL을 학생이나 학부모에게 공유하면 로그인/회원가입 시 연결 코드가 자동으로 적용됩니다.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-sm text-gray-600">
                만료일: {new Date(connectionCode.expires_at).toLocaleDateString("ko-KR")}
              </div>
              <Button
                variant="outline"
                onClick={handleRegenerate}
                isLoading={isRegenerating}
                className="flex items-center gap-2"
              >
                <RefreshCw size={16} />
                재발급
              </Button>
            </div>
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

