import React, { useMemo, useState } from 'react';
import { BookOpen, Play, Search } from 'lucide-react';
import { useMushaf } from '../context/MushafContext';
import { JUZ_LIST, SURAH_LIST } from '../data/surahMetadata';
import { normalizeArabic, toArabicDigits } from '../utils/arabicNormalize';

type IndexTab = 'surahs' | 'juz' | 'pages';
type RevelationFilter = 'all' | 'مكية' | 'مدنية';

export const IndexView: React.FC = () => {
  const {
    lastPosition,
    jumpToPage,
    jumpToSurah,
    playSurahStream,
  } = useMushaf();

  const [tab, setTab] = useState<IndexTab>('surahs');
  const [filterText, setFilterText] = useState('');
  const [revelation, setRevelation] = useState<RevelationFilter>('all');
  const [pageInput, setPageInput] = useState('');

  const filteredSurahs = useMemo(() => {
    const q = normalizeArabic(filterText).replace(/^سوره\s+/, '');
    return SURAH_LIST.filter((s) => {
      if (revelation !== 'all' && s.revelationType !== revelation) return false;
      if (!q) return true;
      return (
        normalizeArabic(s.name).includes(q) ||
        String(s.number) === q
      );
    });
  }, [filterText, revelation]);

  const handleGoToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(pageInput);
    if (n >= 1 && n <= 604) {
      jumpToPage(n);
    }
  };

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-5 pb-28 lg:pb-14 space-y-6">
      {/* Resume Reading Hero Card */}
      <section
        className="rounded-2xl sm:rounded-3xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        <div className="space-y-1">
          <p className="text-xs font-medium" style={{ color: 'var(--accent-primary)' }}>
            آخر موضع للقراءة
          </p>
          <h2 className="font-uthmani text-2xl" style={{ color: 'var(--text-primary)' }}>
            سورة {lastPosition.surahName}
          </h2>
          <p className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
            الآية {toArabicDigits(lastPosition.ayahNumber)} · الصفحة{' '}
            {toArabicDigits(lastPosition.pageNumber)} من ٦٠٤
          </p>
        </div>

        <button
          type="button"
          onClick={() => jumpToPage(lastPosition.pageNumber, lastPosition.globalAyahNumber)}
          className="min-h-[46px] px-5 rounded-xl text-sm font-medium text-white inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          <BookOpen size={17} />
          <span>متابعة القراءة</span>
        </button>
      </section>

      {/* Primary Index Segmented Tabs */}
      <div
        className="grid grid-cols-3 gap-1 p-1 rounded-xl border"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        {(
          [
            { id: 'surahs', label: 'السور (١١٤)' },
            { id: 'juz', label: 'الأجزاء (٣٠)' },
            { id: 'pages', label: 'الصفحات (٦٠٤)' },
          ] as const
        ).map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className="min-h-[42px] rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor: active ? 'var(--accent-primary)' : 'transparent',
                color: active ? '#ffffff' : 'var(--text-secondary)',
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'surahs' && (
        <div className="space-y-4">
          {/* Quick Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search
                size={17}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="search"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="تصفية باسم السورة أو رقمها..."
                className="w-full min-h-[44px] pr-10 pl-4 rounded-xl border text-sm focus:outline-none"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-hairline)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div
              className="inline-flex items-center p-1 rounded-xl border shrink-0"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-hairline)',
              }}
            >
              {(
                [
                  { id: 'all', label: 'الكل' },
                  { id: 'مكية', label: 'مكية' },
                  { id: 'مدنية', label: 'مدنية' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setRevelation(f.id)}
                  className="min-h-[36px] px-3.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor:
                      revelation === f.id ? 'var(--accent-soft)' : 'transparent',
                    color:
                      revelation === f.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Surah List */}
          <div
            className="rounded-2xl border divide-y overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-hairline)',
            }}
          >
            {filteredSurahs.length === 0 ? (
              <p className="py-12 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                لا توجد سورة مطابقة لبحثك.
              </p>
            ) : (
              filteredSurahs.map((surah) => (
                <div
                  key={surah.number}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors"
                  style={{ borderColor: 'var(--border-hairline)' }}
                >
                  <button
                    type="button"
                    onClick={() => jumpToSurah(surah.number)}
                    className="flex-1 flex items-center gap-3.5 text-right min-h-[44px] cursor-pointer min-w-0"
                  >
                    <span
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold tabular-nums shrink-0 border"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor: 'var(--border-hairline)',
                        color: 'var(--accent-primary)',
                      }}
                    >
                      {toArabicDigits(surah.number)}
                    </span>

                    <div className="min-w-0">
                      <p
                        className="font-uthmani text-xl leading-tight"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        سورة {surah.name}
                      </p>
                      <p
                        className="text-xs mt-0.5 tabular-nums truncate"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {surah.revelationType} · {toArabicDigits(surah.ayahCount)} آية · ص{' '}
                        {toArabicDigits(surah.startPage)}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => playSurahStream(surah.number)}
                    aria-label={`تشغيل سورة ${surah.name}`}
                    title={`استماع لسورة ${surah.name}`}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl cursor-pointer shrink-0"
                    style={{
                      backgroundColor: 'var(--accent-soft)',
                      color: 'var(--accent-primary)',
                    }}
                  >
                    <Play size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'juz' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {JUZ_LIST.map((juz) => (
            <button
              key={juz.number}
              type="button"
              onClick={() => jumpToPage(juz.startPage)}
              className="text-right p-4 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-colors"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-hairline)',
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold tabular-nums shrink-0"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--accent-primary)',
                  }}
                >
                  {toArabicDigits(juz.number)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {juz.name}
                  </p>
                  <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    سورة {juz.surahName} · آية {toArabicDigits(juz.ayahNumber)}
                  </p>
                </div>
              </div>
              <span className="text-xs font-medium tabular-nums shrink-0" style={{ color: 'var(--accent-primary)' }}>
                ص {toArabicDigits(juz.startPage)}
              </span>
            </button>
          ))}
        </div>
      )}

      {tab === 'pages' && (
        <div
          className="rounded-2xl border p-5 space-y-5"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-hairline)',
          }}
        >
          <form onSubmit={handleGoToPage} className="flex items-center gap-2.5">
            <input
              type="number"
              min={1}
              max={604}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              placeholder="أدخل رقم الصفحة (١ - ٦٠٤)"
              className="flex-1 min-h-[46px] px-4 rounded-xl border text-sm tabular-nums focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="submit"
              className="min-h-[46px] px-5 rounded-xl text-sm font-medium text-white cursor-pointer whitespace-nowrap"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              انتقال
            </button>
          </form>

          <div>
            <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
              بدايات الأجزاء والأحزاب (انتقال سريع)
            </p>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {JUZ_LIST.map((j) => (
                <button
                  key={j.number}
                  type="button"
                  onClick={() => jumpToPage(j.startPage)}
                  className="min-h-[44px] rounded-xl border text-xs font-medium tabular-nums cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                  }}
                >
                  ص {toArabicDigits(j.startPage)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
