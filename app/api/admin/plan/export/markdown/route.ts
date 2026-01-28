/**
 * 마크다운 내보내기 API
 *
 * 플랜을 마크다운 형식으로 내보냅니다.
 * - 내보내기 범위: today, week, planGroup, planner
 * - 메타 정보 포함 옵션 지원
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveAuthContext, isAdminContext } from "@/lib/auth/strategies";
import { formatPlanLearningAmount } from "@/lib/utils/planFormatting";
import {
  createSplitPlanGroupKey,
  groupPlansByKey,
  sortByStartTimeInPlace,
} from "@/lib/utils/splitPlanGrouping";
import {
  generateTimetableMarkdown,
  type TimetableWeek,
  type TimetableEntry,
} from "@/lib/utils/timetableMarkdown";

type ExportRange = "today" | "week" | "planGroup" | "planner";

interface ExportOptions {
  includeStudentInfo: boolean;
  includePlannerSettings: boolean;
  includeExclusions: boolean;
  includeAcademySchedules: boolean;
  includeStatistics: boolean;
}

type ExportFormat = "table" | "timetable";

interface RequestBody {
  studentId: string;
  plannerId: string;
  planGroupId?: string;
  exportRange: ExportRange;
  selectedDate: string;
  selectedWeek?: number;
  options: ExportOptions;
  exportFormat?: ExportFormat;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();

    // 인증 확인 - studentId를 전달해야 admin 모드로 처리됨
    const auth = await resolveAuthContext({ studentId: body.studentId });
    if (!isAdminContext(auth)) {
      return NextResponse.json(
        { success: false, error: "관리자 권한이 필요합니다" },
        { status: 403 }
      );
    }
    const {
      studentId,
      plannerId,
      planGroupId,
      exportRange,
      selectedDate,
      selectedWeek,
      options,
      exportFormat = "table",
    } = body;

    if (!studentId || !plannerId) {
      return NextResponse.json(
        { success: false, error: "필수 파라미터가 누락되었습니다" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // 1. 학생 정보 조회
    const { data: student } = await supabase
      .from("students")
      .select("id, name, grade, school_name")
      .eq("id", studentId)
      .single();

    // 2. 플래너 정보 조회
    const { data: planner } = await supabase
      .from("planners")
      .select(`
        id,
        name,
        period_start,
        period_end,
        default_scheduler_type,
        default_scheduler_options,
        study_hours,
        self_study_hours,
        lunch_time
      `)
      .eq("id", plannerId)
      .single();

    if (!planner) {
      return NextResponse.json(
        { success: false, error: "플래너를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 3. 플랜 그룹 정보 조회
    const { data: planGroups } = await supabase
      .from("plan_groups")
      .select(`
        id,
        name,
        plan_purpose,
        period_start,
        period_end,
        status,
        daily_schedule
      `)
      .eq("planner_id", plannerId)
      .order("period_start", { ascending: true });

    // 4. 제외일 조회
    let exclusions: Array<{
      exclusion_date: string;
      exclusion_type: string;
      reason: string | null;
    }> = [];
    if (options.includeExclusions) {
      const { data } = await supabase
        .from("planner_exclusions")
        .select("exclusion_date, exclusion_type, reason")
        .eq("planner_id", plannerId)
        .order("exclusion_date", { ascending: true });
      exclusions = data || [];
    }

    // 5. 학원 일정 조회
    let academySchedules: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
      academy_name: string | null;
      subject: string | null;
    }> = [];
    if (options.includeAcademySchedules) {
      const { data } = await supabase
        .from("planner_academy_schedules")
        .select("day_of_week, start_time, end_time, academy_name, subject")
        .eq("planner_id", plannerId)
        .order("day_of_week", { ascending: true });
      academySchedules = data || [];
    }

    // 6. 플랜 데이터 조회 (범위에 따라)
    let dateFilter: { start: string; end: string } | null = null;

    // 선택된 주차 번호 (week 범위 내보내기에서 사용)
    let weekFilter: number | null = null;

    switch (exportRange) {
      case "today":
        dateFilter = { start: selectedDate, end: selectedDate };
        break;
      case "week": {
        // selectedWeek이 제공되면 해당 주차로 필터링
        if (selectedWeek) {
          weekFilter = selectedWeek;
          // 날짜 필터 대신 주차 필터 사용
          dateFilter = null;
        } else {
          // 폴백: 선택된 날짜 기준 주차 계산
          const selected = new Date(selectedDate + "T00:00:00");
          const dayOfWeek = selected.getDay();
          const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          const weekStart = new Date(selected);
          weekStart.setDate(selected.getDate() + mondayOffset);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          dateFilter = {
            start: weekStart.toISOString().split("T")[0],
            end: weekEnd.toISOString().split("T")[0],
          };
        }
        break;
      }
      case "planGroup":
        if (planGroupId) {
          const group = planGroups?.find((g) => g.id === planGroupId);
          if (group) {
            dateFilter = {
              start: group.period_start,
              end: group.period_end,
            };
          }
        }
        break;
      case "planner":
        // 전체 기간
        dateFilter = null;
        break;
    }

    // 플랜 조회
    let plansQuery = supabase
      .from("student_plan")
      .select(`
        id,
        plan_date,
        start_time,
        end_time,
        status,
        day_type,
        week,
        day,
        planned_start_page_or_time,
        planned_end_page_or_time,
        content_id,
        plan_group_id,
        is_partial,
        is_continued,
        plan_groups!inner(planner_id, name)
      `)
      .eq("student_id", studentId)
      .eq("is_active", true)
      .eq("plan_groups.planner_id", plannerId)
      .order("plan_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (dateFilter) {
      plansQuery = plansQuery
        .gte("plan_date", dateFilter.start)
        .lte("plan_date", dateFilter.end);
    }

    // 주차 필터 적용
    if (weekFilter) {
      plansQuery = plansQuery.eq("week", weekFilter);
    }

    if (exportRange === "planGroup" && planGroupId) {
      plansQuery = plansQuery.eq("plan_group_id", planGroupId);
    }

    // week 범위 내보내기 시 planGroupId도 필터링
    if (exportRange === "week" && planGroupId) {
      plansQuery = plansQuery.eq("plan_group_id", planGroupId);
    }

    const { data: plans } = await plansQuery;

    // 7. 콘텐츠 정보 조회 (null/undefined 필터링)
    const contentIds = [...new Set(
      (plans || [])
        .map((p) => p.content_id)
        .filter((id): id is string => id != null && id !== "")
    )];
    const contentMap = new Map<
      string,
      { title: string; content_type: string; subject?: string }
    >();

    if (contentIds.length > 0) {
      // RLS를 우회하기 위해 Admin 클라이언트 사용
      const adminSupabase = createSupabaseAdminClient();
      if (!adminSupabase) {
        throw new Error("Admin client initialization failed");
      }

      // 교재 조회
      const { data: books } = await adminSupabase
        .from("books")
        .select("id, title, subject")
        .in("id", contentIds);

      // 강의 조회
      const { data: lectures } = await adminSupabase
        .from("lectures")
        .select("id, title, subject")
        .in("id", contentIds);

      // 학생 커스텀 콘텐츠 조회
      const { data: studentCustomContents } = await adminSupabase
        .from("student_custom_contents")
        .select("id, title, subject")
        .in("id", contentIds);

      // 마스터 커스텀 콘텐츠 조회
      const { data: masterCustomContents } = await adminSupabase
        .from("master_custom_contents")
        .select("id, title, subject")
        .in("id", contentIds);

      (books || []).forEach((b) => {
        contentMap.set(b.id, {
          title: b.title,
          content_type: "book",
          subject: b.subject ?? undefined,
        });
      });

      (lectures || []).forEach((l) => {
        contentMap.set(l.id, {
          title: l.title,
          content_type: "lecture",
          subject: l.subject ?? undefined,
        });
      });

      (studentCustomContents || []).forEach((c) => {
        contentMap.set(c.id, {
          title: c.title,
          content_type: "custom",
          subject: c.subject ?? undefined,
        });
      });

      (masterCustomContents || []).forEach((c) => {
        contentMap.set(c.id, {
          title: c.title,
          content_type: "custom",
          subject: c.subject ?? undefined,
        });
      });

      // 찾지 못한 content_id 로깅
      const notFoundIds = contentIds.filter((id) => !contentMap.has(id));
      if (notFoundIds.length > 0) {
        console.warn("[Markdown Export] Content not found:", notFoundIds);
      }
    }

    // 8. 마크다운 생성
    const markdown =
      exportFormat === "timetable"
        ? generateTimetableExport({
            planner,
            plans: plans || [],
            contentMap,
            academySchedules,
            exportRange,
            selectedDate,
          })
        : generateMarkdown({
            student: options.includeStudentInfo ? student : null,
            planner,
            planGroups: planGroups || [],
            plans: plans || [],
            contentMap,
            exclusions,
            academySchedules,
            options,
            exportRange,
            selectedDate,
          });

    return NextResponse.json({
      success: true,
      data: { markdown },
    });
  } catch (error) {
    console.error("Markdown export error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "내보내기에 실패했습니다",
      },
      { status: 500 }
    );
  }
}

/**
 * 시간표 형식 마크다운 생성 (Admin 내보내기용 어댑터)
 */
