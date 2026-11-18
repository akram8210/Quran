import React, { useMemo, useState } from 'react';
import { Bookmark, Check, Copy, PenLine, Trash2 } from 'lucide-react';
import { useMushaf } from '../context/MushafContext';
import { toQpcSafeText } from '../services/quranService';
import { BookmarkCategory } from '../types/quran';
import { toArabicDigits } from '../utils/arabicNormalize';

type SavedTab = 'bookmarks' | 'notes';

export const BookmarksView: React.FC = () => {
  const {
    bookmarks,
    notes,
    toggleBookmark,
    deleteTadabburNote,
    jumpToPage,
  } = useMushaf();

  const [tab, setTab] = useState<SavedTab>('bookmarks');
  const [catFilter, setCatFilter] = useState<'all' | BookmarkCategory>('all');
  const [copiedNotes, setCopiedNotes] = useState(false);

  const filteredBookmarks = useMemo(() => {
    if (catFilter === 'all') return bookmarks;
    return bookmarks.filter((b) => b.category === catFilter);
  }, [bookmarks, catFilter]);

  const notesList = useMemo(
    () => Object.values(notes).sort((a, b) => b.updatedAt - a.updatedAt),
    [notes]
  );

  const handleExportNotes = async () => {
    if (notesList.length === 0) return;
    const formatted = notesList
      .map(
        (n) =>
          `[سورة ${n.surahName}: آية ${toArabicDigits(n.ayahNumber)} — ص ${toArabicDigits(
            n.pageNumber
          )}]\n${n.note}`
      )
      .join('\n\n---\n\n');
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedNotes(true);
      setTimeout(() => setCopiedNotes(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-5 pb-28 lg:pb-14 space-y-5">
      {/* Segmented Switch */}
      <div
        className="grid grid-cols-2 gap-1 p-1 rounded-xl border"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        <button
          type="button"
          onClick={() => setTab('bookmarks')}
          className="min-h-[42px] rounded-lg text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer"
          style={{
            backgroundColor: tab === 'bookmarks' ? 'var(--accent-primary)' : 'transparent',
            color: tab === 'bookmarks' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          <Bookmark size={16} />
          <span>الفواصل ({toArabicDigits(bookmarks.length)})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('notes')}
          className="min-h-[42px] rounded-lg text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer"
          style={{
            backgroundColor: tab === 'notes' ? 'var(--accent-primary)' : 'transparent',
            color: tab === 'notes' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          <PenLine size={16} />
          <span>دفتر التدبر ({toArabicDigits(notesList.length)})</span>
        </button>
      </div>

      {tab === 'bookmarks' && (
        <div className="space-y-4">
          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {(['all', 'تلاوة', 'حفظ', 'تدبر', 'مراجعة'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCatFilter(cat)}
                className="min-h-[38px] px-3.5 rounded-xl border text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                style={{
                  backgroundColor:
                    catFilter === cat ? 'var(--accent-soft)' : 'var(--bg-surface)',
                  borderColor:
                    catFilter === cat ? 'var(--accent-primary)' : 'var(--border-hairline)',
                  color:
                    catFilter === cat ? 'var(--accent-primary)' : 'var(--text-secondary)',
                }}
              >
                {cat === 'all' ? 'الكل' : cat}
              </button>
            ))}
          </div>

          {filteredBookmarks.length === 0 ? (
            <div
              className="rounded-2xl border py-14 px-4 text-center space-y-2"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-hairline)',
              }}
            >
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                لا توجد فواصل محفوظة بعد
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                اضغط على أي آية أثناء القراءة لإضافتها إلى الفواصل أو تصنيفها للحفظ والمراجعة.
              </p>
            </div>
          ) : (
            <div
              className="rounded-2xl border divide-y overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-hairline)',
              }}
            >
              {filteredBookmarks.map((b) => (
                <div
                  key={b.id}
                  className="p-4 flex items-start justify-between gap-3"
                  style={{ borderColor: 'var(--border-hairline)' }}
                >
                  <button
                    type="button"
                    onClick={() => jumpToPage(b.pageNumber, b.globalAyahNumber)}
                    className="flex-1 text-right cursor-pointer min-w-0"
                  >
                    <p
                      className="text-xs font-semibold tabular-nums mb-1"
                      style={{ color: 'var(--accent-primary)' }}
                    >
                      {b.category} · سورة {b.surahName} · آية {toArabicDigits(b.ayahNumber)} · ص{' '}
                      {toArabicDigits(b.pageNumber)}
                    </p>
                    <p
                      className="font-uthmani text-lg leading-relaxed truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {toQpcSafeText(b.excerpt)}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      toggleBookmark(
                        {
                          number: b.globalAyahNumber,
                          numberInSurah: b.ayahNumber,
                          surahNumber: b.surahNumber,
                          surahName: b.surahName,
                          text: b.excerpt,
                          rawText: b.excerpt,
                          cleanText: b.excerpt,
                          normalizedText: '',
                          page: b.pageNumber,
                          juz: 1,
                          hizbQuarter: 1,
                          sajda: false,
                        },
                        b.category
                      )
                    }
                    aria-label="إزالة الفاصل"
                    className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl cursor-pointer shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div className="space-y-4">
          {notesList.length > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleExportNotes}
                className="min-h-[40px] px-3.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-hairline)',
                  color: 'var(--text-primary)',
                }}
              >
                {copiedNotes ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedNotes ? 'تم نسخ جميع الخواطر' : 'نسخ جميع الملاحظات'}</span>
              </button>
            </div>
          )}

          {notesList.length === 0 ? (
            <div
              className="rounded-2xl border py-14 px-4 text-center space-y-2"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-hairline)',
              }}
            >
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                دفتر التدبر فارغ حالياً
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                اضغط على أي آية واختر «تدبر ووسم» لتدوين تأملاتك وروابط الحفظ الخاصة بك.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notesList.map((n) => (
                <div
                  key={n.globalAyahNumber}
                  className="rounded-2xl border p-4 space-y-2.5"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-hairline)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => jumpToPage(n.pageNumber, n.globalAyahNumber)}
                      className="text-xs font-semibold tabular-nums cursor-pointer"
                      style={{ color: 'var(--accent-primary)' }}
                    >
                      سورة {n.surahName} · آية {toArabicDigits(n.ayahNumber)} · ص{' '}
                      {toArabicDigits(n.pageNumber)}
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteTadabburNote(n.globalAyahNumber)}
                      aria-label="حذف الملاحظة"
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg cursor-pointer"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <p
                    className="font-uthmani text-lg leading-relaxed opacity-85"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {toQpcSafeText(n.ayahExcerpt)}
                  </p>

                  <p
                    className="text-sm leading-relaxed whitespace-pre-line pt-2 border-t"
                    style={{
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {n.note}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
