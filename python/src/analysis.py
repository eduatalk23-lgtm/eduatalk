"""
학습 데이터 분석 유틸리티

학습 패턴 분석, 성적 트렌드 분석 등의 함수를 제공합니다.
"""

from datetime import datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats


def analyze_learning_patterns(
    plans_df: pd.DataFrame,
    executions_df: pd.DataFrame | None = None,
) -> dict[str, Any]:
    """
    학습 패턴 분석

    Args:
        plans_df: 학습 플랜 DataFrame
        executions_df: 플랜 실행 기록 DataFrame (optional)

    Returns:
        분석 결과 딕셔너리
    """
    if plans_df.empty:
        return {"error": "플랜 데이터가 없습니다."}

    analysis = {}

    # 1. 요일별 학습량 분석
    if "scheduled_date" in plans_df.columns:
        plans_df["day_of_week"] = pd.to_datetime(plans_df["scheduled_date"]).dt.dayofweek
        daily_counts = plans_df.groupby("day_of_week").size()
        analysis["daily_distribution"] = {
            "counts": {int(k): int(v) for k, v in daily_counts.to_dict().items()},
            "most_active_day": int(daily_counts.idxmax()),
            "least_active_day": int(daily_counts.idxmin()),
        }

    # 2. 시간대별 분석 (start_time이 있는 경우)
    if "start_time" in plans_df.columns:
        plans_df["hour"] = pd.to_datetime(
            plans_df["start_time"], format="%H:%M", errors="coerce"
        ).dt.hour
        hourly_counts = plans_df.dropna(subset=["hour"]).groupby("hour").size()
        if not hourly_counts.empty:
            analysis["hourly_distribution"] = {
                "peak_hours": [int(h) for h in hourly_counts.nlargest(3).index.tolist()],
                "low_hours": [int(h) for h in hourly_counts.nsmallest(3).index.tolist()],
            }

    # 3. 과목별 분석
    if "subject" in plans_df.columns:
        subject_counts = plans_df["subject"].value_counts()
        analysis["subject_distribution"] = {
            "counts": {str(k): int(v) for k, v in subject_counts.to_dict().items()},
            "most_studied": str(subject_counts.index[0]) if len(subject_counts) > 0 else None,
        }

    # 4. 완료율 분석
    if "status" in plans_df.columns:
        total = len(plans_df)
        completed = len(plans_df[plans_df["status"] == "completed"])
        analysis["completion_rate"] = {
            "total": total,
            "completed": completed,
            "rate": round(completed / total * 100, 2) if total > 0 else 0,
        }

    # 5. 평균 학습 시간
    if "actual_duration" in plans_df.columns:
        avg_duration = plans_df["actual_duration"].mean()
        analysis["average_duration"] = {
            "minutes": round(avg_duration, 1) if pd.notna(avg_duration) else 0,
        }

    return analysis


def _convert_numpy_types(obj: Any) -> Any:
    """numpy 타입을 Python 네이티브 타입으로 변환"""
    if isinstance(obj, dict):
        return {k: _convert_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_convert_numpy_types(v) for v in obj]
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


def analyze_score_trends(
    scores_df: pd.DataFrame,
    window: int = 5,
) -> dict[str, Any]:
    """
    성적 트렌드 분석

    Args:
        scores_df: 성적 DataFrame
        window: 이동평균 윈도우 크기

    Returns:
        분석 결과 딕셔너리
    """
    if scores_df.empty:
        return {"error": "성적 데이터가 없습니다."}

    analysis = {}

    # 1. 과목별 평균 성적
    if "subject" in scores_df.columns and "score" in scores_df.columns:
        subject_avg = scores_df.groupby("subject")["score"].agg(["mean", "std", "count"])
        analysis["subject_averages"] = _convert_numpy_types(subject_avg.to_dict("index"))

    # 2. 전체 성적 추이
    if "created_at" in scores_df.columns and "score" in scores_df.columns:
        scores_df = scores_df.sort_values("created_at")
        scores_df["score_ma"] = scores_df["score"].rolling(window=window).mean()

        if len(scores_df) >= 2:
            first_score = float(scores_df["score"].iloc[0])
            last_score = float(scores_df["score"].iloc[-1])
            trend = "improving" if last_score > first_score else "declining"
            analysis["overall_trend"] = {
                "direction": trend,
                "first_score": first_score,
                "last_score": last_score,
                "change": round(last_score - first_score, 2),
            }

    # 3. 등급별 분포
    if "grade" in scores_df.columns:
        grade_dist = scores_df["grade"].value_counts().sort_index()
        analysis["grade_distribution"] = _convert_numpy_types(grade_dist.to_dict())

    # 4. 취약 과목 분석 (상위 3개)
    if "subject" in scores_df.columns and "score" in scores_df.columns:
        weak_subjects = (
            scores_df.groupby("subject")["score"]
            .mean()
            .nsmallest(3)
        )
        analysis["weak_subjects"] = _convert_numpy_types(weak_subjects.to_dict())

    return analysis


