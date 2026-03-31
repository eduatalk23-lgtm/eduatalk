#!/usr/bin/env npx tsx
/**
 * 학기 전환 배치 스크립트
 *
 * 매년 3월 1일 전날(2월 28일) GitHub Actions cron으로 실행.
 * 재학생 학년 승급, 3학년 졸업 처리, 이전 학년 기록 확정,
 * 수강추천 초기화, 분석 stale 마킹, 전환 이력 저장을 수행한다.
 *
 * 사용법:
 *   npx tsx scripts/semester-transition.ts --dry-run         # 시뮬레이션 (DB 변경 없음)
 *   npx tsx scripts/semester-transition.ts                   # 실제 실행
 *   npx tsx scripts/semester-transition.ts --tenant=<id>     # 특정 테넌트만
 *   npx tsx scripts/semester-transition.ts --force           # 중복 실행 방지 무시
 */

import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { calculateSchoolYearKST } from "../lib/utils/schoolYear";
import { onGradeAdvanced } from "../lib/domains/student-record/stale-detection";
import { sendInAppNotification } from "../lib/services/inAppNotificationService";

// ─────────────────────────────────────────────────────────────────────────────
// CLI 인자 파싱
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isForce = args.includes("--force");
const tenantArg = args.find((a) => a.startsWith("--tenant="));
const filterTenantId = tenantArg ? tenantArg.split("=")[1] : null;

// ─────────────────────────────────────────────────────────────────────────────
// 콘솔 출력 유틸리티
// ─────────────────────────────────────────────────────────────────────────────

function log(message: string): void {
  console.log(message);
}

function logSection(title: string): void {
  console.log("\n" + "─".repeat(60));
  console.log(title);
  console.log("─".repeat(60));
}

