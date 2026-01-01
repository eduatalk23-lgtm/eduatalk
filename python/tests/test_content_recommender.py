"""
ContentRecommender 테스트
"""

import pandas as pd
import pytest

from src.ml.content_recommender import ContentRecommender, CollaborativeRecommender


class TestContentRecommender:
    """ContentRecommender 단위 테스트"""

    @pytest.fixture
    def recommender(self):
        """테스트용 추천기 인스턴스"""
        return ContentRecommender(weak_subject_threshold=60.0)

    @pytest.fixture
    def sample_scores(self):
        """샘플 성적 데이터"""
        return pd.DataFrame(
            {
                "subject": ["수학", "수학", "영어", "영어", "과학", "과학"],
                "score": [55, 58, 75, 78, 45, 48],  # 수학, 과학이 취약
            }
        )

    @pytest.fixture
    def sample_contents(self):
        """샘플 콘텐츠 데이터"""
        return pd.DataFrame(
            {
                "id": ["c1", "c2", "c3", "c4", "c5"],
                "title": ["수학 기초", "영어 문법", "과학 개념", "수학 심화", "영어 독해"],
                "subject": ["수학", "영어", "과학", "수학", "영어"],
                "content_type": ["book", "lecture", "video", "book", "lecture"],
                "difficulty": ["easy", "medium", "easy", "hard", "medium"],
            }
        )

    @pytest.fixture
    def sample_plans(self):
        """샘플 플랜 데이터"""
        return pd.DataFrame(
            {
                "content_id": ["c1", "c2"],
                "content_type": ["book", "lecture"],
            }
        )

    def test_recommend_basic(self, recommender, sample_scores, sample_contents, sample_plans):
        """기본 추천 테스트"""
        result = recommender.recommend(
            scores_df=sample_scores,
            contents_df=sample_contents,
            plans_df=sample_plans,
            limit=3,
        )

        assert "recommendations" in result
        assert "weak_subjects" in result
        assert "strategy" in result

        assert len(result["recommendations"]) <= 3
        assert "수학" in result["weak_subjects"] or "과학" in result["weak_subjects"]

    def test_recommend_with_subject_filter(self, recommender, sample_scores, sample_contents, sample_plans):
        """과목 필터링 추천"""
        result = recommender.recommend(
            scores_df=sample_scores,
            contents_df=sample_contents,
            plans_df=sample_plans,
            subject="수학",
            limit=5,
        )

        # 모든 추천이 수학이어야 함
        for rec in result["recommendations"]:
            assert rec["subject"] == "수학"

    def test_recommend_with_reasons(self, recommender, sample_scores, sample_contents, sample_plans):
        """추천 이유 포함"""
        result = recommender.recommend(
            scores_df=sample_scores,
            contents_df=sample_contents,
            plans_df=sample_plans,
            include_reasons=True,
        )

        for rec in result["recommendations"]:
            assert "reason" in rec
            assert rec["reason"] is not None

    def test_recommend_without_reasons(self, recommender, sample_scores, sample_contents, sample_plans):
        """추천 이유 미포함"""
        result = recommender.recommend(
            scores_df=sample_scores,
            contents_df=sample_contents,
            plans_df=sample_plans,
            include_reasons=False,
        )

        for rec in result["recommendations"]:
            assert rec.get("reason") is None

    def test_identify_weak_subjects(self, recommender, sample_scores):
        """취약 과목 식별"""
        weak = recommender._identify_weak_subjects(sample_scores)

        assert "수학" in weak  # 평균 56.5
        assert "과학" in weak  # 평균 46.5
        assert "영어" not in weak  # 평균 76.5

    def test_identify_weak_subjects_empty(self, recommender):
        """빈 데이터로 취약 과목 식별"""
        empty_df = pd.DataFrame()
        weak = recommender._identify_weak_subjects(empty_df)
        assert weak == []

    def test_get_studied_content_ids(self, recommender, sample_plans):
        """학습한 콘텐츠 ID 수집"""
        studied = recommender._get_studied_content_ids(sample_plans)
        assert "c1" in studied
        assert "c2" in studied
        assert len(studied) == 2

    def test_get_studied_content_ids_none(self, recommender):
        """플랜 없을 때"""
        studied = recommender._get_studied_content_ids(None)
        assert studied == set()

    def test_determine_strategy(self, recommender, sample_scores):
        """추천 전략 결정"""
        # 취약 과목이 있는 경우
        weak_subjects = ["수학", "과학"]
        strategy = recommender._determine_strategy(weak_subjects, sample_scores)
        assert strategy == "weak_priority"

        # 취약 과목이 많은 경우
        many_weak = ["수학", "과학", "국어", "사회"]
        strategy = recommender._determine_strategy(many_weak, sample_scores)
        assert strategy == "weak_focus"

        # 취약 과목 없는 경우
        strategy = recommender._determine_strategy([], sample_scores)
        assert strategy == "balanced"

        # 데이터 없는 경우
        empty_df = pd.DataFrame()
        strategy = recommender._determine_strategy([], empty_df)
        assert strategy == "exploration"

    def test_filter_contents(self, recommender, sample_contents):
        """콘텐츠 필터링"""
        filtered = recommender._filter_contents(
            contents_df=sample_contents,
            subject="수학",
            studied_ids={"c1"},
        )

        assert len(filtered) == 2  # 수학 콘텐츠 2개
        assert filtered[filtered["id"] == "c1"]["is_studied"].iloc[0] == True
        assert filtered[filtered["id"] == "c4"]["is_studied"].iloc[0] == False

    def test_score_contents(self, recommender, sample_contents, sample_scores):
        """콘텐츠 점수 계산"""
        weak_subjects = ["수학", "과학"]
        contents = sample_contents.copy()
        contents["is_studied"] = False

        scored = recommender._score_contents(
            contents=contents,
            weak_subjects=weak_subjects,
            scores_df=sample_scores,
            plans_df=None,
        )

        assert "relevance_score" in scored.columns
        # 취약 과목 콘텐츠가 더 높은 점수
        math_scores = scored[scored["subject"] == "수학"]["relevance_score"].values
        english_scores = scored[scored["subject"] == "영어"]["relevance_score"].values
        assert math_scores.mean() > english_scores.mean()

    def test_calculate_difficulty_score(self, recommender, sample_contents, sample_scores):
        """난이도 점수 계산"""
        scores = recommender._calculate_difficulty_score(sample_contents, sample_scores)
        assert len(scores) == len(sample_contents)
        assert all(0 <= s <= 30 for s in scores)

    def test_calculate_diversity_score(self, recommender, sample_contents, sample_plans):
        """다양성 점수 계산"""
        scores = recommender._calculate_diversity_score(sample_contents, sample_plans)
        assert len(scores) == len(sample_contents)
        # book과 lecture는 이미 학습함 → 낮은 점수
        # video는 새로운 유형 → 높은 점수

    def test_generate_reason(self, recommender):
        """추천 이유 생성"""
        content_row = pd.Series(
            {
                "subject": "수학",
                "difficulty": "easy",
                "content_type": "book",
                "is_studied": False,
            }
        )
        weak_subjects = ["수학"]

        reason = recommender._generate_reason(content_row, weak_subjects)

        assert "취약 과목" in reason
        assert "난이도" in reason
        assert "신규" in reason

    def test_empty_contents(self, recommender, sample_scores):
        """빈 콘텐츠 데이터"""
        empty_contents = pd.DataFrame()

        result = recommender.recommend(
            scores_df=sample_scores,
            contents_df=empty_contents,
            plans_df=None,
        )

        assert result["recommendations"] == []
        assert result["strategy"] == "no_content"


