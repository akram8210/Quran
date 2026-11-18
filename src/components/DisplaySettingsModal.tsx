import React from 'react';
import { Check, Download, Loader2, Moon, Sun, X } from 'lucide-react';
import { useMushaf } from '../context/MushafContext';
import { RECITERS, TAFSIR_EDITIONS } from '../data/surahMetadata';
import { MushafTheme } from '../types/quran';
import { toArabicDigits } from '../utils/arabicNormalize';

interface DisplaySettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const THEMES: { id: MushafTheme; label: string; bg: string; fg: string }[] = [
  { id: 'parchment', label: 'ورق المصحف', bg: '#fdfaf1', fg: '#1a1612' },
  { id: 'day', label: 'نهاري ناصع', bg: '#ffffff', fg: '#141816' },
  { id: 'night', label: 'ليلي مريح', bg: '#121815', fg: '#eee9dc' },
];

export const DisplaySettingsModal: React.FC<DisplaySettingsModalProps> = ({ open, onClose }) => {
  const { settings, updateSettings, corpusReady, corpusLoading, downloadFullCorpus } = useMushaf();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="إعدادات المصحف والعرض"
        className="w-full sm:max-w-md max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-hairline)',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-5 py-4 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--border-hairline)' }}
        >
          <h2 className="text-base font-bold">إعدادات القراءة والخط</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl cursor-pointer"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {/* Paper / Night Theme */}
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              مظهر صفحة المصحف
            </p>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((t) => {
                const active = settings.theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => updateSettings({ theme: t.id })}
                    className="p-3 rounded-2xl border flex flex-col items-center gap-2 cursor-pointer transition-colors"
                    style={{
                      backgroundColor: t.bg,
                      color: t.fg,
                      borderColor: active ? 'var(--accent-primary)' : 'var(--border-hairline)',
                      outline: active ? '2px solid var(--accent-primary)' : 'none',
                    }}
                  >
                    {t.id === 'night' ? <Moon size={16} /> : <Sun size={16} />}
                    <span className="text-xs font-medium whitespace-nowrap">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* View Mode & Hifz Test inside Settings */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                نمط العرض
              </p>
              <div
                className="grid grid-cols-2 p-1 rounded-xl border"
                style={{
                  backgroundColor: 'var(--bg-canvas)',
                  borderColor: 'var(--border-hairline)',
                }}
              >
                <button
                  type="button"
                  onClick={() => updateSettings({ viewMode: 'mushaf' })}
                  className="min-h-[36px] rounded-lg text-xs font-medium cursor-pointer"
                  style={{
                    backgroundColor:
                      settings.viewMode === 'mushaf' ? 'var(--accent-primary)' : 'transparent',
                    color: settings.viewMode === 'mushaf' ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  المصحف
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ viewMode: 'study' })}
                  className="min-h-[36px] rounded-lg text-xs font-medium cursor-pointer"
                  style={{
                    backgroundColor:
                      settings.viewMode === 'study' ? 'var(--accent-primary)' : 'transparent',
                    color: settings.viewMode === 'study' ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  آية بآية
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                اختبار الحفظ
              </p>
              <div
                className="grid grid-cols-2 p-1 rounded-xl border"
                style={{
                  backgroundColor: 'var(--bg-canvas)',
                  borderColor: 'var(--border-hairline)',
                }}
              >
                <button
                  type="button"
                  onClick={() => updateSettings({ hifzMode: 'off' })}
                  className="min-h-[36px] rounded-lg text-xs font-medium cursor-pointer"
                  style={{
                    backgroundColor:
                      settings.hifzMode === 'off' ? 'var(--accent-primary)' : 'transparent',
                    color: settings.hifzMode === 'off' ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  عادي
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ hifzMode: 'blur-all' })}
                  className="min-h-[36px] rounded-lg text-xs font-medium cursor-pointer"
                  style={{
                    backgroundColor:
                      settings.hifzMode !== 'off' ? 'var(--accent-primary)' : 'transparent',
                    color: settings.hifzMode !== 'off' ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  إخفاء
                </button>
              </div>
            </div>
          </div>

          {/* Responsive Font Scale */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-secondary)' }}>حجم الخط</span>
              <span className="font-semibold tabular-nums" style={{ color: 'var(--accent-primary)' }}>
                {toArabicDigits(Math.round(settings.fontScale * 100))}٪
              </span>
            </div>
            <input
              type="range"
              min={0.85}
              max={1.35}
              step={0.05}
              value={settings.fontScale}
              onChange={(e) => updateSettings({ fontScale: Number(e.target.value) })}
              className="w-full accent-[var(--accent-primary)] cursor-pointer"
            />
          </div>

          {/* Line Spacing */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-secondary)' }}>تباعد الأسطر</span>
              <span className="font-semibold tabular-nums" style={{ color: 'var(--accent-primary)' }}>
                {settings.lineHeight.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={1.7}
              max={2.5}
              step={0.05}
              value={settings.lineHeight}
              onChange={(e) => updateSettings({ lineHeight: Number(e.target.value) })}
              className="w-full accent-[var(--accent-primary)] cursor-pointer"
            />
          </div>

          {/* Default Reciter */}
          <div className="space-y-1.5">
            <label
              htmlFor="settings-reciter"
              className="block text-xs font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              القارئ الافتراضي
            </label>
            <select
              id="settings-reciter"
              value={settings.reciterId}
              onChange={(e) => updateSettings({ reciterId: e.target.value })}
              className="w-full min-h-[44px] px-3 rounded-xl border text-sm focus:outline-none cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-primary)',
              }}
            >
              {RECITERS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.style}
                </option>
              ))}
            </select>
          </div>

          {/* Default Tafsir */}
          <div className="space-y-1.5">
            <label
              htmlFor="settings-tafsir"
              className="block text-xs font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              التفسير المعتمد
            </label>
            <select
              id="settings-tafsir"
              value={settings.tafsirId}
              onChange={(e) => updateSettings({ tafsirId: e.target.value })}
              className="w-full min-h-[44px] px-3 rounded-xl border text-sm focus:outline-none cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-primary)',
              }}
            >
              {TAFSIR_EDITIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Offline Storage Status */}
          <div
            className="p-3.5 rounded-2xl border flex items-center justify-between gap-3"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: 'var(--border-hairline)',
            }}
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                حفظ المصحف في الجهاز
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {corpusReady
                  ? 'المصحف بالكامل محفوظ محلياً للقراءة والبحث الفوري'
                  : 'تنزيل النص العثماني الكامل للبحث السريع بدون انتظار'}
              </p>
            </div>
            {corpusReady ? (
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-primary)' }}
              >
                <Check size={17} />
              </span>
            ) : (
              <button
                type="button"
                onClick={downloadFullCorpus}
                disabled={corpusLoading}
                className="min-h-[40px] px-3 rounded-xl text-xs font-medium text-white shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                {corpusLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                <span>{corpusLoading ? 'جاري الحفظ' : 'حفظ الآن'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
