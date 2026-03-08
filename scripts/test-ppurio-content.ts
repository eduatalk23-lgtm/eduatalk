import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const ACCOUNT = process.env.PPURIO_ACCOUNT || process.env.PPURIO_USER_ID;
const AUTH_KEY = process.env.PPURIO_AUTH_KEY || process.env.PPURIO_API_KEY;
const SENDER = process.env.PPURIO_SENDER_NUMBER;
const BASE_URL = process.env.PPURIO_API_BASE_URL || "https://message.ppurio.com";

function base64Encode(str: string): string { return Buffer.from(str).toString("base64"); }

async function getToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}/v1/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${base64Encode(`${ACCOUNT}:${AUTH_KEY}`)}`, "Content-Type": "application/json" },
  });
  return (await res.json()).token;
}

async function send(token: string, label: string, content: string) {
  console.log(`\n--- ${label} ---`);
  console.log(`내용 (${new TextEncoder().encode(content).length} bytes):\n${content}\n`);

  const res = await fetch(`${BASE_URL}/v1/message`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      account: ACCOUNT, messageType: "LMS", content, from: SENDER,
      duplicateFlag: "N", targetCount: 1,
      targets: [{ to: "01058830723" }],
      refKey: `diag-${label}`, subject: "안내",
    }),
  });
  console.log(`응답: ${await res.text()}`);
}

(async () => {
  const token = await getToken();
  console.log("[Token] OK\n");

  // E: URL 1개 + 스팸 키워드 제거
  await send(token, "E", 
    "[에듀엣톡] 학습관리 서비스 안내\n\n" +
    "아래 초대코드로 접속해주세요.\n\n" +
    "초대코드: INV-B79R-CMS8\n" +
    "접속주소: eduatalk.vercel.app"
  );

  await new Promise((r) => setTimeout(r, 3000));

  // F: URL 완전 제거 (코드만)
  await send(token, "F",
    "[에듀엣톡] 학습관리 서비스 안내\n\n" +
    "아래 초대코드로 가입 부탁드립니다.\n\n" +
    "초대코드: INV-B79R-CMS8\n\n" +
    "접속방법: eduatalk.vercel.app 에서 회원가입 후 초대코드를 입력해주세요.\n\n" +
    "소속기관: 에듀엣톡\n" +
    "회원유형: 학생"
  );

  await new Promise((r) => setTimeout(r, 3000));

  // G: 원본 메시지 그대로 (대조군 - 안 올 것으로 예상)
  await send(token, "G",
    "타일레벨업 학습관리를 위해 아래 링크를 통해 회원가입 부탁드립니다. \n\n" +
    "https://eduatalk.vercel.app/login?code=INV-B79R-CMS8\n\n" +
    "소셜 로그인 외 이메일 인증으로 가입시 입력한 이메일로 인증확인 후 로그인 가능합니다. \n\n" +
    "소속 기관은 에듀엣톡으로 선택해주시고 회원 유형은 '학생' 선택 후 초대코드 입력되어 있는지 확인해주세요 \n\n" +
    "초대코드가 입력되어 있지 않다면 아래 코드를 입력 후 가입해주세요 \n\n" +
    "◼︎ 초대 코드\nINV-B79R-CMS8\n\n◼︎ URL\nhttps://eduatalk.vercel.app"
  );

  console.log("\n" + "=".repeat(50));
  console.log("3건 발송 완료. 수신 확인:");
  console.log("  E: URL 없이 텍스트로만 주소 표기");
  console.log("  F: URL 없이 안내문 형태");
  console.log("  G: 원본 메시지 (대조군)");
  console.log("=".repeat(50));
})();
