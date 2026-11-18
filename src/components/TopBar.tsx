import React from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useMushaf } from '../context/MushafContext';
import { SURAH_LIST } from '../data/surahMetadata';
import { toArabicDigits } from '../utils/arabicNormalize';
import { PWAInstallButton } from './PWAInstallButton';

interface TopBarProps {
  onOpenSettings: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenSettings, focusMode }) => {
  const { activeTab, setActiveTab, currentPage, currentSurah } = useMushaf();

  const surahMeta = SURAH_LIST.find((s) => s.number === currentSurah);

  const tabTitles: Record<string, string> = {
    index: 'فهرس المصحف الشريف',
    search: 'البحث في القرآن الكريم',
    hifz: 'الحفظ الذكي والختمة',
    bookmarks: 'الفواصل ودفتر التدبر',
  };

  if (focusMode && activeTab === 'reader') {
    return null;
  }

  return (
    <header
      className="sticky top-0 z-30 h-[48px] px-4 flex items-center justify-between gap-4 border-b backdrop-blur-md transition-colors"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--bg-surface) 92%, transparent)',
        borderColor: 'var(--border-hairline)',
      }}
    >
      {/* Zone 1: Brand */}
      <button
        type="button"
        onClick={() => setActiveTab('index')}
        className="flex items-center min-h-[44px] text-right whitespace-nowrap shrink-0 cursor-pointer"
        title="فتح الفهرس"
      >
        <span
          className="font-ui text-base font-bold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          مصحف التدبر
        </span>
      </button>

      {/* Zone 2: Minimal Active Context */}
      <div className="min-w-0 flex items-center justify-center">
        {activeTab === 'reader' ? (
          <button
            type="button"
            onClick={() => setActiveTab('index')}
            className="flex items-center gap-1.5 text-xs sm:text-sm truncate cursor-pointer min-h-[40px] px-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {surahMeta ? `سورة ${surahMeta.name}` : 'المصحف'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">ص {toArabicDigits(currentPage)}</span>
          </button>
        ) : (
          <h1
            className="text-sm sm:text-base font-semibold truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {tabTitles[activeTab]}
          </h1>
        )}
      </div>

      {/* Zone 3: Minimal Utility Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        <PWAInstallButton variant="compact" />
        {activeTab === 'reader' && (
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            aria-label="بحث في الآيات"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors cursor-pointer lg:hidden"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Search size={18} />
          </button>
        )}

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="إعدادات العرض والخط"
          title="إعدادات العرض والخط"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors cursor-pointer"
          style={{ color: 'var(--text-secondary)' }}
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>
    </header>
  );
};
