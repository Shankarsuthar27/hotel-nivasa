import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  X
} from 'lucide-react';

/**
 * Premium OTAL PMS Toast Notification
 * - Portal-rendered directly onto document.body for guaranteed top-level visibility
 * - High z-index (9999999) ensuring it floats above all fullscreen overlays and modals
 * - Positioned at top-right with fluid responsive layout
 * - Exact styling matching OTAL PMS dark pill specification (media_1794917467105_0cd7e21c.png)
 * - Dismissible via X button or auto-timer
 */
export default function ToastNotification({ toast, onClose, duration = 4000 }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (!toast) return;

    setIsExiting(false);

    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        if (onClose) onClose();
      }, 220);
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [toast, duration, onClose]);

  if (!toast) return null;

  const rawMessage = typeof toast === 'string' ? toast : toast.message || '';
  const explicitType = typeof toast === 'object' ? toast.type : null;

  // Derive toast type from content if not explicitly provided
  let type = explicitType || 'info';
  if (!explicitType) {
    if (
      rawMessage.includes('❌') ||
      rawMessage.toLowerCase().startsWith('error') ||
      rawMessage.toLowerCase().includes('failed') ||
      rawMessage.toLowerCase().includes('cannot be deleted')
    ) {
      type = 'error';
    } else if (rawMessage.includes('⚠️') || rawMessage.toLowerCase().startsWith('warning')) {
      type = 'warning';
    } else if (rawMessage.includes('✅') || rawMessage.includes('🎉') || rawMessage.toLowerCase().startsWith('success')) {
      type = 'success';
    }
  }

  // Clean redundant leading emojis/prefixes for polished display
  let cleanMessage = rawMessage
    .replace(/^([✅❌⚠️🎉🧹💳🔄🌙👋🏢📢🗑️🔑\s]+)/, '')
    .trim();

  if (cleanMessage.toLowerCase().startsWith('success:')) {
    cleanMessage = cleanMessage.replace(/^success:\s*/i, '').trim();
  } else if (cleanMessage.toLowerCase().startsWith('error:')) {
    cleanMessage = cleanMessage.replace(/^error:\s*/i, '').trim();
  } else if (cleanMessage.toLowerCase().startsWith('warning:')) {
    cleanMessage = cleanMessage.replace(/^warning:\s*/i, '').trim();
  }

  if (!cleanMessage) cleanMessage = rawMessage;

  // Type configuration with clean icon strokes
  const typeConfig = {
    success: {
      icon: <CheckCircle2 size={22} color="#10B981" strokeWidth={2} />
    },
    error: {
      icon: <AlertCircle size={22} color="#EF4444" strokeWidth={2} />
    },
    warning: {
      icon: <AlertTriangle size={22} color="#F59E0B" strokeWidth={2} />
    },
    info: {
      icon: <Info size={22} color="#38BDF8" strokeWidth={2} />
    }
  };

  const currentConfig = typeConfig[type] || typeConfig.info;

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      if (onClose) onClose();
    }, 200);
  };

  const toastElement = (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 9999999,
        maxWidth: '460px',
        minWidth: '320px',
        backgroundColor: '#0F172A',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: '#FFFFFF',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'translateY(-12px) scale(0.97)' : 'translateY(0) scale(1)',
        transition: 'opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'auto',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {currentConfig.icon}
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: '14px',
          fontWeight: 500,
          color: '#FFFFFF',
          lineHeight: '1.45',
          wordBreak: 'break-word'
        }}
      >
        {cleanMessage}
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss notification"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#94A3B8',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.15s ease',
          flexShrink: 0,
          marginLeft: '4px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#FFFFFF';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#94A3B8';
        }}
      >
        <X size={16} strokeWidth={2.2} />
      </button>
    </div>
  );

  return typeof document !== 'undefined'
    ? ReactDOM.createPortal(toastElement, document.body)
    : toastElement;
}
