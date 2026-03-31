/**
 * 2026 학생 일괄 임포트 스크립트
 *
 * 사용법:
 *   npx tsx scripts/import-students-2026.ts --dry-run   # 미리보기 (DB 변경 없음)
 *   npx tsx scripts/import-students-2026.ts              # 실제 임포트
 *
 * 작업 내용:
 *   1. students 테이블에 학생 레코드 생성
 *   2. user_profiles 자동 생성 (트리거) → name, phone 업데이트
 *   3. 부모 ghost 계정 생성 + parent_student_links 연결
 *   4. 초대(invitations) 레코드 생성 (manual 방식)
 */

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

// ─── 환경변수 ────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수 필요");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── 상수 ────────────────────────────────────────────────
const TENANT_ID = "84b71a5d-5681-4da3-88d2-91e75ef89015"; // 에듀엣톡
const INVITED_BY = "f7f0e4e2-ace1-47f0-90a7-f88988ea59ea"; // 장미희 (admin)
const DRY_RUN = process.argv.includes("--dry-run");

// ─── 임포트 데이터 (30명) ─────────────────────────────────
interface StudentRow {
  name: string;
  school_name: string;
  grade: number;        // 1, 2, 3 (고등), -1(중2), 0(중3)
  division: "고등부" | "중등부";
  region: string;
  phone: string | null;
  mother_phone: string | null;
  father_phone: string | null;
}

const STUDENTS: StudentRow[] = [
  // ── 고1 (7명) ──
  { name: "공지윤", school_name: "잠실여자고등학교", grade: 1, division: "고등부", region: "서울", phone: "010-8987-1869", mother_phone: "010-8947-1869", father_phone: null },
  { name: "양새봄", school_name: "상일여자고등학교", grade: 1, division: "고등부", region: "서울", phone: "010-4422-3092", mother_phone: "010-3932-3098", father_phone: null },
  { name: "이가은", school_name: "인제고등학교", grade: 1, division: "고등부", region: "강원", phone: "010-3784-1623", mother_phone: "010-3639-3652", father_phone: "010-8651-1631" },
  { name: "이준우", school_name: "경복고등학교", grade: 1, division: "고등부", region: "서울", phone: "010-6855-9061", mother_phone: "010-3335-9061", father_phone: null },
  { name: "전수빈", school_name: "청덕고등학교", grade: 1, division: "고등부", region: "경기", phone: "010-2474-1087", mother_phone: "010-4004-9395", father_phone: null },
  { name: "조세아", school_name: "서해고등학교", grade: 1, division: "고등부", region: "경기", phone: "010-5406-7180", mother_phone: "010-5186-0822", father_phone: null },
  { name: "채재혁", school_name: "동성고등학교", grade: 1, division: "고등부", region: "서울", phone: "010-2056-3750", mother_phone: "010-8721-0724", father_phone: null },

  // ── 고2 (14명) ──
  { name: "강서현", school_name: "순심여자고등학교", grade: 2, division: "고등부", region: "경남", phone: "010-9204-6761", mother_phone: "010-9110-6761", father_phone: null },
  { name: "강형주", school_name: "위례고등학교", grade: 2, division: "고등부", region: "경기", phone: "010-9599-9275", mother_phone: "010-8281-9275", father_phone: null },
  { name: "김나윤", school_name: "영파여자고등학교", grade: 2, division: "고등부", region: "서울", phone: null, mother_phone: "010-3125-8529", father_phone: null },
  { name: "김래아", school_name: "영동일고등학교", grade: 2, division: "고등부", region: "서울", phone: "010-3921-4431", mother_phone: "010-4726-4431", father_phone: null },
  { name: "김민서", school_name: "안산고등학교", grade: 2, division: "고등부", region: "경기", phone: "010-7164-9417", mother_phone: "010-4110-9417", father_phone: null },
  { name: "김서진", school_name: "창덕여자고등학교", grade: 2, division: "고등부", region: "서울", phone: "010-5174-2979", mother_phone: "010-7321-7848", father_phone: null },
  { name: "김수예", school_name: "군산상일고등학교", grade: 2, division: "고등부", region: "전북", phone: "010-9201-7640", mother_phone: "010-9436-8464", father_phone: "010-9204-9676" },
  { name: "김준석", school_name: "풍산고등학교", grade: 2, division: "고등부", region: "경북", phone: "010-3438-5875", mother_phone: "010-2678-2824", father_phone: null },
  { name: "김지혁", school_name: "강릉명륜고등학교", grade: 2, division: "고등부", region: "강원", phone: "010-5025-5414", mother_phone: null, father_phone: "010-3394-7923" },
  { name: "송민영", school_name: "청덕고등학교", grade: 2, division: "고등부", region: "경기", phone: "010-6691-8749", mother_phone: "010-8421-8749", father_phone: null },
  { name: "신호준", school_name: "광양제철고등학교", grade: 2, division: "고등부", region: "전남", phone: "010-3097-1201", mother_phone: "010-8464-3232", father_phone: null },
  { name: "안재형", school_name: "보인고등학교", grade: 2, division: "고등부", region: "서울", phone: "010-3258-3119", mother_phone: "010-8636-3119", father_phone: null },
  { name: "유솔", school_name: "포항세명고등학교", grade: 2, division: "고등부", region: "경북", phone: "010-2077-1304", mother_phone: "010-9119-9769", father_phone: null },
  { name: "임진구", school_name: "가온고등학교", grade: 2, division: "고등부", region: "경기", phone: "010-2196-5653", mother_phone: "010-9012-7171", father_phone: null },

  // ── 고3 (9명) ──
  { name: "김동하", school_name: "대원고등학교", grade: 3, division: "고등부", region: "서울", phone: "010-6520-7463", mother_phone: "010-6280-7463", father_phone: "010-3254-4553" },
  { name: "김세연", school_name: "주례여자고등학교", grade: 3, division: "고등부", region: "부산", phone: "010-5490-5334", mother_phone: "010-9098-5334", father_phone: null },
  { name: "김지안", school_name: "서울국제고등학교", grade: 3, division: "고등부", region: "서울", phone: "010-7381-7141", mother_phone: "010-3338-7141", father_phone: "010-2650-7288" },
  { name: "김채우", school_name: "강일여자고등학교", grade: 3, division: "고등부", region: "강원", phone: "010-7330-8089", mother_phone: "010-7307-8089", father_phone: null },
  { name: "나이안", school_name: "충남호서고등학교", grade: 3, division: "고등부", region: "충남", phone: "010-2190-9703", mother_phone: null, father_phone: "010-8946-9703" },
  { name: "신수영", school_name: "숭실고등학교", grade: 3, division: "고등부", region: "서울", phone: null, mother_phone: null, father_phone: "010-3622-2044" },
  { name: "이나연", school_name: "광문고등학교", grade: 3, division: "고등부", region: "서울", phone: "010-4227-3287", mother_phone: "010-3707-4122", father_phone: null },
  { name: "이지호", school_name: "세마고등학교", grade: 3, division: "고등부", region: "경기", phone: "010-8968-6404", mother_phone: "010-4519-6404", father_phone: "010-4516-6404" },
  { name: "정현우", school_name: "포항제철고등학교", grade: 3, division: "고등부", region: "경남", phone: "010-6317-0455", mother_phone: "010-6521-0248", father_phone: null },

  // ── 고2 추가 (1명) ──
  { name: "전지원", school_name: "무주고등학교", grade: 2, division: "고등부", region: "전북", phone: "010-8819-0139", mother_phone: "010-8621-0139", father_phone: null },
];

