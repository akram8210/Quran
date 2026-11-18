import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  // Compact button (shown in TopBar only when native install prompt is available or iOS)
  if (variant === 'compact') {
    if (!isInstallable && !isIOS) {
      return null;
    }

    return (
      <>
        <button
          type="button"
          onClick={() => (isInstallable ? install() : setShowGuideModal(true))}
          aria-label="تثبيت التطبيق على الهاتف"
          title="تثبيت التطبيق على الهاتف"
          className="min-h-[36px] px-2.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          style={{
            backgroundColor: 'var(--accent-soft)',
            color: 'var(--accent-primary)',
          }}
        >
          <Download size={14} />
          <span className="hidden sm:inline">تثبيت</span>
        </button>

        {showGuideModal && (
          <InstallGuideModal isIOS={isIOS} onClose={() => setShowGuideModal(false)} />
        )}
      </>
    );
  }

  // Card variant inside Settings modal (always accessible while in browser mode)
  return (
    <>
      <div
        className="p-3.5 rounded-2xl border flex items-center justify-between gap-3"
        style={{
          backgroundColor: 'var(--bg-canvas)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
            <Smartphone size={14} style={{ color: 'var(--accent-primary)' }} />
            <span>تثبيت التطبيق على الهاتف</span>
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {isInstallable
              ? 'أضف مصحف التدبر كتطبيق مستقل على شاشة الأندرويد الرئيسية'
              : 'يعمل كتطبيق مستقل بملء الشاشة على أندرويد وآيفون'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => (isInstallable ? install() : setShowGuideModal(true))}
          className="min-h-[40px] px-3.5 rounded-xl text-xs font-medium text-white shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          <Download size={14} />
          <span>{isInstallable ? 'تثبيت الآن' : 'طريقة التثبيت'}</span>
        </button>
      </div>

      {showGuideModal && (
        <InstallGuideModal isIOS={isIOS} onClose={() => setShowGuideModal(false)} />
      )}
    </>
  );
};

const InstallGuideModal: React.FC<{ isIOS: boolean; onClose: () => void }> = ({
  isIOS,
  onClose,
}) => (
  <div
    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
    onClick={onClose}
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-label="تثبيت التطبيق على الهاتف"
      className="w-full max-w-sm rounded-3xl border p-5 shadow-2xl space-y-4"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-hairline)',
        color: 'var(--text-primary)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">تثبيت مصحف التدبر على الهاتف</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl cursor-pointer"
          style={{ color: 'var(--text-secondary)' }}
        >
          <X size={18} />
        </button>
      </div>

      {isIOS ? (
        <ol className="text-sm space-y-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <li>١. افتح التطبيق في متصفح Safari ثم اضغط على زر <strong>المشاركة</strong> بالأسفل.</li>
          <li>٢. مرّر للأسفل واختر <strong>إضافة إلى الشاشة الرئيسية</strong>.</li>
          <li>٣. اضغط <strong>إضافة</strong> ليظهر التطبيق على هاتفك كأي تطبيق عادي.</li>
        </ol>
      ) : (
        <ol className="text-sm space-y-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <li>١. افتح رابط التطبيق مباشرة في متصفح <strong>Chrome</strong> على هاتفك الأندرويد.</li>
          <li>٢. اضغط على قائمة النقاط الثلاث <strong>(⋮)</strong> أعلى المتصفح.</li>
          <li>٣. اختر <strong>تثبيت التطبيق</strong> أو <strong>الإضافة إلى الشاشة الرئيسية</strong> ليُثبَّت كتطبيق أندرويد مستقل.</li>
        </ol>
      )}

      <button
        type="button"
        onClick={onClose}
        className="w-full min-h-[44px] rounded-xl text-sm font-medium text-white cursor-pointer"
        style={{ backgroundColor: 'var(--accent-primary)' }}
      >
        فهمت
      </button>
    </div>
  </div>
);
