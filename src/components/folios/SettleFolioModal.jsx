import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle2, ChevronDown } from 'lucide-react';

/**
 * SettleFolioModal Component
 * Clean enterprise modal for settling & closing a guest folio.
 */
export default function SettleFolioModal({
  isOpen,
  onClose,
  onSettle,
  folioNumber = 'FOL_1',
  outstandingBalance = 0,
  reservationId
}) {
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentMethodError, setPaymentMethodError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('');
      setPaymentMethodError(false);
      setIsSubmitting(false);
    }
  }, [isOpen, folioNumber, reservationId]);

  if (!isOpen) return null;

  const balanceNum = Math.max(0, Number(outstandingBalance) || 0);
  const formattedBalance = balanceNum.toFixed(2);
  const isZeroBalance = balanceNum <= 0.001;

  const handleConfirm = async () => {
    if (!isZeroBalance && !paymentMethod) {
      setPaymentMethodError(true);
      selectRef.current?.focus();
      return;
    }
    setPaymentMethodError(false);
    try {
      setIsSubmitting(true);
      if (onSettle) {
        await onSettle(reservationId, paymentMethod, 'Direct Folio Settlement', undefined, balanceNum);
      }
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1150,
        padding: '16px',
        boxSizing: 'border-box'
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '460px',
          boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.14), 0 8px 10px -6px rgba(15, 23, 42, 0.08)',
          border: '1px solid #E2E8F0',
          padding: '24px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <CheckCircle2 size={22} color="#10B981" strokeWidth={2.2} />
            </div>

            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '17px',
                  fontWeight: 700,
                  color: '#0F172A',
                  letterSpacing: '-0.01em'
                }}
              >
                Clear / Settle Folio
              </h3>
              <p
                style={{
                  margin: '3px 0 0 0',
                  fontSize: '13px',
                  fontWeight: 400,
                  color: '#64748B'
                }}
              >
                Folio {folioNumber}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748B',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            title="Close"
          >
            <X size={20} color="#475569" strokeWidth={2} />
          </button>
        </div>

        {/* Outstanding Balance Box */}
        <div
          style={{
            backgroundColor: '#F8FAFC',
            borderRadius: '10px',
            padding: '15px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            border: '1px solid #E2E8F0',
            boxSizing: 'border-box'
          }}
        >
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#334155'
            }}
          >
            Outstanding Balance
          </span>
          <span
            style={{
              fontSize: '16.5px',
              fontWeight: 700,
              color: isZeroBalance ? '#16A34A' : '#DC2626'
            }}
          >
            ₹{formattedBalance}
          </span>
        </div>

        {/* Description */}
        <p
          style={{
            margin: '0 0 18px 0',
            fontSize: '13px',
            color: '#64748B',
            lineHeight: 1.5
          }}
        >
          {isZeroBalance
            ? 'This folio has no outstanding balance and will be settled and closed.'
            : `Outstanding balance of ₹${formattedBalance} will be settled and this folio will be closed.`}
        </p>

        {/* Payment Method Selector */}
        {!isZeroBalance && (
          <div style={{ marginBottom: '22px' }}>
            <label
              htmlFor="settle-payment-method"
              style={{
                display: 'block',
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px'
              }}
            >
              Payment Method
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <select
                ref={selectRef}
                id="settle-payment-method"
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  if (e.target.value) setPaymentMethodError(false);
                }}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 36px 0 12px',
                  borderRadius: '8px',
                  border: paymentMethodError ? '1.5px solid #EF4444' : '1px solid #CBD5E1',
                  fontSize: '13.5px',
                  fontWeight: paymentMethod ? 500 : 400,
                  color: paymentMethod ? '#0F172A' : '#64748B',
                  backgroundColor: '#FFFFFF',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">Select Payment Mode</option>
                <option value="UPI" style={{ color: '#0F172A' }}>UPI</option>
                <option value="CASH" style={{ color: '#0F172A' }}>Cash</option>
                <option value="CREDIT_CARD" style={{ color: '#0F172A' }}>Credit Card</option>
                <option value="DEBIT_CARD" style={{ color: '#0F172A' }}>Debit Card</option>
                <option value="NET_BANKING" style={{ color: '#0F172A' }}>Net Banking</option>
              </select>
              <ChevronDown
                size={16}
                color="#64748B"
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none'
                }}
              />
            </div>
            {paymentMethodError && (
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', fontWeight: 600, color: '#DC2626' }}>
                Please select a payment mode before settling.
              </p>
            )}
          </div>
        )}

        {/* Footer Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            paddingTop: '14px',
            borderTop: '1px solid #F1F5F9'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: '9px 20px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: 600,
              color: '#334155',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            style={{
              padding: '9px 22px',
              backgroundColor: isSubmitting ? '#93C5FD' : '#2563EB',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: 600,
              color: '#FFFFFF',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              boxShadow: '0 1px 3px rgba(37, 99, 235, 0.25)',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) e.currentTarget.style.backgroundColor = '#1D4ED8';
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) e.currentTarget.style.backgroundColor = '#2563EB';
            }}
          >
            <CheckCircle2 size={16} color="#FFFFFF" strokeWidth={2.3} />
            <span>{isSubmitting ? 'Settling...' : 'Settle Folio'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
