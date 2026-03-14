/**
 * 성적 대시보드 API 테스트 스크립트
 * 
 * 실행 방법:
 * npx tsx scripts/testScoreDashboard.ts [studentId] [tenantId] [termId]
 * 
 * 인자 없이 실행하면 사용 가능한 학생 목록을 표시합니다.
 * 
 * 예시:
 *   npx tsx scripts/testScoreDashboard.ts <studentId> <tenantId> <termId>
 * 
 * 더미 데이터 생성 후 테스트:
 *   1. npx tsx scripts/seedScoreDashboardDummy.ts (더미 데이터 생성)
 *   2. 출력된 Student ID, Tenant ID, Term ID를 사용하여 테스트
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";

// .env.local 파일 로드
config({ path: path.resolve(process.cwd(), ".env.local") });

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * API 호출 및 결과 출력
 */
async function testScoreDashboard(
  studentId: string,
  tenantId: string,
  grade?: string,
  semester?: string
) {
  // termId 계산
  let termId: string | null = null;

  if (grade && semester) {
    // grade, semester가 있으면 student_terms에서 termId 조회
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("❌ 환경 변수가 설정되지 않아 termId를 조회할 수 없습니다.");
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: termData, error: termError } = await supabase
      .from("student_terms")
      .select("id, grade, semester, school_year")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("grade", parseInt(grade))
      .eq("semester", parseInt(semester))
      .order("school_year", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (termError) {
      console.error("⚠️  student_terms 조회 실패:", termError.message);
    } else if (termData) {
      termId = termData.id;
      console.log(`✅ 학기 정보: ${termData.school_year}년 ${termData.grade}학년 ${termData.semester}학기 (Term ID: ${termId})`);
    }
  } else {
    // grade, semester가 없으면 최근 학기 조회
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("❌ 환경 변수가 설정되지 않아 termId를 조회할 수 없습니다.");
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: recentTerm, error: termError } = await supabase
      .from("student_terms")
      .select("id, grade, semester, school_year")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .order("school_year", { ascending: false })
      .order("grade", { ascending: false })
      .order("semester", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (termError) {
      console.error("⚠️  student_terms 조회 실패:", termError.message);
    } else if (recentTerm) {
      termId = recentTerm.id;
      console.log(`✅ 최근 학기 정보: ${recentTerm.school_year}년 ${recentTerm.grade}학년 ${recentTerm.semester}학기 (Term ID: ${termId})`);
    }
  }

  // API URL 구성
  const url = new URL(
    `/api/students/${studentId}/score-dashboard`,
    BASE_URL
  );
  url.searchParams.set("tenantId", tenantId);
  if (termId) {
    url.searchParams.set("termId", termId);
  } else if (grade && semester) {
    // termId를 찾지 못했지만 grade, semester가 있으면 그대로 전달
    url.searchParams.set("grade", grade);
    url.searchParams.set("semester", semester);
  }

  console.log(`\n🔍 API 호출: ${url.toString()}\n`);

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error("❌ API 호출 실패:");
      console.error(`   Status: ${response.status}`);
      console.error(`   Error: ${JSON.stringify(data, null, 2)}`);
      return;
    }

    console.log("=".repeat(80));
    console.log("📊 성적 대시보드 API 응답");
    console.log("=".repeat(80) + "\n");

    // 학생 프로필
    console.log("👤 학생 프로필:");
    console.log(`   ID: ${data.studentProfile?.id}`);
    console.log(`   이름: ${data.studentProfile?.name}`);
    console.log(`   학년: ${data.studentProfile?.grade || "N/A"}`);
    console.log(`   학교 유형: ${data.studentProfile?.schoolType || "N/A"}`);
    console.log("");

    // 내신 분석
    console.log("📚 내신 분석:");
    console.log(`   전체 GPA: ${data.internalAnalysis?.totalGpa?.toFixed(2) || "N/A"}`);
    console.log(`   Z-Index: ${data.internalAnalysis?.zIndex?.toFixed(2) || "N/A"}`);
    console.log("   교과군별 GPA:");
    if (data.internalAnalysis?.subjectStrength) {
      for (const [subject, gpa] of Object.entries(
        data.internalAnalysis.subjectStrength
      )) {
        console.log(`     - ${subject}: ${Number(gpa).toFixed(2)}`);
      }
    }
    console.log("");

    // 모의고사 분석
    console.log("📝 모의고사 분석:");
    if (data.mockAnalysis?.recentExam) {
      console.log(
        `   최근 시험: ${data.mockAnalysis.recentExam.examTitle} (${data.mockAnalysis.recentExam.examDate})`
      );
    } else {
      console.log("   최근 시험: N/A");
    }
    console.log(
      `   평균 백분위: ${data.mockAnalysis?.avgPercentile?.toFixed(2) || "N/A"}`
    );
    console.log(
      `   표준점수 합: ${data.mockAnalysis?.totalStdScore?.toFixed(2) || "N/A"}`
    );
    console.log(
      `   상위 3개 등급 합: ${data.mockAnalysis?.best3GradeSum || "N/A"}`
    );
    console.log("");

    // 전략 분석
    console.log("🎯 수시/정시 전략 분석:");
    console.log(`   전략 유형: ${data.strategyResult?.type || "N/A"}`);
    console.log(`   메시지: ${data.strategyResult?.message || "N/A"}`);
    if (data.strategyResult?.data) {
      console.log("   데이터:");
      console.log(
        `     - 내신 환산 백분위: ${data.strategyResult.data.internalPct?.toFixed(2) || "N/A"}`
      );
      console.log(
        `     - 모의고사 평균 백분위: ${data.strategyResult.data.mockPct?.toFixed(2) || "N/A"}`
      );
      console.log(
        `     - 차이: ${data.strategyResult.data.diff?.toFixed(2) || "N/A"}`
      );
    }
    console.log("");

    console.log("=".repeat(80));
    console.log("✅ API 테스트 완료!");
    console.log("=".repeat(80) + "\n");
  } catch (error: any) {
    console.error("❌ API 호출 중 오류:", error.message);
    console.error(error);
  }
}

