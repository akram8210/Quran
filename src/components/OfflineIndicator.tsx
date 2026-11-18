import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 lg:bottom-5 left-4 z-50 flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-white shadow-lg"
      style={{ backgroundColor: '#9a7122' }}
    >
      <WifiOff size={14} className="shrink-0" />
      <span>وضع عدم الاتصال — يتم استخدام الصفحات المحفوظة</span>
    </div>
  );
};
