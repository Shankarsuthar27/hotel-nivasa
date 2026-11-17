import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Pencil, X, ChevronDown } from 'lucide-react';

/**
 * UpdateDetailsModal Component
 * Exact match to user specification & screenshots:
 * - Header: Blue Pencil icon box, "Update Details", "Modify the per-night room rate", Close button
 * - Radios: "Apply on selected date" vs "Apply on whole stay"
 * - Date dropdown: Enabled when "Apply on selected date", disabled/greyed out when "Apply on whole stay"
 * - Pax (A/C) dropdowns: Adults and Children side-by-side
 * - "Override Rate" checkbox
 * - Rate input with ₹ currency prefix
 * - Actions: "Cancel" and "Update" buttons
 */
export function UpdateDetailsModal({
  isOpen,
  onClose,
  reservation,
  folio,
  onUpdate
}) {
  // Format date helper: "13/11/2026"
  const formatSlashedDate = (dateStr) => {
    if (!dateStr) return '';
    const clean = String(dateStr).split('T')[0];
    const parts = clean.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
      }
      return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
    }
    return dateStr;
  };

  // Convert "13/11/2026" to "2026-11-13"
  const dmyToIso = (dmyStr) => {
    if (!dmyStr) return '';
    const parts = String(dmyStr).split(/[-/]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    return dmyStr;
  };

  // Generate stay dates list
  const stayDates = useMemo(() => {
    if (!reservation) return [];
    const nights = Math.max(1, Number(reservation.nights) || 1);
    const startDt = new Date(reservation.checkInDate || Date.now());
    const list = [];
    for (let i = 0; i < nights; i++) {
      const d = new Date(startDt);
      d.setDate(d.getDate() + i);
      const iso = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';
      const dmy = formatSlashedDate(iso || reservation.checkInDate);
      list.push({ iso, dmy, index: i });
    }
    return list;
  }, [reservation]);

  const [applyMode, setApplyMode] = useState('selected_date'); // 'selected_date' | 'whole_stay'
  const [selectedDate, setSelectedDate] = useState('');
  const [adults, setAdults] = useState(4);
  const [children, setChildren] = useState(2);
  const [overrideRate, setOverrideRate] = useState(false);
  const [rate, setRate] = useState('7898');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form state
  useEffect(() => {
    if (reservation && isOpen) {
      setApplyMode('selected_date');
      const firstDate = stayDates[0]?.dmy || formatSlashedDate(reservation.checkInDate) || '13/11/2026';
      setSelectedDate(firstDate);
      setAdults(reservation.adults !== undefined ? Number(reservation.adults) : 4);
      setChildren(reservation.children !== undefined ? Number(reservation.children) : 2);
      setOverrideRate(false);

      const currentRate = Number(
        reservation.baseRatePerNight ?? reservation.rate ?? reservation.ratePerNight ?? 2500
      );
      setRate(String(currentRate));
    }
  }, [reservation, isOpen, stayDates]);

  // When selected date changes in 'selected_date' mode, load rate for that specific night if recorded
  useEffect(() => {
    if (applyMode === 'selected_date' && selectedDate && folio?.transactions) {
      const targetIso = dmyToIso(selectedDate);
      const rc = (folio.transactions || []).find(
        (t) => t.type === 'ROOM_CHARGE' && !t.isVoided && (t.date === targetIso || formatSlashedDate(t.date) === selectedDate)
      );
      if (rc && rc.amount !== undefined) {
        setRate(String(Math.abs(Number(rc.amount))));
      }
    }
  }, [selectedDate, applyMode, folio]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numRate = parseFloat(rate);
    if (isNaN(numRate) || numRate < 0) {
      alert('Please enter a valid rate amount.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        applyMode,
        selectedDate: applyMode === 'selected_date' ? selectedDate : null,
        selectedDateIso: applyMode === 'selected_date' ? dmyToIso(selectedDate) : null,
        adults: Number(adults) || 1,
        children: Number(children) || 0,
        overrideRate,
        rate: numRate,
        baseRatePerNight: numRate
      };

      if (onUpdate) {
        await onUpdate(payload);
      }
      onClose();
    } catch (err) {
      console.error('Failed to update details:', err);
      alert('Could not update details. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !reservation) return null;

  const modalElement = (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
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
        {/* Modal Header matching Screenshot */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px'
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
                justifyContent: 'center'
              }}
            >
              <Pencil size={18} color="#2563eb" />
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
                Update Details
              </h3>
              <p
                style={{
                  margin: '3px 0 0 0',
                  fontSize: '13px',
                  color: '#64748b'
                }}
              >
                Modify the per-night room rate
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

        <form onSubmit={handleSubmit}>
          {/* Radio Selection: Apply on selected date vs Apply on whole stay */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              marginBottom: '18px'
            }}
          >
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '13.5px',
                fontWeight: applyMode === 'selected_date' ? 600 : 500,
                color: applyMode === 'selected_date' ? '#0f172a' : '#475569'
              }}
            >
              <input
                type="radio"
                name="applyMode"
                value="selected_date"
                checked={applyMode === 'selected_date'}
                onChange={() => setApplyMode('selected_date')}
                style={{ accentColor: '#2563eb', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>Apply on selected date</span>
            </label>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '13.5px',
                fontWeight: applyMode === 'whole_stay' ? 600 : 500,
                color: applyMode === 'whole_stay' ? '#0f172a' : '#475569'
              }}
            >
              <input
                type="radio"
                name="applyMode"
                value="whole_stay"
                checked={applyMode === 'whole_stay'}
                onChange={() => setApplyMode('whole_stay')}
                style={{ accentColor: '#2563eb', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>Apply on whole stay</span>
            </label>
          </div>

          {/* Date Field */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#0f172a',
                marginBottom: '6px'
              }}
            >
              Date
            </label>
            <div style={{ position: 'relative' }}>
              <select
                disabled={applyMode === 'whole_stay'}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 36px 0 12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: applyMode === 'whole_stay' ? '#f8fafc' : '#ffffff',
                  color: applyMode === 'whole_stay' ? '#94a3b8' : '#0f172a',
                  cursor: applyMode === 'whole_stay' ? 'not-allowed' : 'pointer',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  outline: 'none',
                  appearance: 'none',
                  boxSizing: 'border-box'
                }}
              >
                {stayDates.map((sd) => (
                  <option key={sd.dmy} value={sd.dmy}>
                    {sd.dmy}
                  </option>
                ))}
              </select>
              <div
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  color: applyMode === 'whole_stay' ? '#cbd5e1' : '#64748b'
                }}
              >
                <ChevronDown size={16} />
              </div>
            </div>
          </div>

          {/* Pax (A/C) Field */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#0f172a',
                marginBottom: '6px'
              }}
            >
              Pax (A/C)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {/* Adults dropdown */}
              <div style={{ position: 'relative' }}>
                <select
                  value={adults}
                  onChange={(e) => setAdults(Number(e.target.value))}
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '0 36px 0 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    cursor: 'pointer',
                    fontSize: '13.5px',
                    fontWeight: 500,
                    outline: 'none',
                    appearance: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
                <div
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    color: '#64748b'
                  }}
                >
                  <ChevronDown size={16} />
                </div>
              </div>

              {/* Children dropdown */}
              <div style={{ position: 'relative' }}>
                <select
                  value={children}
                  onChange={(e) => setChildren(Number(e.target.value))}
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '0 36px 0 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    cursor: 'pointer',
                    fontSize: '13.5px',
                    fontWeight: 500,
                    outline: 'none',
                    appearance: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
                <div
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    color: '#64748b'
                  }}
                >
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>
          </div>

          {/* Override Rate Checkbox */}
          <div style={{ marginBottom: '14px' }}>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '13.5px',
                fontWeight: 500,
                color: '#334155'
              }}
            >
              <input
                type="checkbox"
                checked={overrideRate}
                onChange={(e) => setOverrideRate(e.target.checked)}
                style={{
                  width: '16px',
                  height: '16px',
                  accentColor: '#2563eb',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
              />
              <span>Override Rate</span>
            </label>
          </div>

          {/* Rate Field */}
          <div style={{ marginBottom: '22px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#0f172a',
                marginBottom: '6px'
              }}
            >
              Rate
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                overflow: 'hidden',
                height: '44px',
                backgroundColor: '#ffffff'
              }}
            >
              <div
                style={{
                  width: '52px',
                  height: '100%',
                  backgroundColor: '#f8fafc',
                  borderRight: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                  color: '#475569',
                  fontWeight: 500
                }}
              >
                ₹
              </div>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                style={{
                  flex: 1,
                  height: '100%',
                  border: 'none',
                  outline: 'none',
                  padding: '0 14px',
                  fontSize: '14.5px',
                  fontWeight: 600,
                  color: '#0f172a',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Modal Footer Buttons matching Screenshots */}
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
                height: '38px',
                padding: '0 20px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
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
              disabled={isSubmitting}
              style={{
                height: '38px',
                padding: '0 24px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 2px rgba(37, 99, 235, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              {isSubmitting ? 'Updating...' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return ReactDOM.createPortal(modalElement, document.body);
  }
  return modalElement;
}

export default UpdateDetailsModal;

