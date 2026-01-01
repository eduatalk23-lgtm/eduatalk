# ADR-002: Python 마이크로서비스 아키텍처 도입

## 상태

**제안됨** (Proposed)

## 맥락

TimeLevelUp 서비스에서 고급 데이터 분석, ML 기반 추천, 배치 처리 등의 기능을 개선하고자 합니다. 현재 모든 비즈니스 로직이 TypeScript/Next.js로 구현되어 있으나, 일부 기능은 Python 생태계가 더 적합합니다.

### 현재 상황

- 모든 로직이 Next.js 모노리스에 존재
- 데이터 분석은 Supabase SQL 쿼리로 제한적
- ML 기반 추천/예측 기능 부재
- 복잡한 수치 연산의 성능 한계

### Python이 필요한 영역

1. **데이터 분석**: pandas, numpy를 활용한 학습 패턴 분석
2. **ML 추천**: scikit-learn, XGBoost를 활용한 콘텐츠 추천
3. **성적 예측**: 시계열 분석을 통한 성적 트렌드 예측
4. **배치 처리**: 대량 데이터 처리 및 리포트 생성

## 고려한 옵션

### 옵션 1: Python으로 전체 백엔드 마이그레이션

**장점:**
- 일관된 기술 스택
- Python 생태계 전면 활용

**단점:**
- 대규모 마이그레이션 비용
- 기존 Next.js 투자 손실
- 프론트엔드-백엔드 분리로 복잡도 증가

### 옵션 2: Python 마이크로서비스 (선택)

**장점:**
- 점진적 도입 가능
- 기존 시스템 영향 최소화
- 필요한 기능만 Python으로 구현
- 독립적 스케일링

**단점:**
- 서비스 간 통신 오버헤드
- 추가 인프라 관리
- 데이터 동기화 복잡도

### 옵션 3: TypeScript 내 Python 런타임 (pyodide 등)

**장점:**
- 배포 단순화
- 추가 인프라 불필요

**단점:**
- 성능 제한
- 라이브러리 호환성 문제
- 메모리 제약

### 옵션 4: 현상 유지 (TypeScript만 사용)

**장점:**
- 추가 비용 없음
- 기술 스택 단순

**단점:**
- ML/분석 기능 한계
- 데이터 과학 생태계 활용 불가

## 결정

**옵션 2: Python 마이크로서비스를 도입합니다.**

### 이유

1. **점진적 도입**: 운영 중인 서비스에 영향 없이 새 기능 추가 가능
2. **적절한 도구 사용**: 데이터 분석/ML에는 Python이 최적
3. **독립적 운영**: Python 서비스만 별도 스케일링/배포 가능
4. **리스크 최소화**: 5% 정도의 기능만 Python으로 분리

## 구현 계획

### 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                       Next.js Monolith (95%)                     │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    App Router                             │   │
│  │  - UI 렌더링                                              │   │
│  │  - Server Actions                                         │   │
│  │  - API Routes                                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              lib/services/pythonClient.ts                 │   │
│  │  - Python API 호출                                        │   │
│  │  - 응답 캐싱                                              │   │
│  │  - 폴백 처리                                              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP/REST
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Python FastAPI (5%)                          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ /recommend   │  │ /predict     │  │ /analyze     │          │
│  │              │  │              │  │              │          │
│  │ 콘텐츠 추천  │  │ 성적 예측   │  │ 패턴 분석   │          │
│  │ (ML)         │  │ (시계열)    │  │ (통계)      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Shared Components                      │   │
│  │  - Supabase Connector                                     │   │
│  │  - Model Cache (Redis)                                    │   │
│  │  - Background Tasks (Celery/RQ)                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Supabase                                  │
│                (공유 데이터베이스)                               │
└─────────────────────────────────────────────────────────────────┘
```

### 단계별 도입

#### Phase 3a: Jupyter 분석 환경 (1-2주)

개발/분석용 Jupyter 환경을 먼저 구축합니다.

```
python/
├── notebooks/
│   ├── learning_pattern_analysis.ipynb    # 학습 패턴 분석
│   ├── score_trend_analysis.ipynb         # 성적 트렌드 분석
│   └── content_effectiveness.ipynb        # 콘텐츠 효과성 분석
├── src/
│   ├── __init__.py
│   ├── db_connector.py                    # Supabase 연결
│   └── utils/
│       ├── __init__.py
│       └── transformers.py                # 데이터 변환
├── requirements.txt
└── README.md
```

**db_connector.py:**
```python
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