class TestCollaborativeRecommender:
    """CollaborativeRecommender 테스트"""

    @pytest.fixture
    def recommender(self):
        return CollaborativeRecommender(min_common_items=2)

    @pytest.fixture
    def all_plans(self):
        """전체 학생 플랜 데이터"""
        return pd.DataFrame(
            {
                "student_id": ["s1", "s1", "s1", "s2", "s2", "s2", "s3", "s3"],
                "content_id": ["c1", "c2", "c3", "c1", "c2", "c4", "c5", "c6"],
            }
        )

    def test_find_similar_students(self, recommender, all_plans):
        """유사 학생 찾기"""
        similar = recommender.find_similar_students("s1", all_plans)

        # s2가 유사함 (c1, c2 공유)
        assert "s2" in similar

    def test_find_similar_students_no_data(self, recommender):
        """데이터 없음"""
        empty_df = pd.DataFrame()
        similar = recommender.find_similar_students("s1", empty_df)
        assert similar == []

    def test_find_similar_students_not_found(self, recommender, all_plans):
        """학생을 찾을 수 없음"""
        similar = recommender.find_similar_students("unknown", all_plans)
        assert similar == []

    def test_get_collaborative_recommendations(self, recommender, all_plans):
        """협업 필터링 추천"""
        contents_df = pd.DataFrame(
            {
                "id": ["c1", "c2", "c3", "c4", "c5", "c6"],
                "title": ["콘텐츠1", "콘텐츠2", "콘텐츠3", "콘텐츠4", "콘텐츠5", "콘텐츠6"],
                "subject": ["수학"] * 6,
            }
        )

        similar = ["s2"]
        recommendations = recommender.get_collaborative_recommendations(
            student_id="s1",
            similar_students=similar,
            all_plans=all_plans,
            contents_df=contents_df,
            limit=3,
        )

        # s2가 학습했지만 s1이 학습하지 않은 c4 추천
        content_ids = [r["content_id"] for r in recommendations]
        assert "c4" in content_ids

    def test_get_collaborative_recommendations_no_similar(self, recommender, all_plans):
        """유사 학생 없음"""
        contents_df = pd.DataFrame({"id": [], "title": [], "subject": []})

        recommendations = recommender.get_collaborative_recommendations(
            student_id="s1",
            similar_students=[],
            all_plans=all_plans,
            contents_df=contents_df,
        )

        assert recommendations == []
