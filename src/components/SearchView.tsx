import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpLeft, Loader2, Search, X } from 'lucide-react';
import { useMushaf } from '../context/MushafContext';
import { SURAH_LIST } from '../data/surahMetadata';
import {
  ensurePageQcfFontLoaded,
  fetchPageAyahs,
  getQcfFontFamilyName,
  isPageQcfFontLoadedSync,
  searchQuranWords,
  toQpcSafeText,
} from '../services/quranService';
import { AyahItem, MushafWord } from '../types/quran';
import { normalizeArabic, parseQuickJump, toArabicDigits } from '../utils/arabicNormalize';

const QUICK_TOPICS = ['الرحمة', 'الصبر', 'التقوى', 'الذكر', 'الشكر', 'الجنة', 'الاستغفار', 'الدعاء'];

interface SearchResultCardProps {
  ayah: AyahItem;
  query: string;
  onSelect: (ayah: AyahItem) => void;
}

const SearchResultCard: React.FC<SearchResultCardProps> = ({ ayah, query, onSelect }) => {
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const [qcfWords, setQcfWords] = useState<MushafWord[] | null>(null);
  const [qcfFontReady, setQcfFontReady] = useState<boolean>(() =>
    isPageQcfFontLoadedSync(ayah.page)
  );

  useEffect(() => {
    let active = true;
    const el = cardRef.current;
    if (!el) return;

    const hydrateQcf = () => {
      Promise.all([
        fetchPageAyahs(ayah.page),
        ensurePageQcfFontLoaded(ayah.page),
      ])
        .then(([pageAyahs, fontOk]) => {
          if (!active) return;
          const match = pageAyahs.find((p) => p.number === ayah.number);
          if (match?.words && match.words.every((w) => Boolean(w.codeV2))) {
            setQcfWords(match.words);
          }
          setQcfFontReady(fontOk);
        })
        .catch(() => {
          // Keep clean fallback text
        });
    };

    if (typeof IntersectionObserver === 'undefined') {
      hydrateQcf();
      return () => {
        active = false;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          hydrateQcf();
        }
      },
      { rootMargin: '240px' }
    );
    observer.observe(el);

    return () => {
      active = false;
      observer.disconnect();
    };
  }, [ayah.number, ayah.page]);

  const queryWords = useMemo(
    () => normalizeArabic(query).split(' ').filter(Boolean),
    [query]
  );

  const useQcf = qcfFontReady && qcfWords && qcfWords.length > 0;
  const qcfFamily = getQcfFontFamilyName(ayah.page);

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={() => onSelect(ayah)}
      className="w-full text-right p-4 hover:opacity-90 transition-opacity cursor-pointer block"
      style={{ borderColor: 'var(--border-hairline)' }}
    >
      <div className="flex items-center justify-between text-xs mb-2 tabular-nums">
        <span className="font-semibold" style={{ color: 'var(--accent-primary)' }}>
          سورة {ayah.surahName} · الآية {toArabicDigits(ayah.numberInSurah)}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          صفحة {toArabicDigits(ayah.page)} · الجزء {toArabicDigits(ayah.juz)}
        </span>
      </div>

      {useQcf ? (
        <p
          className="text-xl sm:text-2xl leading-loose mb-1.5"
          style={{
            fontFamily: qcfFamily,
            color: 'var(--text-primary)',
          }}
        >
          {qcfWords.map((w) => {
            if (w.charType === 'end') {
              return (
                <span key={w.id} style={{ color: 'var(--accent-gold)' }}>
                  {w.codeV2}{' '}
                </span>
              );
            }
            const nw = normalizeArabic(w.textUthmani);
            const isMatch = queryWords.some((qw) => qw.length >= 2 && nw.includes(qw));
            return (
              <span
                key={w.id}
                className={`${w.isSajdahWord ? 'sajdah-word-underline' : ''} ${
                  isMatch ? 'rounded px-0.5' : ''
                }`}
                style={
                  isMatch
                    ? {
                        backgroundColor: 'var(--accent-soft)',
                        color: 'var(--accent-primary)',
                      }
                    : undefined
                }
              >
                {w.codeV2}{' '}
              </span>
            );
          })}
        </p>
      ) : (
        <p
          className="font-uthmani text-xl leading-loose mb-1.5"
          style={{ color: 'var(--text-primary)' }}
        >
          {toQpcSafeText(ayah.text)}
        </p>
      )}
    </button>
  );
};

