"use client";

import { useState, useEffect, useCallback } from "react";
import {
  generateQRCodeAction,
  getActiveQRCodeAction,
} from "@/app/(admin)/actions/qrCodeActions";
import Button from "@/components/atoms/Button";
import { Card, CardContent, CardHeader } from "@/components/molecules/Card";
import type { QRCodeRecord } from "@/lib/services/qrCodeService";

export function QRCodeDisplay() {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [qrCodeInfo, setQrCodeInfo] = useState<QRCodeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQRCode = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 먼저 활성 QR 코드 조회 시도
      const activeResult = await getActiveQRCodeAction();
      if (activeResult.success && activeResult.data) {
        // 활성 QR 코드가 있으면 표시
        setQrCodeInfo(activeResult.data);
        setQrCodeUrl(activeResult.data.qr_code_url || null);
        setLoading(false);
        return;
      }

      // 활성 QR 코드가 없으면 새로 생성
      const result = await generateQRCodeAction();
      if (result.success && result.qrCodeUrl) {
        setQrCodeUrl(result.qrCodeUrl);
        // 생성 후 다시 활성 QR 코드 정보 조회
        const updatedResult = await getActiveQRCodeAction();
        if (updatedResult.success && updatedResult.data) {
          setQrCodeInfo(updatedResult.data);
        }
      } else {
        setError(result.error || "QR 코드 생성에 실패했습니다.");
      }
    } catch (err: any) {
      setError(err.message || "QR 코드 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQRCode();
  }, [loadQRCode]);

  const handleDownload = () => {
    if (!qrCodeUrl) return;

    const link = document.createElement("a");
    link.href = qrCodeUrl;
    link.download = "attendance-qr-code.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (!qrCodeUrl) return;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>출석용 QR 코드</title>
            <style>
              body {
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                font-family: Arial, sans-serif;
              }
              .qr-container {
                text-align: center;
              }
              .qr-code {
                max-width: 400px;
                margin: 20px 0;
              }
              .instructions {
                margin-top: 20px;
                font-size: 14px;
                color: #666;
              }
            </style>
          </head>
          <body>
            <div class="qr-container">
              <h1>출석용 QR 코드</h1>
              <img src="${qrCodeUrl}" alt="QR Code" class="qr-code" />
              <div class="instructions">
                <p>이 QR 코드를 학원 입구에 부착하세요.</p>
                <p>학생들이 이 QR 코드를 스캔하여 출석을 체크합니다.</p>
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-sm text-gray-500">QR 코드 생성 중...</div>
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
          <Button onClick={loadQRCode} className="mt-4">
            다시 시도
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="QR 코드" />
      <CardContent>
        <div className="space-y-6">
          {qrCodeUrl && (
            <div className="flex justify-center">
              <img
                src={qrCodeUrl}
                alt="출석용 QR 코드"
                className="rounded-lg border border-gray-200"
              />
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={loadQRCode} variant="outline" className="flex-1">
              새로고침
            </Button>
            <Button
              onClick={handleDownload}
              variant="outline"
              className="flex-1"
            >
              다운로드
            </Button>
            <Button onClick={handlePrint} variant="outline" className="flex-1">
              인쇄
            </Button>
          </div>

          {qrCodeInfo && (
            <div className="rounded-lg bg-gray-50 p-4 text-sm">
              <p className="font-semibold mb-2 text-gray-900">QR 코드 정보:</p>
              <div className="space-y-1 text-gray-700">
                <p>
                  생성 시간:{" "}
                  {new Date(qrCodeInfo.created_at).toLocaleString("ko-KR")}
                </p>
                <p>
                  만료 시간:{" "}
                  {new Date(qrCodeInfo.expires_at).toLocaleString("ko-KR")}
                </p>
                <p>사용 횟수: {qrCodeInfo.usage_count}회</p>
                {qrCodeInfo.last_used_at && (
                  <p>
                    마지막 사용:{" "}
                    {new Date(qrCodeInfo.last_used_at).toLocaleString("ko-KR")}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
            <p className="font-semibold mb-2">사용 방법:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>이 QR 코드를 출력하여 학원 입구에 부착하세요.</li>
              <li>학생들이 출석 체크 페이지에서 이 QR 코드를 스캔합니다.</li>
              <li>QR 코드는 24시간마다 갱신하는 것을 권장합니다.</li>
              <li>
                새 QR 코드를 생성하면 이전 QR 코드는 자동으로 비활성화됩니다.
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
