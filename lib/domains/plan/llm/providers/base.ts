/**
 * LLM Provider 기본 인터페이스
 *
 * 모든 LLM Provider(Anthropic, OpenAI, Google 등)가 구현해야 하는 인터페이스입니다.
 * Provider 패턴을 통해 다양한 LLM 서비스를 통일된 방식으로 사용할 수 있습니다.
 */

// ============================================
// 공통 타입
// ============================================

/**
 * 모델 티어 (비용/성능 기준)
 */
export type ModelTier = "fast" | "standard" | "advanced";

/**
 * 지원되는 Provider 타입
 */
export type ProviderType = "anthropic" | "openai" | "gemini";

/**
 * 모델 설정
 */
export interface ModelConfig {
  tier: ModelTier;
  modelId: string;
  maxTokens: number;
  temperature: number;
  provider: ProviderType;
}

/**
 * 메시지 역할
 */
export type MessageRole = "user" | "assistant" | "system";

/**
 * 대화 메시지
 */
export interface Message {
  role: MessageRole;
  content: string;
}

/**
 * 메시지 생성 옵션
 */
export interface CreateMessageOptions {
  /** 시스템 프롬프트 */
  system: string;
  /** 대화 메시지 배열 */
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  /** 모델 티어 (기본값: 'standard') */
  modelTier?: ModelTier;
  /** 최대 출력 토큰 수 */
  maxTokens?: number;
  /** 생성 온도 (0-1) */
  temperature?: number;
}

/**
 * 메시지 생성 결과
 */
export interface CreateMessageResult {
  /** 생성된 텍스트 */
  content: string;
  /** 중지 이유 */
  stopReason: string | null;
  /** 토큰 사용량 */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  /** 사용된 모델 ID */
  modelId: string;
  /** 프로바이더 타입 */
  provider: ProviderType;
}

/**
 * 스트리밍 메시지 옵션
 */
export interface StreamMessageOptions extends CreateMessageOptions {
  /** 텍스트 청크 수신 콜백 */
  onText?: (text: string) => void;
  /** 완료 콜백 */
  onComplete?: (result: CreateMessageResult) => void;
  /** 에러 콜백 */
  onError?: (error: Error) => void;
}

/**
 * 비용 정보
 */
export interface CostInfo {
  /** 입력 토큰당 비용 (USD/1M 토큰) */
  inputCostPer1M: number;
  /** 출력 토큰당 비용 (USD/1M 토큰) */
  outputCostPer1M: number;
  /** 통화 단위 */
  currency: "USD";
}

/**
 * Provider 상태 정보
 */
export interface ProviderStatus {
  /** 사용 가능 여부 */
  available: boolean;
  /** API 키 설정 여부 */
  hasApiKey: boolean;
  /** 에러 메시지 (있는 경우) */
  errorMessage?: string;
}

// ============================================
// LLMProvider 인터페이스
// ============================================

/**
 * LLM Provider 인터페이스
 *
 * 모든 LLM 서비스 제공자가 구현해야 하는 공통 인터페이스입니다.
 *
 * @example
 * ```typescript
 * const provider = getProvider('anthropic');
 * const result = await provider.createMessage({
 *   system: 'You are a helpful assistant.',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * console.log(result.content);
 * ```
 */
export interface LLMProvider {
  /**
   * Provider 타입
   */
  readonly type: ProviderType;

  /**
   * Provider 이름 (표시용)
   */
  readonly name: string;

  /**
   * Provider 상태 확인
   */
  getStatus(): ProviderStatus;

  /**
   * 지정된 티어의 모델 설정 반환
   */
  getModelConfig(tier: ModelTier): ModelConfig;

  /**
   * 사용 가능한 모든 모델 설정 반환
   */
  getAllModelConfigs(): Record<ModelTier, ModelConfig>;

  /**
   * 메시지 생성 (비스트리밍)
   */
  createMessage(options: CreateMessageOptions): Promise<CreateMessageResult>;

  /**
   * 메시지 생성 (스트리밍)
   */
  streamMessage(options: StreamMessageOptions): Promise<CreateMessageResult>;

  /**
   * 텍스트 토큰 수 추정
   */
  estimateTokens(text: string): number;

  /**
   * API 호출 비용 추정 (USD)
   */
  estimateCost(inputTokens: number, outputTokens: number, tier: ModelTier): number;

  /**
   * 티어별 비용 정보 반환
   */
  getCostInfo(tier: ModelTier): CostInfo;
}

// ============================================
// 추상 기본 클래스
// ============================================

/**
 * LLM Provider 추상 기본 클래스
 *
 * 공통 로직을 제공하며, 각 Provider는 이를 상속받아 구현합니다.
 */
export abstract class BaseLLMProvider implements LLMProvider {
  abstract readonly type: ProviderType;
  abstract readonly name: string;

  abstract getStatus(): ProviderStatus;
  abstract getModelConfig(tier: ModelTier): ModelConfig;
  abstract getAllModelConfigs(): Record<ModelTier, ModelConfig>;
  abstract createMessage(options: CreateMessageOptions): Promise<CreateMessageResult>;
  abstract streamMessage(options: StreamMessageOptions): Promise<CreateMessageResult>;
  abstract getCostInfo(tier: ModelTier): CostInfo;

  /**
   * 텍스트 토큰 수 추정 (한글 고려)
   *
   * 대부분의 LLM에서 비슷한 토크나이저를 사용하므로 공통 구현을 제공합니다.
   * - 한글: 약 1.5 토큰/문자
   * - 영어/기타: 약 0.25 토큰/문자 (4문자당 1토큰)
   */
  estimateTokens(text: string): number {
    const koreanChars = (text.match(/[가-힣]/g) || []).length;
    const otherChars = text.length - koreanChars;
    return Math.ceil(koreanChars * 1.5 + otherChars / 4);
  }

  /**
   * API 호출 비용 추정 (USD)
   */
  estimateCost(inputTokens: number, outputTokens: number, tier: ModelTier): number {
    const costInfo = this.getCostInfo(tier);
    return (
      (inputTokens * costInfo.inputCostPer1M) / 1_000_000 +
      (outputTokens * costInfo.outputCostPer1M) / 1_000_000
    );
  }

  /**
   * API 키 검증 헬퍼
   */
  protected validateApiKey(key: string | undefined, envVarName: string): string {
    if (!key) {
      throw new Error(
        `${envVarName} 환경 변수가 설정되지 않았습니다. ` +
          `.env.local 파일에 ${envVarName}를 추가해주세요.`
      );
    }
    return key;
  }
}
