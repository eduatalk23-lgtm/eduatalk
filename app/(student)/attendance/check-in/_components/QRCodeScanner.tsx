"use client";

import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  checkInWithQRCode,
  checkOutWithQRCode,
} from "@/app/(student)/actions/attendanceActions";
import Button from "@/components/atoms/Button";

type QRCodeScannerProps = {
  mode?: "check-in" | "check-out";
  onSuccess?: () => void;
};

export function QRCodeScanner({
  mode = "check-in",
  onSuccess,
}: QRCodeScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [smsFailure, setSmsFailure] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "qr-reader";

  useEffect(() => {
    return () => {
      // 컴포넌트 언마운트 시 스캐너 정리
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current = null;
          })
          .catch(() => {
            scannerRef.current = null;
          });
      }
    };
  }, []);

  const startScan = async () => {
    try {
      setError(null);
      setSuccess(false);
      setScanning(true);

      const html5QrCode = new Html5Qrcode(scannerId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" }, // 후면 카메라 우선
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          // QR 코드 스캔 성공
          try {
            await html5QrCode.stop();
            setScanning(false);
            scannerRef.current = null;

            const result =
              mode === "check-out"
                ? await checkOutWithQRCode(decodedText)
                : await checkInWithQRCode(decodedText);
            if (result.success) {
              setSuccess(true);
              if (result.smsFailure) {
                setSmsFailure(result.smsFailure);
              }
              if (onSuccess) {
                setTimeout(() => {
                  onSuccess();
                }, 1000);
              }
            } else {
              setError(
                result.error ||
                  (mode === "check-out"
                    ? "퇴실 체크에 실패했습니다."
                    : "출석 체크에 실패했습니다.")
              );
            }
          } catch (err: any) {
            setError(
              err.message ||
                (mode === "check-out"
                  ? "퇴실 체크 중 오류가 발생했습니다."
                  : "출석 체크 중 오류가 발생했습니다.")
            );
            setScanning(false);
          }
        },
        (errorMessage) => {
          // 스캔 중 에러 (무시 - 계속 스캔)
          // console.debug("[QRCodeScanner] 스캔 중:", errorMessage);
        }
      );
    } catch (err: any) {
      let errorMessage = "QR 코드 스캔을 시작할 수 없습니다.";

      if (err.message?.includes("Permission denied")) {
        errorMessage =
          "카메라 권한이 필요합니다. 브라우저 설정에서 카메라 권한을 허용해주세요.";
      } else if (err.message?.includes("No camera")) {
        errorMessage = "카메라를 찾을 수 없습니다.";
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setScanning(false);
      scannerRef.current = null;
    }
  };

  const stopScan = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
        setScanning(false);
      } catch (err) {
        console.error("[QRCodeScanner] 스캔 중지 실패:", err);
        scannerRef.current = null;
        setScanning(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div id={scannerId} className="w-full max-w-md mx-auto" />

      {!scanning ? (
        <Button onClick={startScan} className="w-full">
          {mode === "check-out" ? "퇴실 QR 코드 스캔 시작" : "QR 코드 스캔 시작"}
        </Button>
      ) : (
        <Button onClick={stopScan} variant="outline" className="w-full">
          스캔 중지
        </Button>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600">
          {mode === "check-out"
            ? "퇴실 체크가 완료되었습니다!"
            : "출석 체크가 완료되었습니다!"}
        </div>
      )}

      {smsFailure && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          <div className="flex flex-col gap-1">
            <p className="font-medium">⚠️ SMS 발송 실패</p>
            <p className="text-xs">{smsFailure}</p>
            <p className="text-xs text-amber-600">
              출석 기록은 정상 저장되었습니다.
            </p>
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500">
        <p>• 카메라 권한이 필요합니다.</p>
        <p>• 학원의 QR 코드를 카메라에 비춰주세요.</p>
      </div>
    </div>
  );
}
