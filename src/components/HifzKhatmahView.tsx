import React, { useMemo, useState } from 'react';
import { EyeOff, Play, Repeat } from 'lucide-react';
import { useMushaf } from '../context/MushafContext';
import { JUZ_LIST, SURAH_LIST } from '../data/surahMetadata';
import { fetchSurahAyahs } from '../services/quranService';
import { toArabicDigits } from '../utils/arabicNormalize';

const DAILY_TARGETS = [
  { pages: 2, label: 'صفحتان' },
  { pages: 4, label: '٤ صفحات' },
  { pages: 10, label: '١٠ صفحات' },
  { pages: 20, label: 'جزء يومياً (٢٠ ص)' },
];

export const HifzKhatmahView: React.FC = () => {
  const {
    khatmah,
    setDailyKhatmahTarget,
    jumpToPage,
    settings,
    updateSettings,
    playAyah,
    setRangeLoop,
    setActiveTab,
  } = useMushaf();

  const [hifzSurah, setHifzSurah] = useState<number>(67); // Default Al-Mulk
  const [startAyah, setStartAyah] = useState<number>(1);
  const [endAyah, setEndAyah] = useState<number>(5);
  const [startingSession, setStartingSession] = useState(false);

  const selectedSurahMeta = useMemo(
    () => SURAH_LIST.find((s) => s.number === hifzSurah) ?? SURAH_LIST[0],
    [hifzSurah]
  );

  const completedCount = khatmah.completedPages.length;
  const pct = Math.min(100, Math.round((completedCount / 604) * 100));
  const remainingPages = Math.max(0, 604 - completedCount);
  const estDays = Math.ceil(remainingPages / Math.max(1, khatmah.dailyPagesTarget));

  // SVG Ring math
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  const juzProgressList = useMemo(() => {
    const completedSet = new Set(khatmah.completedPages);
    return JUZ_LIST.map((juz, idx) => {
      const nextStart = JUZ_LIST[idx + 1]?.startPage ?? 605;
      const total = nextStart - juz.startPage;
      let done = 0;
      for (let p = juz.startPage; p < nextStart; p++) {
        if (completedSet.has(p)) done++;
      }
      return {
        ...juz,
        total,
        done,
        ratio: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    });
  }, [khatmah.completedPages]);

  const handleStartHifzSession = async (enableBlur: boolean) => {
    setStartingSession(true);
    try {
      const ayahs = await fetchSurahAyahs(hifzSurah);
      const safeStart = Math.max(1, Math.min(startAyah, selectedSurahMeta.ayahCount));
      const safeEnd = Math.max(safeStart, Math.min(endAyah, selectedSurahMeta.ayahCount));
      const targetAyah = ayahs.find((a) => a.numberInSurah === safeStart) ?? ayahs[0];

      if (enableBlur) {
        updateSettings({ hifzMode: 'blur-all' });
      }
      if (settings.repeatAyahCount === 1) {
        updateSettings({ repeatAyahCount: 3 });
      }

      if (targetAyah) {
        setRangeLoop(safeStart, safeEnd);
        playAyah(targetAyah, { rangeStart: safeStart, rangeEnd: safeEnd });
        setActiveTab('reader');
      }
    } finally {
      setStartingSession(false);
    }
  };

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-5 pb-28 lg:pb-14 space-y-6">
      {/* Khatmah Progress & Daily Goal Card */}
      <section
        className="rounded-2xl sm:rounded-3xl border p-5 space-y-5"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-base sm:text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              متابعة الختمة اليومية
            </h2>
            <p className="text-xs sm:text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              أتممت {toArabicDigits(completedCount)} من ٦٠٤ صفحة · المتبقي نحو{' '}
              {toArabicDigits(estDays)} يوم
            </p>
            <p className="text-xs tabular-nums" style={{ color: 'var(--accent-primary)' }}>
              سلسلة المواظبة: {toArabicDigits(khatmah.streakDays)} يوم · ورد اليوم:{' '}
              {toArabicDigits(khatmah.todayPagesRead)} / {toArabicDigits(khatmah.dailyPagesTarget)}{' '}
              صفحات
            </p>
          </div>

          {/* SVG Progress Ring */}
          <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
              <circle
                cx="48"
                cy="48"
                r={radius}
                fill="none"
                stroke="var(--bg-subtle)"
                strokeWidth="7"
              />
              <circle
                cx="48"
                cy="48"
                r={radius}
                fill="none"
                stroke="var(--accent-primary)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>
            <span
              className="absolute text-sm font-bold tabular-nums"
              style={{ color: 'var(--text-primary)' }}
            >
              {toArabicDigits(pct)}٪
            </span>
          </div>
        </div>

        {/* Daily Target Selector */}
        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            الورد اليومي المستهدف:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {DAILY_TARGETS.map((t) => {
              const active = khatmah.dailyPagesTarget === t.pages;
              return (
                <button
                  key={t.pages}
                  type="button"
                  onClick={() => setDailyKhatmahTarget(t.pages)}
                  className="min-h-[42px] px-3 rounded-xl border text-xs font-medium cursor-pointer transition-colors"
                  style={{
                    backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                    borderColor: active ? 'var(--accent-primary)' : 'var(--border-hairline)',
                    color: active ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Smart Hifz Session Launcher */}
      <section
        className="rounded-2xl sm:rounded-3xl border p-5 space-y-4"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        <div>
          <h2 className="text-base sm:text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            جلسة الحفظ الذكي والتكرار
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            اختر سورة ونطاق آيات لتكرارها تلقائياً مع مهلة ترديد أو اختبار إخفاء النص
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label
              htmlFor="hifz-surah"
              className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              السورة
            </label>
            <select
              id="hifz-surah"
              value={hifzSurah}
              onChange={(e) => {
                const nextNum = Number(e.target.value);
                const meta = SURAH_LIST.find((s) => s.number === nextNum);
                setHifzSurah(nextNum);
                setStartAyah(1);
                setEndAyah(Math.min(5, meta?.ayahCount ?? 5));
              }}
              className="w-full min-h-[44px] px-3 rounded-xl border text-sm focus:outline-none cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-primary)',
              }}
            >
              {SURAH_LIST.map((s) => (
                <option key={s.number} value={s.number}>
                  {toArabicDigits(s.number)}. سورة {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="hifz-start"
              className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              من آية
            </label>
            <input
              id="hifz-start"
              type="number"
              min={1}
              max={selectedSurahMeta.ayahCount}
              value={startAyah}
              onChange={(e) => setStartAyah(Number(e.target.value))}
              className="w-full min-h-[44px] px-3 rounded-xl border text-sm tabular-nums focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="hifz-end"
              className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              إلى آية (الحد {toArabicDigits(selectedSurahMeta.ayahCount)})
            </label>
            <input
              id="hifz-end"
              type="number"
              min={startAyah}
              max={selectedSurahMeta.ayahCount}
              value={endAyah}
              onChange={(e) => setEndAyah(Number(e.target.value))}
              className="w-full min-h-[44px] px-3 rounded-xl border text-sm tabular-nums focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="space-y-1.5">
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              تكرار كل آية
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { val: 1, label: '١×' },
                { val: 3, label: '٣×' },
                { val: 5, label: '٥×' },
                { val: 0, label: '∞' },
              ].map((r) => (
                <button
                  key={r.val}
                  type="button"
                  onClick={() => updateSettings({ repeatAyahCount: r.val })}
                  className="min-h-[40px] rounded-xl border text-xs font-medium cursor-pointer"
                  style={{
                    backgroundColor:
                      settings.repeatAyahCount === r.val
                        ? 'var(--accent-soft)'
                        : 'var(--bg-canvas)',
                    borderColor:
                      settings.repeatAyahCount === r.val
                        ? 'var(--accent-primary)'
                        : 'var(--border-hairline)',
                    color:
                      settings.repeatAyahCount === r.val
                        ? 'var(--accent-primary)'
                        : 'var(--text-secondary)',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--text-secondary)' }}>مهلة الترديد</span>
              <span className="font-semibold tabular-nums" style={{ color: 'var(--accent-primary)' }}>
                {toArabicDigits(settings.echoPauseSeconds)} ث
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              value={settings.echoPauseSeconds}
              onChange={(e) => updateSettings({ echoPauseSeconds: Number(e.target.value) })}
              className="w-full accent-[var(--accent-primary)] cursor-pointer mt-2"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 pt-2">
          <button
            type="button"
            disabled={startingSession}
            onClick={() => handleStartHifzSession(false)}
            className="flex-1 min-w-[160px] min-h-[46px] px-4 rounded-xl text-xs sm:text-sm font-medium text-white inline-flex items-center justify-center gap-2 cursor-pointer"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            <Play size={16} />
            <span>بدء التكرار الصوتي</span>
          </button>

          <button
            type="button"
            disabled={startingSession}
            onClick={() => handleStartHifzSession(true)}
            className="flex-1 min-w-[160px] min-h-[46px] px-4 rounded-xl border text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: 'var(--border-hairline)',
              color: 'var(--text-primary)',
            }}
          >
            <EyeOff size={16} />
            <span>بدء مع إخفاء الآيات</span>
          </button>
        </div>
      </section>

      {/* 30 Juz Progress Grid */}
      <section
        className="rounded-2xl sm:rounded-3xl border p-5 space-y-3"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            خريطة الأجزاء الثلاثين
          </h3>
          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <Repeat size={13} />
            <span>اضغط لفتح الجزء</span>
          </span>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-2">
          {juzProgressList.map((j) => (
            <button
              key={j.number}
              type="button"
              onClick={() => jumpToPage(j.startPage)}
              className="min-h-[54px] p-1.5 rounded-xl border flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors"
              style={{
                backgroundColor:
                  j.ratio >= 100
                    ? 'var(--accent-primary)'
                    : j.ratio > 0
                      ? 'var(--accent-soft)'
                      : 'var(--bg-canvas)',
                borderColor:
                  j.ratio > 0 ? 'var(--accent-primary)' : 'var(--border-hairline)',
                color: j.ratio >= 100 ? '#ffffff' : 'var(--text-primary)',
              }}
            >
              <span className="text-xs font-bold tabular-nums">{toArabicDigits(j.number)}</span>
              <span className="text-[10px] opacity-80 tabular-nums">{toArabicDigits(j.ratio)}٪</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
