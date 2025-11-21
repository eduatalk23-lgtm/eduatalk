/**
 * 더미 성적 데이터 생성 스크립트
 * 사용법: npx tsx scripts/generate-dummy-scores.ts
 */

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// .env.local 파일 로드
config({ path: resolve(process.cwd(), ".env.local") });

// 환경 변수 직접 읽기
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ 환경 변수가 설정되지 않았습니다.");
  console.error("   .env.local 파일에 다음 변수가 필요합니다:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  console.error("   - NEXT_PUBLIC_SUPABASE_ANON_KEY");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY (선택사항, 권장)");
  process.exit(1);
}

// 서비스 키가 있으면 사용, 없으면 anon key 사용
const supabaseKey = supabaseServiceKey || supabaseAnonKey;

const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const STUDENT_EMAIL = "ghkdwp2282@naver.com";

// 과목 그룹 및 과목 정의
const SUBJECT_GROUPS = {
  국어: ["언어와 매체", "화법과 작문", "문학"],
  수학: ["수학Ⅰ", "수학Ⅱ", "확률과 통계", "미적분"],
  영어: ["영어"],
  한국사: ["한국사"],
  사회: ["한국지리", "세계지리", "생활과 윤리", "윤리와 사상"],
  과학: ["물리학Ⅰ", "화학Ⅰ", "생명과학Ⅰ", "지구과학Ⅰ"],
};

// 모의고사 과목 (탐구 영역)
const MOCK_SUBJECTS = {
  사회: ["한국지리", "세계지리", "생활과 윤리", "윤리와 사상"],
  과학: ["물리학Ⅰ", "화학Ⅰ", "생명과학Ⅰ", "지구과학Ⅰ"],
};

// 모의고사 시험 유형
const EXAM_TYPES = ["평가원", "교육청", "사설"] as const;
const EXAM_ROUNDS = ["3월", "4월", "6월", "9월", "11월"] as const;

/**
 * 랜덤 숫자 생성 (min ~ max)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 랜덤 소수 생성 (min ~ max, 소수점 1자리)
 */
