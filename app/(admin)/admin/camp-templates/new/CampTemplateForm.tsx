"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { createCampTemplateAction } from "@/app/(admin)/actions/campTemplateActions";
import { PlanGroupWizard, WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { BlockSetWithBlocks } from "@/lib/data/blockSets";
import { CampProgramType, RequiredSubject } from "@/lib/types/plan";
import { TemplateFormChecklist } from "../_components/TemplateFormChecklist";
import { useToast } from "@/components/ui/ToastProvider";
import { getSubjectGroupsAction, getSubjectsByGroupAction } from "@/app/(admin)/actions/subjectActions";
import { getCurriculumRevisionsAction } from "@/app/(admin)/actions/contentMetadataActions";
import type { SubjectGroup, Subject } from "@/lib/data/subjects";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";
import { cn } from "@/lib/cn";

type CampTemplateFormProps = {
  initialBlockSets: BlockSetWithBlocks[];
};

const programTypes: Array<{ value: CampProgramType; label: string }> = [
  { value: "윈터캠프", label: "윈터캠프" },
  { value: "썸머캠프", label: "썸머캠프" },
  { value: "파이널캠프", label: "파이널캠프" },
  { value: "기타", label: "기타" },
];

const statuses: Array<{ value: "draft" | "active" | "archived"; label: string }> = [
  { value: "draft", label: "초안" },
  { value: "active", label: "활성" },
  { value: "archived", label: "보관" },
];

export function CampTemplateForm({ initialBlockSets }: CampTemplateFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [programType, setProgramType] = useState<CampProgramType>("기타");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
  const [templateName, setTemplateName] = useState("");
  const [campStartDate, setCampStartDate] = useState("");
  const [campEndDate, setCampEndDate] = useState("");
  const [campLocation, setCampLocation] = useState("");
  
  // 개정교육과정 및 교과-과목 데이터
  const [curriculumRevisions, setCurriculumRevisions] = useState<CurriculumRevision[]>([]);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | undefined>(undefined);
  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [subjectsByGroup, setSubjectsByGroup] = useState<Map<string, Subject[]>>(new Map());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  
  // 콘텐츠 선택 검증 설정
  const [enableRequiredSubjectsValidation, setEnableRequiredSubjectsValidation] = useState(false);
  const [requiredSubjects, setRequiredSubjects] = useState<RequiredSubject[]>([]);
  
  // 개정교육과정 및 교과-과목 데이터 로드
  useEffect(() => {
    loadCurriculumRevisions();
  }, []);
  
  useEffect(() => {
    if (selectedRevisionId) {
      loadSubjectGroups(selectedRevisionId);
    }
  }, [selectedRevisionId]);
  
  async function loadCurriculumRevisions() {
    try {
      const revisions = await getCurriculumRevisionsAction();
      setCurriculumRevisions(revisions);
      if (revisions.length > 0 && !selectedRevisionId) {
        setSelectedRevisionId(revisions[0].id);
      }
    } catch (error) {
      console.error("개정교육과정 조회 실패:", error);
      toast.showError("개정교육과정 목록을 불러오는데 실패했습니다.");
    }
  }
  
  async function loadSubjectGroups(revisionId: string) {
    try {
      setLoadingSubjects(true);
      const groups = await getSubjectGroupsAction(revisionId);
      setSubjectGroups(groups);
    } catch (error) {
      console.error("교과 그룹 조회 실패:", error);
      toast.showError("교과 그룹 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoadingSubjects(false);
    }
  }
  
  async function loadSubjectsForGroup(groupId: string) {
    if (subjectsByGroup.has(groupId)) {
      return; // 이미 로드됨
    }
    
    try {
      const subjects = await getSubjectsByGroupAction(groupId);
      setSubjectsByGroup((prev) => {
        const newMap = new Map(prev);
        newMap.set(groupId, subjects);
        return newMap;
      });
    } catch (error) {
      console.error("과목 조회 실패:", error);
      toast.showError("과목 목록을 불러오는데 실패했습니다.");
    }
  }
  
  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
        loadSubjectsForGroup(groupId);
      }
      return newSet;
    });
  };

  const handleTemplateSave = async (wizardData: WizardData) => {
    // subject_constraints 설정을 wizardData에 병합
    const finalWizardData: WizardData = {
      ...wizardData,
      subject_constraints: {
        enable_required_subjects_validation: enableRequiredSubjectsValidation,
        required_subjects: enableRequiredSubjectsValidation && requiredSubjects.length > 0 ? requiredSubjects : undefined,
        constraint_handling: "strict", // 기본값
      },
    };

    const formData = new FormData();
    formData.append("name", finalWizardData.name);
    formData.append("program_type", programType);
    formData.append("description", description);
    formData.append("status", status);
    formData.append("template_data", JSON.stringify(finalWizardData));
    if (campStartDate) {
      formData.append("camp_start_date", campStartDate);
    }
    if (campEndDate) {
      formData.append("camp_end_date", campEndDate);
    }
    if (campLocation) {
      formData.append("camp_location", campLocation);
    }

    const result = await createCampTemplateAction(formData);
    if (!result.success) {
      throw new Error(result.error || "템플릿 저장에 실패했습니다.");
    }

    // 템플릿 저장 성공 후 상세 페이지로 리다이렉트
    if (result.templateId) {
      toast.showSuccess("템플릿이 성공적으로 생성되었습니다.");
      router.push(`/admin/camp-templates/${result.templateId}`);
    }
  };

  const addRequiredSubject = (groupId: string, groupName: string, subjectId?: string, subjectName?: string) => {
    const newSubject: RequiredSubject = {
      subject_category: groupName,
      subject: subjectName,
      min_count: 1,
    };
    
    // 중복 체크
    const isDuplicate = requiredSubjects.some(
      (rs) => rs.subject_category === groupName && rs.subject === subjectName
    );
    
    if (!isDuplicate) {
      setRequiredSubjects((prev) => [...prev, newSubject]);
    }
  };

  const removeRequiredSubject = (index: number) => {
    setRequiredSubjects((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRequiredSubjectMinCount = (index: number, minCount: number) => {
    setRequiredSubjects((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], min_count: Math.max(1, minCount) };
      return updated;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 기본 정보 체크리스트 */}
      <TemplateFormChecklist name={templateName} programType={programType} />

      {/* 템플릿 메타 정보 입력 섹션 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">템플릿 기본 정보</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {/* 템플릿 이름 */}
          <div className="md:col-span-2">
            <label htmlFor="template_name" className="mb-2 block text-sm font-medium text-gray-700">
              템플릿 이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="template_name"
              value={templateName}
              onChange={(e) => {
                setTemplateName(e.target.value);
              }}
              placeholder="템플릿 이름을 입력하세요"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
              required
            />
          </div>

          {/* 프로그램 유형 */}
          <div>
            <label htmlFor="program_type" className="mb-2 block text-sm font-medium text-gray-700">
              프로그램 유형 <span className="text-red-500">*</span>
            </label>
            <select
              id="program_type"
              value={programType}
              onChange={(e) => setProgramType(e.target.value as CampProgramType)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
              required
            >
              {programTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* 상태 */}
          <div>
            <label htmlFor="status" className="mb-2 block text-sm font-medium text-gray-700">
              상태
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as "draft" | "active" | "archived")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            >
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* 설명 */}
          <div className="md:col-span-2">
            <label htmlFor="description" className="mb-2 block text-sm font-medium text-gray-700">
              설명
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="템플릿에 대한 설명을 입력하세요. (선택사항)"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>

          {/* 캠프 기간 */}
          <div>
            <label htmlFor="camp_start_date" className="mb-2 block text-sm font-medium text-gray-700">
              캠프 시작일
            </label>
            <input
              type="date"
              id="camp_start_date"
              value={campStartDate}
              onChange={(e) => setCampStartDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="camp_end_date" className="mb-2 block text-sm font-medium text-gray-700">
              캠프 종료일
            </label>
            <input
              type="date"
              id="camp_end_date"
              value={campEndDate}
              onChange={(e) => setCampEndDate(e.target.value)}
              min={campStartDate || undefined}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>

          {/* 캠프 장소 */}
          <div className="md:col-span-2">
            <label htmlFor="camp_location" className="mb-2 block text-sm font-medium text-gray-700">
              캠프 장소
            </label>
            <input
              type="text"
              id="camp_location"
              value={campLocation}
              onChange={(e) => setCampLocation(e.target.value)}
              placeholder="캠프 장소를 입력하세요. (선택사항)"
              maxLength={200}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
        </div>

        {/* 콘텐츠 선택 검증 설정 */}
        <div className="mt-6 border-t border-gray-200 pt-6">
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            4단계 콘텐츠 선택 검증 설정
          </h3>
          <p className="mb-4 text-sm text-gray-600">
            학생이 캠프 템플릿 입력 시 4단계 콘텐츠 선택에서 적용될 검증 규칙을 설정합니다.
          </p>

          {/* 필수 과목 검증 활성화 */}
          <div className="mb-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={enableRequiredSubjectsValidation}
                onChange={(e) => {
                  setEnableRequiredSubjectsValidation(e.target.checked);
                  if (!e.target.checked) {
                    setRequiredSubjects([]);
                  }
                }}
                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              <span className="text-sm font-medium text-gray-700">
                필수 과목 검증 활성화
              </span>
            </label>
            <p className="mt-1 text-xs text-gray-500">
              활성화 시, 학생이 선택한 콘텐츠에 지정된 필수 과목이 각각 1개 이상 포함되어야 합니다.
            </p>
          </div>

              {/* 필수 과목 선택 (교과-과목 위계 구조) */}
              {enableRequiredSubjectsValidation && (
            <div className="space-y-4">
              {/* 개정교육과정 선택 */}
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">
                  개정교육과정:
                </label>
                <select
                  value={selectedRevisionId || ""}
                  onChange={(e) => setSelectedRevisionId(e.target.value || undefined)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">선택하세요</option>
                  {curriculumRevisions.map((revision) => (
                    <option key={revision.id} value={revision.id}>
                      {revision.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  필수 교과/과목 선택
                </label>
                {loadingSubjects && (
                  <span className="text-xs text-gray-500">로딩 중...</span>
                )}
              </div>

              {/* 교과별 트리 구조 */}
              <div className="max-h-96 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-4">
                {!selectedRevisionId && (
                  <p className="text-sm text-gray-500">개정교육과정을 선택해주세요.</p>
                )}
                {selectedRevisionId && subjectGroups.length === 0 && !loadingSubjects && (
                  <p className="text-sm text-gray-500">교과 그룹 목록이 없습니다.</p>
                )}
                {selectedRevisionId && subjectGroups.map((group) => {
                  const isExpanded = expandedGroups.has(group.id);
                  const subjects = subjectsByGroup.get(group.id) || [];
                  const hasSubjects = subjects.length > 0;

                  return (
                    <div key={group.id} className="space-y-1">
                      {/* 교과 헤더 */}
                      <div className="flex items-center gap-2">
                        <div
                          onClick={() => hasSubjects && toggleGroup(group.id)}
                          className={cn(
                            "flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm font-medium text-gray-700 transition-colors",
                            hasSubjects ? "cursor-pointer hover:bg-gray-100" : "cursor-not-allowed opacity-50"
                          )}
                        >
                          {hasSubjects ? (
                            isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )
                          ) : (
                            <div className="h-4 w-4" />
                          )}
                          <span className="flex-1">{group.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              addRequiredSubject(group.id, group.name);
                            }}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
                          >
                            <Plus className="h-3 w-3" />
                            교과 추가
                          </button>
                        </div>
                      </div>

                      {/* 세부 과목 목록 */}
                      {isExpanded && hasSubjects && (
                        <div className="ml-6 space-y-1 border-l-2 border-gray-200 pl-3">
                          {subjects.map((subject) => (
                            <div
                              key={subject.id}
                              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
                            >
                              <span className="text-sm text-gray-700">{subject.name}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  addRequiredSubject(
                                    group.id,
                                    group.name,
                                    subject.id,
                                    subject.name
                                  )
                                }
                                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                              >
                                <Plus className="h-3 w-3" />
                                추가
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 선택된 필수 과목 목록 */}
              {requiredSubjects.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    선택된 필수 과목 ({requiredSubjects.length}개)
                  </label>
                  <div className="space-y-2">
                    {requiredSubjects.map((rs, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {rs.subject_category}
                            {rs.subject && (
                              <span className="ml-1 text-gray-600">- {rs.subject}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-600">최소 개수:</label>
                          <input
                            type="number"
                            min="1"
                            max="99"
                            value={rs.min_count}
                            onChange={(e) =>
                              updateRequiredSubjectMinCount(
                                index,
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="w-16 rounded border border-gray-300 px-2 py-1 text-sm focus:border-gray-900 focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRequiredSubject(index)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {requiredSubjects.length === 0 && enableRequiredSubjectsValidation && (
                <p className="text-xs text-amber-600">
                  필수 과목 검증을 활성화하려면 최소 1개 이상의 교과 또는 과목을 선택해주세요.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 플랜 그룹 위저드 */}
      <PlanGroupWizard
        initialBlockSets={initialBlockSets}
        initialContents={{ books: [], lectures: [], custom: [] }}
        initialData={{
          name: templateName,
          subject_constraints: {
            enable_required_subjects_validation: enableRequiredSubjectsValidation,
            required_subjects:
              enableRequiredSubjectsValidation && requiredSubjects.length > 0
                ? requiredSubjects
                : undefined,
            constraint_handling: "strict",
          },
        }}
        isTemplateMode={true}
        onTemplateSave={handleTemplateSave}
      />
    </div>
  );
}