def calculate_study_efficiency(
    plans_df: pd.DataFrame,
    scores_df: pd.DataFrame,
) -> dict[str, Any]:
    """
    학습 효율성 분석

    플랜 실행과 성적 변화의 상관관계를 분석합니다.

    Args:
        plans_df: 학습 플랜 DataFrame
        scores_df: 성적 DataFrame

    Returns:
        효율성 분석 결과
    """
    if plans_df.empty or scores_df.empty:
        return {"error": "데이터가 부족합니다."}

    analysis = {}

    # 과목별 학습 시간 vs 성적 상관관계
    if "subject" in plans_df.columns and "actual_duration" in plans_df.columns:
        study_time_by_subject = plans_df.groupby("subject")["actual_duration"].sum()

        if "subject" in scores_df.columns and "score" in scores_df.columns:
            avg_score_by_subject = scores_df.groupby("subject")["score"].mean()

            # 공통 과목에 대해 상관관계 계산
            common_subjects = set(study_time_by_subject.index) & set(avg_score_by_subject.index)
            if len(common_subjects) >= 3:
                study_times = [study_time_by_subject[s] for s in common_subjects]
                scores = [avg_score_by_subject[s] for s in common_subjects]

                correlation, p_value = stats.pearsonr(study_times, scores)
                analysis["study_score_correlation"] = {
                    "correlation": round(correlation, 3),
                    "p_value": round(p_value, 4),
                    "significant": p_value < 0.05,
                }

    return analysis


def predict_weekly_workload(
    plans_df: pd.DataFrame,
    target_date: datetime | None = None,
) -> dict[str, Any]:
    """
    주간 학습량 예측

    과거 패턴을 기반으로 다음 주 학습량을 예측합니다.

    Args:
        plans_df: 학습 플랜 DataFrame
        target_date: 예측 대상 주의 시작일 (기본값: 다음 월요일)

    Returns:
        예측 결과
    """
    if plans_df.empty:
        return {"error": "플랜 데이터가 없습니다."}

    if target_date is None:
        today = datetime.now()
        days_until_monday = (7 - today.weekday()) % 7
        target_date = today + timedelta(days=days_until_monday or 7)

    # 최근 4주간 평균 학습량
    if "scheduled_date" in plans_df.columns:
        plans_df["date"] = pd.to_datetime(plans_df["scheduled_date"])
        four_weeks_ago = target_date - timedelta(weeks=4)

        recent_plans = plans_df[
            (plans_df["date"] >= four_weeks_ago) & (plans_df["date"] < target_date)
        ]

        if not recent_plans.empty:
            recent_plans["week"] = recent_plans["date"].dt.isocalendar().week
            weekly_counts = recent_plans.groupby("week").size()

            return {
                "predicted_plans": round(weekly_counts.mean()),
                "std": round(weekly_counts.std(), 2),
                "min_expected": max(0, round(weekly_counts.mean() - weekly_counts.std())),
                "max_expected": round(weekly_counts.mean() + weekly_counts.std()),
                "target_week_start": target_date.strftime("%Y-%m-%d"),
            }

    return {"error": "날짜 데이터가 없습니다."}
