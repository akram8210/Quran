import React, { useState } from 'react';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { AyahSheet } from './components/AyahSheet';
import { BookmarksView } from './components/BookmarksView';
import { BottomNav } from './components/BottomNav';
import { DisplaySettingsModal } from './components/DisplaySettingsModal';
import { HifzKhatmahView } from './components/HifzKhatmahView';
import { IndexView } from './components/IndexView';
import { MushafReader } from './components/MushafReader';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SearchView } from './components/SearchView';
import { TopBar } from './components/TopBar';
import { MushafProvider, useMushaf } from './context/MushafContext';

const MushafShell: React.FC = () => {
  const { activeTab } = useMushaf();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        onOpenSettings={() => setSettingsOpen(true)}
        focusMode={focusMode}
        onToggleFocusMode={() => setFocusMode((v) => !v)}
      />

      <div className="flex-1 flex">
        <BottomNav hidden={focusMode && activeTab === 'reader'} />

        <main className="flex-1 flex flex-col min-w-0">
          {activeTab === 'reader' && (
            <MushafReader
              focusMode={focusMode}
              onExitFocusMode={() => setFocusMode(false)}
            />
          )}
          {activeTab === 'index' && <IndexView />}
          {activeTab === 'search' && <SearchView />}
          {activeTab === 'hifz' && <HifzKhatmahView />}
          {activeTab === 'bookmarks' && <BookmarksView />}
        </main>
      </div>

      <AudioPlayerBar />
      <AyahSheet />
      <DisplaySettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <OfflineIndicator />
    </div>
  );
};

export default function App() {
  return (
    <MushafProvider>
      <MushafShell />
    </MushafProvider>
  );
}
