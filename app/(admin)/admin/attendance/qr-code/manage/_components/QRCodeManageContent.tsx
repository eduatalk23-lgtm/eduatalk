"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getQRCodeHistoryAction,
  deactivateQRCodeAction,
} from "@/app/(admin)/actions/qrCodeActions";
import Button from "@/components/atoms/Button";
import { Card, CardContent, CardHeader } from "@/components/molecules/Card";
import type { QRCodeRecord } from "@/lib/services/qrCodeService";

export function QRCodeManageContent() {
  const [history, setHistory] = useState<QRCodeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getQRCodeHistoryAction(50);
      if (result.success && result.data) {
        setHistory(result.data);
      } else {
        setError(result.error || "QR 코드 이력을 불러올 수 없습니다.");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "QR 코드 이력을 불러올 수 없습니다.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleDeactivate = async (qrCodeId: string) => {
    if (!confirm("이 QR 코드를 비활성화하시겠습니까?")) {
      return;
    }

    setDeactivating(qrCodeId);
    try {
      const result = await deactivateQRCodeAction(qrCodeId);
      if (result.success) {
        await loadHistory();
      } else {
        alert(result.error || "QR 코드 비활성화에 실패했습니다.");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "QR 코드 비활성화 중 오류가 발생했습니다.";
      alert(errorMessage);
    } finally {
      setDeactivating(null);
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

  if (error) {
    return (
      <Card>
        <CardContent>
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
          <Button onClick={loadHistory} className="mt-4">
            다시 시도
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="QR 코드 이력" />
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">생성된 QR 코드가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((qrCode) => {
              const isExpired = new Date(qrCode.expires_at) < new Date();
              const isActive = qrCode.is_active && !isExpired;

              return (
                <div
                  key={qrCode.id}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {isActive ? "활성" : "비활성"}
                        </span>
                        {isExpired && (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800">
                            만료됨
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">생성 시간</p>
                          <p className="font-medium text-gray-900">
                            {new Date(qrCode.created_at).toLocaleString(
                              "ko-KR"
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">만료 시간</p>
                          <p className="font-medium text-gray-900">
                            {new Date(qrCode.expires_at).toLocaleString(
                              "ko-KR"
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">사용 횟수</p>
                          <p className="font-medium text-gray-900">
                            {qrCode.usage_count}회
                          </p>
                        </div>
                        {qrCode.last_used_at && (
                          <div>
                            <p className="text-gray-500">마지막 사용</p>
                            <p className="font-medium text-gray-900">
                              {new Date(qrCode.last_used_at).toLocaleString(
                                "ko-KR"
                              )}
                            </p>
                          </div>
                        )}
                      </div>

                      {qrCode.deactivated_at && (
                        <div className="text-xs text-gray-500">
                          비활성화:{" "}
                          {new Date(qrCode.deactivated_at).toLocaleString(
                            "ko-KR"
                          )}
                        </div>
                      )}
                    </div>

                    {isActive && (
                      <Button
                        onClick={() => handleDeactivate(qrCode.id)}
                        variant="outline"
                        disabled={deactivating === qrCode.id}
                        isLoading={deactivating === qrCode.id}
                      >
                        비활성화
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