def get_supabase_client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)

def get_student_scores(student_id: str) -> list[dict]:
    client = get_supabase_client()
    response = client.table("scores").select("*").eq("student_id", student_id).execute()
    return response.data

def get_learning_history(student_id: str) -> list[dict]:
    client = get_supabase_client()
    response = (
        client.table("student_plan")
        .select("*, content:student_content_masters(*)")
        .eq("student_id", student_id)
        .eq("status", "completed")
        .execute()
    )
    return response.data
```

#### Phase 3b: FastAPI 서비스 (2-3주)

분석 로직을 API로 서빙합니다.

```
python/
├── api/
│   ├── __init__.py
│   ├── main.py                           # FastAPI 앱
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── recommendations.py            # 추천 API
│   │   ├── predictions.py                # 예측 API
│   │   └── analytics.py                  # 분석 API
│   ├── models/
│   │   ├── __init__.py
│   │   ├── content_recommender.py        # 콘텐츠 추천 모델
│   │   └── score_predictor.py            # 성적 예측 모델
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── recommendation.py
│   │   └── prediction.py
│   └── dependencies.py                   # 의존성 주입
├── tests/
│   ├── __init__.py
│   ├── test_recommendations.py
│   └── test_predictions.py
├── Dockerfile
├── requirements.txt
└── pyproject.toml
```

**main.py:**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import recommendations, predictions, analytics

app = FastAPI(
    title="TimeLevelUp ML API",
    version="0.1.0",
    docs_url="/docs",
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://timelevelup.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(
    recommendations.router,
    prefix="/api/recommendations",
    tags=["recommendations"],
)
app.include_router(
    predictions.router,
    prefix="/api/predictions",
    tags=["predictions"],
)
app.include_router(
    analytics.router,
    prefix="/api/analytics",
    tags=["analytics"],
)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

**recommendations.py:**
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..models.content_recommender import ContentRecommender
from ..dependencies import get_supabase_client

router = APIRouter()
recommender = ContentRecommender()

class RecommendationRequest(BaseModel):
    student_id: str
    subject_ids: list[str] | None = None
    limit: int = 10

class RecommendationResponse(BaseModel):
    content_ids: list[str]
    scores: list[float]
    reasoning: list[str]

@router.post("/contents", response_model=RecommendationResponse)
async def recommend_contents(request: RecommendationRequest):
    try:
        client = get_supabase_client()

        # 학생 학습 이력 조회
        history = (
            client.table("student_plan")
            .select("content_id, status, completed_at")
            .eq("student_id", request.student_id)
            .execute()
        )

        # 추천 생성
        recommendations = recommender.recommend(
            student_history=history.data,
            subject_ids=request.subject_ids,
            limit=request.limit,
        )

        return RecommendationResponse(
            content_ids=recommendations["content_ids"],
            scores=recommendations["scores"],
            reasoning=recommendations["reasoning"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

**content_recommender.py:**
```python
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from typing import TypedDict

class RecommendationResult(TypedDict):
    content_ids: list[str]
    scores: list[float]
    reasoning: list[str]

class ContentRecommender:
    def __init__(self):
        self.model = None
        self._load_model()

    def _load_model(self):
        """모델 로드 또는 초기화"""
        # TODO: 학습된 모델 로드
        pass

    def recommend(
        self,
        student_history: list[dict],
        subject_ids: list[str] | None = None,
        limit: int = 10,
    ) -> RecommendationResult:
        """
        학생 학습 이력 기반 콘텐츠 추천

        알고리즘:
        1. 학생의 완료/미완료 패턴 분석
        2. 유사 학생의 학습 경로 참조
        3. 난이도 적절성 평가
        4. 과목별 균형 고려
        """
        completed = [h for h in student_history if h["status"] == "completed"]
        pending = [h for h in student_history if h["status"] != "completed"]

        # 완료율 기반 난이도 조정
        completion_rate = len(completed) / max(len(student_history), 1)

        # 협업 필터링 기반 추천
        # TODO: 실제 추천 로직 구현

        return RecommendationResult(
            content_ids=["content-1", "content-2"],
            scores=[0.95, 0.87],
            reasoning=["완료율 높은 유사 패턴", "약점 과목 보강"],
        )
```

### TypeScript 클라이언트

```typescript
// lib/services/pythonClient.ts

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';

interface PythonClientConfig {
  timeout?: number;
  retries?: number;
  cacheTtl?: number;
}

