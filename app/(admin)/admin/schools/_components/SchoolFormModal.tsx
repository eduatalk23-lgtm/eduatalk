"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import { createSchool, updateSchool } from "@/app/(admin)/actions/schoolActions";
import { getRegionsAction } from "@/app/(admin)/actions/schoolActions";
import RegionFilter from "./RegionFilter";
import type { School, Region } from "@/lib/data/schools";

type SchoolFormModalProps = {
  school?: School;
  defaultType?: "중학교" | "고등학교" | "대학교";
  onSuccess: () => void;
  onCancel: () => void;
};

export default function SchoolFormModal({
  school,
  defaultType,
  onSuccess,
  onCancel,
}: SchoolFormModalProps) {
  const toast = useToast();
  const [schoolType, setSchoolType] = useState<
    "중학교" | "고등학교" | "대학교"
  >(school?.type || defaultType || "중학교");
  const [name, setName] = useState(school?.name || "");
  const [regionId, setRegionId] = useState<string | null>(
    school?.region_id || null
  );
  const [address, setAddress] = useState(school?.address || "");
  const [postalCode, setPostalCode] = useState(school?.postal_code || "");
  const [addressDetail, setAddressDetail] = useState(
    school?.address_detail || ""
  );
  const [city, setCity] = useState(school?.city || "");
  const [district, setDistrict] = useState(school?.district || "");
  const [phone, setPhone] = useState(school?.phone || "");

  // 고등학교 속성
  const [category, setCategory] = useState<
    "일반고" | "특목고" | "자사고" | "특성화고" | ""
  >((school?.category as "일반고" | "특목고" | "자사고" | "특성화고" | "" | null | undefined) || "");

  // 대학교 속성
  const [universityType, setUniversityType] = useState<"4년제" | "2년제" | "">(
    (school?.university_type as "4년제" | "2년제" | "" | null | undefined) || ""
  );
  const [universityOwnership, setUniversityOwnership] = useState<
    "국립" | "사립" | ""
  >((school?.university_ownership as "국립" | "사립" | "" | null | undefined) || "");
  const [campusName, setCampusName] = useState(school?.campus_name || "");

  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.showError("학교명을 입력해주세요.");
      return;
    }

    if (!schoolType) {
      toast.showError("학교 타입을 선택해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      if (school) {
        formData.append("id", school.id);
      }
      formData.append("name", name.trim());
      formData.append("type", schoolType);
      if (regionId) formData.append("region_id", regionId);
      if (address) formData.append("address", address.trim());
      if (postalCode) formData.append("postal_code", postalCode.trim());
      if (addressDetail) formData.append("address_detail", addressDetail.trim());
      if (city) formData.append("city", city.trim());
      if (district) formData.append("district", district.trim());
      if (phone) formData.append("phone", phone.trim());

      if (schoolType === "고등학교" && category) {
        formData.append("category", category);
      }

      if (schoolType === "대학교") {
        if (universityType) formData.append("university_type", universityType);
        if (universityOwnership)
          formData.append("university_ownership", universityOwnership);
        if (campusName) formData.append("campus_name", campusName.trim());
      }

      const result = school
        ? await updateSchool(formData)
        : await createSchool(formData);

      if (result.success) {
        toast.showSuccess(
          school ? "학교 정보가 수정되었습니다." : "학교가 등록되었습니다."
        );
        onSuccess();
      } else {
        toast.showError(result.error || "저장에 실패했습니다.");
      }
    } catch (error) {
      console.error("학교 저장 실패:", error);
      toast.showError(
        error instanceof Error ? error.message : "저장에 실패했습니다."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={true}
      onOpenChange={() => onCancel()}
      title={school ? "학교 수정" : "학교 등록"}
      maxWidth="2xl"
    >
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            {/* 학교명 */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                학교명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 서울대학교"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            {/* 학교 타입 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                학교 타입 <span className="text-red-500">*</span>
              </label>
              <select
                value={schoolType}
                onChange={(e) =>
                  setSchoolType(
                    e.target.value as "중학교" | "고등학교" | "대학교"
                  )
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
                disabled={isSubmitting || !!school}
              >
                <option value="중학교">중학교</option>
                <option value="고등학교">고등학교</option>
                <option value="대학교">대학교</option>
              </select>
            </div>

            {/* 지역 */}
            <div className="md:col-span-2">
              <RegionFilter value={regionId} onChange={setRegionId} />
            </div>

            {/* 중복 확인 안내 */}
            <div className="md:col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold text-blue-900">
                  중복 확인 안내
                </h4>
                <ul className="list-inside list-disc space-y-1 text-xs text-blue-800">
                  <li>같은 학교명, 타입, 지역의 학교는 등록할 수 없습니다.</li>
                  <li>
                    대학교의 경우, 캠퍼스명이 다르면 같은 이름의 학교도 등록
                    가능합니다.
                  </li>
                  <li>
                    지역이 선택되지 않은 경우, 전역적으로 중복을 확인합니다.
                  </li>
                </ul>
              </div>
            </div>

            {/* 기본주소 */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                기본주소
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="예: 서울특별시 관악구 관악로 1"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
            </div>

            {/* 우편번호 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                우편번호
              </label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="예: 08826"
                maxLength={6}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
            </div>

            {/* 시/군/구 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                시/군/구
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="예: 관악구"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
            </div>

            {/* 상세주소 */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                상세주소
              </label>
              <input
                type="text"
                value={addressDetail}
                onChange={(e) => setAddressDetail(e.target.value)}
                placeholder="예: 서울대학교 1동 101호"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
            </div>

            {/* 읍/면/동 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                읍/면/동
              </label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="예: 관악동"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
            </div>

            {/* 전화번호 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                전화번호
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="예: 02-880-5114"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
            </div>

            {/* 고등학교 유형 */}
            {schoolType === "고등학교" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  고등학교 유형
                </label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      e.target.value as
                        | "일반고"
                        | "특목고"
                        | "자사고"
                        | "특성화고"
                        | ""
                    )
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  disabled={isSubmitting}
                >
                  <option value="">선택하세요</option>
                  <option value="일반고">일반고</option>
                  <option value="특목고">특목고</option>
                  <option value="자사고">자사고</option>
                  <option value="특성화고">특성화고</option>
                </select>
              </div>
            )}

            {/* 대학교 유형 */}
            {schoolType === "대학교" && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    대학교 유형
                  </label>
                  <select
                    value={universityType}
                    onChange={(e) =>
                      setUniversityType(e.target.value as "4년제" | "2년제" | "")
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    disabled={isSubmitting}
                  >
                    <option value="">선택하세요</option>
                    <option value="4년제">4년제</option>
                    <option value="2년제">2년제</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    설립 유형
                  </label>
                  <select
                    value={universityOwnership}
                    onChange={(e) =>
                      setUniversityOwnership(
                        e.target.value as "국립" | "사립" | ""
                      )
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    disabled={isSubmitting}
                  >
                    <option value="">선택하세요</option>
                    <option value="국립">국립</option>
                    <option value="사립">사립</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    캠퍼스명
                  </label>
                  <input
                    type="text"
                    value={campusName}
                    onChange={(e) => setCampusName(e.target.value)}
                    placeholder="예: 서울캠퍼스"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    disabled={isSubmitting}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? "저장 중..." : "저장하기"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

