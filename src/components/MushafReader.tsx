import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Eye,
  EyeOff,
  Loader2,
  Play,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { useMushaf } from '../context/MushafContext';
import {
  ensurePageQcfFontLoaded,
  fetchPageAyahs,
  getQcfFontFamilyName,
  isPageQcfFontLoadedSync,
} from '../services/quranService';
import { AyahItem, MushafWord } from '../types/quran';
import { splitUthmaniTokens, toArabicDigits } from '../utils/arabicNormalize';
import { AyahEndMarker, SurahBanner } from './SurahBanner';

interface MushafReaderProps {
  focusMode: boolean;
  onExitFocusMode: () => void;
}

interface LineWordEntry {
  word: MushafWord;
  ayah: AyahItem;
}

type PageBlock =
  | { type: 'surah-header'; surahNumber: number; key: string }
  | { type: 'line'; lineNumber: number; entries: LineWordEntry[]; key: string };

export const MushafReader: React.FC<MushafReaderProps> = ({
  focusMode,
  onExitFocusMode,
}) => {
  const {
    currentPage,
    jumpToPage,
    settings,
    updateSettings,
    saveReadingPosition,
    highlightedAyahGlobal,
    selectedAyahForSheet,
    selectedWordForSheet,
    openWordSheet,
    audioState,
    playAyah,
    playSurahStream,
    isBookmarked,
    toggleBookmark,
  } = useMushaf();

  const [ayahs, setAyahs] = useState<AyahItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [qcfLoaded, setQcfLoaded] = useState<boolean>(() =>
    isPageQcfFontLoadedSync(currentPage)
  );
  const [error, setError] = useState<string | null>(null);
  const [revealedAyahs, setRevealedAyahs] = useState<Set<number>>(new Set());
  const [pageJumpSliderOpen, setPageJumpSliderOpen] = useState(false);
  const [sliderPage, setSliderPage] = useState(currentPage);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    setSliderPage(currentPage);
    setRevealedAyahs(new Set());
    setPageJumpSliderOpen(false);
  }, [currentPage]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setQcfLoaded(isPageQcfFontLoadedSync(currentPage));

    Promise.all([
      fetchPageAyahs(currentPage),
      ensurePageQcfFontLoaded(currentPage),
    ])
      .then(([data, fontOk]) => {
        if (!active) return;
        setAyahs(data);
        setQcfLoaded(fontOk);
        setLoading(false);

        if (data.length > 0) {
          const first = data[0];
          saveReadingPosition({
            surahNumber: first.surahNumber,
            surahName: first.surahName,
            ayahNumber: first.numberInSurah,
            globalAyahNumber: first.number,
            pageNumber: currentPage,
          });
        }
      })
      .catch(() => {
        if (!active) return;
        setError('تعذر تحميل الصفحة. تحقق من اتصالك بالإنترنت وأعد المحاولة.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentPage, saveReadingPosition]);

  // Keyboard arrow navigation for desktop
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (selectedAyahForSheet) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft' && currentPage < 604) {
        jumpToPage(currentPage + 1);
      } else if (e.key === 'ArrowRight' && currentPage > 1) {
        jumpToPage(currentPage - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentPage, jumpToPage, selectedAyahForSheet]);

  // Auto-scroll to highlighted or currently playing ayah
  useEffect(() => {
    const targetId = highlightedAyahGlobal || audioState.currentAyah?.number;
    if (!targetId) return;
    const el = document.getElementById(`ayah-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedAyahGlobal, audioState.currentAyah?.number, ayahs]);

  const surahGroups = useMemo(() => {
    const groups: { surahNumber: number; surahName: string; startsAtAyah1: boolean; items: AyahItem[] }[] = [];
    for (const ayah of ayahs) {
      const last = groups[groups.length - 1];
      if (!last || last.surahNumber !== ayah.surahNumber) {
        groups.push({
          surahNumber: ayah.surahNumber,
          surahName: ayah.surahName,
          startsAtAyah1: ayah.numberInSurah === 1,
          items: [ayah],
        });
      } else {
        last.items.push(ayah);
      }
    }
    return groups;
  }, [ayahs]);

  // Build authentic 15-line Madinah Mushaf blocks
  const madinahLineBlocks = useMemo<PageBlock[] | null>(() => {
    if (ayahs.length === 0 || !ayahs.every((a) => a.words && a.words.length > 0)) {
      return null;
    }

    const lineMap = new Map<number, LineWordEntry[]>();
    const surahStartLine = new Map<number, number>();

    for (const ayah of ayahs) {
      const words = ayah.words ?? [];
      if (ayah.numberInSurah === 1 && words.length > 0) {
        surahStartLine.set(words[0].lineNumber, ayah.surahNumber);
      }
      for (const w of words) {
        const list = lineMap.get(w.lineNumber);
        if (list) list.push({ word: w, ayah });
        else lineMap.set(w.lineNumber, [{ word: w, ayah }]);
      }
    }

    const sortedLines = Array.from(lineMap.keys()).sort((a, b) => a - b);
    const blocks: PageBlock[] = [];

    for (const ln of sortedLines) {
      const startingSurah = surahStartLine.get(ln);
      if (startingSurah !== undefined) {
        blocks.push({
          type: 'surah-header',
          surahNumber: startingSurah,
          key: `surah-${startingSurah}-ln-${ln}`,
        });
      }
      blocks.push({
        type: 'line',
        lineNumber: ln,
        entries: lineMap.get(ln) ?? [],
        key: `line-${ln}`,
      });
    }

    return blocks;
  }, [ayahs]);

  const pageMeta = useMemo(() => {
    if (ayahs.length === 0) return null;
    const first = ayahs[0];
    const hizb = Math.ceil(first.hizbQuarter / 4);
    return {
      juz: first.juz,
      hizb,
      surahName: first.surahName,
    };
  }, [ayahs]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(dx) > 55 && Math.abs(dy) < 60) {
      if (dx > 0 && currentPage < 604) {
        jumpToPage(currentPage + 1);
      } else if (dx < 0 && currentPage > 1) {
        jumpToPage(currentPage - 1);
      }
    }
  };

  const toggleRevealAyah = (globalNum: number) => {
    setRevealedAyahs((prev) => {
      const next = new Set(prev);
      if (next.has(globalNum)) next.delete(globalNum);
      else next.add(globalNum);
      return next;
    });
  };

  const handleWordClick = (word: MushafWord, ayah: AyahItem) => {
    if (settings.hifzMode !== 'off' && !revealedAyahs.has(ayah.number)) {
      toggleRevealAyah(ayah.number);
      return;
    }
    openWordSheet(ayah, word.charType === 'word' ? word : null);
  };

  const useQcfGlyphs = qcfLoaded && ayahs.every((a) => a.words?.every((w) => Boolean(w.codeV2)));
  const qcfFontFamily = getQcfFontFamilyName(currentPage);

  const renderMushafWord = (
    word: MushafWord,
    ayah: AyahItem,
    wordIdxInAyah: number
  ) => {
    const isPlayingAyah = audioState.currentAyah?.number === ayah.number;
    const isSelectedAyah = selectedAyahForSheet?.number === ayah.number;
    const isSelectedWord =
      selectedWordForSheet?.id === word.id && isSelectedAyah;
    const isSearchPulse = highlightedAyahGlobal === ayah.number;
    const bookmarked = Boolean(isBookmarked(ayah.number));

    if (word.charType === 'end') {
      if (useQcfGlyphs && word.codeV2) {
        return (
          <span
            key={`end-${ayah.number}-${word.id}`}
            onClick={() => openWordSheet(ayah, null)}
            className="inline-block cursor-pointer select-none px-[1px] rounded transition-colors"
            style={{
              fontFamily: qcfFontFamily,
              color: isPlayingAyah ? 'var(--accent-primary)' : 'var(--accent-gold)',
              backgroundColor: isPlayingAyah
                ? 'var(--ayah-playing)'
                : isSelectedAyah || isSearchPulse
                  ? 'var(--ayah-highlight)'
                  : undefined,
            }}
            aria-label={`آية ${ayah.numberInSurah}`}
          >
            {word.codeV2}
          </span>
        );
      }

      return (
        <span
          key={`end-${ayah.number}-${word.id}`}
          onClick={() => openWordSheet(ayah, null)}
          className="inline-flex items-center cursor-pointer"
        >
          <AyahEndMarker
            numberInSurah={ayah.numberInSurah}
            isPlaying={isPlayingAyah}
            isBookmarked={bookmarked}
          />
        </span>
      );
    }

    const isRevealed = revealedAyahs.has(ayah.number);
    const hideToken =
      settings.hifzMode !== 'off' &&
      !isRevealed &&
      (settings.hifzMode === 'blur-all' ||
        (settings.hifzMode === 'first-word' && wordIdxInAyah > 0));

    return (
      <span
        key={`w-${ayah.number}-${word.id}`}
        id={wordIdxInAyah === 0 ? `ayah-${ayah.number}` : undefined}
        onClick={() => handleWordClick(word, ayah)}
        className={`inline-block cursor-pointer rounded transition-colors ${
          hideToken ? 'hifz-blur-word' : 'hifz-blur-word revealed'
        } ${word.isSajdahWord ? 'sajdah-word-underline' : ''}`}
        style={{
          fontFamily: useQcfGlyphs ? qcfFontFamily : undefined,
          backgroundColor: isSelectedWord
            ? 'var(--word-playing)'
            : isPlayingAyah
              ? 'var(--ayah-playing)'
              : isSelectedAyah || isSearchPulse
                ? 'var(--ayah-highlight)'
                : undefined,
        }}
      >
        {useQcfGlyphs ? word.codeV2 : word.qpcText}
      </span>
    );
  };

  // Fallback plain-text renderer if word-level API wasn't loaded
  const renderFallbackAyahText = (ayah: AyahItem) => {
    const isRevealed = revealedAyahs.has(ayah.number);
    const tokens = splitUthmaniTokens(ayah.text);
    const sajdahWordRegex = /(سجد|اسجد|يسجد|سجدا|ساجدين|خروا)/;

    return tokens.map((tok, idx) => {
      const hideToken =
        settings.hifzMode !== 'off' &&
        !isRevealed &&
        !tok.isWaqf &&
        (settings.hifzMode === 'blur-all' || (settings.hifzMode === 'first-word' && idx > 0));

      const isSajdahWord = ayah.sajda && sajdahWordRegex.test(tok.normalized);

      return (
        <span
          key={idx}
          className={`${hideToken ? 'hifz-blur-word' : 'hifz-blur-word revealed'} ${
            isSajdahWord ? 'sajdah-word-underline' : ''
          }`}
        >
          {tok.display}{' '}
        </span>
      );
    });
  };

  const responsiveFontSize = `calc(clamp(16px, 4.45vw, 26px) * ${settings.fontScale})`;

  return (
    <div
      className="flex-1 flex flex-col items-center px-2 sm:px-6 pt-2.5 pb-24 lg:pb-12"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {focusMode && (
        <div className="w-full max-w-2xl flex items-center justify-between mb-2.5">
          <button
            type="button"
            onClick={onExitFocusMode}
            className="min-h-[38px] px-3.5 rounded-xl text-xs font-medium cursor-pointer border"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-hairline)',
              color: 'var(--text-primary)',
            }}
          >
            إنهاء وضع الخشوع
          </button>
          <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
            صفحة {toArabicDigits(currentPage)} من ٦٠٤
          </span>
        </div>
      )}

      {/* Modern Authentic Madinah Mushaf Page Frame */}
      <article
        className="w-full max-w-2xl rounded-2xl sm:rounded-3xl p-[3px] sm:p-[5px] border transition-colors"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--mushaf-frame-outer)',
          boxShadow: '0 8px 28px -12px rgba(0, 0, 0, 0.07)',
        }}
      >
        <div
          className="rounded-[13px] sm:rounded-[19px] border px-3 sm:px-7 py-3.5 sm:py-5"
          style={{
            borderColor: 'var(--mushaf-frame-inner)',
          }}
        >
          {/* Quiet Typographic Mushaf Page Header (zero buttons) */}
          <div
            className="flex items-center justify-between pb-2 mb-2.5 border-b text-xs tabular-nums"
            style={{
              borderColor: 'var(--border-hairline)',
              color: 'var(--text-secondary)',
            }}
          >
            <span className="font-medium">
              {pageMeta ? `الجزء ${toArabicDigits(pageMeta.juz)}` : 'المصحف الشريف'}
            </span>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {pageMeta ? `سورة ${pageMeta.surahName}` : ''}
            </span>
          </div>

          {/* Hifz Test Active Helper Bar (only when user turned on Hifz Blur) */}
          {settings.hifzMode !== 'off' && (
            <div
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 mb-3 rounded-xl border text-xs"
              style={{
                backgroundColor: 'var(--accent-soft)',
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-primary)',
              }}
            >
              <div className="flex items-center gap-1.5">
                <EyeOff size={15} style={{ color: 'var(--accent-primary)' }} />
                <span>وضع اختبار الحفظ — المس الآية لكشفها</span>
              </div>
              <button
                type="button"
                onClick={() => updateSettings({ hifzMode: 'off' })}
                className="font-semibold cursor-pointer"
                style={{ color: 'var(--accent-primary)' }}
              >
                إيقاف
              </button>
            </div>
          )}

          {/* Page Content */}
          {loading ? (
            <div className="py-28 flex flex-col items-center justify-center gap-3">
              <Loader2
                size={26}
                className="animate-spin"
                style={{ color: 'var(--accent-primary)' }}
              />
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                جاري تحميل صفحة {toArabicDigits(currentPage)}...
              </p>
            </div>
          ) : error ? (
            <div className="py-20 text-center space-y-4">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {error}
              </p>
              <button
                type="button"
                onClick={() => jumpToPage(currentPage)}
                className="min-h-[44px] px-5 py-2 rounded-xl text-sm font-medium text-white cursor-pointer"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                إعادة المحاولة
              </button>
            </div>
          ) : settings.viewMode === 'mushaf' && madinahLineBlocks ? (
            /* Authentic 15-Line Madinah Mushaf Page */
            <div
              className={`select-text ${useQcfGlyphs ? '' : 'font-uthmani'}`}
              style={{
                fontSize: responsiveFontSize,
                lineHeight: settings.lineHeight,
                color: 'var(--text-primary)',
              }}
            >
              <div className="space-y-[2px] sm:space-y-1">
                {madinahLineBlocks.map((block) => {
                  if (block.type === 'surah-header') {
                    return (
                      <SurahBanner
                        key={block.key}
                        surahNumber={block.surahNumber}
                        onPlaySurah={() => playSurahStream(block.surahNumber)}
                      />
                    );
                  }

                  const isSpecialCenteredPage = currentPage <= 2;
                  const isShortEndingLine = block.entries.length <= 4 && currentPage > 2;
                  const allowWrap = settings.fontScale > 1.06;

                  return (
                    <div
                      key={block.key}
                      className={
                        isSpecialCenteredPage || isShortEndingLine
                          ? allowWrap
                            ? 'flex flex-wrap justify-center gap-x-1.5'
                            : 'mushaf-line-center'
                          : allowWrap
                            ? 'flex flex-wrap justify-between gap-x-1.5'
                            : 'mushaf-line-justify'
                      }
                    >
                      {block.entries.map((entry) => {
                        const wordPosInAyah = (entry.ayah.words ?? []).findIndex(
                          (w) => w.id === entry.word.id
                        );
                        return renderMushafWord(
                          entry.word,
                          entry.ayah,
                          wordPosInAyah >= 0 ? wordPosInAyah : 0
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Study Verse-by-Verse or Fallback Layout */
            <div>
              {surahGroups.map((group) => (
                <section key={`${group.surahNumber}-${group.items[0]?.number}`}>
                  {group.startsAtAyah1 && (
                    <SurahBanner
                      surahNumber={group.surahNumber}
                      onPlaySurah={() => playSurahStream(group.surahNumber)}
                    />
                  )}

                  {settings.viewMode === 'mushaf' ? (
                    <div
                      className={`font-uthmani select-text ${
                        currentPage <= 2 ? 'text-center' : 'text-justify'
                      }`}
                      style={{
                        fontSize: responsiveFontSize,
                        lineHeight: settings.lineHeight,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {group.items.map((ayah) => {
                        const isPlaying = audioState.currentAyah?.number === ayah.number;
                        const isSelected = selectedAyahForSheet?.number === ayah.number;
                        const isSearchPulse = highlightedAyahGlobal === ayah.number;
                        const bookmarked = Boolean(isBookmarked(ayah.number));

                        return (
                          <span
                            key={ayah.number}
                            id={`ayah-${ayah.number}`}
                            onClick={() => {
                              if (settings.hifzMode !== 'off' && !revealedAyahs.has(ayah.number)) {
                                toggleRevealAyah(ayah.number);
                              } else {
                                openWordSheet(ayah, null);
                              }
                            }}
                            className="inline rounded-lg px-0.5 transition-colors cursor-pointer"
                            style={{
                              backgroundColor: isPlaying
                                ? 'var(--ayah-playing)'
                                : isSelected || isSearchPulse
                                  ? 'var(--ayah-highlight)'
                                  : 'transparent',
                            }}
                          >
                            {renderFallbackAyahText(ayah)}
                            <AyahEndMarker
                              numberInSurah={ayah.numberInSurah}
                              isPlaying={isPlaying}
                              isBookmarked={bookmarked}
                            />
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    /* Study Verse-by-Verse Editorial Layout */
                    <div className="divide-y" style={{ borderColor: 'var(--border-hairline)' }}>
                      {group.items.map((ayah) => {
                        const isPlaying = audioState.currentAyah?.number === ayah.number;
                        const bookmarked = isBookmarked(ayah.number);
                        const isRevealed = revealedAyahs.has(ayah.number);

                        return (
                          <div
                            key={ayah.number}
                            id={`ayah-${ayah.number}`}
                            className="py-4 transition-colors rounded-xl px-2"
                            style={{
                              backgroundColor: isPlaying
                                ? 'var(--ayah-playing)'
                                : highlightedAyahGlobal === ayah.number
                                  ? 'var(--ayah-highlight)'
                                  : 'transparent',
                              borderColor: 'var(--border-hairline)',
                            }}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2.5">
                              <span
                                className="text-xs font-semibold tabular-nums"
                                style={{ color: 'var(--accent-primary)' }}
                              >
                                {ayah.surahName} · {toArabicDigits(ayah.numberInSurah)}
                              </span>

                              <div className="flex items-center gap-1">
                                {settings.hifzMode !== 'off' && (
                                  <button
                                    type="button"
                                    onClick={() => toggleRevealAyah(ayah.number)}
                                    className="min-h-[36px] px-2 rounded-lg text-xs inline-flex items-center gap-1 cursor-pointer"
                                    style={{ color: 'var(--text-secondary)' }}
                                  >
                                    <Eye size={14} />
                                    <span>{isRevealed ? 'إخفاء' : 'كشف'}</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => playAyah(ayah)}
                                  aria-label="استماع للآية"
                                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg cursor-pointer"
                                  style={{
                                    color: isPlaying ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                  }}
                                >
                                  <Play size={15} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => toggleBookmark(ayah)}
                                  aria-label="حفظ الآية"
                                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg cursor-pointer"
                                  style={{
                                    color: bookmarked ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                  }}
                                >
                                  <Bookmark size={15} fill={bookmarked ? 'currentColor' : 'none'} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => openWordSheet(ayah, null)}
                                  className="min-h-[36px] px-2.5 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer"
                                  style={{
                                    backgroundColor: 'var(--accent-soft)',
                                    color: 'var(--accent-primary)',
                                  }}
                                >
                                  <Sparkles size={13} />
                                  <span>التفسير</span>
                                </button>
                              </div>
                            </div>

                            <div
                              className={useQcfGlyphs ? '' : 'font-uthmani'}
                              style={{
                                fontSize: responsiveFontSize,
                                lineHeight: settings.lineHeight,
                                color: 'var(--text-primary)',
                              }}
                            >
                              {ayah.words && ayah.words.length > 0 ? (
                                <div className="flex flex-wrap gap-x-1">
                                  {ayah.words.map((w, wIdx) => renderMushafWord(w, ayah, wIdx))}
                                </div>
                              ) : (
                                <span
                                  onClick={() => openWordSheet(ayah, null)}
                                  className="cursor-pointer"
                                >
                                  {renderFallbackAyahText(ayah)}
                                  <AyahEndMarker
                                    numberInSurah={ayah.numberInSurah}
                                    isPlaying={isPlaying}
                                    isBookmarked={Boolean(bookmarked)}
                                  />
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}

          {/* Minimalist Page Number & Quick Scrubber (Zero Prev/Next Buttons — Swipe Left/Right to flip) */}
          <footer
            className="mt-4 pt-2.5 border-t flex flex-col items-center gap-2"
            style={{ borderColor: 'var(--border-hairline)' }}
          >
            {pageJumpSliderOpen && (
              <div
                className="w-full p-3 rounded-xl border space-y-2"
                style={{
                  backgroundColor: 'var(--bg-canvas)',
                  borderColor: 'var(--border-hairline)',
                }}
              >
                <div className="flex items-center justify-between text-xs tabular-nums">
                  <span style={{ color: 'var(--text-secondary)' }}>الانتقال السريع بين الصفحات</span>
                  <span className="font-semibold" style={{ color: 'var(--accent-primary)' }}>
                    صفحة {toArabicDigits(sliderPage)} / ٦٠٤
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={604}
                  value={sliderPage}
                  onChange={(e) => setSliderPage(Number(e.target.value))}
                  onMouseUp={() => jumpToPage(sliderPage)}
                  onTouchEnd={() => jumpToPage(sliderPage)}
                  className="w-full accent-[var(--accent-primary)] cursor-pointer"
                  aria-label="شريط الانتقال بين صفحات المصحف"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => setPageJumpSliderOpen((v) => !v)}
              className="min-h-[36px] px-4 rounded-xl text-xs font-semibold tabular-nums inline-flex items-center gap-1.5 cursor-pointer"
              style={{
                color: 'var(--text-secondary)',
              }}
              title="اضغط للتنقل السريع، أو اسحب لليمين واليسار لقلب الصفحة"
            >
              <Sliders size={12} className="opacity-60" />
              <span>{toArabicDigits(currentPage)}</span>
            </button>
          </footer>
        </div>
      </article>
    </div>
  );
};
