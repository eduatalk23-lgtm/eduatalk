"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/ToastProvider";
import {
  getCampPlanGroupForReview,
} from "@/app/(admin)/actions/campTemplateActions";
import { PlanGroup, PlanContent, PlanExclusion, AcademySchedule } from "@/lib/types/plan";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Step1BasicInfo } from "@/app/(student)/plan/new-group/_components/_features/basic-info/Step1BasicInfo";
import { Step2TimeSettings } from "@/app/(student)/plan/new-group/_components/_features/scheduling/Step2TimeSettings";
import { Step3ContentSelection } from "@/app/(student)/plan/new-group/_components/_features/content-selection/Step3ContentSelection";
import { planGroupToWizardData } from "@/lib/utils/planGroupAdapters";
import { planPurposeLabels, schedulerTypeLabels } from "@/lib/constants/planLabels";

type CampPlanGroupReviewFormProps = {
  templateId: string;
  groupId: string;
  group: PlanGroup;
  contents: PlanContent[];
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
  templateBlocks?: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
  templateBlockSetName?: string | null;
  templateBlockSetId?: string | null;
  studentInfo?: {
    name: string;
    grade: string | null;
    class: string | null;
  } | null;
};

export function CampPlanGroupReviewForm({
  templateId,
  groupId,
  group,
  contents: initialContents,
  exclusions,
  academySchedules,
  templateBlocks = [],
  templateBlockSetName = null,
  templateBlockSetId = null,
  studentInfo,
}: CampPlanGroupReviewFormProps) {
  const toast = useToast();
  const [contents, setContents] = useState(initialContents);
  const [contentInfos, setContentInfos] = useState<
    Array<{
      content_id: string;
      content_type: "book" | "lecture" | "custom";
      title: string;
      subject_category?: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<"overview" | "step1" | "step2" | "step3" | "step4">("overview");

  // 콘텐츠 상세 정보 조회 (서버에서 이미 조회한 경우 재조회하지 않음)
  useEffect(() => {
    const loadContentInfos = async () => {
      try {
        setLoading(true);
        
        // 서버에서 이미 상세 정보를 포함한 경우 확인
        type ContentWithDetails = PlanContent & {
          contentTitle?: string;
          contentSubtitle?: string | null;
        };
        
        const hasServerDetails = contents.some(
          (c): c is ContentWithDetails => 
            'contentTitle' in c || 'contentSubtitle' in c
        );

        if (hasServerDetails) {
          // 서버에서 이미 조회한 정보 사용
          const infos = contents.map((content) => {
            const contentWithDetails = content as ContentWithDetails;
            return {
              content_id: content.content_id,
              content_type: content.content_type,
              title: contentWithDetails.contentTitle || "",
              subject_category: contentWithDetails.contentSubtitle || null,
            };
          });
          setContentInfos(infos);
          setLoading(false);
          return;
        }

        // 서버에서 조회하지 않은 경우 클라이언트에서 조회
        const supabase = createSupabaseBrowserClient();

        // 콘텐츠별로 과목 정보 조회
        const infos = await Promise.all(
          contents.map(async (content) => {
            let title = "";
            let subject_category: string | null = null;

            if (content.content_type === "book") {
              // 학생 교재 조회
              const { data: book } = await supabase
                .from("books")
                .select("title, subject_category")
                .eq("id", content.content_id)
                .maybeSingle();

              if (book) {
                title = book.title || "";
                subject_category = book.subject_category || null;
              } else {
                // 마스터 교재 조회
                const { data: masterBook } = await supabase
                  .from("master_books")
                  .select("title, subject_category")
                  .eq("id", content.content_id)
                  .maybeSingle();

                if (masterBook) {
                  title = masterBook.title || "";
                  subject_category = masterBook.subject_category || null;
                }
              }
            } else if (content.content_type === "lecture") {
              // 학생 강의 조회
              const { data: lecture } = await supabase
                .from("lectures")
                .select("title, subject_category")
                .eq("id", content.content_id)
                .maybeSingle();

              if (lecture) {
                title = lecture.title || "";
                subject_category = lecture.subject_category || null;
              } else {
                // 마스터 강의 조회
                const { data: masterLecture } = await supabase
                  .from("master_lectures")
                  .select("title, subject_category")
                  .eq("id", content.content_id)
                  .maybeSingle();

                if (masterLecture) {
                  title = masterLecture.title || "";
                  subject_category = masterLecture.subject_category || null;
                }
              }
            } else if (content.content_type === "custom") {
              // 커스텀 콘텐츠 조회
              const { data: custom } = await supabase
                .from("student_custom_contents")
                .select("title, subject")
                .eq("id", content.content_id)
                .maybeSingle();

              if (custom) {
                title = custom.title || "";
                subject_category = custom.subject || null;
              }
            }

            return {
              content_id: content.content_id,
              content_type: content.content_type,
              title,
              subject_category,
            };
          })
        );

        setContentInfos(infos);
      } catch (error) {
        console.error("콘텐츠 정보 조회 실패:", error);
        toast.showError("콘텐츠 정보를 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    if (contents.length > 0) {
      loadContentInfos();
    } else {
      setLoading(false);
    }
  }, [contents, toast]);


  // 학생 콘텐츠와 추천 콘텐츠 분리
  const studentContents = useMemo(() => {
    type ContentWithRecommendation = PlanContent & {
      is_recommended?: boolean;
    };
    
    return contents.filter((c): c is ContentWithRecommendation => {
      const contentWithRec = c as ContentWithRecommendation;
      // is_recommended 필드가 있으면 그것을 사용, 없으면 추정
      return !contentWithRec.is_recommended;
    });
  }, [contents]);

  // 콘텐츠 상세 정보 추가
  const studentContentsWithDetails = useMemo(() => {
    return studentContents.map((content) => {
      const info = contentInfos.find((ci) => ci.content_id === content.content_id);
      return {
        ...content,
        contentTitle: info?.title || "알 수 없음",
        contentSubtitle: info?.subject_category || null,
        isRecommended: false,
      };
    });
  }, [studentContents, contentInfos]);

  // WizardData 생성 (Step 컴포넌트에서 사용)
  const wizardData = useMemo(() => {
    return planGroupToWizardData(
      group,
      exclusions,
      academySchedules,
      studentContentsWithDetails,
      templateBlocks,
      templateBlockSetName
    );
  }, [
    group,
    exclusions,
    academySchedules,
    studentContentsWithDetails,
    templateBlocks,
    templateBlockSetName,
  ]);

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="text-sm text-gray-500">콘텐츠 정보를 불러오는 중...</div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">캠프 관리</p>
            <h1 className="text-3xl font-semibold text-gray-900">플랜 그룹 검토</h1>
            <p className="text-sm text-gray-500">{group.name || "플랜 그룹"}</p>
            {studentInfo && (
              <p className="text-sm text-gray-600">
                학생: {studentInfo.name}
                {studentInfo.grade && studentInfo.class
                  ? ` (${studentInfo.grade}학년 ${studentInfo.class}반)`
                  : ""}
              </p>
            )}
          </div>
          <Link
            href={`/admin/camp-templates/${templateId}/participants`}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            참여자 목록으로 돌아가기
          </Link>
        </div>

        {/* 탭 네비게이션 */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setCurrentTab("overview")}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
                currentTab === "overview"
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              개요
            </button>
            <button
              onClick={() => setCurrentTab("step1")}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
                currentTab === "step1"
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Step 1: 기본 정보
            </button>
            <button
              onClick={() => setCurrentTab("step2")}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
                currentTab === "step2"
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Step 2: 블록 및 제외일
            </button>
            <button
              onClick={() => setCurrentTab("step3")}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
                currentTab === "step3"
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Step 3: 스케줄 확인
            </button>
            <button
              onClick={() => setCurrentTab("step4")}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
                currentTab === "step4"
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Step 4: 콘텐츠 선택
            </button>
          </nav>
        </div>

        {/* 탭 컨텐츠 */}
        {currentTab === "overview" && (
          <>
            {/* 플랜 그룹 정보 */}
            <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900">플랜 그룹 정보</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">학습 기간:</span>
                  <span className="text-gray-900">
                    {new Date(group.period_start).toLocaleDateString("ko-KR")} ~{" "}
                    {new Date(group.period_end).toLocaleDateString("ko-KR")}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">스케줄러 유형:</span>
                  <span className="text-gray-900">
                    {group.scheduler_type
                      ? schedulerTypeLabels[group.scheduler_type] || group.scheduler_type
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">플랜 목적:</span>
                  <span className="text-gray-900">
                    {group.plan_purpose
                      ? planPurposeLabels[group.plan_purpose] || group.plan_purpose
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">콘텐츠 개수:</span>
                  <span className="text-gray-900">{studentContents.length}개</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">제외일 개수:</span>
                  <span className="text-gray-900">{exclusions.length}개</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">학원 일정 개수:</span>
                  <span className="text-gray-900">{academySchedules.length}개</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">상태:</span>
                  <span className="text-gray-900">{group.status}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">제출일:</span>
                  <span className="text-gray-900">
                    {group.created_at
                      ? new Date(group.created_at).toLocaleDateString("ko-KR")
                      : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* 블록 세트 정보 */}
            {templateBlockSetName && (
              <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
                <label className="text-xs font-medium text-gray-500">블록 세트</label>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{templateBlockSetName}</p>
                </div>
                {templateBlocks.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {templateBlocks.map((block) => (
                      <div
                        key={block.id}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"][block.day_of_week]}
                        </div>
                        <div className="text-xs text-gray-600">
                          {block.start_time} ~ {block.end_time}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">등록된 시간 블록이 없습니다.</p>
                )}
              </div>
            )}
          </>
        )}

        {currentTab === "step1" && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <Step1BasicInfo
              data={wizardData}
              onUpdate={() => {}} // readonly 모드에서는 업데이트 불필요
              blockSets={[]} // 검토 모드에서는 블록세트 선택 불필요
              editable={false}
              isCampMode={true}
              isTemplateMode={false}
            />
          </div>
        )}

        {currentTab === "step2" && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <Step2TimeSettings
              data={wizardData}
              onUpdate={() => {}} // readonly 모드에서는 업데이트 불필요
              periodStart={group.period_start}
              periodEnd={group.period_end}
              campMode={true}
              isTemplateMode={false}
            />
          </div>
        )}

        {currentTab === "step3" && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-semibold text-gray-900">스케줄 확인</h2>
                <p className="text-sm text-gray-500">
                  학생이 확인한 스케줄 미리보기 정보입니다.
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-600">
                  스케줄 미리보기는 학생이 입력한 블록 및 제외일, 학원 일정을 기반으로 생성됩니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {currentTab === "step4" && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <Step3ContentSelection
              data={wizardData}
              onUpdate={() => {}} // readonly 모드에서는 업데이트 불필요
              contents={{ books: [], lectures: [], custom: [] }} // 검토 모드에서는 선택 가능한 콘텐츠 목록 불필요
              editable={false}
              isCampMode={true}
              studentId={group.student_id}
            />
          </div>
        )}

      </div>
    </section>
  );
}

