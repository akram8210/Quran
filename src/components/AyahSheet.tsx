import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  BookOpenText,
  Check,
  Copy,
  GitCompare,
  Loader2,
  MapPin,
  PenLine,
  Play,
  Repeat,
  SearchCode,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { useMushaf } from '../context/MushafContext';
import { TAFSIR_EDITIONS } from '../data/surahMetadata';
import {
  ensureFullCorpusLoaded,
  exploreWordOccurrences,
  fetchAyahTafsir,
  fetchAyahWords,
  getFullCorpusSync,
  toQpcSafeText,
} from '../services/quranService';
import {
  BookmarkCategory,
  MushafWord,
  SimilarAyahMatch,
  WordOccurrenceResult,
} from '../types/quran';
import {
  findSimilarAyahs,
  normalizeArabic,
  toArabicDigits,
} from '../utils/arabicNormalize';

type SheetTab = 'tafsir' | 'word-lens' | 'mutashabihat' | 'tadabbur';

const BOOKMARK_CATEGORIES: BookmarkCategory[] = ['تلاوة', 'حفظ', 'تدبر', 'مراجعة'];

export const AyahSheet: React.FC = () => {
  const {
    selectedAyahForSheet: ayah,
    selectedWordForSheet,
    setSelectedAyahForSheet,
    settings,
    updateSettings,
    playAyah,
    toggleBookmark,
    isBookmarked,
    notes,
    saveTadabburNote,
    deleteTadabburNote,
    saveReadingPosition,
    jumpToAyah,
    setRangeLoop,
    pronounceWord,
    pronouncingWord,
  } = useMushaf();

  const [activeTab, setActiveTab] = useState<SheetTab>('tafsir');
  const [focusedWord, setFocusedWord] = useState<MushafWord | null>(null);
  const [tafsirText, setTafsirText] = useState<string>('');
  const [tafsirLoading, setTafsirLoading] = useState<boolean>(false);
  const [tafsirError, setTafsirError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Word-by-word pronunciation + explorer state
  const [ayahWords, setAyahWords] = useState<MushafWord[]>([]);
  const [wordResult, setWordResult] = useState<WordOccurrenceResult | null>(null);
  const [wordLoading, setWordLoading] = useState(false);

  // Mutashabihat state
  const [similarMatches, setSimilarMatches] = useState<SimilarAyahMatch[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  // Tadabbur Note state
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSavedToast, setNoteSavedToast] = useState(false);

  // Sync tapped word & Ayah
  useEffect(() => {
    if (!ayah) return;
    setActiveTab('tafsir');
    setFocusedWord(selectedWordForSheet);
    setWordResult(null);
    setCopied(false);
    setNoteDraft(notes[ayah.number]?.note ?? '');
    setNoteSavedToast(false);

    if (ayah.words && ayah.words.length > 0) {
      setAyahWords(ayah.words.filter((w) => w.charType === 'word'));
    } else {
      setAyahWords([]);
      fetchAyahWords(ayah.surahNumber, ayah.numberInSurah).then((ws) => {
        setAyahWords(ws.filter((w) => w.charType === 'word'));
      });
    }
  }, [ayah?.number, selectedWordForSheet?.id]);

  // Load Tafsir
  useEffect(() => {
    if (!ayah || activeTab !== 'tafsir') return;
    let mounted = true;
    setTafsirLoading(true);
    setTafsirError(null);

    fetchAyahTafsir(ayah.surahNumber, ayah.numberInSurah, settings.tafsirId)
      .then((text) => {
        if (!mounted) return;
        setTafsirText(text);
        setTafsirLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setTafsirError('تعذر تحميل التفسير، تأكد من الاتصال بالإنترنت.');
        setTafsirLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [ayah?.number, settings.tafsirId, activeTab]);

  // Auto-load word occurrences when switching to word-lens with a focusedWord
  useEffect(() => {
    if (!ayah || activeTab !== 'word-lens' || !focusedWord) return;
    let mounted = true;
    setWordLoading(true);
    exploreWordOccurrences(focusedWord.qpcText, normalizeArabic(focusedWord.textUthmani))
      .then((res) => {
        if (mounted) setWordResult(res);
      })
      .catch(() => {
        if (mounted) setWordResult(null);
      })
      .finally(() => {
        if (mounted) setWordLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, focusedWord?.id, ayah?.number]);

  // Load Mutashabihat when tab opens
  useEffect(() => {
    if (!ayah || activeTab !== 'mutashabihat') return;
    let mounted = true;
    setSimilarLoading(true);

    (async () => {
      try {
        const corpus = getFullCorpusSync() || (await ensureFullCorpusLoaded());
        if (!mounted) return;
        const matches = findSimilarAyahs(ayah, corpus, 12);
        setSimilarMatches(matches);
      } catch {
        if (mounted) setSimilarMatches([]);
      } finally {
        if (mounted) setSimilarLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [ayah?.number, activeTab]);

  // Highlight mentions of the focused word inside Tafsir prose
  const highlightedTafsirNodes = useMemo(() => {
    if (!tafsirText || !focusedWord) return tafsirText;
    const targetNorm = normalizeArabic(focusedWord.textUthmani);
    if (targetNorm.length < 2) return tafsirText;

    const tokens = tafsirText.split(/(\s+)/);
    return tokens.map((tok, idx) => {
      if (/^\s+$/.test(tok)) return tok;
      const tokNorm = normalizeArabic(tok);
      const isRelated =
        tokNorm === targetNorm ||
        (targetNorm.length >= 3 && (tokNorm.includes(targetNorm) || targetNorm.includes(tokNorm)));
      if (isRelated) {
        return (
          <mark
            key={idx}
            className="rounded px-1 font-semibold"
            style={{
              backgroundColor: 'var(--accent-soft)',
              color: 'var(--accent-primary)',
            }}
          >
            {tok}
          </mark>
        );
      }
      return tok;
    });
  }, [tafsirText, focusedWord]);

  if (!ayah) return null;

  const bookmarked = isBookmarked(ayah.number);

  const handleSelectWord = (w: MushafWord, autoSpeak = true) => {
    setFocusedWord(w);
    if (autoSpeak && w.audioUrl) {
      pronounceWord(w, ayah, 1);
    }
    if (activeTab === 'word-lens') {
      setWordLoading(true);
      exploreWordOccurrences(w.qpcText, normalizeArabic(w.textUthmani))
        .then((res) => setWordResult(res))
        .finally(() => setWordLoading(false));
    }
  };

  const handleCopyAyah = async () => {
    const citation = `﴿${ayah.text}﴾ [سورة ${ayah.surahName}: ${toArabicDigits(ayah.numberInSurah)}]`;
    try {
      await navigator.clipboard.writeText(citation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/45 backdrop-blur-[2px]"
      onClick={() => setSelectedAyahForSheet(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`تفاصيل الآية ${ayah.numberInSurah} من سورة ${ayah.surahName}`}
        className="w-full lg:max-w-2xl max-h-[88vh] flex flex-col rounded-t-3xl lg:rounded-3xl border shadow-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-hairline)',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lg:hidden flex justify-center pt-2.5 pb-1">
          <div
            className="w-10 h-1.5 rounded-full opacity-30"
            style={{ backgroundColor: 'var(--text-muted)' }}
          />
        </div>

        {/* Sheet Header */}
        <div
          className="px-4 sm:px-6 pt-1.5 pb-3 border-b flex items-center justify-between gap-3"
          style={{ borderColor: 'var(--border-hairline)' }}
        >
          <div className="min-w-0">
            <h2 className="text-base font-bold truncate">
              سورة {ayah.surahName} · الآية {toArabicDigits(ayah.numberInSurah)}
            </h2>
            <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--text-muted)' }}>
              صفحة {toArabicDigits(ayah.page)} · الجزء {toArabicDigits(ayah.juz)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSelectedAyahForSheet(null)}
            aria-label="إغلاق"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl cursor-pointer"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Focused Word Pronunciation Bar (appears immediately when user tapped a word!) */}
        {focusedWord && (
          <div
            className="px-4 sm:px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3"
            style={{
              backgroundColor: 'var(--accent-soft)',
              borderColor: 'var(--border-hairline)',
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="font-uthmani text-2xl sm:text-3xl leading-none"
                style={{ color: 'var(--text-primary)' }}
              >
                {focusedWord.qpcText}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                الكلمة المختارة
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {focusedWord.audioUrl && (
                <>
                  <button
                    type="button"
                    onClick={() => pronounceWord(focusedWord, ayah, 1)}
                    className="min-h-[38px] px-3 rounded-xl text-xs font-medium text-white inline-flex items-center gap-1.5 cursor-pointer"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                  >
                    <Volume2 size={14} />
                    <span>
                      {pronouncingWord?.word.id === focusedWord.id && pronouncingWord.isPlaying
                        ? 'جاري النطق...'
                        : 'نطق الكلمة'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => pronounceWord(focusedWord, ayah, 0.72)}
                    className="min-h-[38px] px-3 rounded-xl border text-xs font-medium cursor-pointer"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    بطيء
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('word-lens')}
                className="min-h-[38px] px-3 rounded-xl border text-xs font-medium cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-hairline)',
                  color: 'var(--accent-primary)',
                }}
              >
                مواضعها
              </button>
            </div>
          </div>
        )}

        {/* Ayah Preview (Tap any word inside to switch word & hear it) + Compact Actions */}
        <div
          className="px-4 sm:px-6 py-3 border-b space-y-2.5"
          style={{
            backgroundColor: 'var(--bg-canvas)',
            borderColor: 'var(--border-hairline)',
          }}
        >
          <div className="max-h-28 overflow-y-auto">
            {ayahWords.length > 0 ? (
              <p className="font-uthmani text-xl sm:text-2xl leading-loose">
                {ayahWords.map((w) => {
                  const isFocused = focusedWord?.id === w.id;
                  return (
                    <span
                      key={w.id}
                      onClick={() => handleSelectWord(w, true)}
                      className={`inline cursor-pointer rounded px-1 transition-colors ${
                        w.isSajdahWord ? 'sajdah-word-underline' : ''
                      }`}
                      style={{
                        backgroundColor: isFocused ? 'var(--word-playing)' : undefined,
                      }}
                    >
                      {w.qpcText}{' '}
                    </span>
                  );
                })}
              </p>
            ) : (
              <p className="font-uthmani text-xl sm:text-2xl leading-loose">
                {ayah.text}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => playAyah(ayah)}
              className="min-h-[38px] px-3 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 text-white cursor-pointer whitespace-nowrap"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              <Play size={13} />
              <span>تلاوة الآية</span>
            </button>

            <button
              type="button"
              onClick={() => {
                updateSettings({ repeatAyahCount: 3 });
                setRangeLoop(ayah.numberInSurah, ayah.numberInSurah);
                playAyah(ayah);
              }}
              className="min-h-[38px] px-3 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 border cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-primary)',
              }}
            >
              <Repeat size={13} />
              <span>تكرار للحفظ</span>
            </button>

            <button
              type="button"
              onClick={() => toggleBookmark(ayah)}
              className="min-h-[38px] px-3 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 border cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor: bookmarked ? 'var(--accent-gold-soft)' : 'var(--bg-surface)',
                borderColor: bookmarked ? 'var(--accent-gold)' : 'var(--border-hairline)',
                color: bookmarked ? 'var(--accent-gold)' : 'var(--text-primary)',
              }}
            >
              <Bookmark size={13} fill={bookmarked ? 'currentColor' : 'none'} />
              <span>{bookmarked ? 'محفوظة' : 'فاصل'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                saveReadingPosition({
                  surahNumber: ayah.surahNumber,
                  surahName: ayah.surahName,
                  ayahNumber: ayah.numberInSurah,
                  globalAyahNumber: ayah.number,
                  pageNumber: ayah.page,
                })
              }
              className="min-h-[38px] px-3 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 border cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-primary)',
              }}
            >
              <MapPin size={13} />
              <span>علامة القراءة</span>
            </button>

            <button
              type="button"
              onClick={handleCopyAyah}
              className="min-h-[38px] px-3 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 border cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-primary)',
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
            </button>
          </div>
        </div>

        {/* Clean Feature Tabs */}
        <div
          className="px-4 sm:px-6 pt-2 pb-1.5 border-b grid grid-cols-4 gap-1"
          style={{ borderColor: 'var(--border-hairline)' }}
        >
          {(
            [
              { id: 'tafsir', label: 'التفسير', icon: BookOpenText },
              { id: 'word-lens', label: 'عدسة الكلمات', icon: SearchCode },
              { id: 'mutashabihat', label: 'المتشابهات', icon: GitCompare },
              { id: 'tadabbur', label: 'تدبر ووسم', icon: PenLine },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className="min-h-[40px] px-1.5 py-1 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                  color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                }}
              >
                <Icon size={14} />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Tab Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {activeTab === 'tafsir' && (
            <div className="space-y-3.5">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {TAFSIR_EDITIONS.map((ed) => {
                  const active = settings.tafsirId === ed.id;
                  return (
                    <button
                      key={ed.id}
                      type="button"
                      onClick={() => updateSettings({ tafsirId: ed.id })}
                      className="min-h-[36px] px-3 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 border transition-colors cursor-pointer"
                      style={{
                        backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                        borderColor: active ? 'var(--accent-primary)' : 'var(--border-hairline)',
                        color: active ? '#ffffff' : 'var(--text-secondary)',
                      }}
                    >
                      {ed.shortName}
                    </button>
                  );
                })}
              </div>

              {tafsirLoading ? (
                <div className="py-10 flex items-center justify-center gap-2 text-sm">
                  <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>جاري جلب التفسير...</span>
                </div>
              ) : tafsirError ? (
                <p className="text-sm py-6 text-center" style={{ color: 'var(--text-secondary)' }}>
                  {tafsirError}
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    {TAFSIR_EDITIONS.find((e) => e.id === settings.tafsirId)?.name} —{' '}
                    {TAFSIR_EDITIONS.find((e) => e.id === settings.tafsirId)?.author}
                  </p>
                  <p
                    className="text-base leading-relaxed whitespace-pre-line"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {highlightedTafsirNodes}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'word-lens' && (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                اضغط على أي كلمة لسماع نطقها وعرض جميع مواضع ورودها في المصحف:
              </p>

              <div
                className="flex flex-wrap gap-2 p-3 rounded-2xl border"
                style={{
                  backgroundColor: 'var(--bg-canvas)',
                  borderColor: 'var(--border-hairline)',
                }}
              >
                {ayahWords.map((w) => {
                  const active = focusedWord?.id === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => handleSelectWord(w, true)}
                      className="min-h-[42px] px-3 py-1 rounded-xl font-uthmani text-xl inline-flex items-center gap-1.5 transition-colors border cursor-pointer"
                      style={{
                        backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-surface)',
                        borderColor: active ? 'var(--accent-primary)' : 'var(--border-hairline)',
                        color: active ? '#ffffff' : 'var(--text-primary)',
                      }}
                    >
                      <Volume2 size={13} className="opacity-70 shrink-0" />
                      <span>{w.qpcText}</span>
                    </button>
                  );
                })}
              </div>

              {wordLoading ? (
                <div className="py-8 flex items-center justify-center gap-2 text-sm">
                  <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>جاري البحث في المصحف...</span>
                </div>
              ) : wordResult ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-semibold" style={{ color: 'var(--accent-primary)' }}>
                      وردت «{wordResult.queryWord}» {toArabicDigits(wordResult.totalMatches)} مرة
                    </span>
                    <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      في {toArabicDigits(wordResult.surahSpread)} سورة
                    </span>
                  </div>

                  {wordResult.ayahs.length === 0 ? (
                    <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>
                      لم يتم العثور على مطابقات تامة لهذه الكلمة.
                    </p>
                  ) : (
                    <div className="divide-y" style={{ borderColor: 'var(--border-hairline)' }}>
                      {wordResult.ayahs.slice(0, 40).map((match) => (
                        <button
                          key={match.number}
                          type="button"
                          onClick={() => {
                            setSelectedAyahForSheet(null);
                            jumpToAyah(match);
                          }}
                          className="w-full text-right py-3 px-2 hover:opacity-85 transition-opacity cursor-pointer block"
                          style={{ borderColor: 'var(--border-hairline)' }}
                        >
                          <div className="flex items-center justify-between text-xs mb-1 tabular-nums">
                            <span className="font-semibold" style={{ color: 'var(--accent-primary)' }}>
                              سورة {match.surahName} · آية {toArabicDigits(match.numberInSurah)}
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>
                              ص {toArabicDigits(match.page)}
                            </span>
                          </div>
                          <p className="font-uthmani text-lg leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                            {toQpcSafeText(match.text)}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {activeTab === 'mutashabihat' && (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                رادار المتشابهات اللفظية: آيات قريبة اللفظ والتركيب لمساعدتك على ضبط الحفظ:
              </p>

              {similarLoading ? (
                <div className="py-10 flex items-center justify-center gap-2 text-sm">
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>جاري تحليل المتشابهات...</span>
                </div>
              ) : similarMatches.length === 0 ? (
                <p className="text-sm py-8 text-center" style={{ color: 'var(--text-secondary)' }}>
                  هذه الآية متفردة بتركيبها ولا توجد آيات متشابهة لفظياً بنسبة عالية.
                </p>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border-hairline)' }}>
                  {similarMatches.map(({ ayah: match, score, sharedWords }) => (
                    <button
                      key={match.number}
                      type="button"
                      onClick={() => {
                        setSelectedAyahForSheet(null);
                        jumpToAyah(match);
                      }}
                      className="w-full text-right py-3.5 px-2 cursor-pointer block"
                      style={{ borderColor: 'var(--border-hairline)' }}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5 tabular-nums">
                        <span className="font-semibold" style={{ color: 'var(--accent-primary)' }}>
                          سورة {match.surahName} · آية {toArabicDigits(match.numberInSurah)}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          تطابق {toArabicDigits(score)}٪ · {sharedWords.slice(0, 4).join('، ')}
                        </span>
                      </div>
                      <p className="font-uthmani text-lg leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {toQpcSafeText(match.text)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'tadabbur' && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  تصنيف الفاصل القرآني:
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {BOOKMARK_CATEGORIES.map((cat) => {
                    const active = bookmarked?.category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleBookmark(ayah, cat)}
                        className="min-h-[42px] rounded-xl text-xs font-medium border transition-colors cursor-pointer"
                        style={{
                          backgroundColor: active ? 'var(--accent-gold-soft)' : 'var(--bg-canvas)',
                          borderColor: active ? 'var(--accent-gold)' : 'var(--border-hairline)',
                          color: active ? 'var(--accent-gold)' : 'var(--text-secondary)',
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5">
                <label
                  htmlFor="tadabbur-note-input"
                  className="block text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  وقفتك التدبرية أو ملاحظة الحفظ:
                </label>
                <textarea
                  id="tadabbur-note-input"
                  rows={4}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="اكتب معنى تأملته، رابطاً للحفظ، أو دعاءً..."
                  className="w-full rounded-2xl border p-3.5 text-sm leading-relaxed focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                  }}
                />
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      saveTadabburNote(ayah, noteDraft);
                      setNoteSavedToast(true);
                      setTimeout(() => setNoteSavedToast(false), 2000);
                    }}
                    disabled={!noteDraft.trim()}
                    className="min-h-[44px] px-5 rounded-xl text-xs sm:text-sm font-medium text-white disabled:opacity-40 cursor-pointer"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                  >
                    {noteSavedToast ? 'تم حفظ الملاحظة' : 'حفظ الملاحظة'}
                  </button>

                  {notes[ayah.number] && (
                    <button
                      type="button"
                      onClick={() => {
                        deleteTadabburNote(ayah.number);
                        setNoteDraft('');
                      }}
                      className="min-h-[44px] px-3 rounded-xl text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                      style={{ color: '#b91c1c' }}
                    >
                      <Trash2 size={14} />
                      <span>حذف</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
