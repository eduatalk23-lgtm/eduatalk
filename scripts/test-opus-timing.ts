import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import {
  HIGHLIGHT_SYSTEM_PROMPT,
  buildHighlightUserPrompt,
} from "@/lib/domains/student-record/llm/prompts/competencyHighlight";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const anthropic = new Anthropic();

async function main() {
  const studentId = "0e3e149d-4b9c-402d-ad5c-b3df04190889";
  
  const { data: setek } = await admin
    .from("student_record_seteks")
    .select("id, imported_content, grade, subject:subject_id(name)")
    .eq("student_id", studentId)
    .eq("grade", 1)
    .not("imported_content", "is", null)
    .limit(1)
    .single();

  if (!setek?.imported_content) {
    console.log("No setek found");
    return;
  }

  const subjectName = (setek.subject as Record<string, string>)?.name ?? "unknown";
  console.log(`[1건 테스트] ${subjectName}, ${setek.imported_content.length}chars`);
  
  const userPrompt = buildHighlightUserPrompt({
    recordType: "setek",
    content: setek.imported_content,
    subjectName,
    grade: 1,
  });

  console.log("Claude Opus (streaming) 호출 시작...");
  const start = Date.now();
  try {
    let text = "";
    const stream = anthropic.messages.stream({
      model: "claude-opus-4-20250514",
      max_tokens: 16384,
      temperature: 0.3,
      system: HIGHLIGHT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    
    const response = await stream.finalMessage();
    text = response.content[0].type === "text" ? response.content[0].text : "";
    
    const elapsed = Date.now() - start;
    console.log(`\nOpus 1건: ${elapsed}ms (${(elapsed/1000).toFixed(1)}초)`);
    console.log(`응답 길이: ${text.length}chars`);
    console.log(`\n18건 x 동시성3 = 6라운드 예상: ~${Math.ceil(elapsed * 6 / 1000)}초`);
    console.log(`\n비교: Gemini=30초/건, Opus=${(elapsed/1000).toFixed(1)}초/건`);
  } catch (err) {
    const elapsed = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`\n실패 (${(elapsed/1000).toFixed(1)}초): ${msg.slice(0, 300)}`);
  }
}

main().catch(console.error);