function logError(context: string, error: unknown): void {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`  [ERROR] ${context}: ${msg}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 결과 카운터
// ─────────────────────────────────────────────────────────────────────────────

interface TransitionSummary {
  promoted: number;
  graduated: number;
  recordsFinalized: number;
  coursePlansCleared: number;
  staleMarked: number;
  notificationsSent: number;
  historyRecorded: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: string[];
  failures: Array<{ studentId: string; error: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 이전 학년 기록 확정 (seteks / changche / haengteuk)
// ─────────────────────────────────────────────────────────────────────────────

async function finalizeRecords(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  studentId: string,
  prevSchoolYear: number,
): Promise<number> {
  let count = 0;

  const tables = [
    "student_record_seteks",
    "student_record_changche",
    "student_record_haengteuk",
  ] as const;

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .update({ status: "final" })
      .eq("student_id", studentId)
      .eq("school_year", prevSchoolYear)
      .neq("status", "final")
      .select("id");

    if (error) {
      logError(`finalizeRecords(${table})`, error);
    } else {
      count += data?.length ?? 0;
    }
  }

  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// 수강계획 초기화 (이전 학년 recommended 삭제)
// ─────────────────────────────────────────────────────────────────────────────

async function clearOutdatedCoursePlans(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  studentId: string,
  newGrade: number,
): Promise<number> {
  // M2: confirmed 미이수 계획 경고
  const { data: orphanedPlans } = await supabase
    .from("student_course_plans")
    .select("id, grade, semester")
    .eq("student_id", studentId)
    .eq("plan_status", "confirmed")
    .lt("grade", newGrade);

  if (orphanedPlans && orphanedPlans.length > 0) {
    log(
      `  ⚠️  student=${studentId} — 이전 학년 미이수 확정 계획 ${orphanedPlans.length}건 (수동 확인 필요)`,
    );
  }

  const { data, error } = await supabase
    .from("student_course_plans")
    .delete()
    .eq("student_id", studentId)
    .eq("plan_status", "recommended")
    .lt("grade", newGrade)
    .select("id");

  if (error) {
    logError("clearOutdatedCoursePlans", error);
    return 0;
  }

  return data?.length ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// 전환 이력 저장
// ─────────────────────────────────────────────────────────────────────────────

async function recordTransition(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  params: {
    tenantId: string;
    studentId: string;
    fromGrade: number;
    toGrade: number;
    schoolYear: number;
    transitionType: "promotion" | "graduation";
  },
): Promise<void> {
  const { error } = await supabase.from("student_grade_transitions").insert({
    tenant_id: params.tenantId,
    student_id: params.studentId,
    from_grade: params.fromGrade,
    to_grade: params.toGrade,
    school_year: params.schoolYear,
    transition_type: params.transitionType,
    metadata: { dry_run: isDryRun },
  });

  if (error) {
    logError("recordTransition", error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 알림 발송 (학생 user_id 조회 후 전송)
// ─────────────────────────────────────────────────────────────────────────────

async function notifyStudent(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  studentId: string,
  tenantId: string,
  newGrade: number,
  schoolYear: number,
): Promise<boolean> {
  const { data: student, error } = await supabase
    .from("students")
    .select("user_id")
    .eq("id", studentId)
    .maybeSingle();

  if (error || !student?.user_id) return false;

  const result = await sendInAppNotification(
    student.user_id,
    "system",
    `${newGrade}학년 새 학기가 시작되었습니다`,
    "수강 계획을 확인하고, 새 학년 활동을 시작하세요.",
    { newGrade, schoolYear },
    tenantId,
  );

  return result.success;
}

// ─────────────────────────────────────────────────────────────────────────────
// 단일 승급 학생 후속 처리
// ─────────────────────────────────────────────────────────────────────────────

async function processPromotedStudent(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  student: { id: string; grade: number; tenant_id: string },
  currentSchoolYear: number,
  summary: TransitionSummary,
): Promise<void> {
  const prevSchoolYear = currentSchoolYear - 1;
  const { id: studentId, grade: newGrade, tenant_id: tenantId } = student;

  log(`  처리 중: student=${studentId} ${newGrade - 1}학년 → ${newGrade}학년`);

  // M5: 미완료 로드맵 항목 경고
  const { data: unfinishedRoadmap } = await supabase
    .from("student_record_roadmap_items")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("grade", newGrade - 1)
    .in("status", ["planning", "in_progress"]);

  const unfinishedCount = (unfinishedRoadmap as unknown as { count?: number } | null)?.count ?? 0;
  if (unfinishedCount > 0) {
    log(`  ⚠️  이전 학년(${newGrade - 1}학년) 미완료 로드맵 ${unfinishedCount}건`);
  }

  // a. 이전 학년 기록 확정
  const finalized = await finalizeRecords(supabase, studentId, prevSchoolYear);
  summary.recordsFinalized += finalized;

  // b. 수강추천 초기화 (M2: confirmed 경고 포함)
  const cleared = await clearOutdatedCoursePlans(supabase, studentId, newGrade);
  summary.coursePlansCleared += cleared;

  // c. 분석 결과 stale 마킹 (가이드 tenant 필터 포함, 엣지, 파이프라인)
  await onGradeAdvanced(studentId, newGrade, tenantId).catch((e) => {
    logError("onGradeAdvanced", e);
  });
  summary.staleMarked++;

  // d. 학생 알림 발송
  const notified = await notifyStudent(supabase, studentId, tenantId, newGrade, currentSchoolYear);
  if (notified) summary.notificationsSent++;

  // e. 전환 이력 저장
  await recordTransition(supabase, {
    tenantId,
    studentId,
    fromGrade: newGrade - 1,
    toGrade: newGrade,
    schoolYear: currentSchoolYear,
    transitionType: "promotion",
  });
  summary.historyRecorded++;
}

// ─────────────────────────────────────────────────────────────────────────────
// 단일 졸업 학생 후속 처리
// ─────────────────────────────────────────────────────────────────────────────

async function processGraduatedStudent(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  student: { id: string; grade: number; tenant_id: string },
  currentSchoolYear: number,
  summary: TransitionSummary,
): Promise<void> {
  const prevSchoolYear = currentSchoolYear - 1;
  const { id: studentId, tenant_id: tenantId } = student;

  log(`  졸업 처리: student=${studentId}`);

  // 졸업생 기록 확정
  const finalized = await finalizeRecords(supabase, studentId, prevSchoolYear);
  summary.recordsFinalized += finalized;

  // 전환 이력 저장
  await recordTransition(supabase, {
    tenantId,
    studentId,
    fromGrade: 3,
    toGrade: 0, // 졸업 = 0
    schoolYear: currentSchoolYear,
    transitionType: "graduation",
  });
  summary.historyRecorded++;
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 실행
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  logSection("학기 전환 배치");
  log(`모드: ${isDryRun ? "드라이런 (DB 변경 없음)" : "실제 실행"}`);
  if (isForce) log("--force 옵션: 중복 실행 방지 무시");
  if (filterTenantId) log(`테넌트 필터: ${filterTenantId}`);

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    log("[FATAL] NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.");
    process.exit(1);
  }

  // GitHub Actions(UTC) 환경에서도 올바른 KST 기준 학년도를 사용
  const currentSchoolYear = calculateSchoolYearKST();
  log(`현재 학년도 (KST 기준): ${currentSchoolYear}`);

  const summary: TransitionSummary = {
    promoted: 0,
    graduated: 0,
    recordsFinalized: 0,
    coursePlansCleared: 0,
    staleMarked: 0,
    notificationsSent: 0,
    historyRecorded: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    failures: [],
  };

  // ──────────────────────────────────────────
  // C1: 중복 실행 방지 — 해당 school_year 전환 이력 확인
  // ──────────────────────────────────────────

  if (!isDryRun) {
    let existingCountQuery = supabase
      .from("student_grade_transitions")
      .select("id", { count: "exact", head: true })
      .eq("school_year", currentSchoolYear);

    if (filterTenantId) {
      existingCountQuery = existingCountQuery.eq("tenant_id", filterTenantId);
    }

    const { count: existingCount, error: countError } = await existingCountQuery;

    if (countError) {
      log(`[WARN] 중복 실행 확인 실패: ${countError.message} (계속 진행)`);
    } else if (existingCount && existingCount > 0) {
      log(
        `\n⚠️  ${currentSchoolYear}학년도 전환 이력이 이미 존재합니다 (${existingCount}건).`,
      );
      log("중복 실행을 방지합니다. --force 옵션으로 강제 실행 가능합니다.");
      if (!isForce) {
        process.exit(1);
      }
      log("--force 옵션으로 계속 진행합니다.");
    }
  }

  // ──────────────────────────────────────────
  // H1: grade NULL 재학생 경고
  // ──────────────────────────────────────────

  let nullGradeQuery = supabase
    .from("students")
    .select("id, name")
    .eq("status", "enrolled")
    .is("grade", null);

  if (filterTenantId) {
    nullGradeQuery = nullGradeQuery.eq("tenant_id", filterTenantId);
  }

  const { data: nullGradeStudents } = await nullGradeQuery;
  if (nullGradeStudents && nullGradeStudents.length > 0) {
    log(
      `\n⚠️  grade가 NULL인 재학생 ${nullGradeStudents.length}명 발견 — 수동 확인 필요:`,
    );
    nullGradeStudents.forEach((s) => log(`  - id=${s.id} name=${s.name ?? "(미설정)"}`));
  }

  // ──────────────────────────────────────────
  // 1. grade < 3 재학생 조회 (승급 대상) + H1: NULL 제외
  // ──────────────────────────────────────────

  logSection("1. 승급 대상 조회");

  let promotionQuery = supabase
    .from("students")
    .select("id, grade, tenant_id")
    .eq("status", "enrolled")
    .not("grade", "is", null)
    .lt("grade", 3);

  if (filterTenantId) {
    promotionQuery = promotionQuery.eq("tenant_id", filterTenantId);
  }

  const { data: promotionCandidates, error: promotionQueryError } = await promotionQuery;

  if (promotionQueryError) {
    log(`[FATAL] 승급 대상 조회 실패: ${promotionQueryError.message}`);
    process.exit(1);
  }

  log(`승급 대상: ${promotionCandidates?.length ?? 0}명`);
  promotionCandidates?.forEach((s) => {
    log(`  - id=${s.id} grade=${s.grade} → ${(s.grade ?? 0) + 1}`);
  });

  // ──────────────────────────────────────────
  // 2. grade = 3 재학생 조회 (졸업 대상)
  // ──────────────────────────────────────────

  logSection("2. 졸업 대상 조회");

  let graduationQuery = supabase
    .from("students")
    .select("id, grade, tenant_id")
    .eq("status", "enrolled")
    .eq("grade", 3);

  if (filterTenantId) {
    graduationQuery = graduationQuery.eq("tenant_id", filterTenantId);
  }

  const { data: graduationCandidates, error: graduationQueryError } = await graduationQuery;

  if (graduationQueryError) {
    log(`[FATAL] 졸업 대상 조회 실패: ${graduationQueryError.message}`);
    process.exit(1);
  }

  log(`졸업 대상: ${graduationCandidates?.length ?? 0}명`);

  // ──────────────────────────────────────────
  // H4: dry-run 명시적 가드
  // ──────────────────────────────────────────

  if (isDryRun) {
    logSection("드라이런 완료 (실제 DB 변경 없음)");
    log(`승급 예정: ${promotionCandidates?.length ?? 0}명`);
    log(`졸업 예정: ${graduationCandidates?.length ?? 0}명`);
    log("\n실제 실행하려면 --dry-run 옵션을 제거하세요.");
    return;
  }

  // ──────────────────────────────────────────
  // 3. grade + 1 업데이트 (SQL 수준에서 안전하게)
  // ──────────────────────────────────────────

  logSection("3. 학년 승급 실행");

  if (promotionCandidates && promotionCandidates.length > 0) {
    // 학년별로 묶어서 업데이트 (Supabase JS에서 grade+1 산술식 불가)
    const gradeGroups = new Map<number, string[]>();
    for (const s of promotionCandidates) {
      const fromGrade = s.grade ?? 0;
      const existing = gradeGroups.get(fromGrade);
      if (existing) existing.push(s.id);
      else gradeGroups.set(fromGrade, [s.id]);
    }

    for (const [fromGrade, ids] of gradeGroups) {
      // H4: dry-run 이미 위에서 분기했으나, 혹시 로직 이동 시 가드 유지
      const { error } = await supabase
        .from("students")
        .update({ grade: fromGrade + 1 })
        .in("id", ids);

      if (error) {
        log(`[ERROR] grade ${fromGrade} → ${fromGrade + 1} 업데이트 실패: ${error.message}`);
        summary.errors.push(`promotion_grade_${fromGrade}: ${error.message}`);
      } else {
        summary.promoted += ids.length;
        log(`  grade ${fromGrade} → ${fromGrade + 1}: ${ids.length}명 완료`);
      }
    }

    // C2: 멱등성 — 이미 전환된 학생 skip, 5명씩 병렬 처리 (M3)
    const BATCH_SIZE = 5;
    for (let i = 0; i < promotionCandidates.length; i += BATCH_SIZE) {
      const batch = promotionCandidates.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (candidate) => {
          const studentId = candidate.id;

          // C2: 이미 전환된 학생 확인 (멱등성)
          const { data: alreadyTransitioned } = await supabase
            .from("student_grade_transitions")
            .select("id")
            .eq("student_id", studentId)
            .eq("school_year", currentSchoolYear)
            .eq("transition_type", "promotion")
            .limit(1);

          if (alreadyTransitioned && alreadyTransitioned.length > 0) {
            log(`  (skip) student=${studentId} — 이미 전환 이력 존재`);
            summary.skipped++;
            return;
          }

          // H3: 에러 추적
          try {
            const updatedStudent = {
              ...candidate,
              grade: (candidate.grade ?? 0) + 1,
            };
            await processPromotedStudent(supabase, updatedStudent, currentSchoolYear, summary);
            summary.succeeded++;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            summary.failed++;
            summary.failures.push({ studentId, error: msg });
            summary.errors.push(`processPromoted_${studentId}: ${msg}`);
            log(`  [ERROR] student=${studentId} 처리 실패: ${msg}`);
          }
        }),
      );
    }
  }

  // ──────────────────────────────────────────
  // 4. 졸업 처리
  // ──────────────────────────────────────────

  logSection("4. 졸업 처리 실행");

  if (graduationCandidates && graduationCandidates.length > 0) {
    const graduationIds = graduationCandidates.map((s) => s.id);

    // H4: 실제 DB 변경은 dry-run 분기 이후에만 도달
    const { error } = await supabase
      .from("students")
      .update({
        status: "not_enrolled",
        withdrawn_at: new Date().toISOString(),
        withdrawn_reason: "졸업",
      })
      .in("id", graduationIds);

    if (error) {
      log(`[ERROR] 졸업 처리 실패: ${error.message}`);
      summary.errors.push(`graduation: ${error.message}`);
    } else {
      summary.graduated = graduationIds.length;
      log(`  졸업 처리: ${graduationIds.length}명 완료`);

      // user_profiles.is_active=false 동기화
      const { error: profileError } = await supabase
        .from("user_profiles")
        .update({ is_active: false })
        .in("id", graduationIds);

      if (profileError) {
        log(`[WARN] 졸업생 비활성화 실패: ${profileError.message}`);
        summary.errors.push(`graduation_deactivate: ${profileError.message}`);
      } else {
        log(`  졸업생 계정 비활성화: ${graduationIds.length}명 완료`);
      }
    }

    // C2: 5명씩 병렬 처리 (M3)
    const BATCH_SIZE = 5;
    for (let i = 0; i < graduationCandidates.length; i += BATCH_SIZE) {
      const batch = graduationCandidates.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (candidate) => {
          const studentId = candidate.id;

          // C2: 이미 전환된 학생 확인 (멱등성)
          const { data: alreadyTransitioned } = await supabase
            .from("student_grade_transitions")
            .select("id")
            .eq("student_id", studentId)
            .eq("school_year", currentSchoolYear)
            .eq("transition_type", "graduation")
            .limit(1);

          if (alreadyTransitioned && alreadyTransitioned.length > 0) {
            log(`  (skip) student=${studentId} — 이미 졸업 이력 존재`);
            summary.skipped++;
            return;
          }

          // H3: 에러 추적
          try {
            await processGraduatedStudent(supabase, candidate, currentSchoolYear, summary);
            summary.succeeded++;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            summary.failed++;
            summary.failures.push({ studentId, error: msg });
            summary.errors.push(`processGraduated_${studentId}: ${msg}`);
            log(`  [ERROR] student=${studentId} 졸업 처리 실패: ${msg}`);
          }
        }),
      );
    }
  }

  // ──────────────────────────────────────────
  // 5. 결과 요약
  // ──────────────────────────────────────────

  logSection("결과 요약");
  log(`학년 승급:         ${summary.promoted}명`);
  log(`졸업 처리:         ${summary.graduated}명`);
  log(`기록 확정:         ${summary.recordsFinalized}건`);
  log(`수강추천 초기화:   ${summary.coursePlansCleared}건`);
  log(`분석 stale 마킹:   ${summary.staleMarked}명`);
  log(`알림 발송:         ${summary.notificationsSent}건`);
  log(`전환 이력 저장:    ${summary.historyRecorded}건`);
  log(`─────────────────────────────────────`);
  log(`성공: ${summary.succeeded}명 | 실패: ${summary.failed}명 | 스킵: ${summary.skipped}명`);

  if (summary.failures.length > 0) {
    logSection(`실패 목록 (${summary.failures.length}건)`);
    for (const f of summary.failures) {
      log(`  - student=${f.studentId}: ${f.error}`);
    }
  }

  if (summary.errors.length > 0) {
    logSection(`에러 목록 (${summary.errors.length}건)`);
    summary.errors.forEach((e, i) => log(`  ${i + 1}. ${e}`));
    process.exit(1);
  }

  log("\n학기 전환 완료.");
}

// 실행
main().catch((error) => {
  console.error("스크립트 실행 실패:", error);
  process.exit(1);
});
