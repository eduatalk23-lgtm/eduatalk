"use client";

import { useRef, useState, useTransition } from "react";
import {
  updateMyProfile,
  uploadProfileImage,
  deleteProfileImage,
} from "@/lib/domains/team/actions/profile";
import { useToast } from "@/components/ui/ToastProvider";
import { Avatar } from "@/components/atoms/Avatar";
import { Camera, Trash2 } from "lucide-react";

type ProfileEditFormProps = {
  initialName: string;
  email: string | null;
  role: string;
  initialProfileImageUrl?: string | null;
  initialJobTitle?: string | null;
  initialDepartment?: string | null;
  initialPhone?: string | null;
};

export default function ProfileEditForm({
  initialName,
  email,
  role,
  initialProfileImageUrl,
  initialJobTitle,
  initialDepartment,
  initialPhone,
}: ProfileEditFormProps) {
  const [name, setName] = useState(initialName);
  const [jobTitle, setJobTitle] = useState(initialJobTitle || "");
  const [department, setDepartment] = useState(initialDepartment || "");
  const [phone, setPhone] = useState(initialPhone || "");
  const [profileImageUrl, setProfileImageUrl] = useState(initialProfileImageUrl || null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const roleLabel =
    role === "admin" ? "관리자" : role === "consultant" ? "상담사" : "슈퍼관리자";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast("이름을 입력해주세요.", "error");
      return;
    }

    startTransition(async () => {
      const result = await updateMyProfile({
        name: name.trim(),
        jobTitle: jobTitle.trim() || undefined,
        department: department.trim() || undefined,
        phone: phone.trim() || undefined,
      });

      if (result.success) {
        showToast("프로필이 수정되었습니다.", "success");
        setIsEditing(false);
      } else {
        showToast(result.error || "프로필 수정에 실패했습니다.", "error");
      }
    });
  };

  const handleCancel = () => {
    setName(initialName);
    setJobTitle(initialJobTitle || "");
    setDepartment(initialDepartment || "");
    setPhone(initialPhone || "");
    setIsEditing(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const result = await uploadProfileImage(formData);

    if (result.success && result.url) {
      setProfileImageUrl(result.url);
      showToast("프로필 이미지가 업로드되었습니다.", "success");
    } else {
      showToast(result.error || "이미지 업로드에 실패했습니다.", "error");
    }

    setIsUploading(false);
    // 파일 input 초기화
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImageDelete = async () => {
    if (!confirm("프로필 이미지를 삭제하시겠습니까?")) return;

    setIsUploading(true);
    const result = await deleteProfileImage();

    if (result.success) {
      setProfileImageUrl(null);
      showToast("프로필 이미지가 삭제되었습니다.", "success");
    } else {
      showToast(result.error || "이미지 삭제에 실패했습니다.", "error");
    }

    setIsUploading(false);
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <h2 className="text-h2 text-gray-900 dark:text-gray-100">내 프로필</h2>
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            수정
          </button>
        )}
      </div>

      {/* 프로필 이미지 */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar
            src={profileImageUrl}
            name={name || email || ""}
            size="xl"
          />
          {isEditing && (
            <div className="absolute -bottom-1 -right-1 flex gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="rounded-full bg-indigo-600 p-1.5 text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
                title="이미지 변경"
              >
                <Camera className="size-3.5" />
              </button>
              {profileImageUrl && (
                <button
                  type="button"
                  onClick={handleImageDelete}
                  disabled={isUploading}
                  className="rounded-full bg-red-600 p-1.5 text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
                  title="이미지 삭제"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>
        {isUploading && (
          <span className="text-sm text-gray-500">업로드 중...</span>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="name"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                이름
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                placeholder="이름을 입력하세요"
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="jobTitle"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                직급
              </label>
              <input
                id="jobTitle"
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                maxLength={50}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                placeholder="예: 원장, 팀장"
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="department"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                부서
              </label>
              <input
                id="department"
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                maxLength={50}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                placeholder="예: 수학부, 영어부"
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="phone"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                연락처
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={20}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                placeholder="예: 010-0000-0000"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                이메일
              </div>
              <div className="text-base text-gray-900 dark:text-gray-100">
                {email || "-"}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                역할
              </div>
              <div className="text-base text-gray-900 dark:text-gray-100">
                {roleLabel}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "저장 중..." : "저장"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              취소
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <div className="text-sm text-gray-500 dark:text-gray-400">이름</div>
            <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {initialName || "-"}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              이메일
            </div>
            <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {email || "-"}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-sm text-gray-500 dark:text-gray-400">역할</div>
            <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {roleLabel}
            </div>
          </div>
          {(initialJobTitle || initialDepartment) && (
            <>
              {initialJobTitle && (
                <div className="flex flex-col gap-1">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    직급
                  </div>
                  <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {initialJobTitle}
                  </div>
                </div>
              )}
              {initialDepartment && (
                <div className="flex flex-col gap-1">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    부서
                  </div>
                  <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {initialDepartment}
                  </div>
                </div>
              )}
            </>
          )}
          {initialPhone && (
            <div className="flex flex-col gap-1">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                연락처
              </div>
              <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {initialPhone}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
