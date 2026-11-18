export type MushafTheme = 'parchment' | 'day' | 'night';
export type ReaderViewMode = 'mushaf' | 'study';
export type HifzTestMode = 'off' | 'blur-all' | 'first-word';
export type AppTab = 'reader' | 'index' | 'search' | 'hifz' | 'bookmarks';
export type BookmarkCategory = 'تلاوة' | 'حفظ' | 'تدبر' | 'مراجعة';

export interface SurahMeta {
  number: number;
  name: string;
  fullName: string;
  englishName: string;
  ayahCount: number;
  revelationType: 'مكية' | 'مدنية';
  startPage: number;
  juz: number;
}

export interface JuzMeta {
  number: number;
  name: string;
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  startPage: number;
}

export interface MushafWord {
  id: number;
  position: number;
  textUthmani: string;
  qpcText: string; // KFGQPC UthmanicHafs1Ver18 compatible text (no dotted circles)
  codeV2: string; // Authentic page-exact QCF v2 glyph sequence
  audioUrl: string | null;
  charType: 'word' | 'end';
  lineNumber: number;
  isSajdahWord: boolean;
}

export interface AyahItem {
  number: number; // Global 1..6236
  numberInSurah: number;
  surahNumber: number;
  surahName: string;
  text: string; // Clean Uthmani text (KFGQPC compatible)
  rawText: string;
  cleanText: string; // Simple clean text for search
  normalizedText: string; // Stripped diacritics for instant matching
  page: number;
  juz: number;
  hizbQuarter: number;
  sajda: boolean;
  words?: MushafWord[];
}

export interface ReciterOption {
  id: string;
  name: string;
  style: string;
  supportsSurahStream: boolean;
}

export interface TafsirEdition {
  id: string;
  name: string;
  shortName: string;
  author: string;
}

export interface ReadingPosition {
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  globalAyahNumber: number;
  pageNumber: number;
  updatedAt: number;
}

export interface BookmarkItem {
  id: string;
  globalAyahNumber: number;
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  pageNumber: number;
  excerpt: string;
  category: BookmarkCategory;
  createdAt: number;
}

export interface TadabburNote {
  globalAyahNumber: number;
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  pageNumber: number;
  ayahExcerpt: string;
  note: string;
  updatedAt: number;
}

export interface KhatmahState {
  dailyPagesTarget: number;
  completedPages: number[];
  streakDays: number;
  lastReadDate: string;
  todayPagesRead: number;
}

export interface ReaderSettings {
  theme: MushafTheme;
  fontScale: number; // 0.85 .. 1.35 multiplier on Mushaf page
  lineHeight: number;
  viewMode: ReaderViewMode;
  reciterId: string;
  tafsirId: string;
  hifzMode: HifzTestMode;
  playbackSpeed: number;
  repeatAyahCount: number;
  echoPauseSeconds: number;
}

export interface SimilarAyahMatch {
  ayah: AyahItem;
  score: number;
  sharedWords: string[];
}

export interface WordOccurrenceResult {
  queryWord: string;
  normalizedWord: string;
  totalMatches: number;
  surahSpread: number;
  ayahs: AyahItem[];
}
