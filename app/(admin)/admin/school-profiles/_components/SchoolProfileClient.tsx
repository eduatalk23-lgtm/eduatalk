"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, RefreshCw, Plus, Trash2, X, Search } from "lucide-react";
import Button from "@/components/atoms/Button";
import { useToast } from "@/components/ui/ToastProvider";
import {
  autoCollectSchoolSubjects,
  fetchSchoolProfilesWithStats,
  fetchSchoolProfileDetail,
  fetchSubjectOptionsAction,
  upsertOfferedSubjectAction,
  removeOfferedSubjectAction,
} from "@/lib/domains/student-record/actions/schoolProfile";
import type {
  SchoolProfileListItem,
  SchoolProfileDetail,
  OfferedSubjectWithMeta,
  SubjectOption,
} from "@/lib/domains/student-record/actions/schoolProfile";

// ============================================
// 학교유형 레이블
// ============================================

const SCHOOL_CATEGORY_LABELS: Record<string, string> = {
  general: "일반고",
  autonomous_private: "자사고",
  autonomous_public: "자공고",
  science: "과학고",
  foreign_lang: "외고",
  international: "국제고",
  art: "예고",
  sports: "체고",
  meister: "마이스터고",
  specialized: "특목고",
  other: "기타",
};

// ============================================
// 날짜 포맷
// ============================================

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// ============================================
// 과목 추가 다이얼로그
// ============================================

interface AddSubjectDialogProps {
  schoolProfileId: string;
  onClose: () => void;
  onSaved: () => void;
}

