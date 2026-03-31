#!/usr/bin/env tsx
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { embedBatchCases } from "../lib/agents/memory/embedding-service";

const ids = process.argv.slice(2);

async function main() {
  if (ids.length === 0) {
    // pending인 교차시뮬레이션 케이스 자동 조회
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const res = await fetch(
      `${url}/rest/v1/consulting_cases?embedding_status=eq.pending&strategy_summary=like.*교차시뮬레이션*&select=id`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    const rows = (await res.json()) as Array<{ id: string }>;
    if (rows.length === 0) {
      console.log("✅ pending 케이스 없음. 모두 임베딩 완료.");
      return;
    }
    console.log(`📦 pending 케이스 ${rows.length}건 발견\n`);
    const result = await embedBatchCases(rows.map((r) => r.id));
    console.log(`\n✅ 임베딩 완료: 성공 ${result.success}건 | 실패 ${result.failed}건`);
    return;
  }

  console.log(`📦 ${ids.length}건 임베딩 시작\n`);
  const result = await embedBatchCases(ids);
  console.log(`\n✅ 임베딩 완료: 성공 ${result.success}건 | 실패 ${result.failed}건`);
}

main().catch((e) => {
  console.error("에러:", e);
  process.exit(1);
});
