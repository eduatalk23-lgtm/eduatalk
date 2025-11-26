"use client";

import { useState, useTransition, useEffect } from "react";
import { RefreshCw, Pencil, Plus, MessageCircle } from "lucide-react";
import {
  createBlockSet,
  getBlockSets,
  updateBlockSet,
} from "@/app/actions/blockSets";
import { addBlock, deleteBlock } from "@/app/actions/blocks";
import {
  createTemplateBlockSet,
  getTemplateBlockSets,
  updateTemplateBlockSet,
  addTemplateBlock,
  deleteTemplateBlock,
} from "@/app/(admin)/actions/templateBlockSets";
import { WizardData } from "./PlanGroupWizard";
import {
  toPlanGroupError,
  PlanGroupErrorCodes,
} from "@/lib/errors/planGroupErrors";

type Step1BasicInfoProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  blockSets: Array<{
    id: string;
    name: string;
    blocks?: Array<{
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>;
  }>;
  onBlockSetCreated?: (blockSet: { id: string; name: string }) => void;
  onBlockSetsLoaded?: (
    blockSets: Array<{
      id: string;
      name: string;
      blocks?: Array<{
        id: string;
        day_of_week: number;
        start_time: string;
        end_time: string;
      }>;
    }>
  ) => void;
  editable?: boolean;
  campTemplateInfo?: {
    name: string;
    program_type: string;
  };
  isTemplateMode?: boolean;
  templateId?: string; // 템플릿 ID (템플릿 모드일 때 필요)
  // 템플릿 고정 필드 관련
  isCampMode?: boolean; // 학생 모드에서 고정 필드 수정 방지
};

type PeriodInputType = "dday" | "direct" | "weeks";

const planPurposes = [
  { value: "내신대비", label: "내신대비" },
  { value: "모의고사(수능)", label: "모의고사(수능)" },
] as const;

const schedulerTypes = [
  { value: "1730_timetable", label: "1730 Timetable" },
] as const;