function AddSubjectDialog({ schoolProfileId, onClose, onSaved }: AddSubjectDialogProps) {
  const toast = useToast();
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [query, setQuery] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [grades, setGrades] = useState<number[]>([]);
  const [semesters, setSemesters] = useState<number[]>([]);
  const [isElective, setIsElective] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  useEffect(() => {
    async function loadSubjects() {
      try {
        const result = await fetchSubjectOptionsAction();
        if (result.success && result.data) {
          setSubjects(result.data);
        }
      } catch {
        // subjects 로드 실패 시 빈 목록 유지
      } finally {
        setLoadingSubjects(false);
      }
    }
    loadSubjects();
  }, []);

  const filteredSubjects = useMemo(() => {
    if (!query.trim()) return subjects;
    const q = query.toLowerCase();
    return subjects.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.group_name ?? "").toLowerCase().includes(q),
    );
  }, [subjects, query]);

  const toggleGrade = (g: number) => {
    setGrades((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g].sort(),
    );
  };

  const toggleSemester = (s: number) => {
    setSemesters((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s].sort(),
    );
  };

  const handleSave = async () => {
    if (!selectedSubjectId) {
      toast.showError("과목을 선택해주세요.");
      return;
    }
    setSaving(true);
    try {
      const result = await upsertOfferedSubjectAction({
        schoolProfileId,
        subjectId: selectedSubjectId,
        grades,
        semesters,
        isElective,
      });
      if (result.success) {
        toast.showSuccess("개설 과목이 추가되었습니다.");
        onSaved();
        onClose();
      } else {
        toast.showError(result.error ?? "저장에 실패했습니다.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="w-full max-w-lg rounded-xl shadow-xl"
        style={{ background: "var(--surface-primary)", border: "1px solid var(--border-primary)" }}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border-primary)" }}
        >
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            과목 추가
          </h3>
          <button onClick={onClose} style={{ color: "var(--text-tertiary)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 과목 검색 */}
        <div className="px-5 pt-4">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: "var(--surface-secondary)", border: "1px solid var(--border-primary)" }}
          >
            <Search className="h-4 w-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="과목명 또는 교과군 검색..."
              className="w-full bg-transparent text-sm outline-none"
              style={{ color: "var(--text-primary)" }}
            />
          </div>
        </div>

        {/* 과목 목록 */}
        <div className="mx-5 mt-2 h-48 overflow-y-auto rounded-lg" style={{ border: "1px solid var(--border-primary)" }}>
          {loadingSubjects ? (
            <div className="flex h-full items-center justify-center text-sm" style={{ color: "var(--text-tertiary)" }}>
              로딩 중...
            </div>
          ) : filteredSubjects.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm" style={{ color: "var(--text-tertiary)" }}>
              검색 결과 없음
            </div>
          ) : (
            filteredSubjects.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSubjectId(s.id)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors"
                style={{
                  background: selectedSubjectId === s.id ? "var(--surface-secondary)" : "transparent",
                  color: "var(--text-primary)",
                  borderBottom: "1px solid var(--border-primary)",
                }}
              >
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--surface-tertiary)", color: "var(--text-secondary)" }}>
                  {s.group_name ?? "-"}
                </span>
                <span>{s.name}</span>
              </button>
            ))
          )}
        </div>

        {/* 설정 */}
        <div className="px-5 pt-4">
          <div className="flex gap-6">
            {/* 학년 */}
            <div>
              <p className="mb-1.5 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                학년
              </p>
              <div className="flex gap-2">
                {[1, 2, 3].map((g) => (
                  <label key={g} className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={grades.includes(g)}
                      onChange={() => toggleGrade(g)}
                      className="h-4 w-4 rounded"
                    />
                    <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                      {g}학년
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 학기 */}
            <div>
              <p className="mb-1.5 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                학기
              </p>
              <div className="flex gap-2">
                {[1, 2].map((s) => (
                  <label key={s} className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={semesters.includes(s)}
                      onChange={() => toggleSemester(s)}
                      className="h-4 w-4 rounded"
                    />
                    <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                      {s}학기
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 선택/필수 */}
            <div>
              <p className="mb-1.5 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                구분
              </p>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={isElective}
                  onChange={(e) => setIsElective(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                  선택과목
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div
          className="flex justify-end gap-2 px-5 py-4 mt-4"
          style={{ borderTop: "1px solid var(--border-primary)" }}
        >
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !selectedSubjectId}>
            {saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 상세 뷰
// ============================================

interface DetailViewProps {
  profileId: string;
  onBack: () => void;
}

function DetailView({ profileId, onBack }: DetailViewProps) {
  const toast = useToast();
  const [detail, setDetail] = useState<SchoolProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchSchoolProfileDetail(profileId);
      if (result.success && result.data) {
        setDetail(result.data);
      } else {
        toast.showError("프로파일 상세 로드 실패");
      }
    } finally {
      setLoading(false);
    }
  }, [profileId, toast]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleDelete = async (id: string) => {
    if (!confirm("이 과목을 삭제하시겠습니까?")) return;
    setDeletingId(id);
    try {
      const result = await removeOfferedSubjectAction(id);
      if (result.success) {
        toast.showSuccess("삭제되었습니다.");
        await loadDetail();
      } else {
        toast.showError(result.error ?? "삭제 실패");
      }
    } finally {
      setDeletingId(null);
    }
  };

  // subject_group별 그룹핑
  const grouped = useMemo(() => {
    if (!detail) return new Map<string, OfferedSubjectWithMeta[]>();
    const map = new Map<string, OfferedSubjectWithMeta[]>();
    for (const s of detail.offeredSubjects) {
      const key = s.subject_group_name ?? "기타";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [detail]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm" style={{ color: "var(--text-tertiary)" }}>
        로딩 중...
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          <ChevronLeft className="h-4 w-4" />
          뒤로가기
        </button>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {detail.profile.school_name}
            </h2>
            {detail.profile.school_category && (
              <span
                className="rounded-full px-2 py-0.5 text-sm"
                style={{ background: "var(--surface-secondary)", color: "var(--text-secondary)" }}
              >
                {SCHOOL_CATEGORY_LABELS[detail.profile.school_category] ?? detail.profile.school_category}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            학생 {detail.studentCount}명 · 개설 과목 {detail.offeredSubjects.length}개
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="mr-1 h-4 w-4" />
          과목 추가
        </Button>
      </div>

      {/* 과목 목록 (subject_group별) */}
      {grouped.size === 0 ? (
        <div
          className="rounded-xl p-12 text-center text-sm"
          style={{ border: "1px solid var(--border-primary)", color: "var(--text-tertiary)" }}
        >
          개설 과목이 없습니다. 위 "과목 추가" 버튼으로 추가하거나 자동 수집을 실행하세요.
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([groupName, subjects]) => (
            <div key={groupName}>
              <h3
                className="mb-2 text-sm font-semibold"
                style={{ color: "var(--text-secondary)" }}
              >
                {groupName}
              </h3>
              <div
                className="overflow-hidden rounded-xl"
                style={{ border: "1px solid var(--border-primary)" }}
              >
                <table className="w-full">
                  <thead>
                    <tr style={{ background: "var(--surface-secondary)", borderBottom: "1px solid var(--border-primary)" }}>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                        과목명
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                        학년
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                        학기
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                        구분
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                        삭제
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((subject) => (
                      <tr
                        key={subject.id}
                        style={{ borderBottom: "1px solid var(--border-primary)" }}
                      >
                        <td className="px-4 py-3 text-sm" style={{ color: "var(--text-primary)" }}>
                          {subject.subject_name ?? subject.subject_id}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {subject.grades.length === 0 ? (
                              <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>-</span>
                            ) : (
                              subject.grades.map((g) => (
                                <span
                                  key={g}
                                  className="rounded px-1.5 py-0.5 text-sm"
                                  style={{ background: "var(--surface-secondary)", color: "var(--text-secondary)" }}
                                >
                                  {g}학년
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {subject.semesters.length === 0 ? (
                              <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>-</span>
                            ) : (
                              subject.semesters.map((s) => (
                                <span
                                  key={s}
                                  className="rounded px-1.5 py-0.5 text-sm"
                                  style={{ background: "var(--surface-secondary)", color: "var(--text-secondary)" }}
                                >
                                  {s}학기
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="rounded-full px-2 py-0.5 text-sm"
                            style={{
                              background: subject.is_elective ? "var(--surface-secondary)" : "var(--surface-tertiary)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {subject.is_elective ? "선택" : "필수"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDelete(subject.id)}
                            disabled={deletingId === subject.id}
                            className="transition-colors"
                            style={{ color: "var(--text-tertiary)" }}
                            title="삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddDialog && (
        <AddSubjectDialog
          schoolProfileId={profileId}
          onClose={() => setShowAddDialog(false)}
          onSaved={loadDetail}
        />
      )}
    </div>
  );
}

// ============================================
// 목록 뷰
// ============================================

interface ListViewProps {
  profiles: SchoolProfileListItem[];
  loading: boolean;
  collecting: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onCollect: () => void;
  onSelectProfile: (id: string) => void;
  collectResult: { schoolCount: number; subjectCount: number } | null;
}

function ListView({
  profiles,
  loading,
  collecting,
  searchQuery,
  onSearchChange,
  onCollect,
  onSelectProfile,
  collectResult,
}: ListViewProps) {
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return profiles;
    const q = searchQuery.toLowerCase();
    return profiles.filter((p) => p.school_name.toLowerCase().includes(q));
  }, [profiles, searchQuery]);

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            학교 개설 과목
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            학생 성적 및 세특 데이터를 기반으로 학교별 개설 과목을 자동 수집합니다.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={onCollect}
          disabled={collecting}
        >
          {collecting ? (
            <>
              <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
              수집 중...
            </>
          ) : (
            <>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              자동 수집
            </>
          )}
        </Button>
      </div>

      {/* 수집 결과 배너 */}
      {collectResult && (
        <div
          className="mb-4 rounded-lg px-4 py-3 text-sm"
          style={{ background: "var(--surface-secondary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
        >
          자동 수집 완료 — 학교 {collectResult.schoolCount}개, 과목 {collectResult.subjectCount}건 처리
        </div>
      )}

      {/* 검색 */}
      <div
        className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2"
        style={{ border: "1px solid var(--border-primary)", background: "var(--surface-primary)" }}
      >
        <Search className="h-4 w-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="학교명 검색..."
          className="w-full bg-transparent text-sm outline-none"
          style={{ color: "var(--text-primary)" }}
        />
      </div>

      {/* 테이블 */}
      {loading ? (
        <div className="flex h-48 items-center justify-center text-sm" style={{ color: "var(--text-tertiary)" }}>
          로딩 중...
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-xl p-16 text-center"
          style={{ border: "1px solid var(--border-primary)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {profiles.length === 0 ? "수집된 학교가 없습니다" : "검색 결과가 없습니다"}
          </p>
          {profiles.length === 0 && (
            <p className="mt-2 text-sm" style={{ color: "var(--text-tertiary)" }}>
              상단의 "자동 수집" 버튼을 눌러 학생 데이터에서 학교 개설 과목을 수집하세요.
            </p>
          )}
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-xl"
          style={{ border: "1px solid var(--border-primary)" }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ background: "var(--surface-secondary)", borderBottom: "1px solid var(--border-primary)" }}>
                <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  학교명
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  학생수
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  과목수
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  학교유형
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  최종 갱신
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((profile) => (
                <tr
                  key={profile.id}
                  onClick={() => onSelectProfile(profile.id)}
                  className="cursor-pointer transition-colors"
                  style={{
                    borderBottom: "1px solid var(--border-primary)",
                  }}
                >
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {profile.school_name}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                    {profile.student_count}명
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                    {profile.subject_count}개
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                    {profile.school_category
                      ? (SCHOOL_CATEGORY_LABELS[profile.school_category] ?? profile.school_category)
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--text-tertiary)" }}>
                    {formatDate(profile.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================
// 메인 컴포넌트
// ============================================

export default function SchoolProfileClient() {
  const toast = useToast();
  const [profiles, setProfiles] = useState<SchoolProfileListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [collectResult, setCollectResult] = useState<{ schoolCount: number; subjectCount: number } | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchSchoolProfilesWithStats();
      if (result.success && result.data) {
        setProfiles(result.data);
      } else {
        toast.showError("학교 목록을 불러오는 중 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const handleCollect = async () => {
    setCollecting(true);
    setCollectResult(null);
    try {
      const result = await autoCollectSchoolSubjects();
      if (result.success && result.data) {
        setCollectResult({
          schoolCount: result.data.schoolCount,
          subjectCount: result.data.subjectCount,
        });
        toast.showSuccess(
          `자동 수집 완료 — 학교 ${result.data.schoolCount}개, 과목 ${result.data.subjectCount}건`,
        );
        await loadProfiles();
      } else {
        toast.showError(result.error ?? "자동 수집에 실패했습니다.");
      }
    } finally {
      setCollecting(false);
    }
  };

  if (selectedProfileId) {
    return (
      <section className="mx-auto w-full max-w-5xl px-4 py-8">
        <DetailView
          profileId={selectedProfileId}
          onBack={() => setSelectedProfileId(null)}
        />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8">
      <ListView
        profiles={profiles}
        loading={loading}
        collecting={collecting}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onCollect={handleCollect}
        onSelectProfile={setSelectedProfileId}
        collectResult={collectResult}
      />
    </section>
  );
}