// ─── 헬퍼 ────────────────────────────────────────────────

/** 학년 표시용 라벨 */
function gradeLabel(grade: number): string {
  if (grade >= 1 && grade <= 3) return `고${grade}`;
  if (grade === 0) return "중3";
  if (grade === -1) return "중2";
  return `${grade}`;
}

/** 부모 ghost 계정 생성 + 학생 연결 */
async function createParentLink(
  studentId: string,
  relation: "mother" | "father",
  phone: string,
): Promise<void> {
  const parentId = crypto.randomUUID();

  // ghost parent user_profiles 생성
  const { error: profileError } = await supabase
    .from("user_profiles")
    .insert({
      id: parentId,
      tenant_id: TENANT_ID,
      role: "parent",
      name: "",
      phone,
    });

  if (profileError) {
    console.error(`    ⚠ ${relation} profile 생성 실패: ${profileError.message}`);
    return;
  }

  // parent_student_links 연결
  const { error: linkError } = await supabase
    .from("parent_student_links")
    .insert({
      id: crypto.randomUUID(),
      parent_id: parentId,
      student_id: studentId,
      relation,
      tenant_id: TENANT_ID,
    });

  if (linkError) {
    console.error(`    ⚠ ${relation} link 생성 실패: ${linkError.message}`);
  }
}

