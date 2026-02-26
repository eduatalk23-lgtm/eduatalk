"use client";

import ProfileImageUploader from "@/components/molecules/ProfileImageUploader";

type ParentProfileSectionProps = {
  name: string;
  profileImageUrl: string | null;
  createdAt: string | null;
};

export function ParentProfileSection({
  name,
  profileImageUrl,
  createdAt,
}: ParentProfileSectionProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">나의 정보</h2>

      <ProfileImageUploader
        currentImageUrl={profileImageUrl}
        name={name}
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">이름</label>
          <div className="text-base text-gray-900">{name || "이름 없음"}</div>
        </div>
        {createdAt && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">가입일</label>
            <div className="text-base text-gray-900">
              {new Date(createdAt).toLocaleDateString("ko-KR")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
