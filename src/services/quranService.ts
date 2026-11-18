import { SURAH_LIST } from '../data/surahMetadata';
import { AyahItem, MushafWord, WordOccurrenceResult } from '../types/quran';
import { normalizeArabic, stripLeadingBasmalah } from '../utils/arabicNormalize';

const API_BASE = 'https://api.alquran.cloud/v1';
const QURAN_COM_API = 'https://api.quran.com/api/v4';
const QCF_V2_FONT_BASE = 'https://verses.quran.foundation/fonts/quran/hafs/v2/woff2';
const WBW_AUDIO_CDN = 'https://audio.qurancdn.com';

const DB_NAME = 'mushaf-tadabbur-db';
const DB_VERSION = 4;
const STORE_CORPUS = 'corpus';
const STORE_TAFSIR = 'tafsir';
const STORE_PAGES_V4 = 'pages_v4';
const CORPUS_KEY = 'quran-uthmani-clean-v3';

interface ApiAyahRaw {
  number: number;
  numberInSurah: number;
  text: string;
  page: number;
  juz: number;
  hizbQuarter: number;
  sajda: boolean | { id: number; recommended: boolean; obligatory: boolean };
  surah?: {
    number: number;
    name: string;
  };
}

interface ApiSurahBlock {
  number: number;
  name: string;
  ayahs: ApiAyahRaw[];
}

interface QuranComWordRaw {
  id: number;
  position: number;
  audio_url: string | null;
  char_type_name: 'word' | 'end' | string;
  text_uthmani: string;
  code_v2?: string;
  line_number: number;
}

interface QuranComVerseRaw {
  id: number;
  verse_number: number;
  verse_key: string;
  hizb_number: number;
  rub_el_hizb_number: number;
  sajdah_number: number | null;
  page_number: number;
  juz_number: number;
  qpc_uthmani_hafs?: string;
  words: QuranComWordRaw[];
}

// In-memory stores
let fullCorpus: AyahItem[] | null = null;
let corpusByPage: Map<number, AyahItem[]> = new Map();
let corpusBySurah: Map<number, AyahItem[]> = new Map();
let corpusByGlobalNumber: Map<number, AyahItem> = new Map();
let corpusPromise: Promise<AyahItem[]> | null = null;

const pageV3Cache = new Map<number, AyahItem[]>();
const loadingPagePromises = new Map<number, Promise<AyahItem[]>>();
const surahCache = new Map<number, AyahItem[]>();
const tafsirCache = new Map<string, Map<number, string>>();
const loadedQcfFonts = new Set<number>();
const loadingQcfPromises = new Map<number, Promise<boolean>>();

// Convert standard Uthmani characters that cause dotted circles in UthmanicHafs1Ver18 into QPC-safe glyphs
export function toQpcSafeText(text: string): string {
  return text
    .replace(/\uFEFF/g, '')
    .replace(/\u0640\u0670/g, '\u0670') // Remove tatweel before dagger alef
    .replace(/\u0652/g, '\u06E1') // Standard sukun -> Quranic sukun (must run BEFORE 06DF/06E0 -> 0652)
    .replace(/[\u06DF\u06E0]/g, '\u0652') // Silent rounded/rectangular zero -> KFGQPC safe silent circle
    .replace(/\s+([\u06D6-\u06DC])/g, '$1'); // Attach pause marks to preceding word to avoid detached symbols
}

// Strip Quranic pause/rub/sajdah symbols for clean UI plain-text lines (SearchView preview)
export function stripQuranicAnnotations(text: string): string {
  return text
    .replace(/[\uFEFF\u06D6-\u06ED\u06DD\u06DE\u06E9]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getQcfFontFamilyName(pageNumber: number): string {
  return `QCF_P${pageNumber}`;
}

export async function ensurePageQcfFontLoaded(pageNumber: number): Promise<boolean> {
  const safePage = Math.max(1, Math.min(604, pageNumber));
  if (loadedQcfFonts.has(safePage)) return true;

  const existing = loadingQcfPromises.get(safePage);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const familyName = getQcfFontFamilyName(safePage);
      const url = `${QCF_V2_FONT_BASE}/p${safePage}.woff2`;
      const face = new FontFace(familyName, `url(${url})`, { display: 'swap' });
      const loaded = await face.load();
      document.fonts.add(loaded);
      loadedQcfFonts.add(safePage);
      return true;
    } catch {
      return false;
    } finally {
      loadingQcfPromises.delete(safePage);
    }
  })();

  loadingQcfPromises.set(safePage, promise);
  return promise;
}