/** 초대 레코드 생성 */
async function createInvitation(studentId: string): Promise<string | null> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      tenant_id: TENANT_ID,
      target_role: "student",
      student_id: studentId,
      status: "pending",
      expires_at: expiresAt.toISOString(),
      delivery_method: "manual",
      delivery_status: "skipped",
      invited_by: INVITED_BY,
    })
    .select("token")
    .single();

  if (error) {
    console.error(`    ⚠ 초대 생성 실패: ${error.message}`);
    return null;
  }

  return data?.token ?? null;
}

// ─── 메인 ────────────────────────────────────────────────

async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  2026 학생 일괄 임포트 ${DRY_RUN ? "(DRY RUN - DB 변경 없음)" : ""}`);
  console.log(`  대상: ${STUDENTS.length}명`);
  console.log(`${"=".repeat(60)}\n`);

  // 1) 기존 학생 중복 확인
  const { data: existingStudents } = await supabase
    .from("user_profiles")
    .select("id, name, phone")
    .eq("tenant_id", TENANT_ID)
    .eq("role", "student");

  const existingNames = new Set(
    (existingStudents ?? []).map((s) => s.name),
  );

  // 중복 제거
  const toImport: StudentRow[] = [];
  const skipped: string[] = [];

  for (const s of STUDENTS) {
    if (existingNames.has(s.name)) {
      skipped.push(s.name);
    } else {
      toImport.push(s);
    }
  }

  if (skipped.length > 0) {
    console.log(`⏭  DB 기등록 학생 (스킵): ${skipped.join(", ")}\n`);
  }

  console.log(`📋 임포트 대상: ${toImport.length}명\n`);

  if (toImport.length === 0) {
    console.log("✅ 임포트할 학생이 없습니다.");
    return;
  }

  // 미리보기
  for (const s of toImport) {
    console.log(
      `  ${gradeLabel(s.grade).padEnd(3)} | ${s.name.padEnd(6)} | ${s.school_name.padEnd(14)} | ${s.region}`,
    );
  }
  console.log();

  if (DRY_RUN) {
    console.log("🔍 DRY RUN 완료 — 위 학생들이 임포트됩니다. --dry-run 제거 후 재실행하세요.\n");
    return;
  }

  // 2) 임포트 실행
  let successCount = 0;
  let failCount = 0;
  const results: { name: string; id: string; token: string | null }[] = [];

  for (const s of toImport) {
    const studentId = crypto.randomUUID();
    console.log(`▶ ${s.name} (${gradeLabel(s.grade)}, ${s.school_name})`);

    try {
      // 2a) students INSERT (트리거가 user_profiles 자동 생성)
      const { error: studentError } = await supabase
        .from("students")
        .insert({
          id: studentId,
          tenant_id: TENANT_ID,
          grade: String(s.grade),
          class: null,
          birth_date: null,
          school_id: null,
          school_name: s.school_name,
          school_type: s.division === "중등부" ? "MIDDLE" : "HIGH",
          division: s.division,
          student_number: null,
          enrolled_at: null,
          status: "enrolled",
        });

      if (studentError) {
        throw new Error(`students INSERT 실패: ${studentError.message}`);
      }

      // 2b) user_profiles 업데이트 (name, phone)
      const profileUpdate: Record<string, unknown> = { name: s.name };
      if (s.phone) profileUpdate.phone = s.phone;

      const { error: profileError } = await supabase
        .from("user_profiles")
        .update(profileUpdate)
        .eq("id", studentId);

      if (profileError) {
        console.error(`    ⚠ profile 업데이트 실패: ${profileError.message}`);
      }

      // 2c) 부모 연락처
      if (s.mother_phone) {
        await createParentLink(studentId, "mother", s.mother_phone);
      }
      if (s.father_phone) {
        await createParentLink(studentId, "father", s.father_phone);
      }

      // 2d) 초대 생성
      const token = await createInvitation(studentId);

      successCount++;
      results.push({ name: s.name, id: studentId, token });
      console.log(`  ✅ 완료 (id: ${studentId.slice(0, 8)}...)`);
    } catch (err) {
      failCount++;
      console.error(`  ❌ 실패: ${err instanceof Error ? err.message : err}`);
    }
  }

  // 3) 결과 요약
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  결과: ✅ ${successCount}명 성공 / ❌ ${failCount}명 실패`);
  console.log(`${"=".repeat(60)}\n`);

  if (results.length > 0) {
    console.log("📄 임포트된 학생 목록:");
    console.log("이름      | Student ID                           | 초대 토큰");
    console.log("-".repeat(80));
    for (const r of results) {
      console.log(`${r.name.padEnd(8)} | ${r.id} | ${r.token ?? "-"}`);
    }
  }
}

main().catch((err) => {
  console.error("💥 스크립트 실패:", err);
  process.exit(1);
});
