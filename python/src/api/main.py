"""
FastAPI ML 서비스 메인 엔트리포인트

성적 예측, 콘텐츠 추천, 학습 패턴 분석 API를 제공합니다.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import predictions, recommendations, analysis


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """애플리케이션 라이프사이클 관리"""
    # 시작 시 ML 모델 로드 등
    print("ML 서비스 시작...")
    yield
    # 종료 시 정리
    print("ML 서비스 종료...")


app = FastAPI(
    title="TimeLevelUp ML API",
    description="학습 데이터 분석 및 ML 기반 예측/추천 서비스",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(predictions.router, prefix="/api/predictions", tags=["예측"])
app.include_router(recommendations.router, prefix="/api/recommendations", tags=["추천"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["분석"])


@app.get("/")
async def root():
    """헬스체크"""
    return {
        "service": "TimeLevelUp ML API",
        "status": "healthy",
        "version": "0.1.0",
    }


@app.get("/health")
async def health_check():
    """상세 헬스체크"""
    return {
        "status": "healthy",
        "services": {
            "api": "up",
            "database": "up",
            "ml_models": "loaded",
        },
    }