function generateTimetableExport(data: {
  planner: {
    name: string;
    period_start: string;
    period_end: string;
    lunch_time: { start: string; end: string } | null;
  };
  plans: Array<{
    id: string;
    plan_date: string;
    start_time: string | null;
    end_time: string | null;
    status: string;
    day_type: string | null;
    week: number | null;
    planned_start_page_or_time: number | null;
    planned_end_page_or_time: number | null;
    content_id: string;
    is_partial: boolean | null;
  }>;
  contentMap: Map<string, { title: string; content_type: string; subject?: string }>;
  academySchedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name: string | null;
    subject: string | null;
  }>;
  exportRange: ExportRange;
  selectedDate: string;
}): string {
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  // 분할 플랜 part 정보 계산
  const partInfoMap = calculatePartInfo(data.plans);

  // 주차별 그룹화 (week=null → 0 = 미배정)
  const plansByWeek = new Map<number, typeof data.plans>();
  for (const plan of data.plans) {
    const weekNum = plan.week ?? 0;
    const list = plansByWeek.get(weekNum) ?? [];
    list.push(plan);
    plansByWeek.set(weekNum, list);
  }

  const sortedWeekNums = Array.from(plansByWeek.keys()).sort((a, b) => a - b);

  // 학원 일정을 요일별로 매핑 (day_of_week → schedules)
  const academyByDay = new Map<number, typeof data.academySchedules>();
  for (const s of data.academySchedules) {
    const list = academyByDay.get(s.day_of_week) ?? [];
    list.push(s);
    academyByDay.set(s.day_of_week, list);
  }

  const timetableWeeks: TimetableWeek[] = sortedWeekNums.map((weekNum) => {
    const weekPlans = plansByWeek.get(weekNum)!;
    const weekLabel = weekNum === 0 ? "미배정" : `${weekNum}주차`;

    // 날짜별 그룹
    const dateSet = new Map<string, typeof data.plans>();
    for (const p of weekPlans) {
      const list = dateSet.get(p.plan_date) ?? [];
      list.push(p);
      dateSet.set(p.plan_date, list);
    }
    const sortedDates = Array.from(dateSet.keys()).sort();
    const dateRange =
      sortedDates.length > 0
        ? `${sortedDates[0]} ~ ${sortedDates[sortedDates.length - 1]}`
        : "";

    const entries: TimetableEntry[] = [];

    for (const date of sortedDates) {
      const dayOfWeekIdx = new Date(date + "T00:00:00").getDay();
      const dayOfWeek = dayNames[dayOfWeekIdx];
      const datePlans = dateSet.get(date)!;

      // 학습 플랜 → entries
      for (const plan of datePlans) {
        const content = data.contentMap.get(plan.content_id);
        const title = content?.title || plan.content_id;
        const prefix = plan.day_type === "복습일" ? "복습: " : "";

        let rangeStr = "";
        if (
          plan.planned_start_page_or_time != null &&
          plan.planned_end_page_or_time != null
        ) {
          rangeStr = ` ${formatPlanLearningAmount({
            content_type: content?.content_type || "book",
            planned_start_page_or_time: plan.planned_start_page_or_time,
            planned_end_page_or_time: plan.planned_end_page_or_time,
          })}`;

          const partInfo = partInfoMap.get(plan.id);
          if (plan.is_partial && partInfo) {
            rangeStr += ` (${partInfo.partIndex}/${partInfo.totalParts})`;
          }
        }

        entries.push({
          date,
          dayOfWeek,
          startTime: plan.start_time ? plan.start_time.slice(0, 5) : null,
          endTime: plan.end_time ? plan.end_time.slice(0, 5) : null,
          label: `${prefix}${title}${rangeStr}`,
          isNonStudy: false,
          status: plan.status,
        });
      }

      // 학원 일정 → entries (해당 요일에 학원이 있으면)
      const dayAcademies = academyByDay.get(dayOfWeekIdx);
      if (dayAcademies) {
        for (const a of dayAcademies) {
          entries.push({
            date,
            dayOfWeek,
            startTime: a.start_time.slice(0, 5),
            endTime: a.end_time.slice(0, 5),
            label: `\u{1F3EB} ${a.academy_name || a.subject || "학원"}`,
            isNonStudy: true,
          });
        }
      }
    }

    // 점심 시간 → dailyNonStudy
    const dailyNonStudy: TimetableWeek["dailyNonStudy"] = [];
    if (data.planner.lunch_time) {
      dailyNonStudy.push({
        startTime: data.planner.lunch_time.start,
        endTime: data.planner.lunch_time.end,
        label: "점심",
      });
    }

    return {
      weekLabel,
      dateRange,
      entries,
      dailyNonStudy: dailyNonStudy.length > 0 ? dailyNonStudy : undefined,
    };
  });

  // 빈 주차 필터링
  const filteredWeeks = timetableWeeks.filter((w) => w.entries.length > 0);

  const rangeLabel =
    data.exportRange === "today"
      ? `일일 시간표 (${data.selectedDate})`
      : data.exportRange === "week"
        ? "주간 시간표"
        : data.exportRange === "planGroup"
          ? "플랜 그룹 시간표"
          : "전체 시간표";

  return generateTimetableMarkdown(
    filteredWeeks,
    `${data.planner.name} - ${rangeLabel}`,
    {}
  );
}

