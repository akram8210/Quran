import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { SURAH_LIST } from '../data/surahMetadata';
import {
  ensureFullCorpusLoaded,
  fetchSurahAyahs,
  getAyahAudioUrl,
  getCachedCorpusStatus,
  getSurahAudioUrl,
  getWordAudioUrl,
} from '../services/quranService';
import {
  AppTab,
  AyahItem,
  BookmarkCategory,
  BookmarkItem,
  KhatmahState,
  MushafWord,
  ReaderSettings,
  ReadingPosition,
  TadabburNote,
} from '../types/quran';

const STORAGE_KEYS = {
  LAST_POS: 'mushaf_last_position_v1',
  BOOKMARKS: 'mushaf_bookmarks_v1',
  NOTES: 'mushaf_tadabbur_notes_v1',
  KHATMAH: 'mushaf_khatmah_v1',
  SETTINGS: 'mushaf_settings_v2',
};

const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'parchment',
  fontScale: 1,
  lineHeight: 1.95,
  viewMode: 'mushaf',
  reciterId: 'ar.alafasy',
  tafsirId: 'ar.muyassar',
  hifzMode: 'off',
  playbackSpeed: 1,
  repeatAyahCount: 1,
  echoPauseSeconds: 0,
};

const DEFAULT_POSITION: ReadingPosition = {
  surahNumber: 1,
  surahName: 'الفاتحة',
  ayahNumber: 1,
  globalAyahNumber: 1,
  pageNumber: 1,
  updatedAt: Date.now(),
};

const DEFAULT_KHATMAH: KhatmahState = {
  dailyPagesTarget: 4,
  completedPages: [],
  streakDays: 1,
  lastReadDate: new Date().toISOString().slice(0, 10),
  todayPagesRead: 0,
};

export interface AudioState {
  isPlaying: boolean;
  isLoading: boolean;
  mode: 'ayah' | 'surah';
  currentAyah: AyahItem | null;
  currentSurahNumber: number | null;
  currentRepeatIteration: number;
  rangeStartAyah: number | null; // numberInSurah
  rangeEndAyah: number | null;   // numberInSurah
  duration: number;
  currentTime: number;
  error: string | null;
}

export interface PronouncingWordState {
  word: MushafWord;
  ayah: AyahItem;
  isPlaying: boolean;
  speed: number;
  error: string | null;
}

interface MushafContextValue {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  currentPage: number;
  currentSurah: number;
  highlightedAyahGlobal: number | null;
  lastPosition: ReadingPosition;
  bookmarks: BookmarkItem[];
  notes: Record<number, TadabburNote>;
  khatmah: KhatmahState;
  settings: ReaderSettings;
  corpusReady: boolean;
  corpusLoading: boolean;
  selectedAyahForSheet: AyahItem | null;
  selectedWordForSheet: MushafWord | null;
  setSelectedAyahForSheet: (ayah: AyahItem | null) => void;
  openWordSheet: (ayah: AyahItem, word: MushafWord | null) => void;
  audioState: AudioState;
  pronouncingWord: PronouncingWordState | null;
  pronounceWord: (word: MushafWord, ayah: AyahItem, speed?: number) => Promise<void>;
  dismissPronouncingWord: () => void;
  updateSettings: (patch: Partial<ReaderSettings>) => void;
  jumpToPage: (pageNumber: number, highlightGlobalAyah?: number) => void;
  jumpToSurah: (surahNumber: number, ayahNumber?: number) => Promise<void>;
  jumpToAyah: (ayah: AyahItem) => void;
  saveReadingPosition: (pos: Omit<ReadingPosition, 'updatedAt'>) => void;
  toggleBookmark: (ayah: AyahItem, category?: BookmarkCategory) => void;
  isBookmarked: (globalAyahNumber: number) => BookmarkItem | undefined;
  saveTadabburNote: (ayah: AyahItem, noteText: string) => void;
  deleteTadabburNote: (globalAyahNumber: number) => void;
  togglePageCompleted: (pageNumber: number) => void;
  setDailyKhatmahTarget: (pages: number) => void;
  playAyah: (ayah: AyahItem, options?: { rangeStart?: number; rangeEnd?: number }) => void;
  playSurahStream: (surahNumber: number) => void;
  togglePlayPause: () => void;
  stopAudio: () => void;
  seekAudio: (seconds: number) => void;
  playNextAyah: () => void;
  playPrevAyah: () => void;
  setRangeLoop: (start: number | null, end: number | null) => void;
  downloadFullCorpus: () => Promise<void>;
}

