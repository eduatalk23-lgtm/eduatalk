"use client";

import { useState } from "react";
import { checkInWithLocation } from "@/app/(student)/actions/attendanceActions";
import Button from "@/components/atoms/Button";

type LocationCheckInProps = {
  onSuccess?: () => void;
};

export function LocationCheckIn({ onSuccess }: LocationCheckInProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);

  const handleCheckIn = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    setDistance(null);

    try {
      // 현재 위치 가져오기
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            }
          );
        }
      );

      const { latitude, longitude } = position.coords;

      const result = await checkInWithLocation(latitude, longitude);
      if (result.success) {
        setSuccess(true);
        setDistance(result.distance || null);
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 2000);
        }
      } else {
        setError(result.error || "출석 체크에 실패했습니다.");
      }
    } catch (err: any) {
      let errorMessage = "위치 기반 출석 체크에 실패했습니다.";
      
      if (err.code === 1) {
        errorMessage = "위치 권한이 필요합니다. 브라우저 설정에서 위치 권한을 허용해주세요.";
      } else if (err.code === 2) {
        errorMessage = "위치를 가져올 수 없습니다. GPS가 켜져 있는지 확인해주세요.";
      } else if (err.code === 3) {
        errorMessage = "위치 요청 시간이 초과되었습니다. 다시 시도해주세요.";
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={handleCheckIn}
        disabled={loading}
        isLoading={loading}
        className="w-full"
      >
        {loading ? "위치 확인 중..." : "위치로 출석 체크"}
      </Button>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600">
          출석 체크가 완료되었습니다!
          {distance !== null && (
            <p className="mt-1 text-xs">
              학원에서 {distance}m 떨어진 위치입니다.
            </p>
          )}
        </div>
      )}

      <div className="text-xs text-gray-500">
        <p>• 위치 권한이 필요합니다.</p>
        <p>• GPS가 켜져 있어야 정확한 위치를 확인할 수 있습니다.</p>
        <p>• 학원 위치에서 설정된 반경 내에 있어야 출석이 인정됩니다.</p>
      </div>
    </div>
  );
}