/**
 * 분할 플랜의 part_index, total_parts 계산
 *
 * DB에 part_index, total_parts가 없으므로 런타임에 계산합니다.
 * 같은 날짜 + 같은 content_id + 같은 range의 is_partial=true 플랜들을 그룹화하여 계산
 */
function calculatePartInfo(
  plans: Array<{
    id: string;
    plan_date: string;
    content_id: string;
    planned_start_page_or_time: number | null;
    planned_end_page_or_time: number | null;
    is_partial: boolean | null;
    start_time: string | null;
  }>
): Map<string, { partIndex: number; totalParts: number }> {
  const partInfoMap = new Map<string, { partIndex: number; totalParts: number }>();

  // 공통 유틸리티로 is_partial=true인 플랜만 그룹화
  const groups = groupPlansByKey(
    plans,
    (p) =>
      createSplitPlanGroupKey(
        p.plan_date,
        p.content_id,
        p.planned_start_page_or_time,
        p.planned_end_page_or_time
      ),
    (p) => p.is_partial === true
  );

  // 각 그룹에서 시간순 정렬 후 part 정보 할당
  for (const [, group] of groups) {
    // 시간순 정렬 (timeToMinutes 사용으로 통일)
    sortByStartTimeInPlace(group);

    const totalParts = group.length;
    group.forEach((plan, index) => {
      partInfoMap.set(plan.id, {
        partIndex: index + 1,
        totalParts,
      });
    });
  }

  return partInfoMap;
}

