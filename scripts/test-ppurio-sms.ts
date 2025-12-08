/**
 * 뿌리오 SMS API 연결 테스트 스크립트
 * 환경 변수 설정 및 API 연결 상태를 확인합니다.
 */

// .env.local 파일 로드
import dotenv from "dotenv";
import { resolve } from "path";

// .env.local 파일 로드
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// 환경 변수는 process.env에서 직접 확인 (env.ts는 빌드 시점 체크로 인해 optional 변수를 건너뛸 수 있음)
const envVars = {
  PPURIO_USER_ID: process.env.PPURIO_USER_ID,
  PPURIO_API_KEY: process.env.PPURIO_API_KEY,
  PPURIO_SENDER_NUMBER: process.env.PPURIO_SENDER_NUMBER,
};

async function testPPurioConnection() {
  console.log("=".repeat(60));
  console.log("뿌리오 SMS API 연결 테스트");
  console.log("=".repeat(60));
  console.log();

  // 1. 환경 변수 확인
  console.log("📋 1. 환경 변수 확인");
  console.log("-".repeat(60));

  let hasAllEnvVars = true;

  for (const [key, value] of Object.entries(envVars)) {
    if (value) {
      // 민감한 정보는 일부만 표시
      if (key === "PPURIO_API_KEY") {
        const masked = value.length > 8 
          ? `${value.substring(0, 4)}${"*".repeat(value.length - 8)}${value.substring(value.length - 4)}`
          : "***";
        console.log(`  ✅ ${key}: ${masked} (${value.length}자)`);
      } else {
        console.log(`  ✅ ${key}: ${value}`);
      }
    } else {
      console.log(`  ❌ ${key}: 설정되지 않음`);
      hasAllEnvVars = false;
    }
  }

  console.log();

  if (!hasAllEnvVars) {
    console.log("❌ 환경 변수가 모두 설정되지 않았습니다.");
    console.log("   .env.local 파일에 다음 변수를 추가해주세요:");
    console.log("   - PPURIO_USER_ID");
    console.log("   - PPURIO_API_KEY");
    console.log("   - PPURIO_SENDER_NUMBER");
    process.exit(1);
  }

  // 2. 전화번호 형식 검증 테스트
  console.log("📋 2. 전화번호 형식 검증 테스트");
  console.log("-".repeat(60));

  const testPhones = [
    "010-1234-5678",
    "01012345678",
    "011-123-4567",
    "invalid",
    "1234567890",
  ];

  for (const phone of testPhones) {
    const cleaned = phone.replace(/[-\s]/g, "");
    const isValid = /^(010|011|016|017|018|019)\d{7,8}$/.test(cleaned);
    console.log(`  ${isValid ? "✅" : "❌"} ${phone} → ${isValid ? "유효" : "무효"}`);
  }

  console.log();

  // 3. 뿌리오 API 엔드포인트 확인
  console.log("📋 3. 뿌리오 API 엔드포인트 확인");
  console.log("-".repeat(60));
  console.log("  API 엔드포인트: https://message.ppurio.com/v1/send");
  console.log("  인증 방식: X-PPURIO-USER-ID, X-PPURIO-API-KEY");
  console.log();

  // 4. API 연결 테스트 (실제 발송 없이 헤더만 확인)
  console.log("📋 4. API 헤더 구성 확인");
  console.log("-".repeat(60));

  const headers = {
    "Content-Type": "application/json",
    "X-PPURIO-USER-ID": envVars.PPURIO_USER_ID!,
    "X-PPURIO-API-KEY": envVars.PPURIO_API_KEY!.substring(0, 4) + "***",
  };

  console.log("  요청 헤더:");
  for (const [key, value] of Object.entries(headers)) {
    console.log(`    ${key}: ${value}`);
  }
  console.log();

  // 5. 실제 API 호출 테스트 (선택사항)
  console.log("📋 5. 실제 API 연결 테스트");
  console.log("-".repeat(60));
  console.log("  ⚠️  실제 SMS 발송 테스트는 건너뜁니다.");
  console.log("  실제 발송 테스트는 /admin/sms 페이지에서 진행하세요.");
  console.log();

  // 6. 요약
  console.log("=".repeat(60));
  console.log("✅ 환경 변수 설정 완료");
  console.log("✅ 전화번호 검증 로직 확인 완료");
  console.log("✅ API 헤더 구성 확인 완료");
  console.log();
  console.log("다음 단계:");
  console.log("1. /admin/sms 페이지에서 실제 SMS 발송 테스트");
  console.log("2. SMS 로그에서 발송 상태 확인");
  console.log("=".repeat(60));
}

// 스크립트 실행
testPPurioConnection().catch((error) => {
  console.error("❌ 테스트 실행 중 오류 발생:", error);
  process.exit(1);
});

