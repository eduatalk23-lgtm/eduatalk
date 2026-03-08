/**
 * 뿌리오 LMS 발송 A/B 테스트
 * sendSMS 함수와 동일한 파라미터로 발송하여 어떤 변수가 문제인지 격리합니다.
 *
 * 사용법: npx tsx scripts/test-ppurio-lms.ts 01012345678
 */
import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const ACCOUNT = process.env.PPURIO_ACCOUNT || process.env.PPURIO_USER_ID;
const AUTH_KEY = process.env.PPURIO_AUTH_KEY || process.env.PPURIO_API_KEY;
const SENDER = process.env.PPURIO_SENDER_NUMBER;
const BASE_URL = process.env.PPURIO_API_BASE_URL || "https://message.ppurio.com";
const recipientPhone = process.argv[2];

if (!recipientPhone) {
  console.error("사용법: npx tsx scripts/test-ppurio-lms.ts <수신번호>");
  process.exit(1);
}
if (!ACCOUNT || !AUTH_KEY || !SENDER) {
  console.error("환경변수 누락");
  process.exit(1);
}

function base64Encode(str: string): string {
  return Buffer.from(str).toString("base64");
}

async function getToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}/v1/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${base64Encode(`${ACCOUNT}:${AUTH_KEY}`)}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  return data.token;
}

async function send(
  token: string,
  label: string,
  body: Record<string, unknown>
) {
  console.log(`\n--- ${label} ---`);
  console.log("요청:", JSON.stringify(body, null, 2));

  const res = await fetch(`${BASE_URL}/v1/message`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  console.log(`응답 (${res.status}): ${text}`);
  return text;
}

// 실제 앱에서 보낸 것과 동일한 초대 메시지
const INVITE_MSG =
  "타일레벨업 학습관리를 위해 아래 링크를 통해 회원가입 부탁드립니다. \n\n" +
  "https://eduatalk.vercel.app/login?code=INV-B79R-CMS8\n\n" +
  "소셜 로그인 외 이메일 인증으로 가입시 입력한 이메일로 인증확인 후 로그인 가능합니다. \n\n" +
  "소속 기관은 에듀엣톡으로 선택해주시고 회원 유형은 '학생' 선택 후 초대코드 입력되어 있는지 확인해주세요 \n\n" +
  "초대코드가 입력되어 있지 않다면 아래 코드를 입력 후 가입해주세요 \n\n" +
  "◼︎ 초대 코드\nINV-B79R-CMS8\n\n◼︎ URL\nhttps://eduatalk.vercel.app";

(async () => {
  const token = await getToken();
  console.log("[Token] OK");
  console.log(`Content bytes: ${new TextEncoder().encode(INVITE_MSG).length}`);

  const base = {
    account: ACCOUNT,
    messageType: "LMS",
    content: INVITE_MSG,
    from: SENDER,
    targetCount: 1,
    targets: [{ to: recipientPhone }],
  };

  // A: sendSMS와 완전히 동일 (duplicateFlag:"N", subject 없음)
  await send(token, "A: sendSMS 동일 (dup:N, subject 없음)", {
    ...base,
    duplicateFlag: "N",
    refKey: "diag-A-no-subj",
  });

  await new Promise((r) => setTimeout(r, 3000));

  // B: subject 추가
  await send(token, "B: subject 추가 (dup:N)", {
    ...base,
    duplicateFlag: "N",
    refKey: "diag-B-with-subj",
    subject: "초대 안내",
  });

  await new Promise((r) => setTimeout(r, 3000));

  // C: duplicateFlag:"Y" + subject
  await send(token, "C: dup:Y + subject", {
    ...base,
    duplicateFlag: "Y",
    refKey: "diag-C-dup-y",
    subject: "초대 안내",
  });

  await new Promise((r) => setTimeout(r, 3000));

  // D: duplicateFlag:"Y", subject 없음
  await send(token, "D: dup:Y, subject 없음", {
    ...base,
    duplicateFlag: "Y",
    refKey: "diag-D-dup-y-no-subj",
  });

  console.log("\n" + "=".repeat(60));
  console.log("4건 발송 완료. 수신 여부를 확인해주세요:");
  console.log("  A: sendSMS 동일 (dup:N, subject 없음)");
  console.log("  B: subject 추가 (dup:N)");
  console.log("  C: dup:Y + subject");
  console.log("  D: dup:Y, subject 없음");
  console.log("=".repeat(60));
})();
