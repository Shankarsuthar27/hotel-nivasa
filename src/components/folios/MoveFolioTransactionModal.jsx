import React, { useState } from 'react';
import { X, ArrowLeftRight, Check } from 'lucide-react';

export default function MoveFolioTransactionModal({
  isOpen,
  onClose,
  transaction,
  currentFolioId,
  availableFolios = [],
  onConfirmMove
}) {
  const [targetFolio, setTargetFolio] = useState(
    availableFolios.find((f) => f.id !== currentFolioId)?.id || 'fol_2'
  );

  if (!isOpen || !transaction) return null;

  const txAmount = Math.abs(Number(transaction?.amount || 0)).toFixed(2);
  const txDesc = transaction?.desc || transaction?.description || 'Transaction';

  const handleMove = (e) => {
    e.preventDefault();
    if (onConfirmMove) {
      onConfirmMove(transaction.id, targetFolio);
    }
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1300,
        padding: '1rem'
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '460px',
          width: '100%',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '24px 28px',
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ArrowLeftRight size={18} color="#2563eb" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                Move Transaction
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                Transfer charge / payment to another folio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              cursor: 'pointer',
              color: '#64748b'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Transaction Summary */}
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #f1f5f9',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '18px',
            fontSize: '13px',
            color: '#334155'
          }}
        >
          <div>
            <strong>Transaction:</strong> {txDesc}
          </div>
          <div style={{ marginTop: '4px' }}>
            <strong>Amount:</strong> ₹{txAmount} ({transaction.direction || 'Debit'})
          </div>
        </div>

        <form onSubmit={handleMove}>
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#1e293b',
                marginBottom: '6px'
              }}
            >
              Target Folio <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              value={targetFolio}
              onChange={(e) => setTargetFolio(e.target.value)}
              style={{
                width: '100%',
                height: '40px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13.5px',
                color: '#0f172a',
                outline: 'none',
                backgroundColor: '#ffffff'
              }}
            >
              {availableFolios.length > 0 ? (
                availableFolios.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.folioNumber || f.id} {f.roomNumber ? `(Room ${f.roomNumber})` : ''}
                  </option>
                ))
              ) : (
                <>
                  <option value="fol_secondary">FOL_2 (Secondary Folio)</option>
                  <option value="fol_split">FOL_3 (Split Folio)</option>
                </>
              )}
            </select>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              paddingTop: '16px',
              borderTop: '1px solid #f1f5f9'
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                height: '36px',
                padding: '0 16px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                height: '36px',
                padding: '0 18px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Check size={14} />
              <span>Confirm Move</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

