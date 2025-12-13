"use client";

import React, { useMemo } from "react";
import { BookOpen, Video, CheckCircle } from "lucide-react";
import { WizardData } from "../PlanGroupWizard";
import { SummaryCard } from "./SummaryCard";
import { SectionSummary } from "./SectionSummary";

/**
 * ContentsSummary - 콘텐츠 요약
 * 
 * Phase 4.3에서 구현
 * 학생/추천 콘텐츠를 과목별로 요약하여 표시
 */

export type ContentsSummaryProps = {
  data: WizardData;
  isCampMode?: boolean;
};

type SubjectGroup = {
  subject: string;
  studentCount: number;
  recommendedCount: number;
  totalVolume: number;
  books: number;
  lectures: number;
};

export const ContentsSummary = React.memo(function ContentsSummary({
  data,
  isCampMode = false,
}: ContentsSummaryProps) {
  // 과목별 그룹핑
  const subjectGroups = useMemo(() => {
    const groups = new Map<string, SubjectGroup>();

    // 학생 콘텐츠
    data.student_contents.forEach((content) => {
      const subject = content.subject_category || "기타";
      if (!groups.has(subject)) {
        groups.set(subject, {
          subject,
          studentCount: 0,
          recommendedCount: 0,
          totalVolume: 0,
          books: 0,
          lectures: 0,
        });
      }

      const group = groups.get(subject)!;
      group.studentCount++;
      group.totalVolume += content.end_range - content.start_range + 1;
      
      if (content.content_type === "book") {
        group.books++;
      } else {
        group.lectures++;
      }
    });

    // 추천 콘텐츠
    data.recommended_contents.forEach((content) => {
      const subject = content.subject_category || "기타";
      if (!groups.has(subject)) {
        groups.set(subject, {
          subject,
          studentCount: 0,
          recommendedCount: 0,
          totalVolume: 0,
          books: 0,
          lectures: 0,
        });
      }

      const group = groups.get(subject)!;
      group.recommendedCount++;
      group.totalVolume += content.end_range - content.start_range + 1;
      
      if (content.content_type === "book") {
        group.books++;
      } else {
        group.lectures++;
      }
    });

    // 과목명 순 정렬
    return Array.from(groups.values()).sort((a, b) =>
      a.subject.localeCompare(b.subject)
    );
  }, [data.student_contents, data.recommended_contents]);

  // 필수 과목 체크 (캠프 모드에서만)
  const requiredSubjects = useMemo(() => {
    if (!isCampMode) return [];
    
    // 필수 교과 설정에서 지정한 과목 가져오기
    const requiredSubjectCategories =
      data.subject_constraints?.required_subjects?.map(
        (req) => req.subject_category
      ) || [];
    
    // 필수 교과가 설정되지 않았으면 빈 배열 반환
    if (requiredSubjectCategories.length === 0) {
      return [];
    }
    
    const subjects = subjectGroups.map((g) => g.subject);
    return requiredSubjectCategories.map((category) => ({
      name: category,
      selected: subjects.includes(category),
    }));
  }, [subjectGroups, data.subject_constraints?.required_subjects, isCampMode]);

  const totalStudent = data.student_contents.length;
  const totalRecommended = data.recommended_contents.length;
  const totalContents = totalStudent + totalRecommended;
  const allRequiredSelected = requiredSubjects.every((s) => s.selected);

  return (
    <div className="space-y-6">
      {/* 전체 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          title="총 콘텐츠"
          value={totalContents}
          subtitle={`최대 9개`}
          variant={totalContents >= 9 ? "success" : "default"}
        />
        <SummaryCard
          title="학생 콘텐츠"
          value={totalStudent}
          icon={<BookOpen className="h-5 w-5" />}
          variant="primary"
        />
        <SummaryCard
          title="추천 콘텐츠"
          value={totalRecommended}
          icon={<Video className="h-5 w-5" />}
          variant="primary"
        />
      </div>

      {/* 필수 과목 체크 (캠프 모드에서만 표시) */}
      {isCampMode && requiredSubjects.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900">필수 과목</h4>
            {allRequiredSelected && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-xs font-medium">모두 선택됨</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {requiredSubjects.map((subject) => (
              <div
                key={subject.name}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
                  subject.selected
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {subject.selected ? (
                  <CheckCircle className="h-3.5 w-3.5" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-400" />
                )}
                <span>{subject.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 과목별 상세 */}
      {subjectGroups.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-gray-900">
            과목별 상세
          </h4>
          <SectionSummary
            items={subjectGroups.map((group) => ({
              label: group.subject,
              value: `${group.studentCount + group.recommendedCount}개 (${
                group.totalVolume
              }${group.books > 0 ? "p" : "강"})`,
              icon:
                group.books > 0 ? (
                  <BookOpen className="h-4 w-4" />
                ) : (
                  <Video className="h-4 w-4" />
                ),
              highlight: isCampMode && requiredSubjects.some(
                (s) => s.name === group.subject && s.selected
              ),
            }))}
          />
        </div>
      )}

      {/* 타입별 분포 */}
      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-semibold text-gray-900">타입별 분포</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-amber-600" />
              <div>
                <div className="text-sm font-medium text-amber-900">교재</div>
                <div className="text-xl font-bold text-amber-900">
                  {subjectGroups.reduce((sum, g) => sum + g.books, 0)}개
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5 text-purple-600" />
              <div>
                <div className="text-sm font-medium text-purple-900">강의</div>
                <div className="text-xl font-bold text-purple-900">
                  {subjectGroups.reduce((sum, g) => sum + g.lectures, 0)}개
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 빈 상태 */}
      {totalContents === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-sm font-medium text-gray-900">
            선택된 콘텐츠가 없습니다
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Step 3에서 콘텐츠를 선택해주세요
          </p>
        </div>
      )}
    </div>
  );
});

