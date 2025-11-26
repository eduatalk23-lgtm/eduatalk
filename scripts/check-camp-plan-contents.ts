/**
 * 캠프 플랜 그룹 콘텐츠 데이터 검증 스크립트
 * 
 * 사용법:
 * npx tsx scripts/check-camp-plan-contents.ts <groupId>
 * 
 * 예시:
 * npx tsx scripts/check-camp-plan-contents.ts "123e4567-e89b-12d3-a456-426614174000"
 */

import { createSupabaseServerClient } from "../lib/supabase/server";

async function checkCampPlanContents(groupId: string) {
  const supabase = await createSupabaseServerClient();

  console.log("=".repeat(80));
  console.log(`캠프 플랜 그룹 콘텐츠 데이터 검증`);
  console.log(`플랜 그룹 ID: ${groupId}`);
  console.log("=".repeat(80));
  console.log();

  // 1. 플랜 그룹 정보 조회
  const { data: group, error: groupError } = await supabase
    .from("plan_groups")
    .select("id, name, student_id, plan_type, camp_template_id")
    .eq("id", groupId)
    .maybeSingle();

  if (groupError) {
    console.error("❌ 플랜 그룹 조회 실패:", groupError);
    process.exit(1);
  }

  if (!group) {
    console.error(`❌ 플랜 그룹을 찾을 수 없습니다: ${groupId}`);
    process.exit(1);
  }

  if (group.plan_type !== "camp") {
    console.warn(`⚠️  이 플랜 그룹은 캠프 모드가 아닙니다: ${group.plan_type}`);
  }

  console.log("📋 플랜 그룹 정보:");
  console.log(`  - 이름: ${group.name || "(이름 없음)"}`);
  console.log(`  - 학생 ID: ${group.student_id}`);
  console.log(`  - 플랜 타입: ${group.plan_type}`);
  console.log(`  - 캠프 템플릿 ID: ${group.camp_template_id || "(없음)"}`);
  console.log();

  // 2. plan_contents 조회
  const { data: planContents, error: contentsError } = await supabase
    .from("plan_contents")
    .select("id, content_type, content_id, start_range, end_range, display_order")
    .eq("plan_group_id", groupId)
    .order("display_order", { ascending: true });

  if (contentsError) {
    console.error("❌ plan_contents 조회 실패:", contentsError);
    process.exit(1);
  }

  if (!planContents || planContents.length === 0) {
    console.warn("⚠️  plan_contents에 콘텐츠가 없습니다.");
    process.exit(0);
  }

  console.log(`📚 plan_contents 조회 결과: ${planContents.length}개`);
  console.log();

  // 3. 콘텐츠 타입별 분류
  const books = planContents.filter((c) => c.content_type === "book");
  const lectures = planContents.filter((c) => c.content_type === "lecture");
  const custom = planContents.filter((c) => c.content_type === "custom");

  console.log("📊 콘텐츠 타입별 분류:");
  console.log(`  - 교재(book): ${books.length}개`);
  console.log(`  - 강의(lecture): ${lectures.length}개`);
  console.log(`  - 커스텀(custom): ${custom.length}개`);
  console.log();

  // 4. 각 타입별로 실제 테이블에서 조회
  const studentId = group.student_id;

  // 4-1. 교재 조회
  if (books.length > 0) {
    const bookIds = books.map((b) => b.content_id);
    const { data: studentBooks, error: booksError } = await supabase
      .from("books")
      .select("id, title, subject, master_content_id, student_id")
      .in("id", bookIds)
      .eq("student_id", studentId);

    if (booksError) {
      console.error("❌ books 조회 실패:", booksError);
    } else {
      console.log("📖 학생 교재 조회 결과:");
      console.log(`  - 조회된 교재: ${studentBooks?.length || 0}개 / ${books.length}개`);

      const studentBooksMap = new Map(
        (studentBooks || []).map((b) => [b.id, b])
      );

      const missingBooks = books.filter((b) => !studentBooksMap.has(b.content_id));
      if (missingBooks.length > 0) {
        console.warn(`  ⚠️  찾을 수 없는 교재: ${missingBooks.length}개`);
        missingBooks.forEach((b) => {
          console.warn(`    - content_id: ${b.content_id}`);
        });
      }

      // master_content_id 확인
      const booksWithMaster = (studentBooks || []).filter((b) => b.master_content_id);
      if (booksWithMaster.length > 0) {
        console.log(`  - master_content_id가 있는 교재: ${booksWithMaster.length}개`);
        booksWithMaster.forEach((b) => {
          console.log(`    - ${b.title} (master_content_id: ${b.master_content_id})`);
        });
      }
      console.log();
    }

    // 마스터 교재 확인
    const { data: masterBooks, error: masterBooksError } = await supabase
      .from("master_books")
      .select("id, title, subject_category")
      .in("id", bookIds);

    if (!masterBooksError && masterBooks && masterBooks.length > 0) {
      console.log("📚 마스터 교재 조회 결과:");
      console.log(`  - 조회된 마스터 교재: ${masterBooks.length}개`);
      masterBooks.forEach((b) => {
        console.log(`    - ${b.title} (id: ${b.id})`);
      });
      console.log();
    }
  }

  // 4-2. 강의 조회
  if (lectures.length > 0) {
    const lectureIds = lectures.map((l) => l.content_id);
    const { data: studentLectures, error: lecturesError } = await supabase
      .from("lectures")
      .select("id, title, subject, master_content_id, student_id")
      .in("id", lectureIds)
      .eq("student_id", studentId);

    if (lecturesError) {
      console.error("❌ lectures 조회 실패:", lecturesError);
    } else {
      console.log("🎓 학생 강의 조회 결과:");
      console.log(`  - 조회된 강의: ${studentLectures?.length || 0}개 / ${lectures.length}개`);

      const studentLecturesMap = new Map(
        (studentLectures || []).map((l) => [l.id, l])
      );

      const missingLectures = lectures.filter((l) => !studentLecturesMap.has(l.content_id));
      if (missingLectures.length > 0) {
        console.warn(`  ⚠️  찾을 수 없는 강의: ${missingLectures.length}개`);
        missingLectures.forEach((l) => {
          console.warn(`    - content_id: ${l.content_id}`);
        });
      }

      // master_content_id 확인
      const lecturesWithMaster = (studentLectures || []).filter((l) => l.master_content_id);
      if (lecturesWithMaster.length > 0) {
        console.log(`  - master_content_id가 있는 강의: ${lecturesWithMaster.length}개`);
        lecturesWithMaster.forEach((l) => {
          console.log(`    - ${l.title} (master_content_id: ${l.master_content_id})`);
        });
      }
      console.log();
    }

    // 마스터 강의 확인
    const { data: masterLectures, error: masterLecturesError } = await supabase
      .from("master_lectures")
      .select("id, title, subject_category")
      .in("id", lectureIds);

    if (!masterLecturesError && masterLectures && masterLectures.length > 0) {
      console.log("🎬 마스터 강의 조회 결과:");
      console.log(`  - 조회된 마스터 강의: ${masterLectures.length}개`);
      masterLectures.forEach((l) => {
        console.log(`    - ${l.title} (id: ${l.id})`);
      });
      console.log();
    }
  }

  // 4-3. 커스텀 콘텐츠 조회
  if (custom.length > 0) {
    const customIds = custom.map((c) => c.content_id);
    const { data: customContents, error: customError } = await supabase
      .from("student_custom_contents")
      .select("id, title, content_type, student_id")
      .in("id", customIds)
      .eq("student_id", studentId);

    if (customError) {
      console.error("❌ student_custom_contents 조회 실패:", customError);
    } else {
      console.log("📝 커스텀 콘텐츠 조회 결과:");
      console.log(`  - 조회된 커스텀 콘텐츠: ${customContents?.length || 0}개 / ${custom.length}개`);

      const customContentsMap = new Map(
        (customContents || []).map((c) => [c.id, c])
      );

      const missingCustom = custom.filter((c) => !customContentsMap.has(c.content_id));
      if (missingCustom.length > 0) {
        console.warn(`  ⚠️  찾을 수 없는 커스텀 콘텐츠: ${missingCustom.length}개`);
        missingCustom.forEach((c) => {
          console.warn(`    - content_id: ${c.content_id}`);
        });
      }
      console.log();
    }
  }

  // 5. 요약
  console.log("=".repeat(80));
  console.log("📊 검증 요약");
  console.log("=".repeat(80));
  console.log(`플랜 그룹 ID: ${groupId}`);
  console.log(`학생 ID: ${studentId}`);
  console.log(`총 콘텐츠 수: ${planContents.length}개`);
  console.log(`  - 교재: ${books.length}개`);
  console.log(`  - 강의: ${lectures.length}개`);
  console.log(`  - 커스텀: ${custom.length}개`);
  console.log();
  console.log("✅ 검증 완료");
}

// 스크립트 실행
const groupId = process.argv[2];

if (!groupId) {
  console.error("사용법: npx tsx scripts/check-camp-plan-contents.ts <groupId>");
  process.exit(1);
}

checkCampPlanContents(groupId)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("스크립트 실행 실패:", error);
    process.exit(1);
  });

