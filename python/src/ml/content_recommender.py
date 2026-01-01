"""
콘텐츠 추천 모델

학습 이력, 성적, 취약 과목 등을 기반으로 적합한 학습 콘텐츠를 추천합니다.
"""

from typing import Any

import numpy as np
import pandas as pd


class ContentRecommender:
    """
    콘텐츠 추천 엔진

    협업 필터링과 콘텐츠 기반 필터링을 조합하여 추천합니다.
    """

    def __init__(self, weak_subject_threshold: float = 60.0):
        """
        Args:
            weak_subject_threshold: 취약 과목 판정 기준 점수
        """
        self.weak_subject_threshold = weak_subject_threshold

    def recommend(
        self,
        scores_df: pd.DataFrame,
        contents_df: pd.DataFrame,
        plans_df: pd.DataFrame | None,
        subject: str | None = None,
        limit: int = 5,
        include_reasons: bool = True,
    ) -> dict[str, Any]:
        """
        학습 콘텐츠 추천

        Args:
            scores_df: 성적 DataFrame
            contents_df: 콘텐츠 DataFrame
            plans_df: 학습 플랜 DataFrame (선택)
            subject: 특정 과목 필터 (선택)
            limit: 추천 개수
            include_reasons: 추천 이유 포함 여부

        Returns:
            추천 결과 딕셔너리
        """
        # 취약 과목 분석
        weak_subjects = self._identify_weak_subjects(scores_df)

        # 학습 이력 분석
        studied_content_ids = self._get_studied_content_ids(plans_df)

        # 추천 전략 결정
        strategy = self._determine_strategy(weak_subjects, scores_df)

        # 콘텐츠 필터링
        filtered_contents = self._filter_contents(
            contents_df=contents_df,
            subject=subject,
            studied_ids=studied_content_ids,
        )

        if filtered_contents.empty:
            return {
                "recommendations": [],
                "weak_subjects": weak_subjects,
                "strategy": "no_content",
            }

        # 콘텐츠 점수 계산
        scored_contents = self._score_contents(
            contents=filtered_contents,
            weak_subjects=weak_subjects,
            scores_df=scores_df,
            plans_df=plans_df,
        )

        # 상위 N개 선택
        top_contents = scored_contents.nlargest(limit, "relevance_score")

        # 추천 결과 구성
        recommendations = []
        for _, row in top_contents.iterrows():
            rec = {
                "content_id": row["id"],
                "title": row.get("title", ""),
                "subject": row.get("subject", ""),
                "content_type": row.get("content_type", ""),
                "difficulty": row.get("difficulty"),
                "relevance_score": round(row["relevance_score"], 2),
            }

            if include_reasons:
                rec["reason"] = self._generate_reason(row, weak_subjects)

            recommendations.append(rec)

        return {
            "recommendations": recommendations,
            "weak_subjects": weak_subjects,
            "strategy": strategy,
        }

    def _identify_weak_subjects(self, scores_df: pd.DataFrame) -> list[str]:
        """취약 과목 식별"""
        if scores_df.empty or "subject" not in scores_df.columns:
            return []

        subject_avg = scores_df.groupby("subject")["score"].mean()
        overall_avg = scores_df["score"].mean()

        # 전체 평균 또는 기준 점수보다 낮은 과목
        threshold = min(overall_avg, self.weak_subject_threshold)
        weak = subject_avg[subject_avg < threshold].sort_values()

        return weak.index.tolist()

    def _get_studied_content_ids(self, plans_df: pd.DataFrame | None) -> set[str]:
        """학습한 콘텐츠 ID 수집"""
        if plans_df is None or plans_df.empty:
            return set()

        if "content_id" not in plans_df.columns:
            return set()

        return set(plans_df["content_id"].dropna().unique())

    def _determine_strategy(
        self,
        weak_subjects: list[str],
        scores_df: pd.DataFrame,
    ) -> str:
        """추천 전략 결정"""
        if not weak_subjects:
            if scores_df.empty:
                return "exploration"  # 데이터 없음, 탐색 모드
            return "balanced"  # 균형 잡힌 학습

        if len(weak_subjects) >= 3:
            return "weak_focus"  # 취약 과목 집중

        return "weak_priority"  # 취약 과목 우선

    def _filter_contents(
        self,
        contents_df: pd.DataFrame,
        subject: str | None,
        studied_ids: set[str],
    ) -> pd.DataFrame:
        """콘텐츠 필터링"""
        filtered = contents_df.copy()

        # 특정 과목 필터
        if subject and "subject" in filtered.columns:
            filtered = filtered[filtered["subject"] == subject]

        # 이미 학습한 콘텐츠 제외 (선택적)
        # 복습을 위해 완전히 제외하지 않고 가중치만 낮춤
        if "id" in filtered.columns:
            filtered["is_studied"] = filtered["id"].isin(studied_ids)
        else:
            filtered["is_studied"] = False

        return filtered

    def _score_contents(
        self,
        contents: pd.DataFrame,
        weak_subjects: list[str],
        scores_df: pd.DataFrame,
        plans_df: pd.DataFrame | None,
    ) -> pd.DataFrame:
        """콘텐츠 점수 계산"""
        scored = contents.copy()
        scored["relevance_score"] = 0.0

        # 1. 취약 과목 가중치 (0-40점)
        if weak_subjects and "subject" in scored.columns:
            weak_set = set(weak_subjects)
            scored["weak_subject_score"] = scored["subject"].apply(
                lambda x: 40.0 if x in weak_set else 10.0
            )
        else:
            scored["weak_subject_score"] = 10.0

        # 2. 난이도 적합성 (0-30점)
        scored["difficulty_score"] = self._calculate_difficulty_score(
            scored, scores_df
        )

        # 3. 콘텐츠 유형 다양성 (0-20점)
        scored["diversity_score"] = self._calculate_diversity_score(
            scored, plans_df
        )

        # 4. 신규 콘텐츠 가중치 (0-10점)
        scored["novelty_score"] = scored["is_studied"].apply(
            lambda x: 0.0 if x else 10.0
        )

        # 총점 계산
        scored["relevance_score"] = (
            scored["weak_subject_score"]
            + scored["difficulty_score"]
            + scored["diversity_score"]
            + scored["novelty_score"]
        )

        return scored

    def _calculate_difficulty_score(
        self,
        contents: pd.DataFrame,
        scores_df: pd.DataFrame,
    ) -> pd.Series:
        """난이도 적합성 점수 계산"""
        if "difficulty" not in contents.columns:
            return pd.Series([15.0] * len(contents), index=contents.index)

        # 학생 수준 추정 (평균 점수 기반)
        if not scores_df.empty:
            avg_score = scores_df["score"].mean()
            if avg_score >= 80:
                preferred_difficulty = "hard"
            elif avg_score >= 60:
                preferred_difficulty = "medium"
            else:
                preferred_difficulty = "easy"
        else:
            preferred_difficulty = "medium"

        # 난이도 매칭 점수
        difficulty_map = {
            "easy": {"easy": 30, "medium": 20, "hard": 10},
            "medium": {"easy": 15, "medium": 30, "hard": 20},
            "hard": {"easy": 10, "medium": 20, "hard": 30},
        }

        return contents["difficulty"].apply(
            lambda x: difficulty_map.get(preferred_difficulty, {}).get(x, 15)
        )

    def _calculate_diversity_score(
        self,
        contents: pd.DataFrame,
        plans_df: pd.DataFrame | None,
    ) -> pd.Series:
        """콘텐츠 유형 다양성 점수"""
        if "content_type" not in contents.columns:
            return pd.Series([10.0] * len(contents), index=contents.index)

        # 최근 학습한 콘텐츠 유형 분석
        recent_types = set()
        if plans_df is not None and not plans_df.empty:
            if "content_type" in plans_df.columns:
                recent_types = set(plans_df["content_type"].dropna().unique())

        # 최근 학습하지 않은 유형에 가중치
        return contents["content_type"].apply(
            lambda x: 20.0 if x not in recent_types else 10.0
        )

    def _generate_reason(
        self,
        content_row: pd.Series,
        weak_subjects: list[str],
    ) -> str:
        """추천 이유 생성"""
        reasons = []

        subject = content_row.get("subject", "")
        if subject in weak_subjects:
            reasons.append(f"취약 과목({subject}) 보완")

        difficulty = content_row.get("difficulty")
        if difficulty:
            difficulty_kr = {"easy": "쉬움", "medium": "보통", "hard": "어려움"}
            reasons.append(f"난이도: {difficulty_kr.get(difficulty, difficulty)}")

        content_type = content_row.get("content_type")
        if content_type:
            type_kr = {
                "book": "교재",
                "lecture": "강의",
                "video": "영상",
                "problem": "문제풀이",
            }
            reasons.append(f"유형: {type_kr.get(content_type, content_type)}")

        if not content_row.get("is_studied", False):
            reasons.append("신규 콘텐츠")

        return " | ".join(reasons) if reasons else "맞춤 추천"


