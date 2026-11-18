import React, { useState } from 'react';
import {
  ChevronUp,
  Loader2,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from 'lucide-react';
import { useMushaf } from '../context/MushafContext';
import { RECITERS, SURAH_LIST } from '../data/surahMetadata';
import { toArabicDigits } from '../utils/arabicNormalize';

function formatTime(sec: number): string {
  if (!sec || !Number.isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const AudioPlayerBar: React.FC = () => {
  const {
    audioState,
    settings,
    updateSettings,
    togglePlayPause,
    stopAudio,
    playNextAyah,
    playPrevAyah,
    seekAudio,
    playAyah,
    playSurahStream,
    setRangeLoop,
  } = useMushaf();

  const [expanded, setExpanded] = useState(false);

  const isActive =
    audioState.currentAyah !== null || audioState.currentSurahNumber !== null;

  if (!isActive) return null;

  const currentReciter = RECITERS.find((r) => r.id === settings.reciterId) ?? RECITERS[0];
  const surahMeta = SURAH_LIST.find(
    (s) => s.number === (audioState.currentAyah?.surahNumber ?? audioState.currentSurahNumber)
  );

  const title =
    audioState.mode === 'surah'
      ? `سورة ${surahMeta?.name ?? ''} (تلاوة متصلة)`
      : `سورة ${audioState.currentAyah?.surahName ?? ''} · آية ${toArabicDigits(
          audioState.currentAyah?.numberInSurah ?? 1
        )}`;

  const progressPct =
    audioState.duration > 0 ? (audioState.currentTime / audioState.duration) * 100 : 0;

  return (
    <>
      {/* Expanded Audio & Hifz Repetition Settings Sheet */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/50 backdrop-blur-[2px]"
          onClick={() => setExpanded(false)}
        >
          <div
            className="w-full lg:max-w-lg rounded-t-3xl lg:rounded-3xl border p-5 space-y-5 max-h-[85vh] overflow-y-auto"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-hairline)',
              color: 'var(--text-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">إعدادات التلاوة والتكرار</h3>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
                aria-label="إغلاق"
              >
                <X size={20} />
              </button>
            </div>

            {/* Reciter Selection */}
            <div className="space-y-2">
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                القارئ
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {RECITERS.map((rec) => {
                  const active = settings.reciterId === rec.id;
                  return (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => {
                        updateSettings({ reciterId: rec.id });
                        if (audioState.mode === 'surah' && audioState.currentSurahNumber) {
                          setTimeout(() => playSurahStream(audioState.currentSurahNumber!), 50);
                        } else if (audioState.currentAyah) {
                          setTimeout(() => playAyah(audioState.currentAyah!), 50);
                        }
                      }}
                      className="text-right p-3 rounded-xl border transition-colors cursor-pointer"
                      style={{
                        backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-canvas)',
                        borderColor: active ? 'var(--accent-primary)' : 'var(--border-hairline)',
                      }}
                    >
                      <p
                        className="text-xs font-semibold"
                        style={{ color: active ? 'var(--accent-primary)' : 'var(--text-primary)' }}
                      >
                        {rec.name}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {rec.style}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Speed & Repeat Controls (for Ayah-by-Ayah mode) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  سرعة التلاوة
                </p>
                <div className="grid grid-cols-4 gap-1">
                  {[0.75, 1, 1.25, 1.5].map((spd) => {
                    const active = settings.playbackSpeed === spd;
                    return (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => updateSettings({ playbackSpeed: spd })}
                        className="min-h-[38px] rounded-lg text-xs font-medium tabular-nums border cursor-pointer"
                        style={{
                          backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                          borderColor: active ? 'var(--accent-primary)' : 'var(--border-hairline)',
                          color: active ? '#fff' : 'var(--text-secondary)',
                        }}
                      >
                        {spd}×
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  تكرار كل آية
                </p>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { val: 1, label: '١×' },
                    { val: 3, label: '٣×' },
                    { val: 5, label: '٥×' },
                    { val: 0, label: '∞' },
                  ].map((opt) => {
                    const active = settings.repeatAyahCount === opt.val;
                    return (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => updateSettings({ repeatAyahCount: opt.val })}
                        className="min-h-[38px] rounded-lg text-xs font-medium border cursor-pointer"
                        style={{
                          backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                          borderColor: active ? 'var(--accent-primary)' : 'var(--border-hairline)',
                          color: active ? '#fff' : 'var(--text-secondary)',
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Echo Pause Gap for Hifz repetition */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>
                  مهلة الترديد بين الآيات (للحفظ)
                </span>
                <span className="font-semibold tabular-nums" style={{ color: 'var(--accent-primary)' }}>
                  {toArabicDigits(settings.echoPauseSeconds)} ثوانٍ
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={5}
                step={1}
                value={settings.echoPauseSeconds}
                onChange={(e) => updateSettings({ echoPauseSeconds: Number(e.target.value) })}
                className="w-full accent-[var(--accent-primary)] cursor-pointer"
              />
            </div>

            {/* Range Loop Indicator */}
            {audioState.rangeStartAyah !== null && audioState.rangeEndAyah !== null && (
              <div
                className="flex items-center justify-between p-3 rounded-xl border text-xs"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  borderColor: 'var(--border-hairline)',
                }}
              >
                <span style={{ color: 'var(--accent-primary)' }}>
                  تكرار النطاق: من آية {toArabicDigits(audioState.rangeStartAyah)} إلى{' '}
                  {toArabicDigits(audioState.rangeEndAyah)}
                </span>
                <button
                  type="button"
                  onClick={() => setRangeLoop(null, null)}
                  className="font-semibold underline cursor-pointer"
                  style={{ color: 'var(--accent-primary)' }}
                >
                  إلغاء النطاق
                </button>
              </div>
            )}

            {/* Seek bar for full-surah mode */}
            {audioState.duration > 0 && (
              <div className="space-y-1">
                <input
                  type="range"
                  min={0}
                  max={audioState.duration}
                  value={audioState.currentTime}
                  onChange={(e) => seekAudio(Number(e.target.value))}
                  className="w-full accent-[var(--accent-primary)] cursor-pointer"
                />
                <div className="flex justify-between text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  <span>{formatTime(audioState.currentTime)}</span>
                  <span>{formatTime(audioState.duration)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sleek Compact Docked Mini-Player */}
      <div
        className="fixed bottom-[62px] lg:bottom-5 left-2 right-2 lg:left-6 lg:right-auto lg:w-[430px] z-30 rounded-2xl border shadow-lg backdrop-blur-md overflow-hidden"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-elevated) 95%, transparent)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        {/* Ultra-thin progress hairline */}
        <div className="h-[2px] w-full" style={{ backgroundColor: 'var(--bg-subtle)' }}>
          <div
            className="h-full transition-all"
            style={{
              width: `${Math.min(100, progressPct)}%`,
              backgroundColor: 'var(--accent-primary)',
            }}
          />
        </div>

        <div className="px-3 py-1.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="min-w-0 flex-1 flex items-center gap-2.5 text-right cursor-pointer min-h-[42px]"
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent-primary)',
              }}
            >
              <Volume2 size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {title}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                {audioState.error ? audioState.error : currentReciter.name}
                {settings.repeatAyahCount !== 1 && audioState.mode === 'ayah'
                  ? ` · تكرار ${
                      settings.repeatAyahCount === 0
                        ? '∞'
                        : toArabicDigits(settings.repeatAyahCount)
                    }`
                  : ''}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-0.5 shrink-0">
            {audioState.mode === 'ayah' && (
              <button
                type="button"
                onClick={playPrevAyah}
                aria-label="الآية السابقة"
                className="min-h-[40px] min-w-[38px] flex items-center justify-center rounded-xl cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
              >
                <SkipForward size={16} />
              </button>
            )}

            <button
              type="button"
              onClick={togglePlayPause}
              aria-label={audioState.isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-white cursor-pointer"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              {audioState.isLoading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : audioState.isPlaying ? (
                <Pause size={17} />
              ) : (
                <Play size={17} />
              )}
            </button>

            {audioState.mode === 'ayah' && (
              <button
                type="button"
                onClick={playNextAyah}
                aria-label="الآية التالية"
                className="min-h-[40px] min-w-[38px] flex items-center justify-center rounded-xl cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
              >
                <SkipBack size={16} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setExpanded(true)}
              aria-label="خيارات التلاوة والتكرار"
              className="min-h-[40px] min-w-[34px] flex items-center justify-center rounded-xl cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
            >
              {settings.repeatAyahCount !== 1 ? <Repeat size={15} /> : <ChevronUp size={16} />}
            </button>

            <button
              type="button"
              onClick={stopAudio}
              aria-label="إغلاق المشغل"
              className="min-h-[40px] min-w-[34px] flex items-center justify-center rounded-xl cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
