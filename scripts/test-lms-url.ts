/**
 * URL 포함 LMS 발송 테스트 — 통신사 스팸 차단 여부 확인
 * npx tsx scripts/test-lms-url.ts
 */
import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const ACCOUNT = process.env.PPURIO_ACCOUNT || process.env.PPURIO_USER_ID;
const AUTH_KEY = process.env.PPURIO_AUTH_KEY || process.env.PPURIO_API_KEY;
const SENDER = process.env.PPURIO_SENDER_NUMBER;
const BASE_URL = process.env.PPURIO_API_BASE_URL || "https://message.ppurio.com";

function base64Encode(str: string): string {
  return Buffer.from(str).toString("base64");
}

async function run() {
  const cred = base64Encode(`${ACCOUNT}:${AUTH_KEY}`);
  const tokenRes = await fetch(`${BASE_URL}/v1/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${cred}`, "Content-Type": "application/json" },
  });
  const { token } = await tokenRes.json();
  console.log("[Token] OK\n");

  // URL 포함 LMS (실패했던 초대 메시지와 동일한 패턴)
  const content =
    "테스트 메시지입니다. 아래 링크를 확인해주세요.\n\n" +
    "https://eduatalk.vercel.app/login?code=TEST-CODE\n\n" +
    "이 메시지가 수신되는지 확인하기 위한 테스트입니다.";
  const bytes = new TextEncoder().encode(content).length;

  console.log(`[LMS+URL] Content (${bytes} bytes):\n${content}\n`);

  const res = await fetch(`${BASE_URL}/v1/message`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      account: ACCOUNT,
      messageType: "LMS",
      content,
      from: SENDER,
      duplicateFlag: "Y",
      targetCount: 1,
      targets: [{ to: "01058830723" }],
      refKey: "test-url-lms",
      subject: "URL 포함 테스트",
    }),
  });

  const text = await res.text();
  console.log(`[LMS+URL] HTTP ${res.status}: ${text}`);
  console.log("\n수신 여부를 확인해주세요.");
  console.log("  수신 O → URL이 원인 아님 (다른 문제)");
  console.log("  수신 X → vercel.app URL이 통신사에서 차단됨");
}

run().catch(console.error);
