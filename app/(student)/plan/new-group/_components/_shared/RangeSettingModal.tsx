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
  // 직접 입력 값 (상세 정보가 없을 때) - 빈 문자열도 허용
  const [startRange, setStartRange] = useState<string | null>(
    currentRange?.start ? currentRange.start.replace(/[^\d]/g, "") : null
  );
  const [endRange, setEndRange] = useState<string | null>(
    currentRange?.end ? currentRange.end.replace(/[^\d]/g, "") : null
  );
  // 총 페이지수/회차
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [totalEpisodes, setTotalEpisodes] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // 캐시 참조
  const cacheRef = useRef<Map<string, ContentDetail[]>>(new Map());

  // 모달이 열릴 때 상태 초기화
  useEffect(() => {
    if (!open) {
      // 모달이 닫혔을 때 상태 초기화
      setStartDetailId(null);
      setEndDetailId(null);
      setStartRange(null);
      setEndRange(null);
      setTotalPages(null);
      setTotalEpisodes(null);
      setError(null);
      setHasChanges(false);
      return;
    }

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

      // content.type 검증
      if (content.type !== "book" && content.type !== "lecture") {
        const errorMessage = `[RangeSettingModal] 잘못된 content.type: ${content.type}. contentId: ${content.id}, title: ${content.title}`;
        console.error(errorMessage, {
          contentType: content.type,
          contentId: content.id,
          title: content.title,
          expectedValues: ["book", "lecture"],
        });
        setError(`지원하지 않는 콘텐츠 타입입니다. (${content.type})`);
        setLoading(false);
        return;
      }

      // URL 파라미터 안전하게 생성
      const params = new URLSearchParams({
        contentType: content.type,
        contentId: content.id,
      });
      const url = `${apiPath}?${params.toString()}`;

      // API 호출 전 로깅
      console.log("[RangeSettingModal] API 호출 시작:", {
        apiPath,
        url,
        contentType: content.type,
        contentId: content.id,
        isRecommendedContent,
        content: {
          id: content.id,
          type: content.type,
          title: content.title,
        },
      });

        const response = await fetch(url);

        // 응답 상태 로깅
        console.log("[RangeSettingModal] API 응답 상태:", {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          contentType: response.headers.get("content-type"),
        });

        // 응답 본문 읽기 (에러 처리 전에)
        const responseText = await response.text();
        let responseData: any = null;
        
        // 빈 응답 체크
        if (!responseText || responseText.trim() === "") {
          console.error("[RangeSettingModal] 빈 응답 수신:", {
            status: response.status,
            statusText: response.statusText,
            url,
            contentType: content.type,
            contentId: content.id,
          });
          throw new Error(
            response.status >= 500
              ? "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
              : `서버에서 빈 응답을 받았습니다. (${response.status})`
          );
        }

        try {
          responseData = JSON.parse(responseText);
        } catch (e) {
          console.error("[RangeSettingModal] 응답 파싱 실패:", {
            responseText: responseText.substring(0, 500),
            error: e,
            status: response.status,
            statusText: response.statusText,
            url,
          });
          throw new Error(
            response.status >= 500
              ? "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
              : "응답을 파싱할 수 없습니다."
          );
        }

        // HTTP 상태 코드 체크
        if (!response.ok) {
          const errorMessage = 
            responseData?.error?.message || 
            responseData?.message ||
            (response.status >= 500
              ? "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
              : `서버 오류가 발생했습니다. (${response.status})`);
          
          console.error(
            `[RangeSettingModal] API 호출 실패: ${apiPath}`,
            {
              status: response.status,
              statusText: response.statusText,
              contentType: content.type,
              contentId: content.id,
              isRecommendedContent,
              url,
              responseData: responseData || null,
              responseText: responseText.substring(0, 500), // 처음 500자만
            }
          );
          throw new Error(errorMessage);
        }
        
        // API 응답 형식 체크 (success 필드)
        if (responseData && typeof responseData === 'object' && 'success' in responseData) {
          if (!responseData.success) {
            const errorMessage = 
              responseData.error?.message || 
              responseData.error?.code ||
              "상세 정보를 불러올 수 없습니다.";
            
            console.error(
              `[RangeSettingModal] API 응답 실패: ${apiPath}`,
              {
                contentType: content.type,
                contentId: content.id,
                isRecommendedContent,
                url,
                error: responseData.error || {},
                responseData,
              }
            );
            throw new Error(errorMessage);
          }
        } else {
          // 레거시 응답 형식 지원 (success 필드가 없는 경우)
          console.warn("[RangeSettingModal] 레거시 응답 형식 감지:", {
            url,
            hasSuccess: 'success' in (responseData || {}),
            responseDataKeys: responseData ? Object.keys(responseData) : [],
          });
        }

        console.log("[RangeSettingModal] API 응답 성공:", {
          contentType: content.type,
          contentId: content.id,
          hasDetails: !!responseData.data?.details,
          hasEpisodes: !!responseData.data?.episodes,
          detailsCount: responseData.data?.details?.length || 0,
          episodesCount: responseData.data?.episodes?.length || 0,
        });

        // 콘텐츠 타입에 따라 details 또는 episodes 사용
        const detailsData = 
          content.type === "book" 
            ? responseData.data.details || []
            : responseData.data.episodes || [];
        
        // 상세정보가 없는 경우 로깅 (개발 환경에서만)
        if (detailsData.length === 0) {
          if (process.env.NODE_ENV === "development") {
            console.debug("[RangeSettingModal] 상세정보 없음 (정상):", {
              type: "NO_DETAILS",
              contentType: content.type,
              contentId: content.id,
              title: content.title,
              isRecommendedContent,
              reason: "해당 콘텐츠에 목차/회차 정보가 없습니다. 사용자가 범위를 직접 입력해야 합니다.",
              apiPath: isRecommendedContent
                ? "/api/master-content-details"
                : "/api/student-content-details",
            });
          }
        } else {
          console.log("[RangeSettingModal] 상세정보 조회 성공:", {
            type: "SUCCESS",
            contentType: content.type,
            contentId: content.id,
            title: content.title,
            detailsCount: detailsData.length,
            isRecommendedContent,
          });
        }
        
        setDetails(detailsData);
        
        // 캐시 저장
        cacheRef.current.set(content.id, detailsData);

        // 상세 정보가 없을 때 총 페이지수/회차 조회
        if (detailsData.length === 0) {
          try {
            const infoApiPath = isRecommendedContent
              ? `/api/master-content-info?content_type=${content.type}&content_id=${content.id}`
              : `/api/student-content-info?content_type=${content.type}&content_id=${content.id}`;
            
            const infoResponse = await fetch(infoApiPath);
            if (infoResponse.ok) {
              const infoResult = await infoResponse.json();
              if (infoResult.success && infoResult.data) {
                if (content.type === "book") {
                  setTotalPages(infoResult.data.total_pages || null);
                } else {
                  setTotalEpisodes(infoResult.data.total_episodes || null);
                }
              }
            }
          } catch (infoError) {
            // 총량 조회 실패는 무시 (직접 입력은 여전히 가능)
            if (process.env.NODE_ENV === "development") {
              console.debug("[RangeSettingModal] 총량 조회 실패 (무시 가능):", infoError);
            }
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error
          ? err.message
          : "상세 정보를 불러오는 중 오류가 발생했습니다.";
        
        // 에러 타입별 상세 로깅
        const errorDetails: Record<string, unknown> = {
          type: "API_ERROR",
          contentType: content.type,
          contentId: content.id,
          title: content.title,
          isRecommendedContent,
          apiPath: isRecommendedContent
            ? "/api/master-content-details"
            : "/api/student-content-details",
        };

        if (err instanceof Error) {
          errorDetails.errorMessage = err.message;
          errorDetails.errorStack = err.stack;
          errorDetails.errorName = err.name;
        } else {
          errorDetails.error = String(err);
        }

        console.error(
          "[RangeSettingModal] 상세 정보 조회 실패:",
          errorDetails
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
      
      // 직접 입력 값 초기화 (상세 정보가 없을 때)
      if (!currentRange.start_detail_id && !currentRange.end_detail_id) {
        const startMatch = currentRange.start?.match(/\d+/);
        const endMatch = currentRange.end?.match(/\d+/);
        // 빈 값도 허용 (기본값으로 대체하지 않음)
        setStartRange(startMatch ? startMatch[0] : "");
        setEndRange(endMatch ? endMatch[0] : "");
      } else {
        setStartRange(null);
        setEndRange(null);
      }
      
      setHasChanges(false);
    }
  }, [open, currentRange]);

  // 변경 감지
  useEffect(() => {
    const hasDetails = details.length > 0;
    let changed = false;
    
    if (hasDetails) {
      // 상세 정보가 있을 때
      changed =
        startDetailId !== (currentRange?.start_detail_id || null) ||
        endDetailId !== (currentRange?.end_detail_id || null);
    } else {
      // 상세 정보가 없을 때 (직접 입력)
      const currentStart = currentRange?.start ? currentRange.start.replace(/[^\d]/g, "") : "";
      const currentEnd = currentRange?.end ? currentRange.end.replace(/[^\d]/g, "") : "";
      // 빈 값도 비교에 포함 (기본값으로 대체하지 않음)
      changed =
        (startRange ?? "") !== currentStart ||
        (endRange ?? "") !== currentEnd;
    }
    
    setHasChanges(changed);
  }, [startDetailId, endDetailId, startRange, endRange, currentRange, details.length]);

  // 저장 처리
  const handleSave = () => {
    const hasDetails = details.length > 0;

    if (hasDetails) {
      // 상세 정보가 있을 때
      if (!startDetailId || !endDetailId) {
        setError("시작과 종료 범위를 모두 선택해주세요.");
        return;
      }

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
    } else {
      // 상세 정보가 없을 때 (직접 입력)
      // 빈 문자열 체크 (null, undefined, 빈 문자열 모두 체크)
      if (!startRange || startRange.trim() === "" || !endRange || endRange.trim() === "") {
        setError("시작과 종료 범위를 모두 입력해주세요.");
        return;
      }

      const startNum = Number(startRange);
      const endNum = Number(endRange);

      if (isNaN(startNum) || isNaN(endNum) || startNum <= 0 || endNum <= 0) {
        setError("1 이상의 올바른 숫자를 입력해주세요.");
        return;
      }

      if (startNum > endNum) {
        setError("시작 범위가 종료 범위보다 클 수 없습니다.");
        return;
      }

      // 최대값 검증
      const maxValue = content.type === "book" ? totalPages : totalEpisodes;
      if (maxValue && (startNum > maxValue || endNum > maxValue)) {
        setError(
          `범위는 최대 ${maxValue}${content.type === "book" ? "페이지" : "회차"}까지 입력할 수 있습니다.`
        );
        return;
      }

      // 범위 문자열 생성
      const startStr = content.type === "book" ? `p.${startNum}` : `${startNum}강`;
      const endStr = content.type === "book" ? `p.${endNum}` : `${endNum}강`;

      onSave({
        start: startStr,
        end: endStr,
        start_detail_id: null,
        end_detail_id: null,
      });
    }

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
    
    // 상태 초기화
    setStartDetailId(null);
    setEndDetailId(null);
    setStartRange(null);
    setEndRange(null);
    setTotalPages(null);
    setTotalEpisodes(null);
    setError(null);
    setHasChanges(false);
    
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

  const hasDetails = details.length > 0;
  const isValid = hasDetails
    ? startDetailId && endDetailId
    : startRange && startRange.trim() !== "" && 
      endRange && endRange.trim() !== "" && 
      Number(startRange) > 0 && 
      Number(endRange) > 0 && 
      Number(startRange) <= Number(endRange);
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
                startRange={startRange}
                endRange={endRange}
                totalPages={totalPages}
                totalEpisodes={totalEpisodes}
                onStartChange={setStartDetailId}
                onEndChange={setEndDetailId}
                onStartRangeChange={setStartRange}
                onEndRangeChange={setEndRange}
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

