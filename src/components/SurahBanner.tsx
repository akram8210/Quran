import React from 'react';
import { SURAH_LIST } from '../data/surahMetadata';
import { toArabicDigits } from '../utils/arabicNormalize';

interface SurahBannerProps {
  surahNumber: number;
  onPlaySurah?: () => void;
}

export const SurahBanner: React.FC<SurahBannerProps> = ({ surahNumber, onPlaySurah }) => {
  const meta = SURAH_LIST.find((s) => s.number === surahNumber);
  const surahTitle = meta ? `سُورَةُ ${meta.name}` : `سُورَةُ ${toArabicDigits(surahNumber)}`;
  const showBasmalah = surahNumber !== 1 && surahNumber !== 9;

  return (
    <div className="my-4 select-none">
      {/* Ornate Madinah Mushaf Surah Cartouche */}
      <div
        className="relative p-[3px] rounded-xl border"
        style={{
          borderColor: 'var(--mushaf-frame-outer)',
          backgroundColor: 'var(--accent-gold-soft)',
        }}
      >
        <div
          className="relative flex items-center justify-between px-3.5 sm:px-5 py-2.5 rounded-[9px] border"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--mushaf-frame-inner)',
          }}
        >
          {/* Right Islamic 8-Pointed Medallion */}
          <svg
            width="30"
            height="30"
            viewBox="0 0 36 36"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
            style={{ color: 'var(--accent-gold)' }}
          >
            <path
              d="M18 2L21.9 8.7L29.5 7.4L28.2 15L34 18L28.2 21L29.5 28.6L21.9 27.3L18 34L14.1 27.3L6.5 28.6L7.8 21L2 18L7.8 15L6.5 7.4L14.1 8.7L18 2Z"
              stroke="currentColor"
              strokeWidth="1.25"
              fill="var(--accent-gold-soft)"
            />
            <circle cx="18" cy="18" r="5" stroke="currentColor" strokeWidth="1.1" />
            <circle cx="18" cy="18" r="1.8" fill="currentColor" />
          </svg>

          <div className="flex flex-col items-center text-center px-2 min-w-0">
            <h2
              className="font-uthmani text-xl sm:text-2xl font-normal leading-snug"
              style={{ color: 'var(--text-primary)' }}
            >
              {surahTitle}
            </h2>
            {meta && (
              <div
                className="flex items-center gap-2 text-[11px] sm:text-xs mt-0.5 tabular-nums font-ui"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span>{meta.revelationType}</span>
                <span aria-hidden="true">·</span>
                <span>{toArabicDigits(meta.ayahCount)} آية</span>
                <span aria-hidden="true">·</span>
                <span>الجزء {toArabicDigits(meta.juz)}</span>
              </div>
            )}
          </div>

          {onPlaySurah ? (
            <button
              type="button"
              onClick={onPlaySurah}
              aria-label={`تشغيل ${surahTitle}`}
              title="تشغيل السورة كاملة"
              className="min-h-[38px] px-3 py-1 rounded-lg text-xs font-medium font-ui whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
              }}
            >
              استماع
            </button>
          ) : (
            <svg
              width="30"
              height="30"
              viewBox="0 0 36 36"
              fill="none"
              aria-hidden="true"
              className="shrink-0"
              style={{ color: 'var(--accent-gold)' }}
            >
              <path
                d="M18 2L21.9 8.7L29.5 7.4L28.2 15L34 18L28.2 21L29.5 28.6L21.9 27.3L18 34L14.1 27.3L6.5 28.6L7.8 21L2 18L7.8 15L6.5 7.4L14.1 8.7L18 2Z"
                stroke="currentColor"
                strokeWidth="1.25"
                fill="var(--accent-gold-soft)"
              />
              <circle cx="18" cy="18" r="5" stroke="currentColor" strokeWidth="1.1" />
              <circle cx="18" cy="18" r="1.8" fill="currentColor" />
            </svg>
          )}
        </div>
      </div>

      {/* Basmalah in authentic KFGQPC Uthmani script */}
      {showBasmalah && (
        <p
          className="font-uthmani text-center text-xl sm:text-2xl mt-3.5 mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
        </p>
      )}
    </div>
  );
};

interface AyahEndMarkerProps {
  numberInSurah: number;
  isPlaying?: boolean;
  isBookmarked?: boolean;
}

export const AyahEndMarker: React.FC<AyahEndMarkerProps> = ({
  numberInSurah,
  isPlaying,
  isBookmarked,
}) => {
  const digits = toArabicDigits(numberInSurah);
  const isThreeDigits = digits.length >= 3;

  return (
    <span
      className="inline-flex items-center justify-center mx-1 align-middle select-none"
      style={{
        color: isPlaying ? 'var(--accent-primary)' : 'var(--accent-gold)',
      }}
      aria-label={`آية ${numberInSurah}`}
    >
      <span className="relative inline-flex items-center justify-center w-[1.58em] h-[1.58em]">
        <svg
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden="true"
          className="absolute inset-0 w-full h-full"
        >
          {/* Outer 12-lobed Mushaf rosette petals */}
          <path
            d="M24 2.5C25.9 2.5 27.2 4.6 28.9 5.2C30.6 5.8 32.9 4.7 34.4 5.9C35.9 7.1 35.7 9.6 36.8 11.1C37.9 12.6 40.4 13.1 41.1 14.8C41.8 16.5 40.2 18.6 40.2 20.5C40.2 22.4 42.3 23.9 42.3 25.8C42.3 27.7 40.2 29.2 39.6 31C39 32.8 40.2 35.1 39 36.6C37.8 38.1 35.3 37.9 33.8 39C32.3 40.1 31.8 42.6 30.1 43.3C28.4 44 26.3 42.4 24.4 42.4C22.5 42.4 20.6 44 18.9 43.3C17.2 42.6 16.7 40.1 15.2 39C13.7 37.9 11.2 38.1 10 36.6C8.8 35.1 10 32.8 9.4 31C8.8 29.2 6.7 27.7 6.7 25.8C6.7 23.9 8.8 22.4 8.8 20.5C8.8 18.6 7.2 16.5 7.9 14.8C8.6 13.1 11.1 12.6 12.2 11.1C13.3 9.6 13.1 7.1 14.6 5.9C16.1 4.7 18.4 5.8 20.1 5.2C21.8 4.6 22.1 2.5 24 2.5Z"
            fill={
              isPlaying
                ? 'var(--accent-soft)'
                : isBookmarked
                  ? 'var(--accent-gold-soft)'
                  : 'var(--bg-canvas)'
            }
            stroke="currentColor"
            strokeWidth="1.9"
          />
          {/* Inner precision ring */}
          <circle
            cx="24"
            cy="24"
            r="14.5"
            stroke="currentColor"
            strokeWidth="1.05"
            opacity="0.72"
          />
          {/* Top/Bottom tiny ornamental dots */}
          <circle cx="24" cy="6.2" r="1.1" fill="currentColor" />
          <circle cx="24" cy="41.8" r="1.1" fill="currentColor" />
        </svg>
        <span
          className="relative z-10 font-uthmani leading-none"
          style={{
            color: isPlaying ? 'var(--accent-primary)' : 'var(--text-primary)',
            fontSize: isThreeDigits ? '0.46em' : '0.56em',
            paddingTop: '1px',
          }}
        >
          {digits}
        </span>
      </span>
    </span>
  );
};
