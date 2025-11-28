/**
 * 성적 대시보드 API 테스트용 더미 데이터 삭제 스크립트
 * 
 * 실행 방법:
 * npx tsx scripts/cleanupScoreDashboardDummy.ts
 * 
 * 삭제 순서:
 * 1. student_internal_scores (notes = 'DUMMY_SCORE_TEST')
 * 2. student_mock_scores (notes = 'DUMMY_SCORE_TEST')
 * 3. student_terms (notes = 'DUMMY_SCORE_TEST')
 * 4. students (memo = 'DUMMY_SCORE_TEST')
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";

// .env.local 파일 로드
config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ 환경 변수가 설정되지 않았습니다.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const DUMMY_TAG = "DUMMY_SCORE_TEST";

/**
 * 메인 함수
 */
async function main() {
  console.log("🗑️  성적 대시보드 API 테스트용 더미 데이터 삭제 시작\n");

  try {
    // 1. student_internal_scores 삭제
    console.log("1️⃣ student_internal_scores 삭제 중...");
    const { data: internalScores, error: internalError } = await supabase
      .from("student_internal_scores")
      .select("id")
      .eq("notes", DUMMY_TAG);

    if (internalError) {
      console.error("❌ 내신 성적 조회 실패:", internalError.message);
    } else {
      const count = internalScores?.length || 0;
      if (count > 0) {
        const { error: deleteError } = await supabase
          .from("student_internal_scores")
          .delete()
          .eq("notes", DUMMY_TAG);

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
      .eq("notes", DUMMY_TAG);

    if (mockError) {
      console.error("❌ 모의고사 성적 조회 실패:", mockError.message);
    } else {
      const count = mockScores?.length || 0;
      if (count > 0) {
        const { error: deleteError } = await supabase
          .from("student_mock_scores")
          .delete()
          .eq("notes", DUMMY_TAG);

        if (deleteError) {
          console.error("❌ 모의고사 성적 삭제 실패:", deleteError.message);
        } else {
          console.log(`✅ 모의고사 성적 ${count}개 삭제 완료`);
        }
      } else {
        console.log("ℹ️  삭제할 모의고사 성적이 없습니다.");
      }
    }

    // 3. student_terms 삭제
    console.log("\n3️⃣ student_terms 삭제 중...");
    const { data: terms, error: termsError } = await supabase
      .from("student_terms")
      .select("id")
      .eq("notes", DUMMY_TAG);

    if (termsError) {
      console.error("❌ 학생 학기 조회 실패:", termsError.message);
    } else {
      const count = terms?.length || 0;
      if (count > 0) {
        const { error: deleteError } = await supabase
          .from("student_terms")
          .delete()
          .eq("notes", DUMMY_TAG);

        if (deleteError) {
          console.error("❌ 학생 학기 삭제 실패:", deleteError.message);
        } else {
          console.log(`✅ 학생 학기 ${count}개 삭제 완료`);
        }
      } else {
        console.log("ℹ️  삭제할 학생 학기가 없습니다.");
      }
    }

    // 4. students 삭제
    console.log("\n4️⃣ students 삭제 중...");
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("id, name")
      .eq("memo", DUMMY_TAG);

    if (studentsError) {
      console.error("❌ 학생 조회 실패:", studentsError.message);
    } else {
      const count = students?.length || 0;
      if (count > 0) {
        console.log(`   삭제할 학생: ${students.map((s) => s.name).join(", ")}`);

        const { error: deleteError } = await supabase
          .from("students")
          .delete()
          .eq("memo", DUMMY_TAG);

        if (deleteError) {
          console.error("❌ 학생 삭제 실패:", deleteError.message);
        } else {
          console.log(`✅ 학생 ${count}명 삭제 완료`);
        }
      } else {
        console.log("ℹ️  삭제할 학생이 없습니다.");
      }
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

