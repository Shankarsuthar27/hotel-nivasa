import React, { useState, useEffect } from 'react';
import { X, Edit3, Save } from 'lucide-react';
import CustomDatePicker from '../common/CustomDatePicker';
import { getTodayIsoDate, normalizeDateStr } from '../../services/dateUtils';

// Format date to "Tue, Nov 17, 2026" matching screenshot
const formatDisplayDate = (dStr) => {
  if (!dStr) return '-';
  const cleanStr = String(dStr).split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dt = new Date(y, m, d);
    if (!isNaN(dt.getTime())) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${days[dt.getDay()]}, ${months[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
    }
  }
  const d = new Date(dStr + (String(dStr).includes('T') ? '' : 'T00:00:00'));
  if (isNaN(d.getTime())) return dStr;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

export default function EditFolioTransactionModal({
  isOpen,
  onClose,
  transaction,
  folio,
  onSave
}) {
  // Blur background while modal is active
  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('has-res-modal-open');
    return () => {
      document.body.classList.remove('has-res-modal-open');
    };
  }, [isOpen]);

  const isPayment =
    transaction?.direction === 'Credit' ||
    transaction?.direction === 'CREDIT' ||
    (transaction?.category || '').toUpperCase().includes('PAYMENT') ||
    (transaction?.type || '').toUpperCase().includes('PAYMENT');

  const folioNumber =
    folio?.folioNumber ||
    transaction?.folioNumber ||
    transaction?.folioId ||
    'FOL_388';

  const getCleanDate = (tx) => {
    if (!tx?.date || tx.date === '2026-11-03') return getTodayIsoDate();
    return normalizeDateStr(tx.date) || getTodayIsoDate();
  };

  const initialAmt = Math.abs(Number(transaction?.amount || 0)).toFixed(2);
  const [amount, setAmount] = useState(initialAmt);
  const [txDate, setTxDate] = useState(getCleanDate(transaction));
  const [description, setDescription] = useState(
    transaction?.desc || transaction?.description || (isPayment ? 'Advance Payment (UPI) Ref: Direct' : 'Charge')
  );
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (transaction) {
      setAmount(Math.abs(Number(transaction.amount || 0)).toFixed(2));
      setTxDate(getCleanDate(transaction));
      setDescription(transaction.desc || transaction.description || (isPayment ? 'Advance Payment (UPI) Ref: Direct' : 'Charge'));
      setErrorMsg('');
    }
  }, [transaction, isPayment]);

  if (!isOpen || !transaction) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const numAmt = parseFloat(amount);
    if (isNaN(numAmt) || numAmt < 0) {
      setErrorMsg('Please enter a valid amount');
      return;
    }

    if (onSave) {
      onSave({
        date: txDate || getTodayIsoDate(),
        amount: numAmt,
        description: description.trim()
      });
    }
    onClose();
  };

  const category = (transaction.category || (isPayment ? 'PAYMENT' : 'CHARGE')).toUpperCase();
  const type = (transaction.type || (isPayment ? 'PAYMENT' : 'CHARGE')).toUpperCase();

  // Detect exact payment method (e.g. UPI, CASH, CARD, BANK)
  const fullDesc = `${transaction.particulars || ''} ${transaction.desc || ''} ${transaction.description || ''} ${description || ''}`.toUpperCase();
  let detectedMethod = transaction.paymentMethod;
  if (!detectedMethod) {
    if (fullDesc.includes('UPI')) detectedMethod = 'UPI';
    else if (fullDesc.includes('CASH')) detectedMethod = 'CASH';
    else if (fullDesc.includes('CARD')) detectedMethod = 'CARD';
    else if (fullDesc.includes('BANK')) detectedMethod = 'BANK';
    else if (fullDesc.includes('TDS')) detectedMethod = 'TDS';
  }
  const method = (detectedMethod || (isPayment ? 'UPI' : '-')).toUpperCase();
  const txDateFormatted = formatDisplayDate(txDate || getCleanDate(transaction));

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
        padding: '16px',
        boxSizing: 'border-box'
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '520px',
          width: '100%',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '24px 28px 20px 28px',
          boxSizing: 'border-box',
          position: 'relative',
          maxHeight: '92vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Edit3 size={18} color="#2563eb" />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '17px',
                  fontWeight: 700,
                  color: '#0f172a'
                }}
              >
                {isPayment ? 'Edit Payment' : 'Edit Charge'}
              </h3>
              <p
                style={{
                  margin: '2px 0 0 0',
                  fontSize: '13px',
                  color: '#64748b'
                }}
              >
                Folio:{' '}
                <span style={{ color: '#2563eb', fontWeight: 600 }}>
                  {folioNumber}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              borderRadius: '6px',
              padding: '6px',
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Read-Only Metadata Summary Box matching image */}
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #f1f5f9',
            borderRadius: '10px',
            padding: '14px 18px',
            marginBottom: '16px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            rowGap: '10px',
            columnGap: '18px'
          }}
        >
          <div>
            <span style={{ fontSize: '12px', color: '#64748b', display: 'block', fontWeight: 500 }}>
              Folio No.
            </span>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', display: 'block', marginTop: '2px' }}>
              {folioNumber}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '12px', color: '#64748b', display: 'block', fontWeight: 500 }}>
              Date
            </span>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', display: 'block', marginTop: '2px' }}>
              {txDateFormatted}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '12px', color: '#64748b', display: 'block', fontWeight: 500 }}>
              Category
            </span>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', display: 'block', marginTop: '2px' }}>
              {category}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '12px', color: '#64748b', display: 'block', fontWeight: 500 }}>
              Type
            </span>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', display: 'block', marginTop: '2px' }}>
              {type}
            </span>
          </div>

          {isPayment && (
            <div>
              <span style={{ fontSize: '12px', color: '#64748b', display: 'block', fontWeight: 500 }}>
                Method
              </span>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', display: 'block', marginTop: '2px' }}>
                {method}
              </span>
            </div>
          )}
        </div>

        {errorMsg && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              fontSize: '13px',
              padding: '8px 12px',
              borderRadius: '6px',
              marginBottom: '12px'
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Editable Date */}
          <div style={{ marginBottom: '14px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#1e293b',
                marginBottom: '6px'
              }}
            >
              Date <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <CustomDatePicker
              value={txDate}
              onChange={(val) => setTxDate(val)}
              placeholder="Select date"
              displayFormat="dmy"
              outputFormat="iso"
            />
          </div>

          {/* Editable Amount */}
          <div style={{ marginBottom: '14px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#1e293b',
                marginBottom: '6px'
              }}
            >
              Amount <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                width: '100%',
                height: '40px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Editable Description */}
          <div style={{ marginBottom: '18px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#1e293b',
                marginBottom: '6px'
              }}
            >
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box',
                resize: 'vertical',
                minHeight: '65px',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Action Buttons - Fully Visible & Cleanly Aligned */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              paddingTop: '14px',
              paddingBottom: '2px',
              borderTop: '1px solid #f1f5f9'
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                height: '38px',
                padding: '0 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                height: '38px',
                padding: '0 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(37, 99, 235, 0.25)',
                transition: 'background-color 0.15s ease'
              }}
            >
              <Save size={15} />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

