/**
 * 성적 대시보드 API 테스트용 더미 데이터 삭제 스크립트
 * 
 * 실행 방법:
 * npx tsx scripts/cleanupScoreDashboardDummy.ts
 * 
 * 삭제 순서:
 * 1. student_school_scores (더미학생% 이름의 학생들)
 * 2. student_mock_scores (더미학생% 이름의 학생들)
 * 3. students (이름이 '더미학생%'인 학생들)
 * 
 * 주의: 마스터 테이블(curriculum_revisions, subject_groups, subjects 등)은 삭제하지 않습니다.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";

// .env.local 파일 로드
config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ 환경 변수가 설정되지 않았습니다.");
  console.error("   NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  process.exit(1);
}

// RLS를 우회하기 위해 Service Role Key 사용
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const DUMMY_NAME_PATTERN = "더미학생%";

/**
 * 메인 함수
 */
async function main() {
  console.log("🗑️  성적 대시보드 API 테스트용 더미 데이터 삭제 시작\n");
  console.log(`   삭제 대상: 이름이 '${DUMMY_NAME_PATTERN}'인 학생들의 모든 관련 데이터\n`);

  try {
    // 먼저 더미 학생 ID 목록 조회
    const { data: dummyStudents, error: studentsError } = await supabase
      .from("students")
      .select("id, name")
      .like("name", DUMMY_NAME_PATTERN);

    if (studentsError) {
      console.error("❌ 더미 학생 조회 실패:", studentsError.message);
      process.exit(1);
    }

    if (!dummyStudents || dummyStudents.length === 0) {
      console.log("ℹ️  삭제할 더미 학생이 없습니다.");
      console.log("=".repeat(80) + "\n");
      return;
    }

    const studentIds = dummyStudents.map((s) => s.id);
    console.log(`📋 발견된 더미 학생: ${dummyStudents.length}명`);
    console.log(`   ${dummyStudents.map((s) => s.name).join(", ")}\n`);

    // 1. student_school_scores 삭제
    console.log("1️⃣ student_school_scores 삭제 중...");
    const { data: internalScores, error: internalError } = await supabase
      .from("student_school_scores")
      .select("id")
      .in("student_id", studentIds);

    if (internalError) {
      console.error("❌ 내신 성적 조회 실패:", internalError.message);
    } else {
      const count = internalScores?.length || 0;
      if (count > 0) {
        const { error: deleteError } = await supabase
          .from("student_school_scores")
          .delete()
          .in("student_id", studentIds);

        if (deleteError) {
          console.error("❌ 내신 성적 삭제 실패:", deleteError.message);
        } else {
          console.log(`✅ 내신 성적 ${count}개 삭제 완료`);
        }
      } else {
        console.log("ℹ️  삭제할 내신 성적이 없습니다.");
      }
    }

    // 2. student_mock_scores 삭제
    console.log("\n2️⃣ student_mock_scores 삭제 중...");
    const { data: mockScores, error: mockError } = await supabase
      .from("student_mock_scores")
      .select("id")
      .in("student_id", studentIds);

    if (mockError) {
      console.error("❌ 모의고사 성적 조회 실패:", mockError.message);
    } else {
      const count = mockScores?.length || 0;
      if (count > 0) {
        const { error: deleteError } = await supabase
          .from("student_mock_scores")
          .delete()
          .in("student_id", studentIds);

        if (deleteError) {
          console.error("❌ 모의고사 성적 삭제 실패:", deleteError.message);
        } else {
          console.log(`✅ 모의고사 성적 ${count}개 삭제 완료`);
        }
      } else {
        console.log("ℹ️  삭제할 모의고사 성적이 없습니다.");
      }
    }

    // 3. students 삭제
    console.log("\n4️⃣ students 삭제 중...");
    const { error: deleteError } = await supabase
      .from("students")
      .delete()
      .in("id", studentIds);

    if (deleteError) {
      console.error("❌ 학생 삭제 실패:", deleteError.message);
    } else {
      console.log(`✅ 학생 ${dummyStudents.length}명 삭제 완료`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("✨ 더미 데이터 삭제 완료!");
    console.log("=".repeat(80) + "\n");
  } catch (error: any) {
    console.error("❌ 오류 발생:", error.message);
    console.error(error);
    process.exit(1);
  }
}

// 스크립트 실행
main().catch((error) => {
  console.error("❌ 스크립트 실행 중 오류:", error);
  process.exit(1);
});

