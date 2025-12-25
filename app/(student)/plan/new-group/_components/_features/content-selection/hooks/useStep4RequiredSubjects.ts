/**
 * useRequiredSubjects Hook
 * 필수 교과 검증 로직
 */

import { useMemo } from "react";
import { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { RecommendedContent } from "../types";

type UseRequiredSubjectsProps = {
  data: WizardData;
  allRecommendedContents: RecommendedContent[];
  selectedContentIds: Set<string>;
  recommendedContents: RecommendedContent[];
};

export type RequiredSubject = {
  subject_category: string;
  subject?: string;
  min_count: number;
};

export type MissingRequiredSubject = {
  name: string;
  current: number;
  required: number;
};

type ProgressRequiredSubject = {
  subject: string;
  selected: boolean;
};

export type UseRequiredSubjectsReturn = {
  requiredSubjects: RequiredSubject[];
  requiredSubjectCategories: string[];
  missingRequiredSubjects: MissingRequiredSubject[];
  progressRequiredSubjects: ProgressRequiredSubject[];
  selectedSubjectCategories: Set<string>;
  contentCountBySubject: Map<string, number>;
};

export function useRequiredSubjects({
  data,
  allRecommendedContents,
  selectedContentIds,
  recommendedContents,
}: UseRequiredSubjectsProps): UseRequiredSubjectsReturn {
  return useMemo(() => {
    // 1. 선택된 교과 카테고리 수집
    const selectedSubjectCategories = new Set<string>();

    // 1-1. 이미 추가된 학생 콘텐츠의 subject_category
    data.student_contents.forEach((sc: WizardData["student_contents"][number]) => {
      if (sc.subject_category) {
        selectedSubjectCategories.add(sc.subject_category);
      }
    });

    // 1-2. 현재 선택 중인 추천 콘텐츠
    Array.from(selectedContentIds).forEach((id) => {
      const content = recommendedContents.find((c) => c.id === id);
      if (content?.subject_category) {
        selectedSubjectCategories.add(content.subject_category);
      }
    });

    // 1-3. 이미 추가된 추천 콘텐츠
    data.recommended_contents.forEach((rc: WizardData["recommended_contents"][number]) => {
      const subjectCategory =
        rc.subject_category ||
        allRecommendedContents.find((c) => c.id === rc.content_id)
          ?.subject_category;
      if (subjectCategory) {
        selectedSubjectCategories.add(subjectCategory);
      }
    });

    // 2. 필수 과목 설정 (템플릿 설정에 따라 동적 처리)
    const requiredSubjects: RequiredSubject[] =
      data.subject_constraints?.enable_required_subjects_validation &&
      data.subject_constraints?.required_subjects &&
      data.subject_constraints.required_subjects.length > 0
        ? data.subject_constraints.required_subjects
        : [];

    const requiredSubjectCategories = requiredSubjects.map(
      (req) => req.subject_category
    );

    // 3. 선택된 콘텐츠를 교과/과목별로 카운트
    const contentCountBySubject = new Map<string, number>();

    // 3-1. 학생 콘텐츠 카운트
    data.student_contents.forEach((sc: WizardData["student_contents"][number]) => {
      if (sc.subject_category) {
        const key = sc.subject ? `${sc.subject_category}:${sc.subject}` : sc.subject_category;
        contentCountBySubject.set(key, (contentCountBySubject.get(key) || 0) + 1);
      }
    });

    // 3-2. 추천 콘텐츠 카운트
    data.recommended_contents.forEach((rc: WizardData["recommended_contents"][number]) => {
      const subjectCategory =
        rc.subject_category ||
        allRecommendedContents.find((c) => c.id === rc.content_id)
          ?.subject_category;
      if (subjectCategory) {
        const key = rc.subject ? `${subjectCategory}:${rc.subject}` : subjectCategory;
        contentCountBySubject.set(key, (contentCountBySubject.get(key) || 0) + 1);
      }
    });

    // 3-3. 현재 선택 중인 추천 콘텐츠 카운트
    Array.from(selectedContentIds).forEach((id) => {
      const content = recommendedContents.find((c) => c.id === id);
      if (content?.subject_category) {
        const key = content.subject_category;
        contentCountBySubject.set(key, (contentCountBySubject.get(key) || 0) + 1);
      }
    });

    // 4. 필수 과목 검증
    const missingRequiredSubjects: MissingRequiredSubject[] = [];

    requiredSubjects.forEach((req) => {
      let count = 0;

      if (req.subject) {
        // 세부 과목이 지정된 경우
        const exactKey = `${req.subject_category}:${req.subject}`;
        count = contentCountBySubject.get(exactKey) || 0;
      } else {
        // 교과만 지정된 경우: 해당 교과의 모든 콘텐츠 카운트
        contentCountBySubject.forEach((cnt, key) => {
          if (
            key.startsWith(req.subject_category + ":") ||
            key === req.subject_category
          ) {
            count += cnt;
          }
        });
      }

      if (count < req.min_count) {
        const displayName = req.subject
          ? `${req.subject_category} - ${req.subject}`
          : req.subject_category;
        missingRequiredSubjects.push({
          name: displayName,
          current: count,
          required: req.min_count,
        });
      }
    });

    // 5. ProgressIndicator용 필수과목 정보 생성
    const progressRequiredSubjects: ProgressRequiredSubject[] = requiredSubjects.map((req) => {
      let count = 0;

      if (req.subject) {
        const exactKey = `${req.subject_category}:${req.subject}`;
        count = contentCountBySubject.get(exactKey) || 0;
      } else {
        contentCountBySubject.forEach((cnt, key) => {
          if (
            key.startsWith(req.subject_category + ":") ||
            key === req.subject_category
          ) {
            count += cnt;
          }
        });
      }

      const displayName = req.subject
        ? `${req.subject_category} - ${req.subject}`
        : req.subject_category;

      return {
        subject: displayName,
        selected: count >= req.min_count,
      };
    });

    return {
      requiredSubjects,
      requiredSubjectCategories,
      missingRequiredSubjects,
      progressRequiredSubjects,
      selectedSubjectCategories,
      contentCountBySubject,
    };
  }, [
    data.student_contents,
    data.recommended_contents,
    data.subject_constraints,
    allRecommendedContents,
    selectedContentIds,
    recommendedContents,
  ]);
}