export function isPageQcfFontLoadedSync(pageNumber: number): boolean {
  return loadedQcfFonts.has(pageNumber);
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_CORPUS)) {
          db.createObjectStore(STORE_CORPUS);
        }
        if (!db.objectStoreNames.contains(STORE_TAFSIR)) {
          db.createObjectStore(STORE_TAFSIR);
        }
        if (!db.objectStoreNames.contains(STORE_PAGES_V4)) {
          db.createObjectStore(STORE_PAGES_V4);
        }
        if (db.objectStoreNames.contains('pages_v3')) {
          db.deleteObjectStore('pages_v3');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet<T>(storeName: string, key: string, value: T): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function indexCorpus(items: AyahItem[]): void {
  fullCorpus = items;
  corpusByPage = new Map();
  corpusBySurah = new Map();
  corpusByGlobalNumber = new Map();

  for (const ayah of items) {
    corpusByGlobalNumber.set(ayah.number, ayah);

    const pList = corpusByPage.get(ayah.page);
    if (pList) pList.push(ayah);
    else corpusByPage.set(ayah.page, [ayah]);

    const sList = corpusBySurah.get(ayah.surahNumber);
    if (sList) sList.push(ayah);
    else corpusBySurah.set(ayah.surahNumber, [ayah]);
  }
}

function mapRawAyah(
  raw: ApiAyahRaw,
  surahNumber: number,
  surahName: string,
  cleanTextRaw?: string
): AyahItem {
  const text = toQpcSafeText(stripLeadingBasmalah(raw.text, surahNumber, raw.numberInSurah));
  const cleanStripped = stripQuranicAnnotations(
    cleanTextRaw
      ? stripLeadingBasmalah(cleanTextRaw, surahNumber, raw.numberInSurah)
      : text
  );

  return {
    number: raw.number,
    numberInSurah: raw.numberInSurah,
    surahNumber,
    surahName,
    text,
    rawText: raw.text.replace(/^\uFEFF/, ''),
    cleanText: cleanStripped,
    normalizedText: normalizeArabic(cleanStripped),
    page: raw.page,
    juz: raw.juz,
    hizbQuarter: raw.hizbQuarter,
    sajda: Boolean(raw.sajda),
  };
}

const SAJDAH_WORD_REGEX = /(سجد|اسجد|يسجد|سجدا|ساجدين|خروا)/;

function isWordSajdah(textUthmani: string, isSajdahVerse: boolean): boolean {
  if (!isSajdahVerse) return false;
  const norm = normalizeArabic(textUthmani);
  return SAJDAH_WORD_REGEX.test(norm);
}

function mapQuranComVerse(v: QuranComVerseRaw): AyahItem {
  const [sNumStr] = v.verse_key.split(':');
  const surahNumber = Number(sNumStr);
  const meta = SURAH_LIST.find((m) => m.number === surahNumber);
  const surahName = meta?.name ?? '';
  const isSajdahVerse = v.sajdah_number !== null;

  // Strip trailing ayah number and standalone Rub el-Hizb symbol (۞) so token count matches spoken words
  const qpcTokens = v.qpc_uthmani_hafs
    ? v.qpc_uthmani_hafs
        .replace(/\u00A0\S+$/, '')
        .split(/\s+/)
        .filter((tok) => Boolean(tok) && tok !== '\u06DE')
    : [];

  const nonEndCount = (v.words || []).filter((w) => w.char_type_name !== 'end').length;
  const canUseQpcTokens = qpcTokens.length === nonEndCount;
  const paddedSurah = String(surahNumber).padStart(3, '0');
  const paddedAyah = String(v.verse_number).padStart(3, '0');

  let spokenWordCounter = 0;

  const words: MushafWord[] = (v.words || []).map((w) => {
    const isEnd = w.char_type_name === 'end';
    let qpcCandidate: string | undefined;
    let canonicalAudioUrl: string | null = null;

    if (!isEnd) {
      qpcCandidate = canUseQpcTokens ? qpcTokens[spokenWordCounter] : undefined;
      spokenWordCounter++;
      const paddedWordPos = String(spokenWordCounter).padStart(3, '0');
      canonicalAudioUrl = `wbw/${paddedSurah}_${paddedAyah}_${paddedWordPos}.mp3`;
    }

    const cleanUthmani = w.text_uthmani.replace(/۩/g, '').trim();

    return {
      id: w.id,
      position: w.position,
      textUthmani: cleanUthmani,
      qpcText: qpcCandidate || toQpcSafeText(cleanUthmani),
      codeV2: w.code_v2 || '',
      audioUrl: canonicalAudioUrl,
      charType: isEnd ? 'end' : 'word',
      lineNumber: w.line_number,
      isSajdahWord: !isEnd && isWordSajdah(w.text_uthmani, isSajdahVerse),
    };
  });

  const joinedQpc = v.qpc_uthmani_hafs
    ? v.qpc_uthmani_hafs.replace(/\u00A0[\u0660-\u06690-9]+$/, '').trim()
    : words
        .filter((w) => w.charType === 'word')
        .map((w) => w.qpcText)
        .join(' ');

  const corpusMatch = corpusByGlobalNumber.get(v.id);
  const cleanText = corpusMatch?.cleanText ?? normalizeArabic(joinedQpc);
  const normalizedText = corpusMatch?.normalizedText ?? normalizeArabic(joinedQpc);

  return {
    number: v.id,
    numberInSurah: v.verse_number,
    surahNumber,
    surahName,
    text: joinedQpc,
    rawText: joinedQpc,
    cleanText,
    normalizedText,
    page: v.page_number,
    juz: v.juz_number,
    hizbQuarter: v.rub_el_hizb_number || v.hizb_number * 4,
    sajda: isSajdahVerse,
    words,
  };
}

export async function getCachedCorpusStatus(): Promise<boolean> {
  if (fullCorpus && fullCorpus.length > 0) return true;
  const cached = await idbGet<AyahItem[]>(STORE_CORPUS, CORPUS_KEY);
  if (cached && cached.length === 6236) {
    indexCorpus(cached);
    return true;
  }
  return false;
}

export function getFullCorpusSync(): AyahItem[] | null {
  return fullCorpus;
}

export async function ensureFullCorpusLoaded(): Promise<AyahItem[]> {
  if (fullCorpus && fullCorpus.length > 0) return fullCorpus;
  if (corpusPromise) return corpusPromise;

  corpusPromise = (async () => {
    const cached = await idbGet<AyahItem[]>(STORE_CORPUS, CORPUS_KEY);
    if (cached && cached.length === 6236) {
      indexCorpus(cached);
      return cached;
    }

    const [uthmaniRes, cleanRes] = await Promise.all([
      fetch(`${API_BASE}/quran/quran-uthmani`),
      fetch(`${API_BASE}/quran/quran-simple-clean`),
    ]);

    if (!uthmaniRes.ok) {
      throw new Error('تعذر تحميل بيانات المصحف');
    }

    const uthmaniJson = await uthmaniRes.json();
    const cleanJson = cleanRes.ok ? await cleanRes.json() : null;

    const uthmaniSurahs: ApiSurahBlock[] = uthmaniJson?.data?.surahs ?? [];
    const cleanSurahs: ApiSurahBlock[] = cleanJson?.data?.surahs ?? [];

    const items: AyahItem[] = [];

    for (let sIdx = 0; sIdx < uthmaniSurahs.length; sIdx++) {
      const uSurah = uthmaniSurahs[sIdx];
      const cSurah = cleanSurahs[sIdx];
      const meta = SURAH_LIST.find((m) => m.number === uSurah.number);
      const surahName = meta?.name ?? uSurah.name.replace(/^سُورَةُ\s+/, '');

      for (let aIdx = 0; aIdx < uSurah.ayahs.length; aIdx++) {
        const uAyah = uSurah.ayahs[aIdx];
        const cAyah = cSurah?.ayahs?.[aIdx];
        items.push(mapRawAyah(uAyah, uSurah.number, surahName, cAyah?.text));
      }
    }

    indexCorpus(items);
    await idbSet(STORE_CORPUS, CORPUS_KEY, items);
    return items;
  })().finally(() => {
    corpusPromise = null;
  });

  return corpusPromise;
}

export async function fetchPageAyahs(pageNumber: number): Promise<AyahItem[]> {
  const safePage = Math.max(1, Math.min(604, pageNumber));

  // Kick off QCF v2 font load in parallel immediately
  ensurePageQcfFontLoaded(safePage);
  if (safePage < 604) ensurePageQcfFontLoaded(safePage + 1);
  if (safePage > 1) ensurePageQcfFontLoaded(safePage - 1);

  const memCached = pageV3Cache.get(safePage);
  if (memCached && memCached.length > 0) return memCached;

  const inflight = loadingPagePromises.get(safePage);
  if (inflight) return inflight;

  const promise = (async (): Promise<AyahItem[]> => {
    const idbCached = await idbGet<AyahItem[]>(STORE_PAGES_V4, `page-${safePage}`);
    if (idbCached && idbCached.length > 0 && idbCached[0]?.words?.[0]?.codeV2) {
      pageV3Cache.set(safePage, idbCached);
      return idbCached;
    }

    try {
      const res = await fetch(
        `${QURAN_COM_API}/verses/by_page/${safePage}?words=true&fields=qpc_uthmani_hafs&word_fields=text_uthmani,code_v2&per_page=50`
      );
      if (res.ok) {
        const json = await res.json();
        const verses: QuranComVerseRaw[] = json?.verses ?? [];
        if (verses.length > 0) {
          const mapped = verses.map(mapQuranComVerse);
          pageV3Cache.set(safePage, mapped);
          idbSet(STORE_PAGES_V4, `page-${safePage}`, mapped);
          return mapped;
        }
      }
    } catch {
      // Fallback below
    }

    if (fullCorpus) {
      const list = corpusByPage.get(safePage);
      if (list && list.length > 0) return list;
    }

    const [uthmaniRes, cleanRes] = await Promise.all([
      fetch(`${API_BASE}/page/${safePage}/quran-uthmani`),
      fetch(`${API_BASE}/page/${safePage}/quran-simple-clean`),
    ]);

    if (!uthmaniRes.ok) {
      throw new Error(`تعذر تحميل الصفحة ${safePage}`);
    }

    const uthmaniData = await uthmaniRes.json();
    const cleanData = cleanRes.ok ? await cleanRes.json() : null;
    const rawAyahs: ApiAyahRaw[] = uthmaniData?.data?.ayahs ?? [];
    const cleanAyahs: ApiAyahRaw[] = cleanData?.data?.ayahs ?? [];

    const mapped = rawAyahs.map((raw, idx) => {
      const sNum = raw.surah?.number ?? 1;
      const meta = SURAH_LIST.find((m) => m.number === sNum);
      const sName = meta?.name ?? raw.surah?.name ?? '';
      return mapRawAyah(raw, sNum, sName, cleanAyahs[idx]?.text);
    });

    pageV3Cache.set(safePage, mapped);
    return mapped;
  })().finally(() => {
    loadingPagePromises.delete(safePage);
  });

  loadingPagePromises.set(safePage, promise);
  return promise;
}

export async function fetchSurahAyahs(surahNumber: number): Promise<AyahItem[]> {
  const safeSurah = Math.max(1, Math.min(114, surahNumber));

  if (fullCorpus) {
    const list = corpusBySurah.get(safeSurah);
    if (list && list.length > 0) return list;
  }

  const memCached = surahCache.get(safeSurah);
  if (memCached) return memCached;

  const [uthmaniRes, cleanRes] = await Promise.all([
    fetch(`${API_BASE}/surah/${safeSurah}/quran-uthmani`),
    fetch(`${API_BASE}/surah/${safeSurah}/quran-simple-clean`),
  ]);

  if (!uthmaniRes.ok) {
    throw new Error(`تعذر تحميل السورة ${safeSurah}`);
  }

  const uthmaniData = await uthmaniRes.json();
  const cleanData = cleanRes.ok ? await cleanRes.json() : null;
  const rawAyahs: ApiAyahRaw[] = uthmaniData?.data?.ayahs ?? [];
  const cleanAyahs: ApiAyahRaw[] = cleanData?.data?.ayahs ?? [];
  const meta = SURAH_LIST.find((m) => m.number === safeSurah);
  const sName = meta?.name ?? uthmaniData?.data?.name ?? '';

  const mapped = rawAyahs.map((raw, idx) =>
    mapRawAyah(raw, safeSurah, sName, cleanAyahs[idx]?.text)
  );

  surahCache.set(safeSurah, mapped);
  return mapped;
}

export async function fetchAyahWords(surahNumber: number, numberInSurah: number): Promise<MushafWord[]> {
  try {
    const res = await fetch(
      `${QURAN_COM_API}/verses/by_key/${surahNumber}:${numberInSurah}?words=true&fields=qpc_uthmani_hafs&word_fields=text_uthmani,code_v2`
    );
    if (!res.ok) return [];
    const json = await res.json();
    const verse: QuranComVerseRaw | undefined = json?.verse;
    if (!verse) return [];
    return mapQuranComVerse(verse).words ?? [];
  } catch {
    return [];
  }
}

export async function fetchAyahTafsir(
  surahNumber: number,
  numberInSurah: number,
  editionId: string
): Promise<string> {
  const cacheKey = `${editionId}:${surahNumber}`;
  let surahMap = tafsirCache.get(cacheKey);

  if (!surahMap) {
    const idbData = await idbGet<[number, string][]>(STORE_TAFSIR, cacheKey);
    if (idbData && idbData.length > 0) {
      surahMap = new Map(idbData);
      tafsirCache.set(cacheKey, surahMap);
    }
  }

  if (!surahMap) {
    const res = await fetch(`${API_BASE}/surah/${surahNumber}/${editionId}`);
    if (!res.ok) {
      throw new Error('تعذر تحميل التفسير');
    }
    const json = await res.json();
    const ayahs: { numberInSurah: number; text: string }[] = json?.data?.ayahs ?? [];
    surahMap = new Map();
    for (const a of ayahs) {
      surahMap.set(a.numberInSurah, a.text);
    }
    tafsirCache.set(cacheKey, surahMap);
    await idbSet(STORE_TAFSIR, cacheKey, Array.from(surahMap.entries()));
  }

  return surahMap.get(numberInSurah) ?? 'التفسير غير متوفر لهذه الآية في هذا المصدر.';
}

export async function searchQuranWords(
  query: string,
  options?: { surahFilter?: number; juzFilter?: number; limit?: number }
): Promise<{ total: number; results: AyahItem[] }> {
  const normQuery = normalizeArabic(query);
  if (!normQuery || normQuery.length < 2) {
    return { total: 0, results: [] };
  }

  const corpus = await ensureFullCorpusLoaded();
  const limit = options?.limit ?? 120;
  const matched: AyahItem[] = [];
  let total = 0;

  for (let i = 0; i < corpus.length; i++) {
    const ayah = corpus[i];
    if (options?.surahFilter && ayah.surahNumber !== options.surahFilter) continue;
    if (options?.juzFilter && ayah.juz !== options.juzFilter) continue;

    if (ayah.normalizedText.includes(normQuery)) {
      total++;
      if (matched.length < limit) {
        matched.push(ayah);
      }
    }
  }

  return { total, results: matched };
}

export async function exploreWordOccurrences(
  displayWord: string,
  normalizedWord: string
): Promise<WordOccurrenceResult> {
  const corpus = await ensureFullCorpusLoaded();
  const cleanNorm = normalizeArabic(normalizedWord || displayWord);
  const ayahs: AyahItem[] = [];
  const surahSet = new Set<number>();

  if (!cleanNorm) {
    return {
      queryWord: displayWord,
      normalizedWord: cleanNorm,
      totalMatches: 0,
      surahSpread: 0,
      ayahs: [],
    };
  }

  for (let i = 0; i < corpus.length; i++) {
    const ayah = corpus[i];
    const words = ayah.normalizedText.split(' ');
    if (words.includes(cleanNorm)) {
      ayahs.push(ayah);
      surahSet.add(ayah.surahNumber);
    }
  }

  return {
    queryWord: displayWord,
    normalizedWord: cleanNorm,
    totalMatches: ayahs.length,
    surahSpread: surahSet.size,
    ayahs,
  };
}

export function getAyahByGlobalNumberSync(globalNumber: number): AyahItem | undefined {
  return corpusByGlobalNumber.get(globalNumber);
}

const EVERYAYAH_FOLDERS: Record<string, string> = {
  'ar.yasseraldossari': 'Yasser_Ad-Dussary_128kbps',
  'ar.alafasy': 'Alafasy_128kbps',
  'ar.husary': 'Husary_128kbps',
  'ar.minshawi': 'Minshawy_Murattal_128kbps',
  'ar.abdulbasitmurattal': 'Abdul_Basit_Murattal_192kbps',
  'ar.mahermuaiqly': 'MaherAlMuaiqly128kbps',
  'ar.abdurrahmaansudais': 'Abdurrahmaan_As-Sudais_192kbps',
};

const SURAH_AUDIO_BASES: Record<string, string> = {
  'ar.yasseraldossari': 'https://server11.mp3quran.net/yasser',
  'ar.alafasy': 'https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy',
  'ar.husary': 'https://server13.mp3quran.net/husr',
  'ar.minshawi': 'https://server10.mp3quran.net/minsh',
  'ar.abdulbasitmurattal': 'https://server7.mp3quran.net/basit',
  'ar.mahermuaiqly': 'https://server12.mp3quran.net/maher',
  'ar.abdurrahmaansudais': 'https://server11.mp3quran.net/sds',
};

export function getAyahAudioUrl(
  reciterId: string,
  globalAyahNumber: number,
  surahNumber?: number,
  ayahInSurah?: number
): string {
  const folder = EVERYAYAH_FOLDERS[reciterId];
  if (folder && surahNumber && ayahInSurah) {
    const s = String(surahNumber).padStart(3, '0');
    const a = String(ayahInSurah).padStart(3, '0');
    return `https://everyayah.com/data/${folder}/${s}${a}.mp3`;
  }
  return `https://cdn.islamic.network/quran/audio/128/${reciterId}/${globalAyahNumber}.mp3`;
}

export function getSurahAudioUrl(reciterId: string, surahNumber: number): string {
  const base = SURAH_AUDIO_BASES[reciterId];
  if (base) {
    if (base.includes('cdn.islamic.network')) {
      return `${base}/${surahNumber}.mp3`;
    }
    const s = String(surahNumber).padStart(3, '0');
    return `${base}/${s}.mp3`;
  }
  return `https://cdn.islamic.network/quran/audio-surah/128/${reciterId}/${surahNumber}.mp3`;
}

export function getWordAudioUrl(relativeOrFullUrl: string): string {
  if (relativeOrFullUrl.startsWith('http')) return relativeOrFullUrl;
  const cleaned = relativeOrFullUrl.replace(/^\/+/, '');
  return `${WBW_AUDIO_CDN}/${cleaned}`;
}
