"""
예측 API 라우트

성적 예측, 학습량 예측 등의 엔드포인트를 제공합니다.
"""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ...db_connector import get_connector
from ...ml.score_predictor import ScorePredictor

router = APIRouter()


# ============================================
# 요청/응답 스키마
# ============================================


class ScorePredictionRequest(BaseModel):
    """성적 예측 요청"""

    student_id: str = Field(..., description="학생 ID")
    subject: str = Field(..., description="예측할 과목")
    days_ahead: int = Field(default=30, description="예측 기간 (일)")


class ScorePredictionResponse(BaseModel):
    """성적 예측 응답"""

    student_id: str
    subject: str
    current_score: float | None
    predicted_score: float
    confidence: float
    trend: str  # "improving", "stable", "declining"
    factors: dict[str, Any]


class WorkloadPredictionRequest(BaseModel):
    """학습량 예측 요청"""

    student_id: str = Field(..., description="학생 ID")
    weeks_ahead: int = Field(default=1, description="예측 기간 (주)")


class WorkloadPredictionResponse(BaseModel):
    """학습량 예측 응답"""

    student_id: str
    predicted_plans: int
    confidence_interval: tuple[int, int]
    recommended_daily_minutes: int


# ============================================
# 엔드포인트
# ============================================


@router.post("/score", response_model=ScorePredictionResponse)
async def predict_score(request: ScorePredictionRequest) -> ScorePredictionResponse:
    """
    학생의 특정 과목 성적을 예측합니다.

    - 과거 성적 데이터 기반
    - 학습 패턴 분석 반영
    - 신뢰도와 함께 반환
    """
    try:
        db = get_connector()
        predictor = ScorePredictor()

        # 학생 성적 데이터 조회
        scores_df = db.get_student_scores(request.student_id)
        plans_df = db.get_student_plans(request.student_id)

        if scores_df.empty:
            raise HTTPException(
                status_code=404,
                detail="학생의 성적 데이터가 없습니다.",
            )

        # 해당 과목 데이터 필터링
        subject_scores = scores_df[scores_df["subject"] == request.subject]

        if subject_scores.empty:
            raise HTTPException(
                status_code=404,
                detail=f"{request.subject} 과목의 성적 데이터가 없습니다.",
            )

        # 예측 실행
        prediction = predictor.predict(
            scores_df=scores_df,
            plans_df=plans_df,
            subject=request.subject,
            days_ahead=request.days_ahead,
        )

        return ScorePredictionResponse(
            student_id=request.student_id,
            subject=request.subject,
            current_score=prediction["current_score"],
            predicted_score=prediction["predicted_score"],
            confidence=prediction["confidence"],
            trend=prediction["trend"],
            factors=prediction["factors"],
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/workload", response_model=WorkloadPredictionResponse)
async def predict_workload(
    request: WorkloadPredictionRequest,
) -> WorkloadPredictionResponse:
    """
    학생의 주간 학습량을 예측합니다.

    - 과거 학습 패턴 기반
    - 계절성 고려
    """
    try:
        db = get_connector()

        # 학습 플랜 데이터 조회
        plans_df = db.get_student_plans(request.student_id)

        if plans_df.empty:
            return WorkloadPredictionResponse(
                student_id=request.student_id,
                predicted_plans=0,
                confidence_interval=(0, 0),
                recommended_daily_minutes=180,
            )

        # 최근 4주 평균 계산
        from ...analysis import predict_weekly_workload

        prediction = predict_weekly_workload(plans_df)

        if "error" in prediction:
            return WorkloadPredictionResponse(
                student_id=request.student_id,
                predicted_plans=0,
                confidence_interval=(0, 0),
                recommended_daily_minutes=180,
            )

        return WorkloadPredictionResponse(
            student_id=request.student_id,
            predicted_plans=prediction["predicted_plans"],
            confidence_interval=(
                prediction["min_expected"],
                prediction["max_expected"],
            ),
            recommended_daily_minutes=180,  # 기본값
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subjects/{student_id}")
async def get_predictable_subjects(student_id: str) -> dict[str, Any]:
    """
    예측 가능한 과목 목록을 반환합니다.
    """
    try:
        db = get_connector()
        scores_df = db.get_student_scores(student_id)

        if scores_df.empty:
            return {"subjects": [], "message": "성적 데이터가 없습니다."}

        subjects = scores_df["subject"].unique().tolist()
        subject_counts = scores_df["subject"].value_counts().to_dict()

        # 최소 3개 이상의 데이터가 있는 과목만 예측 가능
        predictable = [s for s in subjects if subject_counts.get(s, 0) >= 3]

        return {
            "subjects": predictable,
            "all_subjects": subjects,
            "data_counts": subject_counts,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
