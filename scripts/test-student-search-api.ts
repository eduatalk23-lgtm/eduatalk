/**
 * 학생 검색 API 테스트 스크립트
 * 
 * 사용법:
 * 1. 개발 서버 실행: npm run dev
 * 2. 관리자 계정으로 로그인하여 세션 쿠키 획득
 * 3. 이 스크립트 실행: npx tsx scripts/test-student-search-api.ts
 * 
 * 또는 브라우저 개발자 도구에서 직접 테스트:
 * fetch('/api/students/search?q=홍길동').then(r => r.json()).then(console.log)
 */

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

/**
 * 학생 검색 API 테스트
 */
async function testStudentSearchAPI() {
  console.log("=== 학생 검색 API 테스트 ===\n");

  // 주의: 실제 사용 시 세션 쿠키가 필요합니다
  // 브라우저 개발자 도구에서 쿠키를 복사하여 사용하세요
  const sessionCookie = process.env.SESSION_COOKIE || "";

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (sessionCookie) {
    headers["Cookie"] = sessionCookie;
  }

  // 테스트 케이스
  const testCases = [
    {
      name: "이름 검색",
      query: "홍길동",
      params: new URLSearchParams({ q: "홍길동" }),
    },
    {
      name: "연락처 검색 (4자리)",
      query: "0101",
      params: new URLSearchParams({ q: "0101", type: "phone" }),
    },
    {
      name: "부분 이름 검색",
      query: "홍",
      params: new URLSearchParams({ q: "홍" }),
    },
    {
      name: "필터링 (학년)",
      query: "홍",
      params: new URLSearchParams({ q: "홍", grade: "1" }),
    },
    {
      name: "페이지네이션",
      query: "홍",
      params: new URLSearchParams({ q: "홍", limit: "10", offset: "0" }),
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n[테스트] ${testCase.name}`);
    console.log(`요청: GET ${API_BASE_URL}/api/students/search?${testCase.params.toString()}`);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/students/search?${testCase.params.toString()}`,
        {
          method: "GET",
          headers,
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        console.log(`✅ 성공: ${data.data.students.length}명의 학생 검색됨`);
        console.log(`   총 결과: ${data.data.total}명`);
        
        if (data.data.students.length > 0) {
          const firstStudent = data.data.students[0];
          console.log(`   첫 번째 결과: ${firstStudent.name} (${firstStudent.matched_field || "N/A"})`);
        }
      } else {
        console.log(`❌ 실패: ${data.error || response.statusText}`);
        console.log(`   상태 코드: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ 오류: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log("\n=== 테스트 완료 ===");
  console.log("\n참고: 실제 테스트를 위해서는 세션 쿠키가 필요합니다.");
  console.log("브라우저 개발자 도구에서 쿠키를 복사하여 SESSION_COOKIE 환경 변수로 설정하세요.");
}

// 스크립트 실행
if (require.main === module) {
  testStudentSearchAPI().catch(console.error);
}

export { testStudentSearchAPI };