/**
 * 데이터베이스에서 사용 가능한 학생 목록 조회
 */
async function listAvailableStudents() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.log("⚠️  환경 변수가 설정되지 않아 학생 목록을 조회할 수 없습니다.");
    console.log("   NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.\n");
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 학생 목록 조회 (더미학생% 필터, 최근 10명)
    const { data: students, error } = await supabase
      .from("students")
      .select("id, tenant_id, grade, user_profiles!inner(name)")
      .like("user_profiles.name", "더미학생%")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.log("⚠️  학생 목록 조회 실패:", error.message);
      return;
    }

    if (!students || students.length === 0) {
      console.log("📋 사용 가능한 학생이 없습니다.");
      console.log("   더미 데이터를 생성하려면: npx tsx scripts/seedScoreDashboardDummy.ts\n");
      return;
    }

    console.log("📋 사용 가능한 학생 목록 (최근 10명):\n");
    
    for (const student of students) {
      // 학생의 최근 학기 정보 조회 (student_terms 테이블 사용)
      const { data: termData, error: termError } = await supabase
        .from("student_terms")
        .select("id, school_year, grade, semester")
        .eq("tenant_id", student.tenant_id)
        .eq("student_id", student.id)
        .order("school_year", { ascending: false })
        .order("semester", { ascending: false })
        .limit(1);

      let termInfo: string;
      let termId: string | null = null;
      let grade: number | null = null;
      let semester: number | null = null;

      if (termError) {
        console.log(`     ⚠️  학기 정보 조회 오류: ${termError.message}`);
        termInfo = "학기 정보 없음";
      } else if (termData && termData.length > 0) {
        const term = termData[0];
        termId = term.id;
        grade = term.grade;
        semester = term.semester;
        termInfo = `${term.school_year}년 ${term.grade}학년 ${term.semester}학기 (Term ID: ${term.id})`;
      } else {
        termInfo = "학기 정보 없음";
      }

      console.log(`  👤 ${student.name || "이름 없음"} (ID: ${student.id})`);
      console.log(`     - Tenant ID: ${student.tenant_id || "없음"}`);
      console.log(`     - 학기: ${termInfo}`);
      if (termId && grade !== null && semester !== null) {
        console.log(`     - 테스트 명령어:`);
        console.log(`       npx tsx scripts/testScoreDashboard.ts ${student.id} ${student.tenant_id || ""} ${grade} ${semester}`);
      }
      console.log("");
    }

    console.log("💡 더미 데이터 생성:");
    console.log("   npx tsx scripts/seedScoreDashboardDummy.ts\n");
  } catch (error: any) {
    console.log("⚠️  학생 목록 조회 중 오류:", error.message);
  }
}

/**
 * 특정 학생의 학기 정보 조회
 */
async function getStudentTermInfo(studentId: string, tenantId: string) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.log("⚠️  환경 변수가 설정되지 않아 학기 정보를 조회할 수 없습니다.");
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: termData, error: termError } = await supabase
      .from("student_terms")
      .select("id, school_year, grade, semester")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .order("school_year", { ascending: false })
      .order("semester", { ascending: false })
      .limit(1);

    if (termError) {
      console.log(`⚠️  학기 정보 조회 오류: ${termError.message}`);
      return null;
    }

    if (!termData || termData.length === 0) {
      return null;
    }

    return termData[0];
  } catch (error: any) {
    console.log(`⚠️  학기 정보 조회 중 오류: ${error.message}`);
    return null;
  }
}

/**
 * 메인 함수
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("📝 성적 대시보드 API 테스트 스크립트\n");
    console.log("사용법:");
    console.log("  npx tsx scripts/testScoreDashboard.ts <studentId> <tenantId> [grade] [semester]\n");
    console.log("예시:");
    console.log("  npx tsx scripts/testScoreDashboard.ts <studentId> <tenantId> 2 1\n");
    console.log("테스트 데이터 예시:");
    console.log("  npx tsx scripts/testScoreDashboard.ts fd0854f1-1f6a-45bb-9743-5c389e754caf 84b71a5d-5681-4da3-88d2-91e75ef89015\n");
    console.log("=".repeat(80) + "\n");
    
    await listAvailableStudents();
    
    console.log("=".repeat(80));
    process.exit(1);
  }

  const [studentId, tenantId, grade, semester] = args;

  if (!studentId || !tenantId) {
    console.error("❌ studentId와 tenantId는 필수입니다.");
    process.exit(1);
  }

  // testScoreDashboard 함수 내부에서 termId를 계산하므로 여기서는 바로 호출
  await testScoreDashboard(studentId, tenantId, grade, semester);
}

// 스크립트 실행
main().catch((error) => {
  console.error("❌ 스크립트 실행 중 오류:", error);
  process.exit(1);
});

