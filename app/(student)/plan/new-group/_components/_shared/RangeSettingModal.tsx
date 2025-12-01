"use client";

import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { RangeSettingModalProps, ContentDetail } from "@/lib/types/content-selection";
import { ContentRangeInput } from "./ContentRangeInput";
import { cn } from "@/lib/cn";

/**
 * RangeSettingModal - 콘텐츠 범위 설정 모달
 * 
 * - API로 상세 정보 조회
 * - 시작/끝 범위 선택
 * - 검증 및 저장
 */
export function RangeSettingModal({
  open,
  onClose,
  content,
  isRecommendedContent = false,
  currentRange,
  onSave,
  loading: externalLoading = false,
  error: externalError = null,
}: RangeSettingModalProps) {
  const [details, setDetails] = useState<ContentDetail[]>([]);
  const [startDetailId, setStartDetailId] = useState<string | null>(
    currentRange?.start_detail_id || null
  );
  const [endDetailId, setEndDetailId] = useState<string | null>(
    currentRange?.end_detail_id || null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // 캐시 참조
  const cacheRef = useRef<Map<string, ContentDetail[]>>(new Map());

  // 상세 정보 조회
  useEffect(() => {
    if (!open) return;

    const fetchDetails = async () => {
      // custom 타입은 범위 설정을 지원하지 않음 (방어 코드)
      if (content.type === "custom") {
        const errorMessage = `[RangeSettingModal] custom 타입 콘텐츠는 범위 설정을 지원하지 않습니다. contentId: ${content.id}, title: ${content.title}`;
        console.error(errorMessage);
        setError("커스텀 콘텐츠는 범위 설정이 필요하지 않습니다.");
        setLoading(false);
        return;
      }

      // 캐시 확인
      if (cacheRef.current.has(content.id)) {
        setDetails(cacheRef.current.get(content.id)!);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 추천 콘텐츠는 마스터 API, 학생 콘텐츠는 학생 API 호출
        const apiPath = isRecommendedContent
          ? "/api/master-content-details"
          : "/api/student-content-details";

        const response = await fetch(
          `${apiPath}?contentType=${content.type}&contentId=${content.id}`
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error?.message || "상세 정보를 불러올 수 없습니다.";
          console.error(
            `[RangeSettingModal] API 호출 실패: ${apiPath}`,
            {
              status: response.status,
              statusText: response.statusText,
              contentType: content.type,
              contentId: content.id,
              isRecommendedContent,
              error: errorData,
            }
          );
          throw new Error(errorMessage);
        }

        const result = await response.json();
        
        if (!result.success) {
          const errorMessage = result.error?.message || "상세 정보를 불러올 수 없습니다.";
          console.error(
            `[RangeSettingModal] API 응답 실패: ${apiPath}`,
            {
              contentType: content.type,
              contentId: content.id,
              isRecommendedContent,
              error: result.error,
            }
          );
          throw new Error(errorMessage);
        }

        // 콘텐츠 타입에 따라 details 또는 episodes 사용
        const detailsData = 
          content.type === "book" 
            ? result.data.details || []
            : result.data.episodes || [];
        
        setDetails(detailsData);
        
        // 캐시 저장
        cacheRef.current.set(content.id, detailsData);
      } catch (err) {
        const errorMessage = err instanceof Error
          ? err.message
          : "상세 정보를 불러오는 중 오류가 발생했습니다.";
        console.error(
          "[RangeSettingModal] 상세 정보 조회 실패:",
          {
            error: err,
            contentType: content.type,
            contentId: content.id,
            isRecommendedContent,
            apiPath: isRecommendedContent
              ? "/api/master-content-details"
              : "/api/student-content-details",
          }
        );
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [open, content.id, content.type, isRecommendedContent]);

  // 현재 범위로 초기화
  useEffect(() => {
    if (open && currentRange) {
      setStartDetailId(currentRange.start_detail_id || null);
      setEndDetailId(currentRange.end_detail_id || null);
      setHasChanges(false);
    }
  }, [open, currentRange]);

  // 변경 감지
  useEffect(() => {
    const changed =
      startDetailId !== (currentRange?.start_detail_id || null) ||
      endDetailId !== (currentRange?.end_detail_id || null);
    setHasChanges(changed);
  }, [startDetailId, endDetailId, currentRange]);

  // 저장 처리
  const handleSave = () => {
    if (!startDetailId || !endDetailId) {
      setError("시작과 종료 범위를 모두 선택해주세요.");
      return;
    }

    // 범위 정보 생성
    const startDetail = details.find((d) => d.id === startDetailId);
    const endDetail = details.find((d) => d.id === endDetailId);

    if (!startDetail || !endDetail) {
      setError("선택한 범위 정보를 찾을 수 없습니다.");
      return;
    }

    // 범위 문자열 생성
    const startStr =
      content.type === "book"
        ? `p.${(startDetail as any).page_number}`
        : `${(startDetail as any).episode_number}강`;
    const endStr =
      content.type === "book"
        ? `p.${(endDetail as any).page_number}`
        : `${(endDetail as any).episode_number}강`;

    onSave({
      start: startStr,
      end: endStr,
      start_detail_id: startDetailId,
      end_detail_id: endDetailId,
    });

    onClose();
  };

  // 모달 닫기
  const handleClose = () => {
    if (hasChanges) {
      if (
        !confirm(
          "변경 사항이 저장되지 않았습니다. 정말 닫으시겠습니까?"
        )
      ) {
        return;
      }
    }
    onClose();
  };

  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, hasChanges]);

  if (!open) return null;

  const isValid = startDetailId && endDetailId;
  const isSaving = externalLoading;

  return (
    <>
      {/* 백드롭 */}
      <div
        className="fixed inset-0 z-50 bg-black/50 transition-opacity"
        onClick={handleClose}
      />

      {/* 모달 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-gray-200 p-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                범위 설정
              </h2>
              <p className="mt-1 text-sm text-gray-600">{content.title}</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100"
              disabled={isSaving}
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* 내용 */}
          <div className="max-h-[60vh] overflow-y-auto p-6">
            {externalError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {externalError}
              </div>
            ) : (
              <ContentRangeInput
                type={content.type}
                details={details}
                startDetailId={startDetailId}
                endDetailId={endDetailId}
                onStartChange={setStartDetailId}
                onEndChange={setEndDetailId}
                loading={loading}
                error={error}
              />
            )}
          </div>

          {/* 푸터 */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 p-6">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className={cn(
                "rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50",
                isSaving && "cursor-not-allowed opacity-50"
              )}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isValid || isSaving || !!error}
              className={cn(
                "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700",
                (!isValid || isSaving || !!error) &&
                  "cursor-not-allowed opacity-50"
              )}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  저장 중...
                </span>
              ) : (
                "저장"
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

