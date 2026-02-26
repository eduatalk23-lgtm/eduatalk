"use client";

import { useRef, useState, useEffect } from "react";
import { Avatar } from "@/components/atoms/Avatar";
import {
  uploadProfileImage,
  deleteProfileImage,
} from "@/lib/domains/profile/actions";
import { useToast } from "@/components/ui/ToastProvider";
import { Camera, Trash2 } from "lucide-react";

type ProfileImageUploaderProps = {
  currentImageUrl?: string | null;
  name: string;
  disabled?: boolean;
  onImageChange?: (url: string | null) => void;
};

export default function ProfileImageUploader({
  currentImageUrl,
  name,
  disabled,
  onImageChange,
}: ProfileImageUploaderProps) {
  const [imageUrl, setImageUrl] = useState(currentImageUrl ?? null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  // prop 변경 시 상태 동기화 (revalidation 등)
  useEffect(() => {
    setImageUrl(currentImageUrl ?? null);
  }, [currentImageUrl]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadProfileImage(formData);

      if (result.success && result.url) {
        setImageUrl(result.url);
        onImageChange?.(result.url);
        showToast("프로필 이미지가 업로드되었습니다.", "success");
      } else {
        showToast(result.error || "이미지 업로드에 실패했습니다.", "error");
      }
    } catch {
      showToast("이미지 업로드 중 오류가 발생했습니다.", "error");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!confirm("프로필 이미지를 삭제하시겠습니까?")) return;

    setIsUploading(true);
    try {
      const result = await deleteProfileImage();

      if (result.success) {
        setImageUrl(null);
        onImageChange?.(null);
        showToast("프로필 이미지가 삭제되었습니다.", "success");
      } else {
        showToast(result.error || "이미지 삭제에 실패했습니다.", "error");
      }
    } catch {
      showToast("이미지 삭제 중 오류가 발생했습니다.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar src={imageUrl} name={name} size="xl" />
        {!disabled && (
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
            {imageUrl && (
              <button
                type="button"
                onClick={handleDelete}
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
          onChange={handleUpload}
          className="hidden"
        />
      </div>
      {isUploading && (
        <span className="text-sm text-gray-500">업로드 중...</span>
      )}
    </div>
  );
}
