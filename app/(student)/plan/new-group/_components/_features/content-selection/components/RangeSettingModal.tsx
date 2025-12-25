"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { RangeSettingModalProps, ContentDetail } from "@/lib/types/content-selection";
import { ContentRangeInput } from "./ContentRangeInput";
import { cn } from "@/lib/cn";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { validateRangeInput } from "@/lib/utils/rangeValidation";

/** API 응답 타입 */
type ContentDetailsApiResponse = {
  success?: boolean;
  error?: {
    message?: string;
    code?: string;
  };
  message?: string;
  data?: {
    details?: ContentDetail[];
    episodes?: ContentDetail[];
    total_pages?: number;
    total_episodes?: number;
  };
};

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
  studentId = null,
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

  // 캐시 참조 (총량 정보도 함께 저장)
  const cacheRef = useRef<Map<string, {
    details: ContentDetail[];
    totalPages?: number | null;
    totalEpisodes?: number | null;
  }>>(new Map());
  // 중복 로그 방지를 위한 ref
  const hasLoggedNoDetails = useRef(false);
  // 포커스 상태 추적
  const focusStateRef = useRef<{
    lastFocusedElement: HTMLElement | null;
    isInputFocused: boolean;
  }>({
    lastFocusedElement: null,
    isInputFocused: false,
  });

  // 상태 초기화 함수 (통합)
  const resetState = useCallback(() => {
    setStartDetailId(null);
    setEndDetailId(null);
    setStartRange(null);
    setEndRange(null);
    setTotalPages(null);
    setTotalEpisodes(null);
    setError(null);
    setHasChanges(false);
    hasLoggedNoDetails.current = false;
    focusStateRef.current = {
      lastFocusedElement: null,
      isInputFocused: false,
    };
  }, []);

  // 모달이 닫혔을 때 상태 초기화
  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }

    const fetchDetails = async () => {
      // custom 타입은 범위 설정을 지원하지 않음 (방어 코드)
      if ((content.type as string) === "custom") {
        const errorMessage = `[RangeSettingModal] custom 타입 콘텐츠는 범위 설정을 지원하지 않습니다. contentId: ${content.id}, title: ${content.title}`;
        console.error(errorMessage);
        setError("커스텀 콘텐츠는 범위 설정이 필요하지 않습니다.");
        setLoading(false);
        return;
      }

      // 캐시 확인
      const cached = cacheRef.current.get(content.id);
      if (cached) {
        setDetails(cached.details);
        if (content.type === "book") {
          setTotalPages(cached.totalPages ?? null);
        } else {
          setTotalEpisodes(cached.totalEpisodes ?? null);
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 추천 콘텐츠는 마스터 API, 학생 콘텐츠는 학생 API 호출
        const apiPath = isRecommendedContent
          ? "/api/master-content-details"
          : "/api/student-content-details";

        if (process.env.NODE_ENV === "development") {
          console.log("[RangeSettingModal] API 호출 정보:", {
            apiPath,
            isRecommendedContent,
            contentType: content.type,
            contentId: content.id,
            studentId,
            title: content.title,
            props: {
              isRecommendedContent,
              studentId,
            },
          });
        }

      // URL 파라미터 안전하게 생성
      const params = new URLSearchParams({
        contentType: content.type,
        contentId: content.id,
      });
      
      // 관리자/컨설턴트가 특정 학생의 콘텐츠를 조회할 때 student_id 전달 (마스터 콘텐츠가 아닌 경우만)
      if (!isRecommendedContent && studentId) {
        params.append("student_id", studentId);
      }
      
      const url = `${apiPath}?${params.toString()}`;

        const response = await fetch(url);

        // 응답 처리: .json() 직접 사용
        let responseData: ContentDetailsApiResponse | null = null;
        let responseText: string | null = null;
        
        try {
          // 응답 본문을 텍스트로 먼저 읽기 (디버깅용)
          responseText = await response.text();
          
          // 빈 응답 체크
          if (!responseText || responseText.trim() === "") {
            throw new Error("응답 본문이 비어있습니다.");
          }
          
          // JSON 파싱 시도
          try {
            responseData = JSON.parse(responseText);
          } catch (parseError) {
            if (process.env.NODE_ENV === "development") {
              console.error("[RangeSettingModal] JSON 파싱 실패:", {
                status: response.status,
                statusText: response.statusText,
                url,
                responseText: responseText.substring(0, 200), // 처음 200자만
                parseError,
              });
            }
            throw new Error(
              response.status >= 500
                ? "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
                : "응답을 파싱할 수 없습니다."
            );
          }
        } catch (e) {
          if (e instanceof Error && e.message !== "응답 본문이 비어있습니다." && !e.message.includes("파싱")) {
            // 다른 종류의 에러는 그대로 전달
            throw e;
          }
          
          if (process.env.NODE_ENV === "development") {
            console.error("[RangeSettingModal] 응답 처리 실패:", {
              status: response.status,
              statusText: response.statusText,
              url,
              error: e instanceof Error ? e.message : String(e),
              responseText: responseText?.substring(0, 200),
            });
          }
          throw new Error(
            response.status >= 500
              ? "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
              : "응답을 처리할 수 없습니다."
          );
        }

        // HTTP 상태 코드 체크
        if (!response.ok) {
          // 권한 관련 에러 (401, 403) 특별 처리
          if (response.status === 401 || response.status === 403) {
            const authErrorMessage = 
              (responseData && typeof responseData === 'object' && responseData.error?.message) ||
              (responseData && typeof responseData === 'object' && responseData.message) ||
              "로그인이 필요하거나 권한이 없습니다. 페이지를 새로고침해주세요.";
            
            if (process.env.NODE_ENV === "development") {
              console.error(`[RangeSettingModal] 권한 에러 (${response.status}): ${apiPath}`, {
                status: response.status,
                statusText: response.statusText,
                contentType: content.type,
                contentId: content.id,
                isRecommendedContent,
                url,
                responseData: responseData || null,
                responseText: responseText?.substring(0, 500),
                suggestion: "세션이 만료되었거나 권한이 없습니다. 로그인 페이지로 이동하세요.",
              });
            }
            throw new Error(authErrorMessage);
          }
          
          // 기타 HTTP 에러
          const errorMessage = 
            (responseData && typeof responseData === 'object' && responseData.error?.message) ||
            (responseData && typeof responseData === 'object' && responseData.message) ||
            (response.status >= 500
              ? "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
              : `서버 오류가 발생했습니다. (${response.status})`);
          
          if (process.env.NODE_ENV === "development") {
            // responseData 상세 분석
            const responseDataInfo: Record<string, unknown> = {
              type: typeof responseData,
              isNull: responseData === null,
              isUndefined: responseData === undefined,
              isEmptyObject: responseData && typeof responseData === 'object' && Object.keys(responseData).length === 0,
              keys: responseData && typeof responseData === 'object' ? Object.keys(responseData) : null,
            };
            
            // responseData를 안전하게 직렬화
            let responseDataStringified: string | null = null;
            try {
              responseDataStringified = responseData ? JSON.stringify(responseData, null, 2) : null;
            } catch (e) {
              responseDataStringified = `[직렬화 실패: ${e instanceof Error ? e.message : String(e)}]`;
            }
            
            console.error(`[RangeSettingModal] API 호출 실패: ${apiPath}`, {
              status: response.status,
              statusText: response.statusText,
              contentType: content.type,
              contentId: content.id,
              isRecommendedContent,
              url,
              responseDataInfo,
              responseData: responseData,
              responseDataStringified,
              responseText: responseText?.substring(0, 500),
            });
          }
          throw new Error(errorMessage);
        }
        
        // API 응답 형식 체크 (success 필드)
        if (responseData && typeof responseData === 'object' && 'success' in responseData) {
          if (!responseData.success) {
            const errorMessage = 
              responseData.error?.message || 
              responseData.error?.code ||
              "상세 정보를 불러올 수 없습니다.";
            
            if (process.env.NODE_ENV === "development") {
              console.error(`[RangeSettingModal] API 응답 실패: ${apiPath}`, {
                contentType: content.type,
                contentId: content.id,
                isRecommendedContent,
                url,
                error: responseData.error || {},
                responseData,
              });
            }
            throw new Error(errorMessage);
          }
        }

        // 콘텐츠 타입에 따라 details 또는 episodes 사용
        const detailsData =
          content.type === "book"
            ? responseData?.data?.details || []
            : responseData?.data?.episodes || [];
        
        // 상세정보가 없는 경우 로깅 (개발 환경에서만, 한 번만)
        if (detailsData.length === 0) {
          if (process.env.NODE_ENV === "development" && !hasLoggedNoDetails.current) {
            hasLoggedNoDetails.current = true;
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
          // 상세정보가 있으면 로그 플래그 리셋 (다음에 다시 없을 때 로그 출력 가능)
          hasLoggedNoDetails.current = false;
        }
        
        setDetails(detailsData);
        
        // 총량 정보를 상세 정보 API 응답에서 직접 사용
        const totalPagesValue = content.type === "book"
          ? (responseData?.data?.total_pages ?? null)
          : null;
        const totalEpisodesValue = content.type === "lecture"
          ? (responseData?.data?.total_episodes ?? null)
          : null;

        if (content.type === "book") {
          setTotalPages(totalPagesValue);
        } else {
          setTotalEpisodes(totalEpisodesValue);
        }

        // 캐시 저장 (총량 정보도 함께 저장)
        cacheRef.current.set(content.id, {
          details: detailsData,
          totalPages: totalPagesValue,
          totalEpisodes: totalEpisodesValue,
        });
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
          errorDetails.errorStack = err.stack || undefined;
          errorDetails.errorName = err.name;
          
          // 권한 관련 에러인지 확인
          if (err.message.includes("로그인") || err.message.includes("권한") || err.message.includes("인증")) {
            errorDetails.isAuthError = true;
            errorDetails.suggestion = "세션이 만료되었을 수 있습니다. 페이지를 새로고침하거나 다시 로그인해주세요.";
          }
        } else {
          errorDetails.error = String(err);
          errorDetails.errorType = typeof err;
        }

        // 에러 객체의 모든 속성을 안전하게 직렬화
        if (process.env.NODE_ENV === "development") {
          // 개별 속성으로 출력 (직렬화 문제 방지)
          console.error("[RangeSettingModal] 상세 정보 조회 실패:");
          console.error("  type:", errorDetails.type);
          console.error("  contentType:", errorDetails.contentType);
          console.error("  contentId:", errorDetails.contentId);
          console.error("  title:", errorDetails.title);
          console.error("  isRecommendedContent:", errorDetails.isRecommendedContent);
          console.error("  apiPath:", errorDetails.apiPath);
          console.error("  errorMessage:", errorDetails.errorMessage);
          console.error("  errorName:", errorDetails.errorName);
          console.error("  isAuthError:", errorDetails.isAuthError);
          if (errorDetails.errorStack) {
            console.error("  errorStack:", errorDetails.errorStack);
          }
          if (errorDetails.suggestion) {
            console.error("  suggestion:", errorDetails.suggestion);
          }
          
          // JSON 형태로도 출력 시도 (디버깅용)
          try {
            const serialized = JSON.stringify(errorDetails, null, 2);
            console.error("[RangeSettingModal] 에러 상세 (JSON):", serialized);
          } catch (serializeError) {
            // 직렬화 실패는 무시 (이미 개별 속성으로 출력했음)
          }
        }
        
        // 에러가 발생해도 직접 입력은 가능하도록 에러를 경고로 처리
        // 상세 정보가 없으면 빈 배열로 설정하여 직접 입력 모드로 전환
        setDetails([]);
        setError(null); // 에러를 null로 설정하여 직접 입력 모드 활성화
        
        // 총량 정보는 기본값으로 설정 (나중에 사용자가 입력할 수 있도록)
        if (content.type === "book") {
          setTotalPages(null);
        } else {
          setTotalEpisodes(null);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [open, content.id, content.type, isRecommendedContent, studentId]);

  // 현재 범위로 초기화 (모달이 열리고 currentRange가 변경될 때만)
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
  const handleSave = useCallback(() => {
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
      const maxValue = content.type === "book" ? totalPages : totalEpisodes;
      const validation = validateRangeInput(
        startRange,
        endRange,
        maxValue,
        content.type
      );

      if (!validation.valid) {
        setError(validation.error || "유효하지 않은 범위입니다.");
        return;
      }

      // 범위 문자열 생성
      const startStr = content.type === "book" ? `p.${validation.startNum!}` : `${validation.startNum!}강`;
      const endStr = content.type === "book" ? `p.${validation.endNum!}` : `${validation.endNum!}강`;

      onSave({
        start: startStr,
        end: endStr,
        start_detail_id: null,
        end_detail_id: null,
      });
    }

    onClose();
  }, [details, startDetailId, endDetailId, startRange, endRange, totalPages, totalEpisodes, content.type, onSave, onClose]);

  // 모달 닫기
  const handleClose = useCallback(() => {
    if (hasChanges) {
      if (
        !confirm(
          "변경 사항이 저장되지 않았습니다. 정말 닫으시겠습니까?"
        )
      ) {
        return;
      }
    }
    
    // 상태 초기화 (통합 함수 사용)
    resetState();
    
    onClose();
  }, [hasChanges, onClose, resetState]);

  const hasDetails = details.length > 0;
  const isValid = useMemo(() => {
    if (hasDetails) {
      return startDetailId && endDetailId;
    }
    return startRange && startRange.trim() !== "" && 
      endRange && endRange.trim() !== "" && 
      Number(startRange) > 0 && 
      Number(endRange) > 0 && 
      Number(startRange) <= Number(endRange);
  }, [hasDetails, startDetailId, endDetailId, startRange, endRange]);
  const isSaving = externalLoading;

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) {
          handleClose();
        }
      }}
      title="범위 설정"
      description={content.title}
      maxWidth="2xl"
    >
      <DialogContent className="max-h-[60vh] overflow-y-auto">
            {externalError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {externalError}
              </div>
            ) : (
              <>
                {error && (
                  <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                    <p className="font-medium">상세 정보를 불러올 수 없습니다.</p>
                    <p className="mt-1 text-xs">범위를 직접 입력해주세요.</p>
                  </div>
                )}
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
                  error={null}
                />
              </>
            )}
      </DialogContent>
      <DialogFooter>
        <button
          type="button"
          onClick={handleClose}
          disabled={isSaving}
          className={cn(
            "rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50",
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
      </DialogFooter>
    </Dialog>
  );
}