class CollaborativeRecommender:
    """
    협업 필터링 기반 추천

    유사한 학습 패턴을 가진 학생들의 데이터를 활용합니다.
    (향후 확장용)
    """

    def __init__(self, min_common_items: int = 3):
        self.min_common_items = min_common_items

    def find_similar_students(
        self,
        student_id: str,
        all_plans: pd.DataFrame,
    ) -> list[str]:
        """유사 학생 찾기"""
        if all_plans.empty:
            return []

        # 학생별 학습한 콘텐츠 집합
        student_contents = all_plans.groupby("student_id")["content_id"].apply(set)

        if student_id not in student_contents.index:
            return []

        target_contents = student_contents[student_id]

        # Jaccard 유사도 계산
        similarities = []
        for other_id, other_contents in student_contents.items():
            if other_id == student_id:
                continue

            intersection = len(target_contents & other_contents)
            if intersection < self.min_common_items:
                continue

            union = len(target_contents | other_contents)
            similarity = intersection / union if union > 0 else 0

            similarities.append((other_id, similarity))

        # 상위 유사 학생 반환
        similarities.sort(key=lambda x: x[1], reverse=True)
        return [s[0] for s in similarities[:10]]

    def get_collaborative_recommendations(
        self,
        student_id: str,
        similar_students: list[str],
        all_plans: pd.DataFrame,
        contents_df: pd.DataFrame,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """협업 필터링 추천"""
        if not similar_students:
            return []

        # 타겟 학생이 학습하지 않은 콘텐츠 중
        # 유사 학생들이 많이 학습한 콘텐츠 추천
        target_contents = set(
            all_plans[all_plans["student_id"] == student_id]["content_id"]
        )

        similar_plans = all_plans[all_plans["student_id"].isin(similar_students)]
        content_counts = similar_plans["content_id"].value_counts()

        # 타겟이 학습하지 않은 콘텐츠만
        new_contents = content_counts[~content_counts.index.isin(target_contents)]

        top_content_ids = new_contents.head(limit).index.tolist()

        # 콘텐츠 정보 조회
        recommendations = []
        for content_id in top_content_ids:
            content_info = contents_df[contents_df["id"] == content_id]
            if not content_info.empty:
                row = content_info.iloc[0]
                recommendations.append(
                    {
                        "content_id": content_id,
                        "title": row.get("title", ""),
                        "subject": row.get("subject", ""),
                        "reason": "유사 학생들이 학습한 콘텐츠",
                    }
                )

        return recommendations