function randomFloat(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

/**
 * 원점수로 등급 계산 (1등급 ~ 9등급)
 */
function calculateGrade(rawScore: number): number {
  if (rawScore >= 90) return randomInt(1, 2);
  if (rawScore >= 80) return randomInt(2, 3);
  if (rawScore >= 70) return randomInt(3, 4);
  if (rawScore >= 60) return randomInt(4, 5);
  if (rawScore >= 50) return randomInt(5, 6);
  if (rawScore >= 40) return randomInt(6, 7);
  if (rawScore >= 30) return randomInt(7, 8);
  return randomInt(8, 9);
}

/**
 * 원점수로 백분위 계산
 */
function calculatePercentile(rawScore: number): number {
  // 원점수가 높을수록 백분위도 높음 (대략적인 관계)
  const basePercentile = (rawScore / 100) * 100;
  // ±5% 랜덤 변동
  const variation = randomFloat(-5, 5);
  return Math.max(0, Math.min(100, Math.round(basePercentile + variation)));
}

/**
 * 날짜 생성 (YYYY-MM-DD)
 */
function generateDate(year: number, month: number, day?: number): string {
  const m = String(month).padStart(2, "0");
  const d = day ? String(day).padStart(2, "0") : String(randomInt(1, 28)).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

async function main() {
  console.log("🚀 더미 성적 데이터 생성 시작...\n");

  // 1. 이메일로 사용자 ID 찾기
  console.log(`📧 이메일로 사용자 찾기: ${STUDENT_EMAIL}`);
  
  let userId: string;
  
  // 서비스 키가 있으면 admin API 사용
  if (supabaseServiceKey) {
    const {
      data: { users },
      error: userError,
    } = await supabase.auth.admin.listUsers();

    if (userError) {
      console.error("❌ 사용자 조회 실패:", userError);
      process.exit(1);
    }

    const user = users.find((u) => u.email === STUDENT_EMAIL);
    if (!user) {
      console.error(`❌ 이메일 ${STUDENT_EMAIL}에 해당하는 사용자를 찾을 수 없습니다.`);
      process.exit(1);
    }

    userId = user.id;
    console.log(`✅ 사용자 찾음: ${userId} (${user.email})\n`);
  } else {
    // 서비스 키가 없으면 auth.users 테이블에서 직접 조회 (RLS 우회 필요)
    const { data: authUser, error: authError } = await supabase
      .from("auth.users")
      .select("id")
      .eq("email", STUDENT_EMAIL)
      .single();

    if (authError || !authUser) {
      // 대안: students 테이블에서 이메일로 찾기 (만약 이메일이 저장되어 있다면)
      console.log("⚠️  Auth 테이블 직접 조회 실패, students 테이블에서 조회 시도...");
      
      // students 테이블에는 이메일이 없으므로, 다른 방법 필요
      // 일단 사용자에게 직접 student_id를 입력받도록 안내
      console.error(`❌ 이메일 ${STUDENT_EMAIL}에 해당하는 사용자를 찾을 수 없습니다.`);
      console.error("💡 해결 방법:");
      console.error("   1. .env.local에 SUPABASE_SERVICE_ROLE_KEY를 추가하거나");
      console.error("   2. 스크립트를 수정하여 student_id를 직접 입력하도록 변경하세요.");
      process.exit(1);
    }

    userId = authUser.id;
    console.log(`✅ 사용자 찾음: ${userId}\n`);
  }

  // 2. 학생 정보 확인
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, tenant_id, grade")
    .eq("id", userId)
    .single();

  if (studentError || !student) {
    console.error("❌ 학생 정보를 찾을 수 없습니다:", studentError);
    process.exit(1);
  }

  console.log(`✅ 학생 정보 확인: ${student.id}`);
  console.log(`   - Tenant ID: ${student.tenant_id}`);
  console.log(`   - 학년: ${student.grade || "미설정"}\n`);

  const studentId = student.id;
  const currentYear = new Date().getFullYear();

  // 3. 내신 성적 데이터 생성
  console.log("📚 내신 성적 데이터 생성 중...");
  const schoolScores = [];

  // 최근 2년간의 내신 성적 생성
  for (let yearOffset = 0; yearOffset < 2; yearOffset++) {
    const year = currentYear - yearOffset;
    
    // 1학기, 2학기
    for (const semester of [1, 2]) {
      // 각 과목 그룹별로 성적 생성
      for (const [subjectGroup, subjects] of Object.entries(SUBJECT_GROUPS)) {
        for (const subjectName of subjects) {
          const rawScore = randomInt(60, 95);
          const gradeScore = calculateGrade(rawScore);

          schoolScores.push({
            student_id: userId,
            tenant_id: student.tenant_id,
            grade: yearOffset === 0 ? (student.grade || 2) : (student.grade || 2) - 1,
            semester,
            subject_group: subjectGroup,
            subject_type: subjectGroup === "한국사" ? "필수" : "공통",
            subject_name: subjectName,
            raw_score: rawScore,
            grade_score: gradeScore,
          });
        }
      }
    }
  }

  // 내신 성적 삽입
  const { error: schoolError } = await supabase
    .from("student_school_scores")
    .insert(schoolScores);

  if (schoolError) {
    console.error("❌ 내신 성적 삽입 실패:", schoolError);
  } else {
    console.log(`✅ 내신 성적 ${schoolScores.length}개 생성 완료\n`);
  }

  // 4. 모의고사 성적 데이터 생성
  console.log("📝 모의고사 성적 데이터 생성 중...");
  const mockScores = [];

  // 최근 2년간의 모의고사 성적 생성
  for (let yearOffset = 0; yearOffset < 2; yearOffset++) {
    const year = currentYear - yearOffset;
    const grade = yearOffset === 0 ? (student.grade || 2) : (student.grade || 2) - 1;

    // 각 시험 유형별로
    for (const examType of EXAM_TYPES) {
      // 각 회차별로
      for (const examRound of EXAM_ROUNDS) {
        // 국어, 수학, 영어
        for (const subjectGroup of ["국어", "수학", "영어"]) {
          const subjectName = subjectGroup === "국어" ? "언어와 매체" : subjectGroup === "수학" ? "수학Ⅰ" : "영어";
          const rawScore = randomInt(70, 95);
          const percentile = calculatePercentile(rawScore);
          const gradeScore = calculateGrade(rawScore);

          // 시험 날짜 생성 (회차에 따라)
          let testDate: string;
          if (examRound === "3월") testDate = generateDate(year, 3);
          else if (examRound === "4월") testDate = generateDate(year, 4);
          else if (examRound === "6월") testDate = generateDate(year, 6);
          else if (examRound === "9월") testDate = generateDate(year, 9);
          else testDate = generateDate(year, 11);

          mockScores.push({
            student_id: userId,
            tenant_id: student.tenant_id,
            grade,
            subject_group: subjectGroup,
            subject_name: subjectName,
            exam_type: examType,
            exam_round: examRound,
            raw_score: rawScore,
            percentile,
            grade_score: gradeScore,
            test_date: testDate,
          });
        }

        // 탐구 영역 (사회 또는 과학 중 랜덤 선택)
        const exploreGroup = Math.random() > 0.5 ? "사회" : "과학";
        const exploreSubjects = MOCK_SUBJECTS[exploreGroup];
        const selectedSubject = exploreSubjects[randomInt(0, exploreSubjects.length - 1)];

        const rawScore = randomInt(65, 95);
        const percentile = calculatePercentile(rawScore);
        const gradeScore = calculateGrade(rawScore);

        let testDate: string;
        if (examRound === "3월") testDate = generateDate(year, 3);
        else if (examRound === "4월") testDate = generateDate(year, 4);
        else if (examRound === "6월") testDate = generateDate(year, 6);
        else if (examRound === "9월") testDate = generateDate(year, 9);
        else testDate = generateDate(year, 11);

        mockScores.push({
          student_id: userId,
          tenant_id: student.tenant_id,
          grade,
          subject_group: exploreGroup,
          subject_name: selectedSubject,
          exam_type: examType,
          exam_round: examRound,
          raw_score: rawScore,
          percentile,
          grade_score: gradeScore,
          test_date: testDate,
        });
      }
    }
  }

  // 모의고사 성적 삽입
  const { error: mockError } = await supabase
    .from("student_mock_scores")
    .insert(mockScores);

  if (mockError) {
    console.error("❌ 모의고사 성적 삽입 실패:", mockError);
  } else {
    console.log(`✅ 모의고사 성적 ${mockScores.length}개 생성 완료\n`);
  }

  console.log("🎉 더미 데이터 생성 완료!");
  console.log(`   - 내신 성적: ${schoolScores.length}개`);
  console.log(`   - 모의고사 성적: ${mockScores.length}개`);
}

main().catch((error) => {
  console.error("❌ 스크립트 실행 실패:", error);
  process.exit(1);
});