// 마크다운 생성 함수
function generateMarkdown(data: {
  student: { name: string; grade: number | null; school_name: string | null } | null;
  planner: {
    name: string;
    period_start: string;
    period_end: string;
    default_scheduler_type: string | null;
    default_scheduler_options: Record<string, unknown> | null;
    study_hours: { start: string; end: string } | null;
    self_study_hours: { start: string; end: string } | null;
    lunch_time: { start: string; end: string } | null;
  };
  planGroups: Array<{
    id: string;
    name: string;
    plan_purpose: string | null;
    period_start: string;
    period_end: string;
    status: string;
    daily_schedule: unknown;
  }>;
  plans: Array<{
    id: string;
    plan_date: string;
    start_time: string | null;
    end_time: string | null;
    status: string;
    day_type: string | null;
    week: number | null;
    day: number | null;
    planned_start_page_or_time: number | null;
    planned_end_page_or_time: number | null;
    content_id: string;
    plan_group_id: string;
    is_partial: boolean | null;
    is_continued: boolean | null;
    plan_groups: { planner_id: string; name: string } | { planner_id: string; name: string }[];
  }>;
  contentMap: Map<string, { title: string; content_type: string; subject?: string }>;
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: string;
    reason: string | null;
  }>;
  academySchedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name: string | null;
    subject: string | null;
  }>;
  options: ExportOptions;
  exportRange: ExportRange;
  selectedDate: string;
}): string {
  const lines: string[] = [];
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  // 마크다운 테이블 셀 이스케이프 (| 문자 처리)
  const escapeCell = (text: string | null | undefined): string => {
    if (!text) return "-";
    return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
  };

  // 제목
  const rangeLabel =
    data.exportRange === "today"
      ? `일일 플랜 (${data.selectedDate})`
      : data.exportRange === "week"
      ? "주간 플랜"
      : data.exportRange === "planGroup"
      ? "플랜 그룹"
      : "전체 플랜";

  lines.push(`# ${data.planner.name} - ${rangeLabel}`);
  lines.push("");

  // 학생 정보
  if (data.options.includeStudentInfo && data.student) {
    lines.push("## 학생 정보");
    lines.push("");
    lines.push(`- **이름**: ${data.student.name}`);
    if (data.student.grade) {
      lines.push(`- **학년**: ${data.student.grade}학년`);
    }
    if (data.student.school_name) {
      lines.push(`- **학교**: ${data.student.school_name}`);
    }
    lines.push("");
  }

  // 플래너 설정
  if (data.options.includePlannerSettings) {
    lines.push("## 플래너 설정");
    lines.push("");
    lines.push(
      `- **전체 기간**: ${data.planner.period_start} ~ ${data.planner.period_end}`
    );
    if (data.planner.default_scheduler_type) {
      lines.push(`- **스케줄러**: ${data.planner.default_scheduler_type}`);
    }
    if (data.planner.study_hours) {
      lines.push(
        `- **학습 시간대**: ${data.planner.study_hours.start} ~ ${data.planner.study_hours.end}`
      );
    }
    if (data.planner.self_study_hours) {
      lines.push(
        `- **자율학습 시간대**: ${data.planner.self_study_hours.start} ~ ${data.planner.self_study_hours.end}`
      );
    }
    if (data.planner.lunch_time) {
      lines.push(
        `- **점심 시간**: ${data.planner.lunch_time.start} ~ ${data.planner.lunch_time.end}`
      );
    }
    const schedulerOptions = data.planner.default_scheduler_options as {
      study_days?: number;
      review_days?: number;
    } | null;
    if (schedulerOptions) {
      if (schedulerOptions.study_days) {
        lines.push(`- **주당 학습일**: ${schedulerOptions.study_days}일`);
      }
      if (schedulerOptions.review_days) {
        lines.push(`- **주당 복습일**: ${schedulerOptions.review_days}일`);
      }
    }
    lines.push("");
  }

  // 학원 일정
  if (data.options.includeAcademySchedules && data.academySchedules.length > 0) {
    lines.push("## 학원 일정");
    lines.push("");
    lines.push("| 요일 | 시간 | 학원명 | 과목 |");
    lines.push("|------|------|--------|------|");
    for (const schedule of data.academySchedules) {
      lines.push(
        `| ${dayNames[schedule.day_of_week]} | ${schedule.start_time}-${schedule.end_time} | ${escapeCell(schedule.academy_name)} | ${escapeCell(schedule.subject)} |`
      );
    }
    lines.push("");
  }

  // 제외일
  if (data.options.includeExclusions && data.exclusions.length > 0) {
    lines.push("## 제외일 목록");
    lines.push("");
    lines.push("| 날짜 | 유형 | 사유 |");
    lines.push("|------|------|------|");
    for (const exc of data.exclusions) {
      lines.push(
        `| ${exc.exclusion_date} | ${escapeCell(exc.exclusion_type)} | ${escapeCell(exc.reason)} |`
      );
    }
    lines.push("");
  }

  // 플랜 그룹 목록 (플래너 전체 내보내기 시)
  if (data.exportRange === "planner" && data.planGroups.length > 0) {
    lines.push("## 플랜 그룹 목록");
    lines.push("");
    lines.push("| 그룹명 | 목적 | 기간 | 상태 |");
    lines.push("|--------|------|------|------|");
    for (const group of data.planGroups) {
      const statusLabel =
        group.status === "active"
          ? "진행중"
          : group.status === "completed"
          ? "완료"
          : group.status === "paused"
          ? "일시정지"
          : group.status;
      lines.push(
        `| ${escapeCell(group.name)} | ${escapeCell(group.plan_purpose)} | ${group.period_start} ~ ${group.period_end} | ${statusLabel} |`
      );
    }
    lines.push("");
  }

  // 분할 플랜의 part 정보 계산
  const partInfoMap = calculatePartInfo(data.plans);

  // 학습 스케줄
  lines.push("## 학습 스케줄");
  lines.push("");

  if (data.plans.length === 0) {
    lines.push("*해당 기간에 플랜이 없습니다.*");
    lines.push("");
  } else {
    // 날짜별로 그룹화
    const plansByDate = new Map<string, typeof data.plans>();
    for (const plan of data.plans) {
      const existing = plansByDate.get(plan.plan_date) || [];
      existing.push(plan);
      plansByDate.set(plan.plan_date, existing);
    }

    // 주차별로 그룹화
    const plansByWeek = new Map<number, Map<string, typeof data.plans>>();
    for (const [date, datePlans] of plansByDate) {
      const weekNum = datePlans[0].week || 1;
      if (!plansByWeek.has(weekNum)) {
        plansByWeek.set(weekNum, new Map());
      }
      plansByWeek.get(weekNum)!.set(date, datePlans);
    }

    // 주차별 출력
    const sortedWeeks = Array.from(plansByWeek.keys()).sort((a, b) => a - b);
    for (const weekNum of sortedWeeks) {
      const weekDates = plansByWeek.get(weekNum)!;
      const sortedDates = Array.from(weekDates.keys()).sort();

      if (data.exportRange !== "today") {
        lines.push(`### ${weekNum}주차`);
        lines.push(
          `*${sortedDates[0]} ~ ${sortedDates[sortedDates.length - 1]}*`
        );
        lines.push("");
      }

      lines.push("| 날짜 | 요일 | 시간 | 콘텐츠 | 범위 | 유형 | 상태 |");
      lines.push("|------|------|------|--------|------|------|------|");

      for (const date of sortedDates) {
        const datePlans = weekDates.get(date)!;
        const dayOfWeek = dayNames[new Date(date + "T00:00:00").getDay()];

        for (const plan of datePlans) {
          const content = data.contentMap.get(plan.content_id);
          const timeStr =
            plan.start_time && plan.end_time
              ? `${plan.start_time}-${plan.end_time}`
              : "-";

          // 범위 표시: content_type에 따라 포맷팅
          let rangeStr = "-";
          if (plan.planned_start_page_or_time != null && plan.planned_end_page_or_time != null) {
            const baseRange = formatPlanLearningAmount({
              content_type: content?.content_type || "book",
              planned_start_page_or_time: plan.planned_start_page_or_time,
              planned_end_page_or_time: plan.planned_end_page_or_time,
            });

            // 분할 플랜인 경우 (1/2), (2/2) 형식 추가
            const partInfo = partInfoMap.get(plan.id);
            if (plan.is_partial && partInfo) {
              rangeStr = `${baseRange} (${partInfo.partIndex}/${partInfo.totalParts})`;
            } else {
              rangeStr = baseRange;
            }
          }

          // 유형 표시: day_type이 "복습일"이면 복습, 아니면 학습
          // is_continued인 경우 [이어서] 표시
          let typeStr = plan.day_type === "복습일" ? "복습" : "학습";
          if (plan.is_continued) {
            typeStr = `[이어서] ${typeStr}`;
          }

          const statusStr =
            plan.status === "completed"
              ? "✅ 완료"
              : plan.status === "pending"
              ? "⬜ 미완료"
              : plan.status;

          lines.push(
            `| ${date} | ${dayOfWeek} | ${timeStr} | ${escapeCell(content?.title || plan.content_id)} | ${rangeStr} | ${typeStr} | ${statusStr} |`
          );
        }
      }
      lines.push("");
    }
  }

  // 통계
  if (data.options.includeStatistics && data.plans.length > 0) {
    lines.push("## 통계");
    lines.push("");

    // 날짜별 day_type 매핑
    const dateToType = new Map<string, string>();
    data.plans.forEach((p) => {
      if (p.day_type && !dateToType.has(p.plan_date)) {
        dateToType.set(p.plan_date, p.day_type);
      }
    });

    const uniqueDates = new Set(data.plans.map((p) => p.plan_date));
    const studyDates = new Set(
      [...uniqueDates].filter((d) => dateToType.get(d) === "학습일")
    );
    const reviewDates = new Set(
      [...uniqueDates].filter((d) => dateToType.get(d) === "복습일")
    );

    const completedPlans = data.plans.filter((p) => p.status === "completed");

    // 콘텐츠 타입별 통계
    let bookPages = 0;
    let lectureEpisodes = 0;
    let customItems = 0;
    let bookCount = 0;
    let lectureCount = 0;
    let customCount = 0;

    data.plans.forEach((p) => {
      const content = data.contentMap.get(p.content_id);
      const contentType = content?.content_type || "custom";
      const start = p.planned_start_page_or_time || 0;
      const end = p.planned_end_page_or_time || 0;
      const amount = Math.max(0, end - start + 1);

      switch (contentType) {
        case "book":
          bookPages += amount;
          bookCount++;
          break;
        case "lecture":
          lectureEpisodes += amount;
          lectureCount++;
          break;
        default:
          customItems += amount;
          customCount++;
          break;
      }
    });

    // 학습일 기준 일평균 (복습일 제외)
    const studyDayCount = studyDates.size || 1;

    lines.push("### 기간 요약");
    lines.push(
      `- **총 학습일**: ${uniqueDates.size}일 (학습 ${studyDates.size}일 + 복습 ${reviewDates.size}일)`
    );
    lines.push(`- **총 플랜 수**: ${data.plans.length}개`);
    lines.push(
      `- **완료율**: ${Math.round((completedPlans.length / data.plans.length) * 100)}% (${completedPlans.length}/${data.plans.length})`
    );
    lines.push("");

    lines.push("### 콘텐츠별 학습량");
    if (bookCount > 0) {
      lines.push(
        `- **교재**: ${bookPages}페이지 (${bookCount}개 플랜, 일평균 ${Math.round(bookPages / studyDayCount)}페이지)`
      );
    }
    if (lectureCount > 0) {
      lines.push(
        `- **인강**: ${lectureEpisodes}회차 (${lectureCount}개 플랜, 일평균 ${Math.round(lectureEpisodes / studyDayCount)}회차)`
      );
    }
    if (customCount > 0) {
      lines.push(`- **커스텀**: ${customItems}개 (${customCount}개 플랜)`);
    }
    lines.push("");
  }

  // 푸터
  lines.push("---");
  lines.push(
    `*생성일시: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}*`
  );

  return lines.join("\n");
}
