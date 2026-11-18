import React from 'react';
import { BookOpen, Bookmark, Compass, ListTree, Search } from 'lucide-react';
import { useMushaf } from '../context/MushafContext';
import { AppTab } from '../types/quran';
import { toArabicDigits } from '../utils/arabicNormalize';

interface NavItem {
  id: AppTab;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'reader', label: 'المصحف', icon: BookOpen },
  { id: 'index', label: 'الفهرس', icon: ListTree },
  { id: 'search', label: 'البحث', icon: Search },
  { id: 'hifz', label: 'الختمة والحفظ', icon: Compass },
  { id: 'bookmarks', label: 'المحفوظات', icon: Bookmark },
];

export const BottomNav: React.FC<{ hidden?: boolean }> = ({ hidden }) => {
  const { activeTab, setActiveTab, lastPosition, khatmah, corpusReady } = useMushaf();

  if (hidden) return null;

  const progressPct = Math.round((khatmah.completedPages.length / 604) * 100);

  return (
    <>
      {/* Mobile Bottom Tab Bar (<= 60px to honor 15% sticky cap) */}
      <nav
        aria-label="التنقل الرئيسي"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-md pb-safe"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-surface) 94%, transparent)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        <div className="grid grid-cols-5 h-[58px] items-center">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className="flex flex-col items-center justify-center min-h-[44px] py-1 transition-colors cursor-pointer"
                style={{
                  color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
                }}
              >
                <Icon size={20} strokeWidth={active ? 2.3 : 1.7} />
                <span className="text-[11px] font-medium mt-0.5 whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop Side Rail (RTL Right Sidebar) */}
      <aside
        aria-label="القائمة الجانبية"
        className="hidden lg:flex flex-col justify-between w-64 shrink-0 border-l px-4 py-6 sticky top-[52px] h-[calc(100vh-52px)]"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        <div className="space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className="w-full flex items-center gap-3 px-3.5 min-h-[46px] rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                  color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                }}
              >
                <Icon size={19} strokeWidth={active ? 2.3 : 1.8} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Quiet Last Reading & Khatmah Summary */}
        <div
          className="pt-5 border-t space-y-4 text-xs"
          style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }}
        >
          <div>
            <p className="font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              آخر موضع قراءة
            </p>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              سورة {lastPosition.surahName} · آية {toArabicDigits(lastPosition.ayahNumber)}
            </p>
            <p className="tabular-nums mt-0.5">صفحة {toArabicDigits(lastPosition.pageNumber)}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span style={{ color: 'var(--text-muted)' }}>تقدم الختمة</span>
              <span className="font-semibold tabular-nums" style={{ color: 'var(--accent-primary)' }}>
                {toArabicDigits(progressPct)}٪
              </span>
            </div>
            <div
              className="h-1.5 w-full rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--bg-subtle)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(2, progressPct)}%`,
                  backgroundColor: 'var(--accent-primary)',
                }}
              />
            </div>
          </div>

          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {corpusReady ? 'النص القرآني محفوظ للبحث الفوري' : 'جاري تجهيز فهرس البحث...'}
          </p>
        </div>
      </aside>
    </>
  );
};
