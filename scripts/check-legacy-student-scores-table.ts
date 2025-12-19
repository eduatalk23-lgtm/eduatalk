/**
 * 레거시 student_scores 테이블 상태 확인 스크립트
 * 
 * 이 스크립트는 student_scores 테이블의 존재 여부와 데이터를 확인합니다.
 */

import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

async function checkLegacyTable() {
  // 스크립트 실행 환경에서는 직접 클라이언트 생성
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("❌ Supabase 환경 변수가 설정되지 않았습니다.");
    console.error("   NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY가 필요합니다.");
    process.exit(1);
  }

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  console.log("=== 레거시 student_scores 테이블 상태 확인 ===\n");

  // 1. 테이블 존재 여부 확인 (직접 쿼리로 확인)
  const { data: testData, error: testError } = await supabase
    .from("student_scores")
    .select("id")
    .limit(1)
    .maybeSingle();
  
  if (testError && testError.code === "42P01") {
    console.log("✅ student_scores 테이블이 존재하지 않습니다.");
    console.log("   → 이미 제거되었거나 생성되지 않았습니다.\n");
    return;
  } else if (testError) {
    console.error("❌ 테이블 확인 중 오류:", testError.message);
    console.log("   → 테이블이 존재하지 않을 수 있습니다.\n");
    return;
  } else {
    console.log("⚠️  student_scores 테이블이 존재합니다.\n");
  }

  // 2. 데이터 개수 확인
  const { count, error: countError } = await supabase
    .from("student_scores")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("❌ 데이터 개수 확인 중 오류:", countError.message);
    return;
  }

  console.log(`📊 데이터 개수: ${count ?? 0}개\n`);

  if (count === 0) {
    console.log("✅ 테이블에 데이터가 없습니다.");
    console.log("   → 안전하게 제거할 수 있습니다.\n");
  } else {
    console.log("⚠️  테이블에 데이터가 있습니다.");
    console.log("   → 데이터 마이그레이션 확인이 필요합니다.\n");
    
    // 3. 샘플 데이터 확인
    const { data: sample, error: sampleError } = await supabase
      .from("student_scores")
      .select("*")
      .limit(5);

    if (!sampleError && sample && sample.length > 0) {
      console.log("📋 샘플 데이터 (최대 5개):");
      sample.forEach((row: any, index: number) => {
        console.log(`   ${index + 1}. ID: ${row.id}, 학생: ${row.student_id}, 과목: ${row.course ?? "없음"}`);
      });
      console.log();
    }
  }

  // 4. 외래 키 참조 확인
  console.log("🔗 외래 키 참조 확인:");
  console.log("   (Supabase 클라이언트로는 직접 확인이 어려우므로,");
  console.log("    데이터베이스에서 직접 확인하거나 마이그레이션 실행 시 자동 처리됩니다.)\n");

  // 5. 새 구조 데이터 확인
  console.log("📊 새 구조 데이터 확인 중...\n");
  
  const [internalCount, mockCount] = await Promise.all([
    supabase
      .from("student_internal_scores")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("student_mock_scores")
      .select("*", { count: "exact", head: true }),
  ]);

  console.log(`   내신 성적 (student_internal_scores): ${internalCount.count ?? 0}개`);
  console.log(`   모의고사 성적 (student_mock_scores): ${mockCount.count ?? 0}개\n`);

  // 6. 권장 사항
  console.log("💡 권장 사항:\n");
  
  if (count === 0) {
    console.log("   ✅ 테이블에 데이터가 없으므로 안전하게 제거할 수 있습니다.");
    console.log("   → 마이그레이션 파일 실행: supabase/migrations/20250204000000_remove_legacy_student_scores_table.sql\n");
  } else {
    console.log("   ⚠️  테이블에 데이터가 있습니다.");
    console.log("   → 다음 단계를 수행하세요:");
    console.log("     1. 데이터가 새 구조로 마이그레이션되었는지 확인");
    console.log("     2. 데이터 백업 생성");
    console.log("     3. 마이그레이션 파일 실행\n");
  }
}

// 스크립트 실행
checkLegacyTable()
  .then(() => {
    console.log("✅ 확인 완료");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ 오류 발생:", error);
    process.exit(1);
  });
