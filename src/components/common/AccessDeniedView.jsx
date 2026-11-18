import React from 'react';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';

export default function AccessDeniedView({
  sectionName = 'this section',
  userRole = 'Staff',
  onGoHome,
  fullScreen = false
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        flex: 1,
        minHeight: fullScreen ? '100vh' : 'calc(100vh - 64px)',
        padding: '32px 24px',
        backgroundColor: '#F8FAFC',
        textAlign: 'center',
        boxSizing: 'border-box',
        margin: '0 auto'
      }}
    >
      <div
        style={{
          maxWidth: '460px',
          width: '100%',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '36px 32px',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)'
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px',
            color: '#DC2626'
          }}
        >
          <ShieldAlert size={28} />
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '9999px',
            backgroundColor: '#F1F5F9',
            color: '#475569',
            fontSize: '11.5px',
            fontWeight: 600,
            marginBottom: '12px'
          }}
        >
          <Lock size={12} />
          <span>Role: {userRole}</span>
        </div>

        <h2
          style={{
            fontSize: '20px',
            fontWeight: 700,
            color: '#0F172A',
            margin: '0 0 8px 0'
          }}
        >
          Access Restricted
        </h2>

        <p
          style={{
            fontSize: '13.5px',
            lineHeight: 1.6,
            color: '#64748B',
            margin: '0 0 24px 0'
          }}
        >
          Your account does not currently have permission to access{' '}
          <strong style={{ color: '#0F172A' }}>{sectionName}</strong>. Please contact the hotel
          Owner to update your operational permissions.
        </p>

        {onGoHome && (
          <button
            type="button"
            onClick={onGoHome}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(37, 99, 235, 0.25)'
            }}
          >
            <ArrowLeft size={16} />
            <span>Return to Allowed Workspace</span>
          </button>
        )}
      </div>
    </div>
  );
}