class PythonClient {
  private config: PythonClientConfig;

  constructor(config: PythonClientConfig = {}) {
    this.config = {
      timeout: config.timeout || 10000,
      retries: config.retries || 2,
      cacheTtl: config.cacheTtl || 300,
    };
  }

  async getContentRecommendations(
    studentId: string,
    options?: { subjectIds?: string[]; limit?: number }
  ): Promise<ContentRecommendation[]> {
    const response = await this.fetch('/api/recommendations/contents', {
      method: 'POST',
      body: JSON.stringify({
        student_id: studentId,
        subject_ids: options?.subjectIds,
        limit: options?.limit || 10,
      }),
    });

    return response.content_ids.map((id: string, i: number) => ({
      contentId: id,
      score: response.scores[i],
      reasoning: response.reasoning[i],
    }));
  }

  async predictScore(
    studentId: string,
    subjectId: string,
    targetDate: Date
  ): Promise<ScorePrediction> {
    const response = await this.fetch('/api/predictions/score', {
      method: 'POST',
      body: JSON.stringify({
        student_id: studentId,
        subject_id: subjectId,
        target_date: targetDate.toISOString(),
      }),
    });

    return {
      predictedScore: response.predicted_score,
      confidence: response.confidence,
      factors: response.factors,
    };
  }

  async analyzePatterns(studentId: string): Promise<PatternAnalysis> {
    const response = await this.fetch('/api/analytics/patterns', {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId }),
    });

    return {
      preferredTimeSlots: response.preferred_time_slots,
      averageSessionDuration: response.avg_session_duration,
      peakProductivityHours: response.peak_hours,
      subjectStrengths: response.subject_strengths,
    };
  }

  private async fetch(path: string, options: RequestInit) {
    const url = `${PYTHON_API_URL}${path}`;

    let lastError: Error | null = null;
    for (let i = 0; i <= this.config.retries!; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          signal: AbortSignal.timeout(this.config.timeout!),
        });

        if (!response.ok) {
          throw new Error(`Python API error: ${response.status}`);
        }

        return response.json();
      } catch (error) {
        lastError = error as Error;
        if (i < this.config.retries!) {
          await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        }
      }
    }

    throw lastError;
  }
}

export const pythonClient = new PythonClient();
```

### 폴백 전략

Python 서비스 장애 시 TypeScript 기반 폴백:

```typescript
// lib/services/recommendations.ts

import { pythonClient } from './pythonClient';
import { getBasicRecommendations } from './fallbackRecommendations';

export async function getContentRecommendations(
  studentId: string,
  options?: RecommendationOptions
): Promise<ContentRecommendation[]> {
  try {
    // Python ML 서비스 시도
    return await pythonClient.getContentRecommendations(studentId, options);
  } catch (error) {
    console.warn('Python service unavailable, using fallback:', error);

    // TypeScript 기반 간단 추천으로 폴백
    return await getBasicRecommendations(studentId, options);
  }
}
```

### 배포

**Railway/Render 배포:**

```dockerfile
# python/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스 코드 복사
COPY api/ ./api/

# 포트 설정
EXPOSE 8000

# 실행
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**환경 변수:**
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
REDIS_URL=redis://xxx  # 캐싱용 (선택)
```

## 결과

### 예상 비용

| 서비스 | 월간 비용 |
|--------|----------|
| Railway/Render | $10-20 |
| Redis (선택) | $5-10 |
| **총계** | $15-30 |

### 마이그레이션 대상

| 현재 TypeScript 모듈 | Python 마이그레이션 가치 | 우선순위 |
|---------------------|-------------------------|---------|
| `lib/scheduler/SchedulerEngine` | 높음 (NumPy 최적화) | P2 |
| `lib/analysis/scoreAnalyzer` | 높음 (ML 예측) | P1 |
| `lib/recommendations/` | 중간 (협업 필터링) | P1 |
| `lib/services/reportGenerator` | 중간 (배치 처리) | P3 |

### 성공 지표

| 지표 | 목표 |
|------|------|
| API 응답 시간 | < 500ms |
| 가용성 | > 99% |
| 추천 정확도 | 측정 예정 |

## 관련 문서

- [PRD: Notion 스타일 플랜 관리](./PRD-notion-style-plan-management.md)
- [TDD: 플랜 도메인 기술 설계](./TDD-plan-domain-enhancement.md)
- [ADR-001: LLM 통합](./ADR-001-llm-integration.md)
