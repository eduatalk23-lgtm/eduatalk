"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getLocationSettings,
  updateLocationSettings,
} from "@/app/(admin)/actions/attendanceSettingsActions";
import Button from "@/components/atoms/Button";
import Input from "@/components/atoms/Input";
import Label from "@/components/atoms/Label";
import { Card, CardContent, CardHeader } from "@/components/molecules/Card";

export function LocationSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    latitude: "",
    longitude: "",
    radiusMeters: "100",
  });

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getLocationSettings();
      if (result.success && result.data) {
        setFormData({
          latitude: result.data.latitude?.toString() || "",
          longitude: result.data.longitude?.toString() || "",
          radiusMeters: result.data.radiusMeters?.toString() || "100",
        });
      }
    } catch (err: any) {
      setError(err.message || "위치 설정을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("브라우저가 위치 서비스를 지원하지 않습니다.");
      return;
    }

    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData({
          ...formData,
          latitude: position.coords.latitude.toFixed(8),
          longitude: position.coords.longitude.toFixed(8),
        });
      },
      (err) => {
        let errorMessage = "위치를 가져올 수 없습니다.";
        if (err.code === 1) {
          errorMessage =
            "위치 권한이 필요합니다. 브라우저 설정에서 위치 권한을 허용해주세요.";
        } else if (err.code === 2) {
          errorMessage =
            "위치를 가져올 수 없습니다. GPS가 켜져 있는지 확인해주세요.";
        }
        setError(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const latitude = parseFloat(formData.latitude);
      const longitude = parseFloat(formData.longitude);
      const radiusMeters = parseInt(formData.radiusMeters, 10);

      if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusMeters)) {
        setError("모든 필드를 올바르게 입력해주세요.");
        setSaving(false);
        return;
      }

      const result = await updateLocationSettings({
        latitude,
        longitude,
        radiusMeters,
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || "위치 설정 저장에 실패했습니다.");
      }
    } catch (err: any) {
      setError(err.message || "위치 설정 저장 중 오류가 발생했습니다.");
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
      <CardHeader title="위치 설정" />
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="latitude">위도 (Latitude) *</Label>
            <Input
              id="latitude"
              type="number"
              step="any"
              value={formData.latitude}
              onChange={(e) =>
                setFormData({ ...formData, latitude: e.target.value })
              }
              placeholder="37.5665"
              required
            />
            <p className="mt-1 text-xs text-gray-500">위도 범위: -90 ~ 90</p>
          </div>

          <div>
            <Label htmlFor="longitude">경도 (Longitude) *</Label>
            <Input
              id="longitude"
              type="number"
              step="any"
              value={formData.longitude}
              onChange={(e) =>
                setFormData({ ...formData, longitude: e.target.value })
              }
              placeholder="126.9780"
              required
            />
            <p className="mt-1 text-xs text-gray-500">경도 범위: -180 ~ 180</p>
          </div>

          <div>
            <Button
              type="button"
              onClick={handleGetCurrentLocation}
              variant="outline"
              className="w-full"
            >
              현재 위치 가져오기
            </Button>
          </div>

          <div>
            <Label htmlFor="radiusMeters">출석 인정 반경 (미터) *</Label>
            <Input
              id="radiusMeters"
              type="number"
              min="1"
              value={formData.radiusMeters}
              onChange={(e) =>
                setFormData({ ...formData, radiusMeters: e.target.value })
              }
              placeholder="100"
              required
            />
            <p className="text-xs text-gray-500">
              학생이 이 반경 내에 있어야 출석이 인정됩니다. (기본값: 100m)
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600">
              위치 설정이 저장되었습니다.
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
