'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { ContentType } from '@/lib/domains/admin-plan/types';
import type { AddContentWizardData } from '../types';
import { BookOpen, Video, FileEdit, Search, X } from 'lucide-react';
import { MasterContentSearchModal } from '../../admin-wizard/steps/_components/MasterContentSearchModal';
import type { SelectedContent } from '../../admin-wizard/_context/types';

interface Step1ContentInfoProps {
  data: AddContentWizardData;
  onChange: (updates: Partial<AddContentWizardData>) => void;
  studentId: string;
  tenantId: string;
}

const CONTENT_TYPES: { type: ContentType; label: string; icon: React.ReactNode }[] = [
  { type: 'book', label: '교재', icon: <BookOpen className="h-4 w-4" /> },
  { type: 'lecture', label: '강의', icon: <Video className="h-4 w-4" /> },
  { type: 'custom', label: '커스텀', icon: <FileEdit className="h-4 w-4" /> },
];

export function Step1ContentInfo({ data, onChange, studentId, tenantId }: Step1ContentInfoProps) {
  const [showMasterSearch, setShowMasterSearch] = useState(false);

  // 마스터 콘텐츠 선택 핸들러
  const handleMasterContentSelect = (content: SelectedContent) => {
    onChange({
      linkMaster: true,
      masterContentId: content.contentId,
      masterContentTitle: content.title,
      title: content.title,
      subject: content.subject || '',
      contentType: content.contentType,
      // 범위 정보도 가져오기
      rangeStart: String(content.startRange),
      rangeEnd: String(content.endRange),
      totalVolume: String(content.totalRange),
    });
    setShowMasterSearch(false);
  };

  // 마스터 콘텐츠 연결 해제 핸들러
  const handleClearMasterContent = () => {
    onChange({
      linkMaster: false,
      masterContentId: undefined,
      masterContentTitle: undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* 콘텐츠 유형 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          콘텐츠 유형
        </label>
        <div className="grid grid-cols-3 gap-3">
          {CONTENT_TYPES.map(({ type, label, icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => onChange({ contentType: type })}
              className={cn(
                'flex items-center justify-center gap-2 py-3 px-4 border rounded-lg transition-colors',
                data.contentType === type
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              {icon}
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 과목 정보 */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          과목 정보
        </label>
        <div className="grid grid-cols-3 gap-3">
          <select
            value={data.curriculum}
            onChange={(e) => onChange({ curriculum: e.target.value })}
            className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">개정과정</option>
            <option value="2022 개정">2022 개정</option>
            <option value="2015 개정">2015 개정</option>
          </select>
          <select
            value={data.subjectArea}
            onChange={(e) => onChange({ subjectArea: e.target.value })}
            className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">교과</option>
            <option value="국어">국어</option>
            <option value="수학">수학</option>
            <option value="영어">영어</option>
            <option value="과학">과학</option>
            <option value="사회">사회</option>
          </select>
          <input
            type="text"
            placeholder="과목명"
            value={data.subject}
            onChange={(e) => onChange({ subject: e.target.value })}
            className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* 콘텐츠 제목 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          콘텐츠 제목 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="예: 개념원리 수학1"
          value={data.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* 마스터 콘텐츠 연결 */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          마스터 콘텐츠 연결 <span className="text-gray-400">(선택)</span>
        </label>

        {data.linkMaster && data.masterContentId ? (
          // 선택된 마스터 콘텐츠 표시
          <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
                {data.contentType === 'book' ? (
                  <BookOpen className="h-5 w-5 text-blue-600" />
                ) : (
                  <Video className="h-5 w-5 text-blue-600" />
                )}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {data.masterContentTitle || data.title}
                </div>
                <div className="text-xs text-gray-500">
                  마스터 콘텐츠 연결됨
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClearMasterContent}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              title="연결 해제"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          // 마스터 콘텐츠 검색 버튼
          <button
            type="button"
            onClick={() => setShowMasterSearch(true)}
            className="w-full flex items-center justify-center gap-2 p-4 bg-gray-50 border border-dashed border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-colors"
          >
            <Search className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">마스터 콘텐츠에서 검색하기</span>
          </button>
        )}

        <p className="text-xs text-gray-500">
          마스터 콘텐츠를 연결하면 교재/강의 정보가 자동으로 채워집니다.
        </p>
      </div>

      {/* 마스터 콘텐츠 검색 모달 */}
      <MasterContentSearchModal
        open={showMasterSearch}
        onClose={() => setShowMasterSearch(false)}
        onSelect={handleMasterContentSelect}
        studentId={studentId}
        tenantId={tenantId}
        existingContentIds={new Set()}
      />
    </div>
  );
}
