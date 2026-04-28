/**
 * Claude Code CLI Provider — subprocess 래퍼
 *
 * 사용자의 Claude Code 구독(OAuth) 인증을 그대로 사용해 LLM 호출을 대체.
 * Vercel AI SDK 의 LanguageModel 인터페이스를 구현하지 않고, 별도 진입점으로
 * `ai-sdk.ts` 의 `generateTextWithRateLimit` / `generateObjectWithRateLimit`
 * 진입부에서 직접 분기되어 호출된다.
 *
 * ⚠ 개발/실험 전용. 프로덕션(Vercel)에서는 사용 금지.
 *  - subprocess `claude -p` 가 호스트에 설치되어 있어야 함
 *  - 16~30s/call 레이턴시
 *  - Max 플랜 5h 윈도우 rate limit 존재
 *
 * 활성화: `LLM_PROVIDER_OVERRIDE=claude-code`
 */

import "server-only";

import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";

export type ClaudeCodeModel = "haiku" | "sonnet" | "opus";

export interface ClaudeCodeCliOptions {
  /** 시스템 프롬프트(`--append-system-prompt`로 전달) */
  system?: string;
  /** 사용자 프롬프트(positional argument) */
  prompt: string;
  /** JSON Schema (있으면 `--json-schema`로 구조화 출력 강제) */
  schemaJson?: object;
  /** 모델 별명 (haiku/sonnet/opus). 기본: haiku */
  model?: ClaudeCodeModel;
  /** 타임아웃(ms). 기본 60s */
  timeoutMs?: number;
  /** 최대 비용(USD). `--max-budget-usd` 안전장치 */
  maxBudgetUsd?: number;
}

export interface ClaudeCodeCliResult {
  /** 자유 텍스트 응답 */
  text: string;
  /** schema 강제 시 파싱된 객체. 미지정/실패 시 null */
  structured: unknown | null;
  /** Anthropic API 환산 청구 참조값 (구독 한도와 별개의 $ 환산 추정치) */
  costUsd: number;
  /** 토큰 사용량 (input/output) */
  usage: { inputTokens: number; outputTokens: number };
  /** 실제 응답 모델 ID (예: claude-haiku-4-5-20251001) */
  modelId: string;
  /** wall clock duration */
  durationMs: number;
}

export class ClaudeCodeCliError extends Error {
  constructor(
    message: string,
    public readonly stderr?: string,
    public readonly exitCode?: number,
  ) {
    super(message);
    this.name = "ClaudeCodeCliError";
  }
}

/**
 * `claude -p` subprocess를 실행하고 JSON 응답을 파싱한다.
 *
 * - cwd를 임시 디렉토리로 설정해 CLAUDE.md 자동 로딩 회피 (40k 토큰 절감)
 * - `--disallowedTools "*"` 로 도구 사용 차단 (LLM 응답만 받음)
 * - `--output-format json` 으로 메타데이터 포함 응답
 * - `structured_output` 필드를 우선 사용 (`--json-schema` 적용 시 검증된 파싱 결과)
 */
export async function runClaudeCodeCli(
  options: ClaudeCodeCliOptions,
): Promise<ClaudeCodeCliResult> {
  const startedAt = Date.now();

  const args: string[] = [
    "-p",
    "--model",
    options.model ?? "haiku",
    "--disallowedTools",
    "*",
    "--output-format",
    "json",
    "--exclude-dynamic-system-prompt-sections",
  ];

  if (options.schemaJson) {
    args.push("--json-schema", JSON.stringify(options.schemaJson));
  }

  if (options.system) {
    args.push("--append-system-prompt", options.system);
  }

  if (options.maxBudgetUsd != null) {
    args.push("--max-budget-usd", String(options.maxBudgetUsd));
  }

  args.push(options.prompt);

  // CLAUDE.md auto-discovery 회피용 임시 cwd
  const isolatedCwd = mkdtempSync(join(tmpdir(), "cc-llm-"));

  // OAuth(구독) 인증 강제: ANTHROPIC_API_KEY/AUTH_TOKEN 이 env에 있으면
  // claude CLI 가 API 키 경로로 결제하려 한다. 명시적으로 제거하여 키체인의
  // OAuth credentials 를 사용하도록 강제. (사용자는 Max 구독으로 결제하길 원함)
  const childEnv = { ...process.env };
  delete childEnv.ANTHROPIC_API_KEY;
  delete childEnv.ANTHROPIC_AUTH_TOKEN;

  return await new Promise<ClaudeCodeCliResult>((resolve, reject) => {
    const proc = spawn("claude", args, {
      cwd: isolatedCwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: childEnv,
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(
        new ClaudeCodeCliError(
          `claude -p timed out after ${options.timeoutMs ?? 60000}ms`,
          stderr,
        ),
      );
    }, options.timeoutMs ?? 60_000);

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(
        new ClaudeCodeCliError(
          `failed to spawn 'claude': ${err.message}`,
          stderr,
        ),
      );
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0 && !stdout.trim()) {
        reject(
          new ClaudeCodeCliError(
            `claude -p exited with code ${code}`,
            stderr,
            code ?? undefined,
          ),
        );
        return;
      }

      let parsed: ClaudeCodeJsonResponse;
      try {
        parsed = JSON.parse(stdout) as ClaudeCodeJsonResponse;
      } catch (e) {
        reject(
          new ClaudeCodeCliError(
            `failed to parse claude -p JSON output: ${(e as Error).message}\nstdout head: ${stdout.slice(0, 300)}`,
            stderr,
            code ?? undefined,
          ),
        );
        return;
      }

      if (parsed.is_error) {
        reject(
          new ClaudeCodeCliError(
            `claude -p reported error: ${parsed.result || parsed.api_error_status || "unknown"}`,
            stderr,
            code ?? undefined,
          ),
        );
        return;
      }

      const usage = parsed.usage ?? {};
      const modelUsage = parsed.modelUsage ?? {};
      const firstModelId = Object.keys(modelUsage)[0] ?? options.model ?? "haiku";

      resolve({
        text: parsed.result ?? "",
        structured: parsed.structured_output ?? null,
        costUsd: parsed.total_cost_usd ?? 0,
        usage: {
          inputTokens:
            (usage.input_tokens ?? 0) +
            (usage.cache_creation_input_tokens ?? 0) +
            (usage.cache_read_input_tokens ?? 0),
          outputTokens: usage.output_tokens ?? 0,
        },
        modelId: firstModelId,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

/** `claude -p --output-format json` 응답 형태 (필요한 필드만) */
interface ClaudeCodeJsonResponse {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  api_error_status?: string | null;
  result?: string;
  total_cost_usd?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  modelUsage?: Record<string, unknown>;
  structured_output?: unknown;
}
