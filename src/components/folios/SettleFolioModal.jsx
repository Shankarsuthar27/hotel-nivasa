import React, { useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';

/**
 * SettleFolioModal Component
 * Pixel-matched exactly to the authoritative PMS specification screenshot:
 * - Header: Rounded green check icon, "Clear / Settle Folio", "Folio FOL_..." subtitle, Close X button
 * - Body: Light card with "Outstanding Balance" and amount, explanation text
 * - Footer: "Cancel" outline button and blue "Settle Folio" button with circular checkmark icon
 */
export default function SettleFolioModal({
  isOpen,
  onClose,
  onSettle,
  folioNumber = 'FOL_1',
  outstandingBalance = 0,
  reservationId
}) {
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const balanceNum = Math.max(0, Number(outstandingBalance) || 0);
  const formattedBalance = balanceNum.toFixed(2);
  const isZeroBalance = balanceNum <= 0.001;

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      if (onSettle) {
        await onSettle(reservationId, paymentMethod, 'Direct Folio Settlement');
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
        padding: '16px'
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
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
          padding: '24px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Green rounded icon */}
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: '#ECFDF5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <CheckCircle2 size={24} color="#10B981" strokeWidth={2.2} />
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

          {/* Close X Button */}
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
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            border: '1px solid #F1F5F9'
          }}
        >
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#475569'
            }}
          >
            Outstanding Balance
          </span>
          <span
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: isZeroBalance ? '#16A34A' : '#DC2626'
            }}
          >
            {formattedBalance}
          </span>
        </div>

        {/* Subtext description */}
        <p
          style={{
            margin: '0 0 20px 0',
            fontSize: '13px',
            color: '#64748B',
            lineHeight: 1.45
          }}
        >
          {isZeroBalance
            ? 'This folio has no outstanding balance and will be settled and closed.'
            : `Outstanding balance of ₹${formattedBalance} will be settled and this folio will be closed.`}
        </p>

        {/* Optional Payment Mode when balance > 0 */}
        {!isZeroBalance && (
          <div style={{ marginBottom: '20px' }}>
            <label
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
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '13.5px',
                color: '#0F172A',
                backgroundColor: '#FFFFFF'
              }}
            >
              <option value="UPI">UPI</option>
              <option value="CASH">Cash</option>
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="DEBIT_CARD">Debit Card</option>
              <option value="NET_BANKING">Net Banking</option>
            </select>
          </div>
        )}

        {/* Footer Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '8px'
          }}
        >
          {/* Cancel Button */}
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: '9px 20px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#0F172A',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
          >
            Cancel
          </button>

          {/* Settle Folio Blue Button */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            style={{
              padding: '9px 22px',
              backgroundColor: '#86B0FA',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#FFFFFF',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              transition: 'filter 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(0.93)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
          >
            <CheckCircle2 size={16} color="#FFFFFF" strokeWidth={2.4} />
            <span>{isSubmitting ? 'Settling...' : 'Settle Folio'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