const MushafContext = createContext<MushafContextValue | null>(null);

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function loadArrayJson<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export const MushafProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<ReaderSettings>(() =>
    loadJson(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS)
  );
  const [lastPosition, setLastPosition] = useState<ReadingPosition>(() =>
    loadJson(STORAGE_KEYS.LAST_POS, DEFAULT_POSITION)
  );
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() =>
    loadArrayJson(STORAGE_KEYS.BOOKMARKS, [])
  );
  const [notes, setNotes] = useState<Record<number, TadabburNote>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.NOTES);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [khatmah, setKhatmah] = useState<KhatmahState>(() =>
    loadJson(STORAGE_KEYS.KHATMAH, DEFAULT_KHATMAH)
  );

  const [activeTab, setActiveTab] = useState<AppTab>('reader');
  const [currentPage, setCurrentPage] = useState<number>(lastPosition.pageNumber || 1);
  const [currentSurah, setCurrentSurah] = useState<number>(lastPosition.surahNumber || 1);
  const [highlightedAyahGlobal, setHighlightedAyahGlobal] = useState<number | null>(null);
  const [selectedAyahForSheet, setSelectedAyahForSheetState] = useState<AyahItem | null>(null);
  const [selectedWordForSheet, setSelectedWordForSheet] = useState<MushafWord | null>(null);

  const setSelectedAyahForSheet = useCallback((ayah: AyahItem | null) => {
    setSelectedAyahForSheetState(ayah);
    if (!ayah) setSelectedWordForSheet(null);
  }, []);

  const openWordSheet = useCallback((ayah: AyahItem, word: MushafWord | null) => {
    setSelectedWordForSheet(word);
    setSelectedAyahForSheetState(ayah);
  }, []);

  const [corpusReady, setCorpusReady] = useState(false);
  const [corpusLoading, setCorpusLoading] = useState(false);

  // Word pronunciation player
  const [pronouncingWord, setPronouncingWord] = useState<PronouncingWordState | null>(null);
  const wordAudioRef = useRef<HTMLAudioElement | null>(null);

  // Audio player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pauseTimerRef = useRef<number | null>(null);
  const surahQueueRef = useRef<AyahItem[]>([]);

  const [audioState, setAudioState] = useState<AudioState>({
    isPlaying: false,
    isLoading: false,
    mode: 'ayah',
    currentAyah: null,
    currentSurahNumber: null,
    currentRepeatIteration: 1,
    rangeStartAyah: null,
    rangeEndAyah: null,
    duration: 0,
    currentTime: 0,
    error: null,
  });

  const audioStateRef = useRef(audioState);
  audioStateRef.current = audioState;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Apply theme to <html>
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('data-theme', settings.theme);
    if (settings.theme === 'night') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  // Persist user data
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LAST_POS, JSON.stringify(lastPosition));
  }, [lastPosition]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.KHATMAH, JSON.stringify(khatmah));
  }, [khatmah]);

  // Background check & warm full Quran corpus
  const downloadFullCorpus = useCallback(async () => {
    if (corpusLoading) return;
    setCorpusLoading(true);
    try {
      await ensureFullCorpusLoaded();
      setCorpusReady(true);
    } catch {
      // Non-fatal: page-by-page mode still works
    } finally {
      setCorpusLoading(false);
    }
  }, [corpusLoading]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const cached = await getCachedCorpusStatus();
      if (!mounted) return;
      if (cached) {
        setCorpusReady(true);
      } else {
        // Warm full corpus quietly in background after initial page paint
        setTimeout(() => {
          if (mounted) downloadFullCorpus();
        }, 700);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<ReaderSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const saveReadingPosition = useCallback((pos: Omit<ReadingPosition, 'updatedAt'>) => {
    const today = new Date().toISOString().slice(0, 10);
    setLastPosition({ ...pos, updatedAt: Date.now() });
    setKhatmah((prev) => {
      const alreadyCompleted = prev.completedPages.includes(pos.pageNumber);
      const isNewDay = prev.lastReadDate !== today;
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const nextStreak = isNewDay
        ? prev.lastReadDate === yesterday
          ? prev.streakDays + 1
          : 1
        : prev.streakDays;

      return {
        ...prev,
        lastReadDate: today,
        streakDays: nextStreak,
        todayPagesRead: isNewDay ? 1 : alreadyCompleted ? prev.todayPagesRead : prev.todayPagesRead + 1,
        completedPages: alreadyCompleted
          ? prev.completedPages
          : [...prev.completedPages, pos.pageNumber],
      };
    });
  }, []);

  const jumpToPage = useCallback(
    (pageNumber: number, highlightGlobalAyah?: number) => {
      const clamped = Math.max(1, Math.min(604, pageNumber));
      setCurrentPage(clamped);
      setActiveTab('reader');
      if (highlightGlobalAyah) {
        setHighlightedAyahGlobal(highlightGlobalAyah);
        setTimeout(() => setHighlightedAyahGlobal(null), 4000);
      }
    },
    []
  );

  const jumpToSurah = useCallback(async (surahNumber: number, ayahNumber = 1) => {
    const meta = SURAH_LIST.find((s) => s.number === surahNumber);
    setCurrentSurah(surahNumber);
    setActiveTab('reader');

    if (ayahNumber === 1 && meta) {
      setCurrentPage(meta.startPage);
      return;
    }

    try {
      const ayahs = await fetchSurahAyahs(surahNumber);
      const target = ayahs.find((a) => a.numberInSurah === ayahNumber) ?? ayahs[0];
      if (target) {
        setCurrentPage(target.page);
        setHighlightedAyahGlobal(target.number);
        setTimeout(() => setHighlightedAyahGlobal(null), 4000);
      }
    } catch {
      if (meta) setCurrentPage(meta.startPage);
    }
  }, []);

  const jumpToAyah = useCallback((ayah: AyahItem) => {
    setCurrentSurah(ayah.surahNumber);
    setCurrentPage(ayah.page);
    setActiveTab('reader');
    setHighlightedAyahGlobal(ayah.number);
    saveReadingPosition({
      surahNumber: ayah.surahNumber,
      surahName: ayah.surahName,
      ayahNumber: ayah.numberInSurah,
      globalAyahNumber: ayah.number,
      pageNumber: ayah.page,
    });
    setTimeout(() => setHighlightedAyahGlobal(null), 4000);
  }, [saveReadingPosition]);

  const toggleBookmark = useCallback((ayah: AyahItem, category: BookmarkCategory = 'تلاوة') => {
    setBookmarks((prev) => {
      const existing = prev.find((b) => b.globalAyahNumber === ayah.number);
      if (existing) {
        if (existing.category === category) {
          return prev.filter((b) => b.globalAyahNumber !== ayah.number);
        }
        return prev.map((b) =>
          b.globalAyahNumber === ayah.number ? { ...b, category } : b
        );
      }
      const next: BookmarkItem = {
        id: `${ayah.number}-${Date.now()}`,
        globalAyahNumber: ayah.number,
        surahNumber: ayah.surahNumber,
        surahName: ayah.surahName,
        ayahNumber: ayah.numberInSurah,
        pageNumber: ayah.page,
        excerpt: ayah.text.slice(0, 95),
        category,
        createdAt: Date.now(),
      };
      return [next, ...prev];
    });
  }, []);

  const isBookmarked = useCallback(
    (globalAyahNumber: number) => bookmarks.find((b) => b.globalAyahNumber === globalAyahNumber),
    [bookmarks]
  );

  const saveTadabburNote = useCallback((ayah: AyahItem, noteText: string) => {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    setNotes((prev) => ({
      ...prev,
      [ayah.number]: {
        globalAyahNumber: ayah.number,
        surahNumber: ayah.surahNumber,
        surahName: ayah.surahName,
        ayahNumber: ayah.numberInSurah,
        pageNumber: ayah.page,
        ayahExcerpt: ayah.text.slice(0, 100),
        note: trimmed,
        updatedAt: Date.now(),
      },
    }));
  }, []);

  const deleteTadabburNote = useCallback((globalAyahNumber: number) => {
    setNotes((prev) => {
      const copy = { ...prev };
      delete copy[globalAyahNumber];
      return copy;
    });
  }, []);

  const togglePageCompleted = useCallback((pageNumber: number) => {
    setKhatmah((prev) => {
      const exists = prev.completedPages.includes(pageNumber);
      return {
        ...prev,
        completedPages: exists
          ? prev.completedPages.filter((p) => p !== pageNumber)
          : [...prev.completedPages, pageNumber],
      };
    });
  }, []);

  const setDailyKhatmahTarget = useCallback((pages: number) => {
    setKhatmah((prev) => ({ ...prev, dailyPagesTarget: pages }));
  }, []);

  // Audio playback engine
  const clearPauseTimer = () => {
    if (pauseTimerRef.current !== null) {
      window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  };

  const loadAndPlayAyahInternal = useCallback(
    async (ayah: AyahItem, iteration = 1) => {
      clearPauseTimer();
      if (wordAudioRef.current) {
        wordAudioRef.current.pause();
      }
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      const audio = audioRef.current;

      setAudioState((prev) => ({
        ...prev,
        mode: 'ayah',
        isLoading: true,
        isPlaying: false,
        currentAyah: ayah,
        currentSurahNumber: ayah.surahNumber,
        currentRepeatIteration: iteration,
        error: null,
      }));

      // Keep reader synced to active reciting page/surah when in reader tab
      setCurrentPage(ayah.page);
      setCurrentSurah(ayah.surahNumber);

      // Start playback IMMEDIATELY inside user gesture before any background fetch
      const url = getAyahAudioUrl(
        settingsRef.current.reciterId,
        ayah.number,
        ayah.surahNumber,
        ayah.numberInSurah
      );
      audio.src = url;
      audio.playbackRate = settingsRef.current.playbackSpeed;

      // Prefetch surah queue in background without blocking mobile autoplay gesture
      if (
        surahQueueRef.current.length === 0 ||
        surahQueueRef.current[0]?.surahNumber !== ayah.surahNumber
      ) {
        fetchSurahAyahs(ayah.surahNumber)
          .then((list) => {
            surahQueueRef.current = list;
          })
          .catch(() => {
            // ignore
          });
      }

      try {
        await audio.play();
        setAudioState((prev) => ({ ...prev, isPlaying: true, isLoading: false }));
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setAudioState((prev) => ({
          ...prev,
          isPlaying: false,
          isLoading: false,
          error: 'تعذر تشغيل التلاوة، تأكد من الاتصال بالإنترنت',
        }));
      }
    },
    []
  );

  // Sync playbackSpeed & reciter changes mid-session
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = settings.playbackSpeed;
    }
  }, [settings.playbackSpeed]);

  // Attach audio element listeners once
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      setAudioState((prev) => ({
        ...prev,
        currentTime: audio.currentTime || 0,
        duration: audio.duration || 0,
      }));
    };

    const handleEnded = async () => {
      const state = audioStateRef.current;
      const curSettings = settingsRef.current;

      if (state.mode === 'surah') {
        setAudioState((prev) => ({ ...prev, isPlaying: false, currentTime: 0 }));
        return;
      }

      const currentAyah = state.currentAyah;
      if (!currentAyah) return;

      const scheduleNext = (fn: () => void) => {
        const delayMs = (curSettings.echoPauseSeconds || 0) * 1000;
        if (delayMs > 0) {
          setAudioState((prev) => ({ ...prev, isPlaying: false }));
          pauseTimerRef.current = window.setTimeout(fn, delayMs);
        } else {
          fn();
        }
      };

      // Check ayah repeat count (0 = infinite loop)
      if (
        curSettings.repeatAyahCount === 0 ||
        state.currentRepeatIteration < curSettings.repeatAyahCount
      ) {
        scheduleNext(() => {
          loadAndPlayAyahInternal(currentAyah, state.currentRepeatIteration + 1);
        });
        return;
      }

      // Advance to next ayah in surah or loop range
      let queue = surahQueueRef.current;
      if (queue.length === 0 || queue[0]?.surahNumber !== currentAyah.surahNumber) {
        try {
          queue = await fetchSurahAyahs(currentAyah.surahNumber);
          surahQueueRef.current = queue;
        } catch {
          setAudioState((prev) => ({ ...prev, isPlaying: false }));
          return;
        }
      }

      const { rangeStartAyah, rangeEndAyah } = state;
      if (rangeStartAyah !== null && rangeEndAyah !== null) {
        const nextInRange = currentAyah.numberInSurah + 1;
        if (nextInRange <= rangeEndAyah) {
          const nextObj = queue.find((a) => a.numberInSurah === nextInRange);
          if (nextObj) {
            scheduleNext(() => loadAndPlayAyahInternal(nextObj, 1));
            return;
          }
        } else {
          // Loop back to rangeStartAyah
          const startObj = queue.find((a) => a.numberInSurah === rangeStartAyah);
          if (startObj) {
            scheduleNext(() => loadAndPlayAyahInternal(startObj, 1));
            return;
          }
        }
      }

      // Normal sequential play within Surah, then advance to next Surah
      const nextAyah = queue.find((a) => a.numberInSurah === currentAyah.numberInSurah + 1);
      if (nextAyah) {
        scheduleNext(() => loadAndPlayAyahInternal(nextAyah, 1));
      } else if (currentAyah.surahNumber < 114) {
        try {
          const nextSurahQueue = await fetchSurahAyahs(currentAyah.surahNumber + 1);
          surahQueueRef.current = nextSurahQueue;
          if (nextSurahQueue[0]) {
            scheduleNext(() => loadAndPlayAyahInternal(nextSurahQueue[0], 1));
          }
        } catch {
          setAudioState((prev) => ({ ...prev, isPlaying: false }));
        }
      } else {
        setAudioState((prev) => ({ ...prev, isPlaying: false }));
      }
    };

    const handleError = () => {
      setAudioState((prev) => ({
        ...prev,
        isPlaying: false,
        isLoading: false,
        error: 'تعذر تحميل الملف الصوتي',
      }));
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [loadAndPlayAyahInternal]);

  const playAyah = useCallback(
    (ayah: AyahItem, options?: { rangeStart?: number; rangeEnd?: number }) => {
      if (options?.rangeStart !== undefined || options?.rangeEnd !== undefined) {
        setAudioState((prev) => ({
          ...prev,
          rangeStartAyah: options.rangeStart ?? null,
          rangeEndAyah: options.rangeEnd ?? null,
        }));
      }
      loadAndPlayAyahInternal(ayah, 1);
    },
    [loadAndPlayAyahInternal]
  );

  const playSurahStream = useCallback(async (surahNumber: number) => {
    clearPauseTimer();
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;

    setAudioState((prev) => ({
      ...prev,
      mode: 'surah',
      isLoading: true,
      isPlaying: false,
      currentAyah: null,
      currentSurahNumber: surahNumber,
      rangeStartAyah: null,
      rangeEndAyah: null,
      error: null,
    }));

    const url = getSurahAudioUrl(settingsRef.current.reciterId, surahNumber);
    audio.src = url;
    audio.playbackRate = settingsRef.current.playbackSpeed;

    try {
      await audio.play();
      setAudioState((prev) => ({ ...prev, isPlaying: true, isLoading: false }));
    } catch {
      setAudioState((prev) => ({
        ...prev,
        isPlaying: false,
        isLoading: false,
        error: 'تعذر تشغيل السورة، يرجى المحاولة مجدداً',
      }));
    }
  }, []);

  const togglePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    clearPauseTimer();

    if (audioStateRef.current.isPlaying) {
      audio.pause();
      setAudioState((prev) => ({ ...prev, isPlaying: false }));
    } else if (audio.src) {
      try {
        await audio.play();
        setAudioState((prev) => ({ ...prev, isPlaying: true, error: null }));
      } catch {
        setAudioState((prev) => ({ ...prev, isPlaying: false }));
      }
    }
  }, []);

  const stopAudio = useCallback(() => {
    clearPauseTimer();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setAudioState({
      isPlaying: false,
      isLoading: false,
      mode: 'ayah',
      currentAyah: null,
      currentSurahNumber: null,
      currentRepeatIteration: 1,
      rangeStartAyah: null,
      rangeEndAyah: null,
      duration: 0,
      currentTime: 0,
      error: null,
    });
  }, []);

  const seekAudio = useCallback((seconds: number) => {
    if (audioRef.current && !Number.isNaN(seconds)) {
      audioRef.current.currentTime = seconds;
    }
  }, []);

  const playNextAyah = useCallback(async () => {
    const cur = audioStateRef.current.currentAyah;
    if (!cur) return;
    const queue = await fetchSurahAyahs(cur.surahNumber);
    const next = queue.find((a) => a.numberInSurah === cur.numberInSurah + 1);
    if (next) {
      loadAndPlayAyahInternal(next, 1);
    } else if (cur.surahNumber < 114) {
      const nextQueue = await fetchSurahAyahs(cur.surahNumber + 1);
      if (nextQueue[0]) loadAndPlayAyahInternal(nextQueue[0], 1);
    }
  }, [loadAndPlayAyahInternal]);

  const playPrevAyah = useCallback(async () => {
    const cur = audioStateRef.current.currentAyah;
    if (!cur) return;
    const queue = await fetchSurahAyahs(cur.surahNumber);
    const prev = queue.find((a) => a.numberInSurah === cur.numberInSurah - 1);
    if (prev) {
      loadAndPlayAyahInternal(prev, 1);
    } else if (cur.surahNumber > 1) {
      const prevQueue = await fetchSurahAyahs(cur.surahNumber - 1);
      if (prevQueue.length > 0) loadAndPlayAyahInternal(prevQueue[prevQueue.length - 1], 1);
    }
  }, [loadAndPlayAyahInternal]);

  const setRangeLoop = useCallback((start: number | null, end: number | null) => {
    setAudioState((prev) => ({
      ...prev,
      rangeStartAyah: start,
      rangeEndAyah: end,
    }));
  }, []);

  const dismissPronouncingWord = useCallback(() => {
    if (wordAudioRef.current) {
      wordAudioRef.current.pause();
    }
    setPronouncingWord(null);
  }, []);

  const pronounceWord = useCallback(
    async (word: MushafWord, ayah: AyahItem, speed = 1) => {
      if (!word.audioUrl) return;
      // Pause verse audio if active so word pronunciation is crystal clear
      if (audioRef.current && audioStateRef.current.isPlaying) {
        audioRef.current.pause();
        setAudioState((prev) => ({ ...prev, isPlaying: false }));
      }

      if (!wordAudioRef.current) {
        wordAudioRef.current = new Audio();
      }
      const wAudio = wordAudioRef.current;
      wAudio.pause();
      wAudio.currentTime = 0;

      setPronouncingWord({
        word,
        ayah,
        isPlaying: true,
        speed,
        error: null,
      });

      wAudio.onended = () => {
        setPronouncingWord((prev) => (prev ? { ...prev, isPlaying: false } : null));
      };
      wAudio.onerror = () => {
        setPronouncingWord((prev) =>
          prev ? { ...prev, isPlaying: false, error: 'تعذر تشغيل نطق الكلمة' } : null
        );
      };

      wAudio.src = getWordAudioUrl(word.audioUrl);
      wAudio.playbackRate = speed;

      try {
        await wAudio.play();
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setPronouncingWord((prev) =>
          prev ? { ...prev, isPlaying: false, error: 'تعذر تشغيل نطق الكلمة' } : null
        );
      }
    },
    []
  );

  return (
    <MushafContext.Provider
      value={{
        activeTab,
        setActiveTab,
        currentPage,
        currentSurah,
        highlightedAyahGlobal,
        lastPosition,
        bookmarks,
        notes,
        khatmah,
        settings,
        corpusReady,
        corpusLoading,
        selectedAyahForSheet,
        selectedWordForSheet,
        setSelectedAyahForSheet,
        openWordSheet,
        audioState,
        pronouncingWord,
        pronounceWord,
        dismissPronouncingWord,
        updateSettings,
        jumpToPage,
        jumpToSurah,
        jumpToAyah,
        saveReadingPosition,
        toggleBookmark,
        isBookmarked,
        saveTadabburNote,
        deleteTadabburNote,
        togglePageCompleted,
        setDailyKhatmahTarget,
        playAyah,
        playSurahStream,
        togglePlayPause,
        stopAudio,
        seekAudio,
        playNextAyah,
        playPrevAyah,
        setRangeLoop,
        downloadFullCorpus,
      }}
    >
      {children}
    </MushafContext.Provider>
  );
};

export function useMushaf(): MushafContextValue {
  const ctx = useContext(MushafContext);
  if (!ctx) throw new Error('useMushaf must be used inside MushafProvider');
  return ctx;
}
