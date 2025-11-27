/**
 * students 테이블의 학교 관련 컬럼 상태 확인 스크립트
 * 
 * 실행 방법:
 * npx tsx scripts/check-students-school-columns.ts
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

async function checkStudentsSchoolColumns() {
  console.log("🔍 students 테이블의 학교 관련 컬럼 상태 확인...\n");

  try {
    // 1. students 테이블 구조 확인
    console.log("=" .repeat(60));
    console.log("1️⃣ students 테이블 컬럼 구조 확인");
    console.log("=" .repeat(60));
    
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("id, name, school_id, grade")
      .limit(5);
    
    if (studentsError) {
      console.log("❌ students 테이블 조회 실패:", studentsError.message);
      
      // school_type 컬럼이 없어서 에러인지 확인
      if (studentsError.code === "42703" && studentsError.message?.includes("school_type")) {
        console.log("\n⚠️ school_type 컬럼이 없습니다. 마이그레이션을 실행해야 합니다.");
        console.log("   마이그레이션 파일: supabase/migrations/20251128000000_remove_schools_add_unified_view.sql");
      }
    } else {
      console.log(`✅ students 테이블 조회 성공 (샘플 ${students?.length || 0}개)`);
      
      if (students && students.length > 0) {
        console.log("\n📋 샘플 데이터:");
        students.forEach((s, i) => {
          console.log(`  [${i + 1}] ID: ${s.id}`);
          console.log(`      이름: ${s.name || "(없음)"}`);
          console.log(`      school_id: ${s.school_id || "(없음)"}`);
          console.log(`      school_id 타입: ${typeof s.school_id}`);
          console.log(`      학년: ${s.grade || "(없음)"}`);
          console.log("");
        });
      } else {
        console.log("⚠️ students 테이블이 비어있습니다.");
      }
    }

    // 2. school_id가 있는 학생 수 확인
    console.log("=" .repeat(60));
    console.log("2️⃣ school_id가 설정된 학생 수");
    console.log("=" .repeat(60));
    
    try {
      const { count, error: countError } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .not("school_id", "is", null);
      
      if (countError) {
        console.log("❌ 조회 실패:", countError.message);
      } else {
        console.log(`  school_id가 있는 학생: ${count ?? 0}명`);
      }
    } catch (e: any) {
      console.log("❌ 오류:", e.message);
    }

    // 3. school_id 형식 확인
    console.log("\n" + "=" .repeat(60));
    console.log("3️⃣ school_id 형식 확인");
    console.log("=" .repeat(60));
    
    try {
      const { data: schoolIds, error: schoolIdsError } = await supabase
        .from("students")
        .select("school_id")
        .not("school_id", "is", null)
        .limit(10);
      
      if (schoolIdsError) {
        console.log("❌ 조회 실패:", schoolIdsError.message);
      } else if (schoolIds && schoolIds.length > 0) {
        console.log("📋 school_id 샘플:");
        const uniqueIds = new Set(schoolIds.map(s => s.school_id));
        uniqueIds.forEach((id, i) => {
          const isUnifiedId = typeof id === "string" && (id.startsWith("SCHOOL_") || id.startsWith("UNIV_"));
          console.log(`  [${i + 1}] ${id} ${isUnifiedId ? "✅ (통합 ID)" : "⚠️ (기존 형식)"}`);
        });
      } else {
        console.log("⚠️ school_id가 설정된 학생이 없습니다.");
      }
    } catch (e: any) {
      console.log("❌ 오류:", e.message);
    }

    // 4. school_type 컬럼 존재 여부 확인
    console.log("\n" + "=" .repeat(60));
    console.log("4️⃣ school_type 컬럼 존재 여부 확인");
    console.log("=" .repeat(60));
    
    try {
      const { data: testData, error: testError } = await supabase
        .from("students")
        .select("school_type")
        .limit(1)
        .maybeSingle();
      
      if (testError && testError.code === "42703") {
        console.log("❌ school_type 컬럼이 없습니다.");
        console.log("   → 마이그레이션을 실행해야 합니다.");
        console.log("   → 파일: supabase/migrations/20251128000000_remove_schools_add_unified_view.sql");
      } else if (testError) {
        console.log("❌ 확인 실패:", testError.message);
      } else {
        console.log("✅ school_type 컬럼이 존재합니다.");
        
        // school_type이 설정된 학생 수 확인
        const { count: typeCount } = await supabase
          .from("students")
          .select("*", { count: "exact", head: true })
          .not("school_type", "is", null);
        
        console.log(`   school_type이 설정된 학생: ${typeCount ?? 0}명`);
      }
    } catch (e: any) {
      console.log("❌ 오류:", e.message);
    }

    // 5. schools 테이블 존재 여부 확인
    console.log("\n" + "=" .repeat(60));
    console.log("5️⃣ schools 테이블 존재 여부 확인");
    console.log("=" .repeat(60));
    
    try {
      const { data: schoolsData, error: schoolsError } = await supabase
        .from("schools")
        .select("id, name, type")
        .limit(1);
      
      if (schoolsError && schoolsError.code === "42P01") {
        console.log("✅ schools 테이블이 제거되었습니다. (예상된 상태)");
      } else if (schoolsError) {
        console.log("⚠️ schools 테이블 조회 오류:", schoolsError.message);
      } else {
        console.log("⚠️ schools 테이블이 아직 존재합니다.");
        console.log("   → 마이그레이션을 실행해야 합니다.");
      }
    } catch (e: any) {
      console.log("❌ 오류:", e.message);
    }

    console.log("\n✨ 확인 완료!");
    console.log("\n📝 다음 단계:");
    console.log("   1. 마이그레이션 SQL 실행: supabase/migrations/20251128000000_remove_schools_add_unified_view.sql");
    console.log("   2. Supabase Studio → SQL Editor에서 직접 실행");
    console.log("   3. 또는 Supabase CLI 연결 후: supabase db push");
    
  } catch (error: any) {
    console.error("❌ 스크립트 실행 중 오류:", error.message);
    process.exit(1);
  }
}

// 스크립트 실행
checkStudentsSchoolColumns().catch((error) => {
  console.error("❌ 스크립트 실행 중 오류:", error);
  process.exit(1);
});

