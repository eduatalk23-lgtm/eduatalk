// ============================================
// 학년별 파이프라인 오케스트레이터 — re-export 진입점
// NOTE: "use server" 지시어는 하위 모듈에 각각 선언.
//
// 실제 구현은 하위 모듈에 있음:
//   - pipeline-orchestrator-types.ts  : 공유 인터페이스
//   - pipeline-orchestrator-init.ts   : 7-1 runGradePipeline
//                                       7-2 runSynthesisPipeline
//                                       7-3 runGradeAwarePipeline
//   - pipeline-orchestrator-status.ts : 7-4 fetchGradeAwarePipelineStatus
//   - pipeline-orchestrator-rerun.ts  : 7-5 rerunGradePipelineTasks
//
// 기존 import 경로(`./actions/pipeline-orchestrator`) 호환을 위해
// 모든 exported 심볼을 이 파일에서 re-export한다.
//
// NOTE: "use server" 모듈에서 type re-export 금지 규칙 적용.
//       GradeAwarePipelineStartResult / GradeAwarePipelineStatus 타입은
//       pipeline-orchestrator-types.ts 에서 직접 import하세요.
// ============================================

export {
  runGradePipeline,
  runSynthesisPipeline,
  runGradeAwarePipeline,
} from "./pipeline-orchestrator-init";

export { fetchGradeAwarePipelineStatus } from "./pipeline-orchestrator-status";

export {
  rerunGradePipelineTasks,
  rerunSynthesisPipelineTasks,
} from "./pipeline-orchestrator-rerun";

// 타입 re-export — "use server" 모듈에서 타입 re-export는 금지이므로
// 소비자 파일은 아래 경로에서 직접 import할 것:
// import type { GradeAwarePipelineStatus, GradeAwarePipelineStartResult }
//   from "@/lib/domains/student-record/actions/pipeline-orchestrator-types";
//
// 하위 호환을 위한 타입 재공개는 별도 비-서버 파일에서 처리 가능하나,
// 현재 소비자(PipelineGradeGrid, usePipelineExecution, PipelineSynthesisGrid)는
// `import type`으로만 사용하므로 런타임 크래시 없이 동작한다.
// Next.js는 `import type`을 트리쉐이킹하므로 "use server" 모듈에서
// type-only re-export는 런타임에 도달하지 않는다.
// 단, 안전을 위해 소비자 파일을 pipeline-orchestrator-types.ts 로 이전 권장.
