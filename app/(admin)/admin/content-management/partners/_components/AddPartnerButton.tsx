"use client";

/**
 * 파트너 추가 버튼 및 다이얼로그
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { Dialog, DialogFooter } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
import { createPartner, type CreatePartnerInput } from "@/lib/domains/content-research/actions/partners";

export function AddPartnerButton() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState<CreatePartnerInput>({
    name: "",
    display_name: "",
    partner_type: "publisher",
    content_type: "book",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.display_name.trim()) {
      toast.showError("필수 필드를 입력해주세요.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await createPartner(formData);
      if (result.success) {
        toast.showSuccess("파트너가 등록되었습니다.");
        setOpen(false);
        setFormData({
          name: "",
          display_name: "",
          partner_type: "publisher",
          content_type: "book",
        });
        router.refresh();
      } else {
        toast.showError(result.error ?? "등록 실패");
      }
    } catch (error) {
      toast.showError("등록 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        파트너 추가
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="새 파트너 등록"
        description="출판사, 강의 플랫폼 등 B2B 파트너를 등록합니다."
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 식별자 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              식별자 (영문) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
              placeholder="예: chunjae, megastudy"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">영문 소문자, 숫자, 하이픈만 사용 가능</p>
          </div>

          {/* 표시 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              표시 이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              placeholder="예: 천재교육, 메가스터디"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* 파트너 유형 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              파트너 유형
            </label>
            <select
              value={formData.partner_type}
              onChange={(e) => setFormData({ ...formData, partner_type: e.target.value as CreatePartnerInput["partner_type"] })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="publisher">출판사</option>
              <option value="lecture_platform">강의 플랫폼</option>
              <option value="academy">학원</option>
            </select>
          </div>

          {/* 콘텐츠 유형 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              콘텐츠 유형
            </label>
            <select
              value={formData.content_type}
              onChange={(e) => setFormData({ ...formData, content_type: e.target.value as CreatePartnerInput["content_type"] })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="book">교재</option>
              <option value="lecture">강의</option>
              <option value="both">모두</option>
            </select>
          </div>

          {/* 계약 기간 (선택) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                계약 시작일 (선택)
              </label>
              <input
                type="date"
                value={formData.contract_start_date ?? ""}
                onChange={(e) => setFormData({ ...formData, contract_start_date: e.target.value || undefined })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                계약 종료일 (선택)
              </label>
              <input
                type="date"
                value={formData.contract_end_date ?? ""}
                onChange={(e) => setFormData({ ...formData, contract_end_date: e.target.value || undefined })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button variant="primary" type="submit" isLoading={isLoading}>
              등록
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}
