import { AyahItem, SimilarAyahMatch } from '../types/quran';

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toArabicDigits(num: number | string): string {
  return String(num).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);
}

// Strip all Quranic diacritics, tajweed marks, waqf signs, and normalize letters for accurate Arabic search
export function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .replace(/\uFEFF/g, '')
    // Remove Arabic diacritics, harakat, Quranic annotation signs (0610-061A, 064B-065F, 0670, 06D6-06ED)
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    // Alef wasla & hamza forms -> bare alef
    .replace(/[\u0671\u0622\u0623\u0625\u0672\u0673]/g, 'ا')
    // Taa marbuta -> haa
    .replace(/\u0629/g, 'ه')
    // Alef maksura -> yaa
    .replace(/\u0649/g, 'ي')
    // Waw/Yaa hamza normalization for forgiving search
    .replace(/\u0624/g, 'و')
    .replace(/\u0626/g, 'ي')
    .replace(/[^\u0621-\u064A\s0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripLeadingBasmalah(
  rawText: string,
  surahNumber: number,
  numberInSurah: number
): string {
  const cleaned = rawText.replace(/^\uFEFF/, '').trim();
  if (surahNumber === 1 || surahNumber === 9 || numberInSurah !== 1) {
    return cleaned;
  }
  // Uthmani Basmalah prefix present in AlQuran.cloud surah ayah 1
  const uthmaniPrefix = /^بِسْمِ\s+ٱللَّهِ\s+ٱلرَّحْمَٰنِ\s+ٱلرَّحِيمِ\s*/;
  if (uthmaniPrefix.test(cleaned)) {
    return cleaned.replace(uthmaniPrefix, '').trim();
  }
  const simplePrefix = /^بسم\s+الله\s+الرحمن\s+الرحيم\s*/;
  if (simplePrefix.test(cleaned)) {
    return cleaned.replace(simplePrefix, '').trim();
  }
  return cleaned;
}

// Check if a token is a pure Quranic pause/waqf mark (not a spoken word)
const WAQF_ONLY_REGEX = /^[\u06D6-\u06ED\u06DD\u06DE\u06E9]+$/;

export function splitUthmaniTokens(text: string): { display: string; isWaqf: boolean; normalized: string }[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const isWaqf = WAQF_ONLY_REGEX.test(token);
      return {
        display: token,
        isWaqf,
        normalized: isWaqf ? '' : normalizeArabic(token),
      };
    });
}

// Common Arabic stopwords excluded when computing Mutashabihat similarity
const STOP_WORDS = new Set([
  'من', 'في', 'علي', 'الي', 'عن', 'ان', 'ما', 'لا', 'الا', 'انما', 'هو', 'هم',
  'انتم', 'نحن', 'الذي', 'الذين', 'التي', 'كان', 'كانوا', 'قد', 'لم', 'لن',
  'ولا', 'وما', 'وان', 'بما', 'لهم', 'لكم', 'عليهم', 'فيها', 'منها', 'عند',
  'كل', 'او', 'ثم', 'حتي', 'اذا', 'اذ', 'يا', 'ايها', 'انه', 'انهم', 'به', 'بها',
  'له', 'لها', 'منكم', 'منهم', 'فيكم', 'فيهم', 'عليكم', 'ولقد', 'فان', 'وانا',
]);

export function findSimilarAyahs(
  target: AyahItem,
  corpus: AyahItem[],
  limit = 10
): SimilarAyahMatch[] {
  if (!corpus || corpus.length === 0) return [];

  const targetWords = target.normalizedText
    .split(' ')
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));

  if (targetWords.length < 2) return [];
  const targetSet = new Set(targetWords);

  const matches: SimilarAyahMatch[] = [];

  for (let i = 0; i < corpus.length; i++) {
    const candidate = corpus[i];
    if (candidate.number === target.number) continue;

    const candWords = candidate.normalizedText
      .split(' ')
      .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
    if (candWords.length < 2) continue;

    const candSet = new Set(candWords);
    const shared: string[] = [];
    targetSet.forEach((w) => {
      if (candSet.has(w)) shared.push(w);
    });

    if (shared.length < 2) continue;

    const unionSize = targetSet.size + candSet.size - shared.length;
    const jaccard = shared.length / unionSize;

    // Require meaningful lexical overlap
    if (jaccard >= 0.28 || shared.length >= 4) {
      matches.push({
        ayah: candidate,
        score: Math.round(jaccard * 100),
        sharedWords: shared,
      });
    }
  }

  matches.sort((a, b) => b.score - a.score || b.sharedWords.length - a.sharedWords.length);
  return matches.slice(0, limit);
}

// Parse smart navigation queries like "2:255", "البقرة 255", "ص 50", "صفحة 120"
export function parseQuickJump(
  rawQuery: string,
  surahs: { number: number; name: string; ayahCount: number; startPage: number }[]
): { type: 'ayah'; surahNumber: number; ayahNumber: number } | { type: 'page'; pageNumber: number } | { type: 'surah'; surahNumber: number } | null {
  const q = rawQuery.trim().replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
  if (!q) return null;

  // Format: "2:255" or "2 255"
  const colonMatch = q.match(/^(\d{1,3})\s*[:\-]\s*(\d{1,3})$/);
  if (colonMatch) {
    const s = Number(colonMatch[1]);
    const a = Number(colonMatch[2]);
    const surah = surahs.find((item) => item.number === s);
    if (surah && a >= 1 && a <= surah.ayahCount) {
      return { type: 'ayah', surahNumber: s, ayahNumber: a };
    }
  }

  // Format: "صفحة 50" or "ص 50" or "p 50"
  const pageMatch = q.match(/^(?:صفحة|صفحه|ص|p|page)\s*(\d{1,3})$/i);
  if (pageMatch) {
    const p = Number(pageMatch[1]);
    if (p >= 1 && p <= 604) {
      return { type: 'page', pageNumber: p };
    }
  }

  // Format: "البقرة 255"
  const surahAyahMatch = q.match(/^(.+?)\s+(\d{1,3})$/);
  if (surahAyahMatch) {
    const nameNorm = normalizeArabic(surahAyahMatch[1]).replace(/^سوره\s+/, '');
    const ayahNum = Number(surahAyahMatch[2]);
    const found = surahs.find((s) => normalizeArabic(s.name) === nameNorm || normalizeArabic(s.name).includes(nameNorm));
    if (found && ayahNum >= 1 && ayahNum <= found.ayahCount) {
      return { type: 'ayah', surahNumber: found.number, ayahNumber: ayahNum };
    }
  }

  // Format: exact surah name match
  const normQ = normalizeArabic(q).replace(/^سوره\s+/, '');
  if (normQ.length >= 2) {
    const exactSurah = surahs.find((s) => normalizeArabic(s.name) === normQ);
    if (exactSurah) {
      return { type: 'surah', surahNumber: exactSurah.number };
    }
  }

  return null;
}