export const SearchView: React.FC = () => {
  const { jumpToAyah, jumpToPage, jumpToSurah, corpusReady } = useMushaf();

  const [query, setQuery] = useState('');
  const [surahFilter, setSurahFilter] = useState<number>(0);
  const [results, setResults] = useState<AyahItem[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [loading, setLoading] = useState(false);

  const quickJump = useMemo(() => parseQuickJump(query, SURAH_LIST), [query]);

  useEffect(() => {
    const clean = normalizeArabic(query);
    if (clean.length < 2) {
      setResults([]);
      setTotalMatches(0);
      return;
    }

    let active = true;
    setLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const res = await searchQuranWords(query, {
          surahFilter: surahFilter || undefined,
          limit: 100,
        });
        if (!active) return;
        setResults(res.results);
        setTotalMatches(res.total);
      } catch {
        if (!active) return;
        setResults([]);
        setTotalMatches(0);
      } finally {
        if (active) setLoading(false);
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, surahFilter]);

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-5 pb-28 lg:pb-14 space-y-5">
      {/* Search Box */}
      <div
        className="rounded-2xl border p-4 space-y-3"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        <div className="relative">
          <Search
            size={18}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث بكلمة أو عبارة (بدون تشكيل) أو اكتب ٢:٢٥٥ أو ص ٥٠..."
            autoFocus
            className="w-full min-h-[48px] pr-10 pl-10 rounded-xl border text-sm sm:text-base focus:outline-none"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: 'var(--border-hairline)',
              color: 'var(--text-primary)',
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="مسح البحث"
              className="absolute left-2 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={17} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <select
            value={surahFilter}
            onChange={(e) => setSurahFilter(Number(e.target.value))}
            aria-label="تصفية حسب السورة"
            className="min-h-[40px] px-3 rounded-xl border text-xs font-medium focus:outline-none cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: 'var(--border-hairline)',
              color: 'var(--text-primary)',
            }}
          >
            <option value={0}>جميع السور (١١٤)</option>
            {SURAH_LIST.map((s) => (
              <option key={s.number} value={s.number}>
                {toArabicDigits(s.number)}. سورة {s.name}
              </option>
            ))}
          </select>

          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {corpusReady ? 'البحث يشمل ٦٬٢٣٦ آية بدقة عالية' : 'جاري تحميل الفهرس الكامل...'}
          </span>
        </div>
      </div>

      {/* Smart Quick-Jump Banner (e.g. 2:255 or ص 50) */}
      {quickJump && (
        <button
          type="button"
          onClick={() => {
            if (quickJump.type === 'page') jumpToPage(quickJump.pageNumber);
            else if (quickJump.type === 'surah') jumpToSurah(quickJump.surahNumber);
            else jumpToSurah(quickJump.surahNumber, quickJump.ayahNumber);
          }}
          className="w-full text-right p-4 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer"
          style={{
            backgroundColor: 'var(--accent-soft)',
            borderColor: 'var(--accent-primary)',
            color: 'var(--accent-primary)',
          }}
        >
          <span className="text-sm font-semibold">
            {quickJump.type === 'page' && `انتقال مباشر إلى الصفحة ${toArabicDigits(quickJump.pageNumber)}`}
            {quickJump.type === 'surah' &&
              `انتقال مباشر إلى سورة ${
                SURAH_LIST.find((s) => s.number === quickJump.surahNumber)?.name
              }`}
            {quickJump.type === 'ayah' &&
              `انتقال مباشر إلى سورة ${
                SURAH_LIST.find((s) => s.number === quickJump.surahNumber)?.name
              } · الآية ${toArabicDigits(quickJump.ayahNumber)}`}
          </span>
          <ArrowUpLeft size={18} />
        </button>
      )}

      {/* Quick Topic Suggestions when search is empty */}
      {!query.trim() && (
        <div className="space-y-2.5">
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            كلمات قرآنية للبحث السريع:
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_TOPICS.map((word) => (
              <button
                key={word}
                type="button"
                onClick={() => setQuery(word)}
                className="min-h-[40px] px-4 rounded-xl border text-xs sm:text-sm font-medium cursor-pointer transition-colors"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-hairline)',
                  color: 'var(--text-primary)',
                }}
              >
                {word}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Results */}
      {loading ? (
        <div className="py-16 flex items-center justify-center gap-2 text-sm">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>جاري البحث في آيات المصحف...</span>
        </div>
      ) : normalizeArabic(query).length >= 2 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              تم العثور على {toArabicDigits(totalMatches)} آية مطابقة
            </span>
            {totalMatches > results.length && (
              <span style={{ color: 'var(--text-muted)' }}>
                يتم عرض أول {toArabicDigits(results.length)} نتيجة
              </span>
            )}
          </div>

          {results.length === 0 ? (
            <div
              className="rounded-2xl border py-14 px-4 text-center text-sm"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-secondary)',
              }}
            >
              لا توجد آيات مطابقة لعبارة «{query}». جرّب كتابة الكلمة بدون إضافات أو تصفية السورة.
            </div>
          ) : (
            <div
              className="rounded-2xl border divide-y overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-hairline)',
              }}
            >
              {results.map((ayah) => (
                <SearchResultCard
                  key={ayah.number}
                  ayah={ayah}
                  query={query}
                  onSelect={jumpToAyah}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
