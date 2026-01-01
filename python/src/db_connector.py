"""
Supabase 데이터베이스 연결 모듈

Supabase API를 통해 TimeLevelUp 데이터베이스에 접근합니다.
"""

import os
from functools import lru_cache
from typing import Any

import pandas as pd
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from supabase import create_client, Client


class Settings(BaseSettings):
    """환경 설정"""

    supabase_url: str = ""
    supabase_service_role_key: str = ""

    class Config:
        env_file = "../.env.local"
        env_file_encoding = "utf-8"
        extra = "ignore"


class SupabaseConnector:
    """Supabase 데이터베이스 연결 클래스"""

    def __init__(self, settings: Settings | None = None):
        """
        Args:
            settings: 환경 설정 (None인 경우 자동 로드)
        """
        load_dotenv("../.env.local")

        if settings is None:
            settings = Settings()

        # 환경 변수에서 직접 읽기 (fallback)
        url = settings.supabase_url or os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
        key = settings.supabase_service_role_key or os.getenv(
            "SUPABASE_SERVICE_ROLE_KEY", ""
        )

        if not url or not key:
            raise ValueError(
                "SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다. "
                ".env.local 파일을 확인해주세요."
            )

        self.client: Client = create_client(url, key)

    def query(self, table: str, select: str = "*", **filters: Any) -> pd.DataFrame:
        """
        테이블에서 데이터를 조회하여 DataFrame으로 반환

        Args:
            table: 테이블명
            select: 선택할 컬럼 (기본값: "*")
            **filters: 필터 조건 (eq, gt, lt 등)

        Returns:
            조회 결과 DataFrame
        """
        query = self.client.table(table).select(select)

        for key, value in filters.items():
            if key.endswith("__eq"):
                query = query.eq(key[:-4], value)
            elif key.endswith("__gt"):
                query = query.gt(key[:-4], value)
            elif key.endswith("__lt"):
                query = query.lt(key[:-4], value)
            elif key.endswith("__gte"):
                query = query.gte(key[:-5], value)
            elif key.endswith("__lte"):
                query = query.lte(key[:-5], value)
            elif key.endswith("__in"):
                query = query.in_(key[:-4], value)
            else:
                query = query.eq(key, value)

        response = query.execute()
        return pd.DataFrame(response.data)

    def get_students(self, tenant_id: str | None = None) -> pd.DataFrame:
        """학생 목록 조회"""
        filters = {}
        if tenant_id:
            filters["tenant_id__eq"] = tenant_id
        return self.query(
            "students",
            "id, name, grade, school_name, target_university, target_major, created_at",
            **filters,
        )

    def get_student_scores(
        self, student_id: str, limit: int = 100
    ) -> pd.DataFrame:
        """학생 성적 조회"""
        response = (
            self.client.table("scores")
            .select("*")
            .eq("student_id", student_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return pd.DataFrame(response.data)

    def get_student_plans(
        self, student_id: str, start_date: str | None = None, end_date: str | None = None
    ) -> pd.DataFrame:
        """학생 학습 플랜 조회"""
        query = (
            self.client.table("student_plan")
            .select("*")
            .eq("student_id", student_id)
        )

        if start_date:
            query = query.gte("scheduled_date", start_date)
        if end_date:
            query = query.lte("scheduled_date", end_date)

        response = query.order("scheduled_date", desc=False).execute()
        return pd.DataFrame(response.data)

    def get_plan_executions(
        self, student_id: str, limit: int = 500
    ) -> pd.DataFrame:
        """학생 플랜 실행 기록 조회"""
        # student_plan에서 completed 상태인 것들
        response = (
            self.client.table("student_plan")
            .select("*")
            .eq("student_id", student_id)
            .eq("status", "completed")
            .order("completed_at", desc=True)
            .limit(limit)
            .execute()
        )
        return pd.DataFrame(response.data)

    def get_student_contents(self, student_id: str) -> pd.DataFrame:
        """학생 콘텐츠 목록 조회"""
        response = (
            self.client.table("student_contents")
            .select("*")
            .eq("student_id", student_id)
            .execute()
        )
        return pd.DataFrame(response.data)

    def get_plan_groups(self, student_id: str) -> pd.DataFrame:
        """학생 플랜 그룹 조회"""
        response = (
            self.client.table("plan_groups")
            .select("*")
            .eq("student_id", student_id)
            .execute()
        )
        return pd.DataFrame(response.data)

    def get_all_scores_by_tenant(self, tenant_id: str) -> pd.DataFrame:
        """테넌트 전체 성적 조회 (벤치마크용)"""
        response = (
            self.client.table("scores")
            .select("*, students!inner(tenant_id)")
            .eq("students.tenant_id", tenant_id)
            .execute()
        )
        return pd.DataFrame(response.data)

    def execute_sql(self, query: str) -> pd.DataFrame:
        """
        Raw SQL 실행 (RPC를 통해)
        주의: 읽기 전용 쿼리만 사용할 것

        Args:
            query: SQL 쿼리 문자열

        Returns:
            결과 DataFrame
        """
        # Supabase에서는 RPC 함수를 통해 SQL 실행 가능
        # 보안을 위해 읽기 전용 함수를 DB에 미리 정의해야 함
        raise NotImplementedError(
            "Raw SQL 실행은 보안상 RPC 함수를 통해서만 가능합니다."
        )


@lru_cache()
def get_connector() -> SupabaseConnector:
    """
    싱글톤 패턴으로 SupabaseConnector 인스턴스 반환

    Returns:
        SupabaseConnector 인스턴스
    """
    return SupabaseConnector()