export function Step1BasicInfo({
  data,
  onUpdate,
  blockSets,
  onBlockSetCreated,
  onBlockSetsLoaded,
  editable = true,
  campTemplateInfo,
  isTemplateMode = false,
  templateId,
  isCampMode = false,
}: Step1BasicInfoProps) {
  // 템플릿 고정 필드 확인
  // templateLockedFields가 없거나 step1이 없으면 빈 객체로 초기화 (모든 필드 입력 가능)
  const lockedFields = data.templateLockedFields?.step1 || {};

  // 필드가 고정되어 있는지 확인 (학생 모드에서만 체크)
  // 고정 = 학생 입력 허용이 false인 경우
  const isFieldLocked = (fieldName: string) => {
    if (!isCampMode) return false; // 템플릿 편집 모드에서는 항상 편집 가능

    // allow_student_* 필드명 매핑
    const allowFieldMap: Record<string, string> = {
      name: "allow_student_name",
      plan_purpose: "allow_student_plan_purpose",
      scheduler_type: "allow_student_scheduler_type",
      period_start: "allow_student_period",
      period_end: "allow_student_period",
      block_set_id: "allow_student_block_set_id",
      student_level: "allow_student_student_level",
      subject_allocations: "allow_student_subject_allocations",
      study_review_cycle: "allow_student_study_review_cycle",
    };

    const allowFieldName = allowFieldMap[fieldName];
    if (!allowFieldName) return false;

    // lockedFields에 해당 필드가 없거나 false가 아니면 입력 가능 (고정되지 않음)
    const fieldValue =
      lockedFields[allowFieldName as keyof typeof lockedFields];
    return fieldValue === false; // 명시적으로 false인 경우만 고정
  };

  // 템플릿 모드에서 학생 입력 허용 토글 (고정과 통합)
  const toggleFieldControl = (fieldName: keyof typeof lockedFields) => {
    if (!isTemplateMode) return;

    const currentLocked = data.templateLockedFields?.step1 || {};
    // 현재 값이 undefined이면 true로, true이면 false로, false이면 true로 토글
    const currentValue = currentLocked[fieldName];
    const newValue = currentValue === true ? false : true;

    const newLocked = {
      ...currentLocked,
      [fieldName]: newValue,
    };

    onUpdate({
      templateLockedFields: {
        ...data.templateLockedFields,
        step1: newLocked,
      },
    });
  };

  // 체크박스 렌더링 헬퍼 함수
  const renderStudentInputCheckbox = (fieldName: keyof typeof lockedFields) => {
    if (!isTemplateMode) return null;

    return (
      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={lockedFields[fieldName] === true}
          onChange={() => toggleFieldControl(fieldName)}
          className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
        />
        <span>학생 입력 허용</span>
      </label>
    );
  };

  // 학생 모드에서 입력 가능 여부 확인 헬퍼 함수
  const canStudentInput = (fieldName: keyof typeof lockedFields): boolean => {
    if (!isCampMode) return true; // 일반 모드에서는 항상 허용

    // templateLockedFields가 없으면 모든 필드 입력 가능 (기본값)
    if (!data.templateLockedFields?.step1) return true;

    const fieldValue = lockedFields[fieldName];
    // undefined 또는 true이면 입력 가능, false이면 입력 불가
    return fieldValue !== false;
  };

  // 각 필드별 입력 가능 여부 (헬퍼 함수 사용)
  const canStudentInputName = canStudentInput("allow_student_name");
  const canStudentInputPlanPurpose = canStudentInput(
    "allow_student_plan_purpose"
  );
  const canStudentInputSchedulerType = canStudentInput(
    "allow_student_scheduler_type"
  );
  const canStudentInputPeriod = canStudentInput("allow_student_period");
  const canStudentInputBlockSetId = canStudentInput(
    "allow_student_block_set_id"
  );
  const canStudentInputStudentLevel = canStudentInput(
    "allow_student_student_level"
  );
  const canStudentInputSubjectAllocations = canStudentInput(
    "allow_student_subject_allocations"
  );
  const canStudentInputStudyReviewCycle = canStudentInput(
    "allow_student_study_review_cycle"
  );
  const canStudentInputAdditionalPeriodReallocation = canStudentInput(
    "allow_student_additional_period_reallocation"
  );

  const today = new Date().toISOString().split("T")[0];
  const [periodInputType, setPeriodInputType] =
    useState<PeriodInputType>("direct");

  // 각 유형별 독립적인 상태 관리
  const [ddayState, setDdayState] = useState({ date: "", calculated: false });
  const [weeksState, setWeeksState] = useState({ startDate: "", weeks: 4 });

  // 직접 선택: 연도/월/일을 각각 관리
  const getTodayParts = () => {
    const todayDate = new Date();
    return {
      year: todayDate.getFullYear(),
      month: todayDate.getMonth() + 1,
      day: todayDate.getDate(),
    };
  };

  const parseDateString = (dateStr: string) => {
    if (!dateStr) return getTodayParts();
    const [year, month, day] = dateStr.split("-").map(Number);
    return { year, month, day };
  };

  const [directState, setDirectState] = useState(() => {
    const startParts = data.period_start
      ? parseDateString(data.period_start)
      : getTodayParts();
    const endParts = data.period_end
      ? parseDateString(data.period_end)
      : getTodayParts();
    return {
      startYear: startParts.year,
      startMonth: startParts.month,
      startDay: startParts.day,
      endYear: endParts.year,
      endMonth: endParts.month,
      endDay: endParts.day,
    };
  });

  const [blockSetMode, setBlockSetMode] = useState<
    "select" | "create" | "edit"
  >("select");
  const [newBlockSetName, setNewBlockSetName] = useState("");
  const [editingBlockSetId, setEditingBlockSetId] = useState<string | null>(
    null
  );
  const [editingBlockSetName, setEditingBlockSetName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isLoadingBlockSets, setIsLoadingBlockSets] = useState(false);
  const [show1730Desc, setShow1730Desc] = useState(false);
  const [showBlockSetDesc, setShowBlockSetDesc] = useState(false);

  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // 템플릿 블록 세트 자동 선택 (blockSets가 로드된 후)
  useEffect(() => {
    if (data.block_set_id && blockSets.length > 0) {
      const selectedSet = blockSets.find((set) => set.id === data.block_set_id);
      // block_set_id가 설정되어 있지만 아직 선택되지 않은 경우 (초기 로드 시)
      // 이미 isSelected 로직으로 자동 선택되므로 추가 작업 불필요
      // 하지만 템플릿 블록 세트가 blockSets에 포함되어 있는지 확인
      if (!selectedSet && isCampMode) {
        // 템플릿 블록 세트가 blockSets에 없을 수 있으므로 경고만 (정상 동작)
        console.log(
          "[Step1BasicInfo] 템플릿 블록 세트를 찾을 수 없습니다:",
          data.block_set_id
        );
      }
    }
  }, [data.block_set_id, blockSets, isCampMode]);

  // 학습기간 데이터 변경 시 directState 업데이트
  useEffect(() => {
    if (data.period_start || data.period_end) {
      const startParts = data.period_start
        ? parseDateString(data.period_start)
        : getTodayParts();
      const endParts = data.period_end
        ? parseDateString(data.period_end)
        : getTodayParts();

      setDirectState((prev) => {
        // 값이 실제로 변경된 경우에만 업데이트 (무한 루프 방지)
        const startChanged =
          prev.startYear !== startParts.year ||
          prev.startMonth !== startParts.month ||
          prev.startDay !== startParts.day;
        const endChanged =
          prev.endYear !== endParts.year ||
          prev.endMonth !== endParts.month ||
          prev.endDay !== endParts.day;

        if (startChanged || endChanged) {
          return {
            startYear: startParts.year,
            startMonth: startParts.month,
            startDay: startParts.day,
            endYear: endParts.year,
            endMonth: endParts.month,
            endDay: endParts.day,
          };
        }
        return prev;
      });
    }
  }, [data.period_start, data.period_end]);

  // target_date가 있으면 ddayState 업데이트
  useEffect(() => {
    if (data.target_date) {
      setDdayState({ date: data.target_date, calculated: true });
      // target_date가 있으면 periodInputType을 "dday"로 설정
      setPeriodInputType("dday");
    }
  }, [data.target_date]);

  // weeksState 업데이트 (period_start가 있고 target_date가 없는 경우)
  useEffect(() => {
    if (data.period_start && !data.target_date) {
      // weeks 모드인지 확인하기 위해 period_start와 period_end의 차이를 계산
      if (data.period_start && data.period_end) {
        const start = new Date(data.period_start);
        const end = new Date(data.period_end);
        const diffDays = Math.floor(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        );
        const weeks = Math.floor(diffDays / 7);

        // 주 단위로 나누어떨어지고 4주 이상이면 weeks 모드로 간주
        if (diffDays % 7 === 0 && weeks >= 4) {
          setWeeksState({ startDate: data.period_start, weeks });
          setPeriodInputType("weeks");
        } else {
          // 그 외의 경우는 direct 모드
          setPeriodInputType("direct");
        }
      }
    }
  }, [data.period_start, data.period_end, data.target_date]);

  // 시간 블록 추가 관련 상태 (생성 및 수정 공통)
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [blockStartTime, setBlockStartTime] = useState<string>("");
  const [blockEndTime, setBlockEndTime] = useState<string>("");
  const [addedBlocks, setAddedBlocks] = useState<
    Array<{ day: number; startTime: string; endTime: string }>
  >([]);

  // 날짜 조합 헬퍼 함수
  const formatDateString = (
    year: number,
    month: number,
    day: number
  ): string => {
    const monthStr = String(month).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    return `${year}-${monthStr}-${dayStr}`;
  };

  // 해당 월의 마지막 일 계산 (윤년 고려)
  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month, 0).getDate();
  };

  // 유형 전환 시 다른 유형의 값 초기화
  const handlePeriodTypeChange = (type: PeriodInputType) => {
    setPeriodInputType(type);

    // 다른 유형의 값 초기화
    if (type !== "dday") {
      setDdayState({ date: "", calculated: false });
      if (type !== "direct" && type !== "weeks") {
        onUpdate({ period_start: "", period_end: "", target_date: undefined });
      }
    }
    if (type !== "weeks") {
      setWeeksState({ startDate: "", weeks: 4 });
      if (type !== "direct" && type !== "dday") {
        onUpdate({ period_start: "", period_end: "" });
      }
    } else {
      setWeeksState({ startDate: "", weeks: 4 });
    }
    if (type !== "direct") {
      const todayParts = getTodayParts();
      setDirectState({
        startYear: todayParts.year,
        startMonth: todayParts.month,
        startDay: todayParts.day,
        endYear: todayParts.year,
        endMonth: todayParts.month,
        endDay: todayParts.day,
      });
      if (type !== "dday" && type !== "weeks") {
        onUpdate({ period_start: "", period_end: "" });
      }
    }
  };

  const calculatePeriodFromWeeks = (weeks: number, startDate: string) => {
    if (!startDate) {
      onUpdate({ period_start: "", period_end: "" });
      return;
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + weeks * 7);

    onUpdate({
      period_start: start.toISOString().split("T")[0],
      period_end: end.toISOString().split("T")[0],
    });
  };

  const calculatePeriodFromDday = (dday: string) => {
    if (!dday) {
      onUpdate({ period_start: "", period_end: "", target_date: undefined });
      return;
    }

    const targetDate = new Date(dday);
    targetDate.setHours(0, 0, 0, 0);

    // D-day 기준으로 30일 전부터 시작
    const start = new Date(targetDate);
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);

    onUpdate({
      period_start: start.toISOString().split("T")[0],
      period_end: targetDate.toISOString().split("T")[0],
      target_date: dday,
    });
  };

  const toggleWeekday = (day: number) => {
    setSelectedWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const selectAllWeekdays = () => {
    setSelectedWeekdays([0, 1, 2, 3, 4, 5, 6]);
  };

  const selectWeekdays = () => {
    setSelectedWeekdays([1, 2, 3, 4, 5]); // 월~금
  };

  const selectWeekends = () => {
    setSelectedWeekdays([0, 6]); // 일, 토
  };

  const handleAddBlock = () => {
    if (selectedWeekdays.length === 0) {
      alert("추가할 요일을 최소 1개 이상 선택해주세요.");
      return;
    }
    if (!blockStartTime || !blockEndTime) {
      alert("시작 시간과 종료 시간을 입력해주세요.");
      return;
    }

    // 임시 블록 목록에 추가
    const newBlocks = selectedWeekdays.map((day) => ({
      day,
      startTime: blockStartTime,
      endTime: blockEndTime,
    }));
    setAddedBlocks([...addedBlocks, ...newBlocks]);
    setSelectedWeekdays([]);
    setBlockStartTime("");
    setBlockEndTime("");
  };

  const handleRemoveBlock = (index: number) => {
    setAddedBlocks(addedBlocks.filter((_, i) => i !== index));
  };

  const handleCreateBlockSet = () => {
    if (!newBlockSetName.trim()) {
      alert("블록 세트 이름을 입력해주세요.");
      return;
    }

    startTransition(() => {
      (async () => {
        try {
          // 템플릿 모드: 실제 템플릿 블록 세트 생성
          if (isTemplateMode) {
            // 1. 템플릿 블록 세트 생성 (템플릿 ID가 없어도 생성 가능)
            const templateFormData = new FormData();
            // templateId가 있으면 추가, 없으면 템플릿에 연결되지 않은 블록 세트로 생성
            if (templateId) {
              templateFormData.append("template_id", templateId);
            }
            templateFormData.append("name", newBlockSetName.trim());
            const templateResult = await createTemplateBlockSet(
              templateFormData
            );
            const templateBlockSetId = templateResult.blockSetId;
            const templateBlockSetName = templateResult.name;

            // 2. 추가된 블록들을 실제로 추가 (사용자가 명시적으로 추가한 블록만)
            if (addedBlocks.length > 0) {
              for (const block of addedBlocks) {
                const blockFormData = new FormData();
                blockFormData.append("day", String(block.day));
                blockFormData.append("start_time", block.startTime);
                blockFormData.append("end_time", block.endTime);
                blockFormData.append("block_set_id", templateBlockSetId);

                try {
                  await addTemplateBlock(blockFormData);
                } catch (error) {
                  const planGroupError = toPlanGroupError(
                    error,
                    PlanGroupErrorCodes.BLOCK_SET_NOT_FOUND,
                    { day: block.day }
                  );
                  console.error(
                    `[Step1BasicInfo] 템플릿 블록 추가 실패 (요일 ${block.day}):`,
                    planGroupError
                  );
                  // 일부 블록 추가 실패해도 계속 진행
                }
              }
            }

            // 3. 최신 블록 세트 목록 다시 불러오기
            const latestBlockSets = await getTemplateBlockSets(
              templateId || null
            );
            if (onBlockSetsLoaded) {
              onBlockSetsLoaded(latestBlockSets);
            }

            // 4. 생성된 블록 세트를 자동으로 선택
            onUpdate({ block_set_id: templateBlockSetId });

            // 5. 폼 초기화 및 모드 변경
            setNewBlockSetName("");
            setBlockSetMode("select");
            setAddedBlocks([]);
            setBlockStartTime("");
            setBlockEndTime("");
            setSelectedWeekdays([]);
            setCurrentPage(1);
            return;
          }

          // 일반 모드: 실제 블록 세트 생성
          // 1. 블록 세트 생성
          const formData = new FormData();
          formData.append("name", newBlockSetName.trim());
          const result = await createBlockSet(formData);
          const blockSetId = result.blockSetId;
          const blockSetName = result.name;

          // 2. 추가된 블록들을 실제로 추가
          if (addedBlocks.length > 0) {
            for (const block of addedBlocks) {
              const blockFormData = new FormData();
              blockFormData.append("day", String(block.day));
              blockFormData.append("start_time", block.startTime);
              blockFormData.append("end_time", block.endTime);
              blockFormData.append("block_set_id", blockSetId);

              try {
                await addBlock(blockFormData);
              } catch (error) {
                const planGroupError = toPlanGroupError(
                  error,
                  PlanGroupErrorCodes.BLOCK_SET_NOT_FOUND,
                  { day: block.day }
                );
                console.error(
                  `[Step1BasicInfo] 블록 추가 실패 (요일 ${block.day}):`,
                  planGroupError
                );
                // 일부 블록 추가 실패해도 계속 진행
              }
            }
          }

          // 3. 새로 생성된 블록 세트를 목록에 추가하고 선택
          const newBlockSet = { id: blockSetId, name: blockSetName };
          if (onBlockSetCreated) {
            onBlockSetCreated(newBlockSet);
          }

          // 4. 생성된 블록 세트를 자동으로 선택
          onUpdate({ block_set_id: blockSetId });

          // 5. 폼 초기화 및 모드 변경
          setNewBlockSetName("");
          setBlockSetMode("select");
          setAddedBlocks([]);
          setBlockStartTime("");
          setBlockEndTime("");
          setSelectedWeekdays([]);
          setCurrentPage(1); // 새 블록 세트 생성 시 첫 페이지로 리셋
        } catch (error) {
          alert(
            error instanceof Error
              ? error.message
              : "블록 세트 생성에 실패했습니다."
          );
        }
      })();
    });
  };

  const handleLoadBlockSets = () => {
    setIsLoadingBlockSets(true);
    startTransition(() => {
      (async () => {
        try {
          if (isTemplateMode) {
            if (!templateId) {
              // 새 템플릿 생성 시에는 블록 세트 목록이 없음 (정상)
              if (onBlockSetsLoaded) {
                onBlockSetsLoaded([]);
              }
              setBlockSetMode("select");
              setIsLoadingBlockSets(false);
              return;
            }
            const latestBlockSets = await getTemplateBlockSets(
              templateId || null
            );
            if (onBlockSetsLoaded) {
              onBlockSetsLoaded(latestBlockSets);
            }
          } else {
            const latestBlockSets = await getBlockSets();
            if (onBlockSetsLoaded) {
              onBlockSetsLoaded(latestBlockSets);
            }
          }
          setBlockSetMode("select");
          setCurrentPage(1); // 새로고침 시 첫 페이지로 리셋
        } catch (error) {
          alert(
            error instanceof Error
              ? error.message
              : "블록 세트 목록을 불러오는데 실패했습니다."
          );
        } finally {
          setIsLoadingBlockSets(false);
        }
      })();
    });
  };

  const handleStartEdit = () => {
    if (!data.block_set_id) {
      alert("먼저 블록 세트를 선택해주세요.");
      return;
    }
    const selectedSet = blockSets.find((set) => set.id === data.block_set_id);
    if (!selectedSet) {
      alert("선택된 블록 세트를 찾을 수 없습니다.");
      return;
    }
    setEditingBlockSetId(selectedSet.id);
    setEditingBlockSetName(selectedSet.name);
    setBlockSetMode("edit");
  };

  const handleAddBlocksToSet = () => {
    if (!editingBlockSetId) {
      alert("블록 세트를 선택해주세요.");
      return;
    }
    if (selectedWeekdays.length === 0) {
      alert("추가할 요일을 최소 1개 이상 선택해주세요.");
      return;
    }
    if (!blockStartTime || !blockEndTime) {
      alert("시작 시간과 종료 시간을 입력해주세요.");
      return;
    }

    startTransition(() => {
      (async () => {
        try {
          if (isTemplateMode) {
            for (const day of selectedWeekdays) {
              const blockFormData = new FormData();
              blockFormData.append("day", String(day));
              blockFormData.append("start_time", blockStartTime);
              blockFormData.append("end_time", blockEndTime);
              blockFormData.append("block_set_id", editingBlockSetId);

              try {
                await addTemplateBlock(blockFormData);
              } catch (error) {
                const planGroupError = toPlanGroupError(
                  error,
                  PlanGroupErrorCodes.BLOCK_SET_NOT_FOUND,
                  { day }
                );
                console.error(
                  `[Step1BasicInfo] 템플릿 블록 추가 실패 (요일 ${day}):`,
                  planGroupError
                );
                // 일부 블록 추가 실패해도 계속 진행
              }
            }

            // 최신 목록 다시 불러오기
            const latestBlockSets = await getTemplateBlockSets(
              templateId || null
            );
            if (onBlockSetsLoaded) {
              onBlockSetsLoaded(latestBlockSets);
            }
          } else {
            for (const day of selectedWeekdays) {
              const blockFormData = new FormData();
              blockFormData.append("day", String(day));
              blockFormData.append("start_time", blockStartTime);
              blockFormData.append("end_time", blockEndTime);
              blockFormData.append("block_set_id", editingBlockSetId);

              try {
                await addBlock(blockFormData);
              } catch (error) {
                const planGroupError = toPlanGroupError(
                  error,
                  PlanGroupErrorCodes.BLOCK_SET_NOT_FOUND,
                  { day }
                );
                console.error(
                  `[Step1BasicInfo] 블록 추가 실패 (요일 ${day}):`,
                  planGroupError
                );
                // 일부 블록 추가 실패해도 계속 진행
              }
            }

            // 최신 목록 다시 불러오기
            const latestBlockSets = await getBlockSets();
            if (onBlockSetsLoaded) {
              onBlockSetsLoaded(latestBlockSets);
            }
          }

          // 폼 초기화
          setSelectedWeekdays([]);
          setBlockStartTime("");
          setBlockEndTime("");
        } catch (error) {
          alert(
            error instanceof Error ? error.message : "블록 추가에 실패했습니다."
          );
        }
      })();
    });
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm("이 시간 블록을 삭제하시겠습니까?")) {
      return;
    }

    startTransition(() => {
      (async () => {
        try {
          const blockFormData = new FormData();
          blockFormData.append("id", blockId);

          if (isTemplateMode) {
            await deleteTemplateBlock(blockFormData);

            // 최신 목록 다시 불러오기
            const latestBlockSets = await getTemplateBlockSets(
              templateId || null
            );
            if (onBlockSetsLoaded) {
              onBlockSetsLoaded(latestBlockSets);
            }
          } else {
            await deleteBlock(blockFormData);

            // 최신 목록 다시 불러오기
            const latestBlockSets = await getBlockSets();
            if (onBlockSetsLoaded) {
              onBlockSetsLoaded(latestBlockSets);
            }
          }
        } catch (error) {
          alert(
            error instanceof Error ? error.message : "블록 삭제에 실패했습니다."
          );
        }
      })();
    });
  };

  const handleUpdateBlockSetName = () => {
    if (!editingBlockSetId || !editingBlockSetName.trim()) {
      alert("블록 세트 이름을 입력해주세요.");
      return;
    }

    startTransition(() => {
      (async () => {
        try {
          const formData = new FormData();
          formData.append("id", editingBlockSetId);
          formData.append("name", editingBlockSetName.trim());

          if (isTemplateMode) {
            await updateTemplateBlockSet(formData);

            // 최신 목록 다시 불러오기
            const latestBlockSets = await getTemplateBlockSets(
              templateId || null
            );
            if (onBlockSetsLoaded) {
              onBlockSetsLoaded(latestBlockSets);
            }

            // 선택된 블록 세트도 업데이트
            const updatedSet = latestBlockSets.find(
              (set) => set.id === editingBlockSetId
            );
            if (updatedSet) {
              onUpdate({ block_set_id: updatedSet.id });
            }
          } else {
            await updateBlockSet(formData);

            // 최신 목록 다시 불러오기
            const latestBlockSets = await getBlockSets();
            if (onBlockSetsLoaded) {
              onBlockSetsLoaded(latestBlockSets);
            }

            // 선택된 블록 세트도 업데이트
            const updatedSet = latestBlockSets.find(
              (set) => set.id === editingBlockSetId
            );
            if (updatedSet) {
              onUpdate({ block_set_id: updatedSet.id });
            }
          }

          setBlockSetMode("select");
          setEditingBlockSetId(null);
          setEditingBlockSetName("");
        } catch (error) {
          alert(
            error instanceof Error
              ? error.message
              : "블록 세트 이름 수정에 실패했습니다."
          );
        }
      })();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          {isCampMode ? "캠프 기본 정보" : "플랜 기본 정보"}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {isCampMode
            ? "캠프의 목적과 기간, 스케줄러 유형을 설정해주세요."
            : "플랜의 목적과 기간, 스케줄러 유형을 설정해주세요."}
        </p>
      </div>

      {/* 캠프 템플릿 정보 표시 */}
      {campTemplateInfo && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="font-semibold text-blue-900">캠프 프로그램</h3>
          <p className="text-sm text-blue-700">{campTemplateInfo.name}</p>
          <p className="text-xs text-blue-600">
            {campTemplateInfo.program_type}
          </p>
        </div>
      )}

      {/* 플랜/캠프 이름 (필수) */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label
            htmlFor="plan_name"
            className="block text-sm font-medium text-gray-700"
          >
            {isCampMode ? "캠프 이름" : "플랜 이름"}{" "}
            <span className="text-red-500">*</span>
          </label>
          {renderStudentInputCheckbox("allow_student_name")}
        </div>
        <input
          type="text"
          id="plan_name"
          className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none ${
            (!editable && !isCampMode) ||
            isFieldLocked("name") ||
            (isCampMode && !canStudentInputName)
              ? "cursor-not-allowed bg-gray-100 opacity-60"
              : ""
          }`}
          placeholder="예: 1학기 중간고사 대비"
          value={data.name || ""}
          onChange={(e) => onUpdate({ name: e.target.value })}
          disabled={
            (!editable && !isCampMode) ||
            isFieldLocked("name") ||
            (isCampMode && !canStudentInputName)
          }
          required
        />
        {isFieldLocked("name") && (
          <p className="mt-1 text-xs text-gray-500">
            이 필드는 템플릿에서 고정되어 있습니다.
          </p>
        )}
        {isCampMode && !canStudentInputName && (
          <p className="mt-1 text-xs text-gray-500">
            이 필드는 템플릿에서 고정되어 수정할 수 없습니다.
          </p>
        )}
      </div>

      {/* 플랜 목적 */}
      <div
        className={!editable || !canStudentInputPlanPurpose ? "opacity-60" : ""}
      >
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            플랜 목적 <span className="text-red-500">*</span>
          </label>
          {renderStudentInputCheckbox("allow_student_plan_purpose")}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {planPurposes.map((purpose) => (
            <label
              key={purpose.value}
              className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                !editable || !canStudentInputPlanPurpose
                  ? "cursor-not-allowed bg-gray-100"
                  : "cursor-pointer hover:border-gray-300"
              } ${
                data.plan_purpose === purpose.value
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              <input
                type="radio"
                name="plan_purpose"
                value={purpose.value}
                checked={data.plan_purpose === purpose.value}
                onChange={() =>
                  onUpdate({ plan_purpose: purpose.value as any })
                }
                disabled={
                  (!editable && !isCampMode) ||
                  (isCampMode && !canStudentInputPlanPurpose)
                }
                className="hidden"
              />
              {purpose.label}
            </label>
          ))}
        </div>
        {isCampMode && !canStudentInputPlanPurpose && (
          <p className="mt-1 text-xs text-gray-500">
            이 필드는 템플릿에서 고정되어 수정할 수 없습니다.
          </p>
        )}
      </div>

      {/* 학습 기간 (스케줄러 유형보다 먼저) */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            학습 기간 <span className="text-red-500">*</span>
          </label>
          {renderStudentInputCheckbox("allow_student_period")}
        </div>

        {/* 기간 입력 유형 선택 */}
        <div
          className={`mb-4 flex flex-wrap gap-2 ${
            isFieldLocked("period_start") ||
            isFieldLocked("period_end") ||
            (isCampMode && !canStudentInputPeriod)
              ? "opacity-60"
              : ""
          }`}
        >
          <button
            type="button"
            onClick={() => handlePeriodTypeChange("dday")}
            disabled={
              isFieldLocked("period_start") ||
              isFieldLocked("period_end") ||
              (isCampMode && !canStudentInputPeriod)
            }
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              periodInputType === "dday"
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            } ${
              isFieldLocked("period_start") ||
              isFieldLocked("period_end") ||
              (isCampMode && !canStudentInputPeriod)
                ? "cursor-not-allowed opacity-60"
                : ""
            }`}
          >
            D-day
          </button>
          <button
            type="button"
            onClick={() => handlePeriodTypeChange("weeks")}
            disabled={
              isFieldLocked("period_start") ||
              isFieldLocked("period_end") ||
              (isCampMode && !canStudentInputPeriod)
            }
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              periodInputType === "weeks"
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            } ${
              isFieldLocked("period_start") ||
              isFieldLocked("period_end") ||
              (isCampMode && !canStudentInputPeriod)
                ? "cursor-not-allowed opacity-60"
                : ""
            }`}
          >
            주 단위
          </button>
          <button
            type="button"
            onClick={() => handlePeriodTypeChange("direct")}
            disabled={
              isFieldLocked("period_start") ||
              isFieldLocked("period_end") ||
              (isCampMode && !canStudentInputPeriod)
            }
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              periodInputType === "direct"
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            } ${
              isFieldLocked("period_start") ||
              isFieldLocked("period_end") ||
              (isCampMode && !canStudentInputPeriod)
                ? "cursor-not-allowed opacity-60"
                : ""
            }`}
          >
            직접 선택
          </button>
        </div>
        {(isFieldLocked("period_start") || isFieldLocked("period_end")) && (
          <p className="mb-2 text-xs text-gray-500">
            학습 기간은 템플릿에서 고정되어 있습니다.
          </p>
        )}
        {isCampMode && !canStudentInputPeriod && (
          <p className="mb-2 text-xs text-gray-500">
            학습 기간은 템플릿에서 고정되어 수정할 수 없습니다.
          </p>
        )}

        {/* D-day 입력 */}
        {periodInputType === "dday" && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              시험일 입력
            </label>
            <input
              type="date"
              className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none ${
                isFieldLocked("period_start") ||
                isFieldLocked("period_end") ||
                (isCampMode && !canStudentInputPeriod)
                  ? "cursor-not-allowed bg-gray-100 opacity-60"
                  : ""
              }`}
              value={ddayState.date}
              onChange={(e) => {
                if (
                  isFieldLocked("period_start") ||
                  isFieldLocked("period_end") ||
                  (isCampMode && !canStudentInputPeriod)
                )
                  return;
                const date = e.target.value;
                setDdayState({ date, calculated: !!date });
                if (date) {
                  calculatePeriodFromDday(date);
                } else {
                  onUpdate({
                    period_start: "",
                    period_end: "",
                    target_date: undefined,
                  });
                }
              }}
              disabled={
                isFieldLocked("period_start") ||
                isFieldLocked("period_end") ||
                (isCampMode && !canStudentInputPeriod)
              }
              min={today}
            />
            {ddayState.calculated && data.period_start && data.period_end && (
              <div className="mt-3 rounded-lg bg-white p-3">
                <div className="text-sm text-gray-600">
                  <div className="font-medium text-gray-900">학습 기간</div>
                  <div className="mt-1">
                    시작일:{" "}
                    <span className="font-medium">{data.period_start}</span>
                  </div>
                  <div>
                    종료일:{" "}
                    <span className="font-medium">{data.period_end}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 주 단위 입력 */}
        {periodInputType === "weeks" && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              시작일 입력
            </label>
            <input
              type="date"
              className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none ${
                isFieldLocked("period_start") ||
                isFieldLocked("period_end") ||
                (isCampMode && !canStudentInputPeriod)
                  ? "cursor-not-allowed bg-gray-100 opacity-60"
                  : ""
              }`}
              value={weeksState.startDate}
              onChange={(e) => {
                if (
                  isFieldLocked("period_start") ||
                  isFieldLocked("period_end") ||
                  (isCampMode && !canStudentInputPeriod)
                )
                  return;
                const startDate = e.target.value;
                setWeeksState({ ...weeksState, startDate });
                if (startDate) {
                  calculatePeriodFromWeeks(weeksState.weeks, startDate);
                } else {
                  onUpdate({ period_start: "", period_end: "" });
                }
              }}
              disabled={
                isFieldLocked("period_start") ||
                isFieldLocked("period_end") ||
                (isCampMode && !canStudentInputPeriod)
              }
              min={today}
            />

            {weeksState.startDate && (
              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  학습 주수
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        isFieldLocked("period_start") ||
                        isFieldLocked("period_end") ||
                        (isCampMode && !canStudentInputPeriod)
                      )
                        return;
                      const newWeeks = Math.max(4, weeksState.weeks - 1);
                      setWeeksState({ ...weeksState, weeks: newWeeks });
                      calculatePeriodFromWeeks(newWeeks, weeksState.startDate);
                    }}
                    disabled={
                      weeksState.weeks <= 4 ||
                      isFieldLocked("period_start") ||
                      isFieldLocked("period_end") ||
                      (isCampMode && !canStudentInputPeriod)
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    −
                  </button>
                  <div className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-semibold text-gray-900">
                    {weeksState.weeks}주
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        isFieldLocked("period_start") ||
                        isFieldLocked("period_end") ||
                        (isCampMode && !canStudentInputPeriod)
                      )
                        return;
                      const newWeeks = weeksState.weeks + 1;
                      setWeeksState({ ...weeksState, weeks: newWeeks });
                      calculatePeriodFromWeeks(newWeeks, weeksState.startDate);
                    }}
                    disabled={
                      isFieldLocked("period_start") ||
                      isFieldLocked("period_end") ||
                      (isCampMode && !canStudentInputPeriod)
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {weeksState.startDate && data.period_start && data.period_end && (
              <div className="mt-3 rounded-lg bg-white p-3">
                <div className="text-sm text-gray-600">
                  <div className="font-medium text-gray-900">
                    {weeksState.weeks}주 학습 기간
                  </div>
                  <div className="mt-1">
                    시작일:{" "}
                    <span className="font-medium">{data.period_start}</span>
                  </div>
                  <div>
                    종료일:{" "}
                    <span className="font-medium">{data.period_end}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 직접 선택 */}
        {periodInputType === "direct" && (
          <div className="grid gap-4 md:grid-cols-2">
            {/* 시작일 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                시작일
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label
                    htmlFor="start_year"
                    className="mb-1 block text-xs text-gray-600"
                  >
                    연도
                  </label>
                  <select
                    id="start_year"
                    className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none ${
                      isFieldLocked("period_start") ||
                      isFieldLocked("period_end") ||
                      (isCampMode && !canStudentInputPeriod)
                        ? "cursor-not-allowed bg-gray-100 opacity-60"
                        : ""
                    }`}
                    value={directState.startYear}
                    onChange={(e) => {
                      if (
                        isFieldLocked("period_start") ||
                        isFieldLocked("period_end") ||
                        (isCampMode && !canStudentInputPeriod)
                      )
                        return;
                      const year = Number(e.target.value);
                      const maxDay = getDaysInMonth(
                        year,
                        directState.startMonth
                      );
                      const day = Math.min(directState.startDay, maxDay);
                      const newState = {
                        ...directState,
                        startYear: year,
                        startDay: day,
                      };
                      setDirectState(newState);
                      onUpdate({
                        period_start: formatDateString(
                          year,
                          directState.startMonth,
                          day
                        ),
                      });
                    }}
                    disabled={
                      isFieldLocked("period_start") ||
                      isFieldLocked("period_end") ||
                      (isCampMode && !canStudentInputPeriod)
                    }
                  >
                    {Array.from({ length: 6 }, (_, i) => {
                      const year = new Date().getFullYear() + i;
                      return (
                        <option key={year} value={year}>
                          {year}년
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="start_month"
                    className="mb-1 block text-xs text-gray-600"
                  >
                    월
                  </label>
                  <select
                    id="start_month"
                    className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none ${
                      isFieldLocked("period_start") ||
                      isFieldLocked("period_end") ||
                      (isCampMode && !canStudentInputPeriod)
                        ? "cursor-not-allowed bg-gray-100 opacity-60"
                        : ""
                    }`}
                    value={directState.startMonth}
                    onChange={(e) => {
                      if (
                        isFieldLocked("period_start") ||
                        isFieldLocked("period_end") ||
                        (isCampMode && !canStudentInputPeriod)
                      )
                        return;
                      const month = Number(e.target.value);
                      const maxDay = getDaysInMonth(
                        directState.startYear,
                        month
                      );
                      const day = Math.min(directState.startDay, maxDay);
                      const newState = {
                        ...directState,
                        startMonth: month,
                        startDay: day,
                      };
                      setDirectState(newState);
                      onUpdate({
                        period_start: formatDateString(
                          directState.startYear,
                          month,
                          day
                        ),
                      });
                    }}
                    disabled={
                      isFieldLocked("period_start") ||
                      isFieldLocked("period_end") ||
                      (isCampMode && !canStudentInputPeriod)
                    }
                  >
                    {Array.from({ length: 12 }, (_, i) => {
                      const month = i + 1;
                      return (
                        <option key={month} value={month}>
                          {month}월
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="start_day"
                    className="mb-1 block text-xs text-gray-600"
                  >
                    일
                  </label>
                  <select
                    id="start_day"
                    className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none ${
                      isFieldLocked("period_start") ||
                      isFieldLocked("period_end") ||
                      (isCampMode && !canStudentInputPeriod)
                        ? "cursor-not-allowed bg-gray-100 opacity-60"
                        : ""
                    }`}
                    value={directState.startDay}
                    onChange={(e) => {
                      if (
                        isFieldLocked("period_start") ||
                        isFieldLocked("period_end") ||
                        (isCampMode && !canStudentInputPeriod)
                      )
                        return;
                      const day = Number(e.target.value);
                      const newState = { ...directState, startDay: day };
                      setDirectState(newState);
                      onUpdate({
                        period_start: formatDateString(
                          directState.startYear,
                          directState.startMonth,
                          day
                        ),
                      });
                    }}
                    disabled={
                      isFieldLocked("period_start") ||
                      isFieldLocked("period_end") ||
                      (isCampMode && !canStudentInputPeriod)
                    }
                  >
                    {Array.from(
                      {
                        length: getDaysInMonth(
                          directState.startYear,
                          directState.startMonth
                        ),
                      },
                      (_, i) => {
                        const day = i + 1;
                        return (
                          <option key={day} value={day}>
                            {day}일
                          </option>
                        );
                      }
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* 종료일 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                종료일
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label
                    htmlFor="end_year"
                    className="mb-1 block text-xs text-gray-600"
                  >
                    연도
                  </label>
                  <select
                    id="end_year"
                    className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none ${
                      isFieldLocked("period_start") ||
                      isFieldLocked("period_end") ||
                      (isCampMode && !canStudentInputPeriod)
                        ? "cursor-not-allowed bg-gray-100 opacity-60"
                        : ""
                    }`}
                    value={directState.endYear}
                    onChange={(e) => {
                      if (
                        isFieldLocked("period_start") ||
                        isFieldLocked("period_end") ||
                        (isCampMode && !canStudentInputPeriod)
                      )
                        return;
                      const year = Number(e.target.value);
                      const maxDay = getDaysInMonth(year, directState.endMonth);
                      const day = Math.min(directState.endDay, maxDay);
                      const newState = {
                        ...directState,
                        endYear: year,
                        endDay: day,
                      };
                      setDirectState(newState);
                      onUpdate({
                        period_end: formatDateString(
                          year,
                          directState.endMonth,
                          day
                        ),
                      });
                    }}
                    disabled={
                      isFieldLocked("period_start") ||
                      isFieldLocked("period_end") ||
                      (isCampMode && !canStudentInputPeriod)
                    }
                  >
                    {Array.from({ length: 6 }, (_, i) => {
                      const year = new Date().getFullYear() + i;
                      return (
                        <option key={year} value={year}>
                          {year}년
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="end_month"
                    className="mb-1 block text-xs text-gray-600"
                  >
                    월
                  </label>
                  <select
                    id="end_month"
                    className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none ${
                      isFieldLocked("period_start") ||
                      isFieldLocked("period_end") ||
                      (isCampMode && !canStudentInputPeriod)
                        ? "cursor-not-allowed bg-gray-100 opacity-60"
                        : ""
                    }`}
                    value={directState.endMonth}
                    onChange={(e) => {
                      if (
                        isFieldLocked("period_start") ||
                        isFieldLocked("period_end") ||
                        (isCampMode && !canStudentInputPeriod)
                      )
                        return;
                      const month = Number(e.target.value);
                      const maxDay = getDaysInMonth(directState.endYear, month);
                      const day = Math.min(directState.endDay, maxDay);
                      const newState = {
                        ...directState,
                        endMonth: month,
                        endDay: day,
                      };
                      setDirectState(newState);
                      onUpdate({
                        period_end: formatDateString(
                          directState.endYear,
                          month,
                          day
                        ),
                      });
                    }}
                    disabled={
                      isFieldLocked("period_start") ||
                      isFieldLocked("period_end") ||
                      (isCampMode && !canStudentInputPeriod)
                    }
                  >
                    {Array.from({ length: 12 }, (_, i) => {
                      const month = i + 1;
                      return (
                        <option key={month} value={month}>
                          {month}월
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="end_day"
                    className="mb-1 block text-xs text-gray-600"
                  >
                    일
                  </label>
                  <select
                    id="end_day"
                    className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none ${
                      isFieldLocked("period_start") ||
                      isFieldLocked("period_end") ||
                      (isCampMode && !canStudentInputPeriod)
                        ? "cursor-not-allowed bg-gray-100 opacity-60"
                        : ""
                    }`}
                    value={directState.endDay}
                    onChange={(e) => {
                      if (
                        isFieldLocked("period_start") ||
                        isFieldLocked("period_end") ||
                        (isCampMode && !canStudentInputPeriod)
                      )
                        return;
                      const day = Number(e.target.value);
                      const newState = { ...directState, endDay: day };
                      setDirectState(newState);
                      onUpdate({
                        period_end: formatDateString(
                          directState.endYear,
                          directState.endMonth,
                          day
                        ),
                      });
                    }}
                    disabled={
                      isFieldLocked("period_start") ||
                      isFieldLocked("period_end") ||
                      (isCampMode && !canStudentInputPeriod)
                    }
                  >
                    {Array.from(
                      {
                        length: getDaysInMonth(
                          directState.endYear,
                          directState.endMonth
                        ),
                      },
                      (_, i) => {
                        const day = i + 1;
                        return (
                          <option key={day} value={day}>
                            {day}일
                          </option>
                        );
                      }
                    )}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 스케줄러 유형 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            스케줄러 유형 <span className="text-red-500">*</span>
          </label>
          {renderStudentInputCheckbox("allow_student_scheduler_type")}
        </div>

        {/* 스케줄러 유형 선택 (한 줄) */}
        <div
          className={`mb-4 flex gap-2 ${
            isCampMode && !canStudentInputSchedulerType ? "opacity-60" : ""
          }`}
        >
          {schedulerTypes.map((type) => (
            <label
              key={type.value}
              className={`flex-1 rounded-lg border px-4 py-3 text-center text-sm font-medium transition-colors ${
                isCampMode && !canStudentInputSchedulerType
                  ? "cursor-not-allowed bg-gray-100"
                  : "cursor-pointer hover:border-gray-300"
              } ${
                data.scheduler_type === type.value
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 text-gray-700"
              }`}
            >
              <input
                type="radio"
                name="scheduler_type"
                value={type.value}
                checked={data.scheduler_type === type.value}
                onChange={() => {
                  if (isCampMode && !canStudentInputSchedulerType) return;
                  onUpdate({
                    scheduler_type: type.value as any,
                    scheduler_options: undefined, // 유형 변경 시 옵션 초기화
                  });
                  // 유형 변경 시 설명도 초기화
                  setShow1730Desc(false);
                }}
                disabled={isCampMode && !canStudentInputSchedulerType}
                className="hidden"
              />
              {type.label}
            </label>
          ))}
        </div>
        {isCampMode && !canStudentInputSchedulerType && (
          <p className="mb-2 text-xs text-gray-500">
            스케줄러 유형은 템플릿에서 고정되어 수정할 수 없습니다.
          </p>
        )}

        {data.scheduler_type === "1730_timetable" && (
          <div className="space-y-4">
            {/* 설명 토글 */}
            <div>
              <button
                type="button"
                onClick={() => setShow1730Desc(!show1730Desc)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <span>
                  1730 Timetable 동작 방식 {show1730Desc ? "숨기기" : "보기"}
                </span>
                <span className="text-gray-400">
                  {show1730Desc ? "▲" : "▼"}
                </span>
              </button>

              {show1730Desc && (
                <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
                  <h4 className="mb-3 font-semibold text-blue-900">
                    1730 Timetable 동작 방식
                  </h4>
                  <ul className="space-y-2 text-blue-800">
                    <li className="flex items-start gap-2">
                      <span className="mt-1">•</span>
                      <span>
                        주 단위로 학습과 복습을 체계적으로 관리하는
                        스케줄러입니다.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1">•</span>
                      <span>
                        기본적으로 <strong>6일 학습 + 1일 복습</strong> 패턴으로
                        구성됩니다.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1">•</span>
                      <span>
                        학습일에는 새로운 콘텐츠를 순환 배정하여 다양한 과목을
                        학습합니다.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1">•</span>
                      <span>
                        복습일에는 해당 주에 학습한 내용을 복습하여 학습 효과를
                        극대화합니다.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1">•</span>
                      <span>
                        복습 범위를 <strong>부분 복습</strong> 또는{" "}
                        <strong>전체 복습</strong>으로 선택할 수 있습니다.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1">•</span>
                      <span>
                        학습일 수와 복습일 수를 조절하여 자신에게 맞는 학습
                        패턴을 설정할 수 있습니다.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1">•</span>
                      <span>
                        정기적인 복습을 통해 장기 기억 강화와 학습 내용의 완전한
                        이해를 도모합니다.
                      </span>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* 옵션 */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  1730 Timetable 옵션
                </h3>
                {renderStudentInputCheckbox("allow_student_study_review_cycle")}
              </div>
              <div
                className={`space-y-4 ${
                  isCampMode && !canStudentInputStudyReviewCycle
                    ? "opacity-60"
                    : ""
                }`}
              >
                <div>
                  <label className="mb-2 block text-xs font-medium text-gray-700">
                    학습일 수:{" "}
                    {data.scheduler_options?.study_days ??
                      data.study_review_cycle?.study_days ??
                      6}
                    일
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="7"
                    value={
                      data.scheduler_options?.study_days ??
                      data.study_review_cycle?.study_days ??
                      6
                    }
                    onChange={(e) => {
                      if (isCampMode && !canStudentInputStudyReviewCycle)
                        return;
                      const studyDays = Number(e.target.value);
                      const reviewDays =
                        data.scheduler_options?.review_days ??
                        data.study_review_cycle?.review_days ??
                        1;
                      onUpdate({
                        scheduler_options: {
                          ...data.scheduler_options,
                          study_days: studyDays,
                        },
                        study_review_cycle: {
                          study_days: studyDays,
                          review_days: reviewDays,
                        },
                      });
                    }}
                    disabled={isCampMode && !canStudentInputStudyReviewCycle}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-gray-700">
                    복습일 수:{" "}
                    {data.scheduler_options?.review_days ??
                      data.study_review_cycle?.review_days ??
                      1}
                    일
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    value={
                      data.scheduler_options?.review_days ??
                      data.study_review_cycle?.review_days ??
                      1
                    }
                    onChange={(e) => {
                      if (isCampMode && !canStudentInputStudyReviewCycle)
                        return;
                      const reviewDays = Number(e.target.value);
                      const studyDays =
                        data.scheduler_options?.study_days ??
                        data.study_review_cycle?.study_days ??
                        6;
                      onUpdate({
                        scheduler_options: {
                          ...data.scheduler_options,
                          review_days: reviewDays,
                        },
                        study_review_cycle: {
                          study_days: studyDays,
                          review_days: reviewDays,
                        },
                      });
                    }}
                    disabled={isCampMode && !canStudentInputStudyReviewCycle}
                    className="w-full"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    복습일 수는 0일 이상이어야 합니다. 0일이면 복습일이
                    없습니다.
                  </p>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-gray-700">
                    복습 범위
                  </label>
                  <select
                    className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none ${
                      isCampMode && !canStudentInputStudyReviewCycle
                        ? "cursor-not-allowed bg-gray-100 opacity-60"
                        : ""
                    }`}
                    value={data.scheduler_options?.review_scope ?? "partial"}
                    onChange={(e) => {
                      if (isCampMode && !canStudentInputStudyReviewCycle)
                        return;
                      onUpdate({
                        scheduler_options: {
                          ...data.scheduler_options,
                          review_scope: e.target.value as "full" | "partial",
                        },
                      });
                    }}
                    disabled={isCampMode && !canStudentInputStudyReviewCycle}
                  >
                    <option value="partial">부분 복습</option>
                    <option value="full">전체 복습</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 블록 세트 생성/선택 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="block text-sm font-medium text-gray-700">
              블록 세트 <span className="text-red-500">*</span>
            </label>
            {renderStudentInputCheckbox("allow_student_block_set_id")}
            <button
              type="button"
              onClick={() => setShowBlockSetDesc(!showBlockSetDesc)}
              className="flex items-center rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="블록 세트 설명"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleLoadBlockSets}
              disabled={isLoadingBlockSets}
              className="flex items-center gap-1 rounded p-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              title="목록 새로고침"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  isLoadingBlockSets ? "animate-spin" : ""
                }`}
              />
            </button>
            {blockSetMode === "select" && (
              <button
                type="button"
                onClick={() => {
                  if (isCampMode && !canStudentInputBlockSetId) return;
                  setBlockSetMode("create");
                }}
                disabled={isCampMode && !canStudentInputBlockSetId}
                className={`flex items-center gap-1 rounded p-1.5 text-xs ${
                  isCampMode && !canStudentInputBlockSetId
                    ? "cursor-not-allowed text-gray-400 opacity-50"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                }`}
                title="새 블록 세트 만들기"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* 블록 세트 설명 */}
        {showBlockSetDesc && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <h4 className="mb-2 font-semibold text-blue-900">블록 세트란?</h4>
            <p className="mb-2">
              블록 세트는{" "}
              <strong>
                고정적인 학습 제외 시간을 제외한 요일별 학습 시작~끝 시간
              </strong>
              을 정의합니다.
            </p>
            <p className="text-xs text-blue-700">
              예를 들어, 평일 오후 3시~6시, 오후 7시~10시와 같이 규칙적인 학습
              시간대를 설정할 수 있습니다.
            </p>
            <p className="mt-2 text-xs text-blue-700">
              주의: 중간에 학원이나 점심 시간 등이 있는 경우, 이는 이후 입력하는
              항목에서 별도로 수집됩니다.
            </p>
          </div>
        )}

        {/* 선택된 블록 세트의 시간 블록 정보 표시 (목록 위) - 항상 표시 (읽기 전용) */}
        {data.block_set_id && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            {(() => {
              const selectedSet = data.block_set_id
                ? blockSets.find((set) => set.id === data.block_set_id)
                : null;
              const blocks = selectedSet?.blocks ?? [];

              if (blocks.length === 0) {
                return (
                  <p className="text-xs text-gray-500">
                    이 블록 세트에는 등록된 시간 블록이 없습니다.
                  </p>
                );
              }

              // 요일별로 그룹화
              const blocksByDay = blocks.reduce((acc, block) => {
                const day = block.day_of_week;
                if (!acc[day]) acc[day] = [];
                acc[day].push(block);
                return acc;
              }, {} as Record<number, typeof blocks>);

              const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedSet?.name || "선택된 블록 세트"}
                    </p>
                    <p className="text-xs font-medium text-gray-700">
                      등록된 시간 블록 ({blocks.length}개)
                    </p>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(blocksByDay).map(([day, dayBlocks]) => (
                      <div key={day} className="text-xs text-gray-600">
                        <span className="font-medium">
                          {dayNames[Number(day)]}요일:
                        </span>{" "}
                        {dayBlocks.map((block, idx) => (
                          <span key={idx}>
                            {block.start_time} ~ {block.end_time}
                            {idx < dayBlocks.length - 1 && ", "}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* 기존 블록 세트 선택 */}
        {blockSetMode === "select" && (
          <div
            className={`mb-4 space-y-2 ${
              isCampMode && !canStudentInputBlockSetId ? "opacity-60" : ""
            }`}
          >
            {blockSets.length > 0 ? (
              <>
                {(() => {
                  const startIndex = (currentPage - 1) * itemsPerPage;
                  const endIndex = startIndex + itemsPerPage;
                  const paginatedBlockSets = blockSets.slice(
                    startIndex,
                    endIndex
                  );
                  const totalPages = Math.ceil(blockSets.length / itemsPerPage);

                  return (
                    <>
                      {paginatedBlockSets.map((set) => {
                        const blockCount = set.blocks?.length ?? 0;
                        const isSelected = data.block_set_id === set.id;
                        return (
                          <div
                            key={set.id}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
                              isSelected
                                ? "border-gray-900 bg-gray-50"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                          >
                            <label
                              className={`flex flex-1 items-center gap-2 ${
                                isCampMode && !canStudentInputBlockSetId
                                  ? "cursor-not-allowed"
                                  : "cursor-pointer"
                              }`}
                            >
                              <input
                                type="radio"
                                name="block_set"
                                value={set.id}
                                checked={isSelected}
                                onChange={(e) => {
                                  if (isCampMode && !canStudentInputBlockSetId)
                                    return;
                                  onUpdate({
                                    block_set_id: e.target.value || undefined,
                                  });
                                }}
                                disabled={
                                  isCampMode && !canStudentInputBlockSetId
                                }
                                className="h-4 w-4 border-gray-300 text-gray-900 focus:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                              />
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">
                                  {set.name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {blockCount > 0
                                    ? `${blockCount}개 블록`
                                    : "블록 없음"}
                                </div>
                              </div>
                            </label>
                            <button
                              type="button"
                              onClick={(e) => {
                                if (isCampMode && !canStudentInputBlockSetId)
                                  return;
                                e.stopPropagation();
                                setEditingBlockSetId(set.id);
                                setEditingBlockSetName(set.name);
                                setBlockSetMode("edit");
                              }}
                              disabled={
                                isCampMode && !canStudentInputBlockSetId
                              }
                              className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
                                isCampMode && !canStudentInputBlockSetId
                                  ? "cursor-not-allowed text-gray-400 opacity-50"
                                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                              }`}
                              title="수정"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}

                      {/* 페이징 컨트롤 */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-2">
                          <button
                            type="button"
                            onClick={() =>
                              setCurrentPage((prev) => Math.max(1, prev - 1))
                            }
                            disabled={currentPage === 1}
                            className="rounded px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            이전
                          </button>
                          <span className="text-xs text-gray-600">
                            {currentPage} / {totalPages}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setCurrentPage((prev) =>
                                Math.min(totalPages, prev + 1)
                              )
                            }
                            disabled={currentPage === totalPages}
                            className="rounded px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            다음
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            ) : (
              <p className="text-xs text-gray-500">
                등록된 블록 세트가 없습니다. "+" 버튼을 클릭하여 생성하세요.
              </p>
            )}
            {isCampMode && !canStudentInputBlockSetId && (
              <p className="mt-2 text-xs text-gray-500">
                블록 세트는 템플릿에서 고정되어 수정할 수 없습니다.
              </p>
            )}
          </div>
        )}

        {/* 블록 세트 생성 폼 */}
        {blockSetMode === "create" &&
          (!isCampMode || canStudentInputBlockSetId) && (
            <div className="mb-4 space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              {/* 블록 세트 이름 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  블록 세트 이름
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                  placeholder="예: 평일 학습 블록"
                  value={newBlockSetName}
                  onChange={(e) => setNewBlockSetName(e.target.value)}
                />
              </div>

              {/* 시간 블록 추가 */}
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">
                  시간 블록 추가
                </h3>

                <div className="mb-4">
                  <label className="mb-2 block text-xs font-medium text-gray-700">
                    추가할 요일 선택
                  </label>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={selectAllWeekdays}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      전체 선택
                    </button>
                    <button
                      type="button"
                      onClick={selectWeekdays}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      평일
                    </button>
                    <button
                      type="button"
                      onClick={selectWeekends}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      주말
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 0, label: "일" },
                      { value: 1, label: "월" },
                      { value: 2, label: "화" },
                      { value: 3, label: "수" },
                      { value: 4, label: "목" },
                      { value: 5, label: "금" },
                      { value: 6, label: "토" },
                    ].map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleWeekday(day.value)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          selectedWeekdays.includes(day.value)
                            ? "bg-gray-900 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {day.label}요일
                      </button>
                    ))}
                  </div>
                </div>

                {/* 시간 입력 */}
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      시작 시간
                    </label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                      value={blockStartTime}
                      onChange={(e) => setBlockStartTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      종료 시간
                    </label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                      value={blockEndTime}
                      onChange={(e) => setBlockEndTime(e.target.value)}
                    />
                  </div>
                </div>

                {/* 블록 추가 버튼 */}
                <button
                  type="button"
                  onClick={handleAddBlock}
                  disabled={
                    selectedWeekdays.length === 0 ||
                    !blockStartTime ||
                    !blockEndTime
                  }
                  className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  블록 추가하기
                </button>
              </div>

              {/* 추가된 블록 목록 */}
              {addedBlocks.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <h3 className="mb-2 text-sm font-semibold text-gray-900">
                    추가된 블록 ({addedBlocks.length}개)
                  </h3>
                  <div className="space-y-2">
                    {addedBlocks.map((block, index) => {
                      const dayNames = [
                        "일",
                        "월",
                        "화",
                        "수",
                        "목",
                        "금",
                        "토",
                      ];
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                        >
                          <span className="text-sm text-gray-700">
                            {dayNames[block.day]}요일 {block.startTime} ~{" "}
                            {block.endTime}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveBlock(index)}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            삭제
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 생성 버튼 */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBlockSetMode("select");
                    setNewBlockSetName("");
                    setAddedBlocks([]);
                    setBlockStartTime("");
                    setBlockEndTime("");
                    setSelectedWeekdays([]);
                  }}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleCreateBlockSet}
                  disabled={isPending || !newBlockSetName.trim()}
                  className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {isPending ? "생성 중..." : "블록 세트 생성"}
                </button>
              </div>
            </div>
          )}

        {/* 블록 세트 수정 폼 */}
        {blockSetMode === "edit" && editingBlockSetId && (
          <div className="mb-4 space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            {/* 블록 세트 이름 수정 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                블록 세트 이름
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                  value={editingBlockSetName}
                  onChange={(e) => setEditingBlockSetName(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleUpdateBlockSetName}
                  disabled={
                    isPending ||
                    !editingBlockSetName.trim() ||
                    editingBlockSetName ===
                      blockSets.find((s) => s.id === editingBlockSetId)?.name
                  }
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {isPending ? "저장 중..." : "이름 저장"}
                </button>
              </div>
            </div>

            {/* 현재 블록 목록 */}
            {(() => {
              const selectedSet = blockSets.find(
                (set) => set.id === editingBlockSetId
              );
              const blocks = selectedSet?.blocks ?? [];
              const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

              if (blocks.length === 0) {
                return (
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <p className="text-xs text-gray-500">
                      이 블록 세트에는 등록된 시간 블록이 없습니다. 아래에서
                      추가해주세요.
                    </p>
                  </div>
                );
              }

              // 요일별로 그룹화
              const blocksByDay = blocks.reduce((acc, block) => {
                const day = block.day_of_week;
                if (!acc[day]) acc[day] = [];
                acc[day].push(block);
                return acc;
              }, {} as Record<number, typeof blocks>);

              return (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">
                    등록된 시간 블록 ({blocks.length}개)
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(blocksByDay).map(([day, dayBlocks]) => (
                      <div key={day} className="space-y-1">
                        {dayBlocks.map((block) => (
                          <div
                            key={block.id}
                            className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                          >
                            <div className="flex-1">
                              <span className="text-xs font-medium text-gray-700">
                                {dayNames[Number(day)]}요일:
                              </span>{" "}
                              <span className="text-xs text-gray-600">
                                {block.start_time} ~ {block.end_time}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteBlock(block.id)}
                              disabled={isPending}
                              className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              삭제
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 시간 블록 추가 */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">
                시간 블록 추가
              </h3>

              <div className="mb-4">
                <label className="mb-2 block text-xs font-medium text-gray-700">
                  추가할 요일 선택
                </label>
                <div className="mb-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllWeekdays}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    전체 선택
                  </button>
                  <button
                    type="button"
                    onClick={selectWeekdays}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    평일
                  </button>
                  <button
                    type="button"
                    onClick={selectWeekends}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    주말
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 0, label: "일" },
                    { value: 1, label: "월" },
                    { value: 2, label: "화" },
                    { value: 3, label: "수" },
                    { value: 4, label: "목" },
                    { value: 5, label: "금" },
                    { value: 6, label: "토" },
                  ].map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleWeekday(day.value)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        selectedWeekdays.includes(day.value)
                          ? "bg-gray-900 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {day.label}요일
                    </button>
                  ))}
                </div>
              </div>

              {/* 시간 입력 */}
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    시작 시간
                  </label>
                  <input
                    type="time"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                    value={blockStartTime}
                    onChange={(e) => setBlockStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    종료 시간
                  </label>
                  <input
                    type="time"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                    value={blockEndTime}
                    onChange={(e) => setBlockEndTime(e.target.value)}
                  />
                </div>
              </div>

              {/* 블록 추가 버튼 */}
              <button
                type="button"
                onClick={handleAddBlocksToSet}
                disabled={
                  isPending ||
                  selectedWeekdays.length === 0 ||
                  !blockStartTime ||
                  !blockEndTime
                }
                className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isPending ? "추가 중..." : "블록 추가하기"}
              </button>
            </div>

            {/* 수정 완료 버튼 */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setBlockSetMode("select");
                  setEditingBlockSetId(null);
                  setEditingBlockSetName("");
                  setSelectedWeekdays([]);
                  setBlockStartTime("");
                  setBlockEndTime("");
                }}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                수정 완료
              </button>
            </div>
          </div>
        )}

        {/* 추가 기간 학습 범위 재배치 (1730 Timetable) */}
        {data.scheduler_type === "1730_timetable" && (
          <div
            className={`rounded-lg border border-gray-200 bg-white p-4 ${
              isCampMode && !canStudentInputAdditionalPeriodReallocation
                ? "opacity-60"
                : ""
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                추가 기간 학습 범위 재배치 (선택사항)
              </h3>
              {renderStudentInputCheckbox(
                "allow_student_additional_period_reallocation"
              )}
            </div>
            <p className="mb-4 text-xs text-gray-600">
              1730 Timetable은 4주 단위로 진행하며, 추가 기간에는 앞서 4주치
              학습한 내용을 다시 반복합니다.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enable_additional_period"
                  checked={!!data.additional_period_reallocation}
                  onChange={(e) => {
                    if (
                      isCampMode &&
                      !canStudentInputAdditionalPeriodReallocation
                    )
                      return;
                    if (e.target.checked) {
                      // 4주 기간 계산 (원본 기간의 첫 4주)
                      const periodStart = new Date(data.period_start);
                      const periodEnd = new Date(data.period_end);
                      const fourWeeksEnd = new Date(periodStart);
                      fourWeeksEnd.setDate(fourWeeksEnd.getDate() + 28); // 4주 = 28일

                      // 실제 종료일이 4주보다 짧으면 그 날짜 사용
                      const originalEnd =
                        fourWeeksEnd > periodEnd ? periodEnd : fourWeeksEnd;

                      onUpdate({
                        additional_period_reallocation: {
                          period_start: "",
                          period_end: "",
                          type: "additional_review",
                          original_period_start: data.period_start,
                          original_period_end: originalEnd
                            .toISOString()
                            .split("T")[0],
                          review_of_review_factor: 0.25,
                        },
                      });
                    } else {
                      onUpdate({ additional_period_reallocation: undefined });
                    }
                  }}
                  disabled={
                    isCampMode && !canStudentInputAdditionalPeriodReallocation
                  }
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <label
                  htmlFor="enable_additional_period"
                  className={`text-sm ${
                    isCampMode && !canStudentInputAdditionalPeriodReallocation
                      ? "text-gray-500"
                      : "text-gray-700"
                  }`}
                >
                  추가 기간 재배치 사용 (4주 학습 범위 재배치)
                </label>
              </div>

              {data.additional_period_reallocation && (
                <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        추가 기간 시작일
                      </label>
                      <input
                        type="date"
                        className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none ${
                          isCampMode &&
                          !canStudentInputAdditionalPeriodReallocation
                            ? "cursor-not-allowed bg-gray-100 opacity-60"
                            : ""
                        }`}
                        value={data.additional_period_reallocation.period_start}
                        onChange={(e) => {
                          if (
                            isCampMode &&
                            !canStudentInputAdditionalPeriodReallocation
                          )
                            return;
                          onUpdate({
                            additional_period_reallocation: {
                              ...data.additional_period_reallocation!,
                              period_start: e.target.value,
                            },
                          });
                        }}
                        disabled={
                          isCampMode &&
                          !canStudentInputAdditionalPeriodReallocation
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        추가 기간 종료일
                      </label>
                      <input
                        type="date"
                        className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none ${
                          isCampMode &&
                          !canStudentInputAdditionalPeriodReallocation
                            ? "cursor-not-allowed bg-gray-100 opacity-60"
                            : ""
                        }`}
                        value={data.additional_period_reallocation.period_end}
                        onChange={(e) => {
                          if (
                            isCampMode &&
                            !canStudentInputAdditionalPeriodReallocation
                          )
                            return;
                          onUpdate({
                            additional_period_reallocation: {
                              ...data.additional_period_reallocation!,
                              period_end: e.target.value,
                            },
                          });
                        }}
                        disabled={
                          isCampMode &&
                          !canStudentInputAdditionalPeriodReallocation
                        }
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs text-blue-800">
                      <strong>재배치 범위:</strong>{" "}
                      {
                        data.additional_period_reallocation
                          .original_period_start
                      }{" "}
                      ~{" "}
                      {data.additional_period_reallocation.original_period_end}{" "}
                      (4주치 학습 내용)
                    </p>
                    <p className="mt-1 text-xs text-blue-700">
                      앞서 4주치 학습한 내용을 추가 기간에 재배치하여 복습의
                      복습을 진행합니다.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      복습의 복습 보정 계수:{" "}
                      {data.additional_period_reallocation
                        .review_of_review_factor ?? 0.25}
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="0.5"
                      step="0.05"
                      value={
                        data.additional_period_reallocation
                          .review_of_review_factor ?? 0.25
                      }
                      onChange={(e) => {
                        if (
                          isCampMode &&
                          !canStudentInputAdditionalPeriodReallocation
                        )
                          return;
                        onUpdate({
                          additional_period_reallocation: {
                            ...data.additional_period_reallocation!,
                            review_of_review_factor: Number(e.target.value),
                          },
                        });
                      }}
                      disabled={
                        isCampMode &&
                        !canStudentInputAdditionalPeriodReallocation
                      }
                      className={`w-full ${
                        isCampMode &&
                        !canStudentInputAdditionalPeriodReallocation
                          ? "cursor-not-allowed opacity-60"
                          : ""
                      }`}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      원본 학습 소요시간 대비 추가 복습 소요시간 비율입니다.
                      (기본값: 0.25 = 25%)
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {isCampMode && !canStudentInputAdditionalPeriodReallocation && (
          <p className="mt-2 text-xs text-gray-500">
            추가 기간 학습 범위 재배치는 템플릿에서 고정되어 수정할 수 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}
