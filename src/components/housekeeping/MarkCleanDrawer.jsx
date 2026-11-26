import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, User, Clock, ChevronDown } from 'lucide-react';
import SweepingBroomIcon from './SweepingBroomIcon';
import CustomDatePicker from '../common/CustomDatePicker';
import { getTodayIsoDate, getCurrentTimeString } from '../../services/dateUtils';
import './block-room-drawer.css';

function formatTime12h(hhmm) {
  if (!hhmm || !hhmm.includes(':')) return hhmm || '';
  const [hStr, mStr] = hhmm.split(':');
  let h = parseInt(hStr, 10);
  if (isNaN(h)) return hhmm;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mStr} ${ampm}`;
}

export default function MarkCleanDrawer({
  isOpen,
  onClose,
  rooms = [],
  roomTypes = [],
  onConfirmClean
}) {
  const bodyRef = useRef(null);
  const cleanerInputRef = useRef(null);

  const [cleanerName, setCleanerName] = useState('');
  const [cleanedDate, setCleanedDate] = useState(() => getTodayIsoDate());
  const [cleanedTime, setCleanedTime] = useState(() => getCurrentTimeString());
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCleanerName('');
      setCleanedDate(getTodayIsoDate());
      setCleanedTime(getCurrentTimeString());
      setNotes('');
      setErrorMsg('');

      document.body.classList.add('drawer-open', 'modal-open');
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      if (bodyRef.current) bodyRef.current.scrollTop = 0;
      setTimeout(() => {
        if (cleanerInputRef.current) cleanerInputRef.current.focus();
      }, 120);

      return () => {
        document.body.classList.remove('drawer-open', 'modal-open');
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen || !rooms || rooms.length === 0) return null;

  const primaryRoom = rooms[0];
  const matchedRt = roomTypes.find((rt) => rt.id === primaryRoom?.roomTypeId);
  const roomTypeDisplay =
    primaryRoom?.roomTypeName ||
    primaryRoom?.roomType ||
    matchedRt?.name ||
    'Room';

  const roomDisplay =
    rooms.length === 1
      ? `${roomTypeDisplay} ${String(primaryRoom?.roomNumber || primaryRoom?.id || '').replace(/^rm_/, '')}`
      : `${rooms.map((r) => String(r.roomNumber || r.id).replace(/^rm_/, '')).join(', ')} (${rooms.length} Rooms)`;

  const handleClear = () => {
    setCleanerName('');
    setCleanedDate(getTodayIsoDate());
    setCleanedTime(getCurrentTimeString());
    setNotes('');
    setErrorMsg('');
  };

  const handleDone = (e) => {
    if (e) e.preventDefault();
    const trimmedName = cleanerName.trim();
    if (!trimmedName) {
      setErrorMsg('Please enter the cleaner name.');
      if (cleanerInputRef.current) cleanerInputRef.current.focus();
      return;
    }
    if (!cleanedTime) {
      setErrorMsg('Please select the cleaning time.');
      return;
    }

    const formattedTime = formatTime12h(cleanedTime);
    if (onConfirmClean) {
      onConfirmClean({
        rooms,
        cleanedBy: trimmedName,
        cleanedDate: cleanedDate || getTodayIsoDate(),
        cleanedTime,
        cleanedTimeFormatted: formattedTime,
        notes: notes.trim()
      });
    }
    onClose();
  };

  const drawerElement = (
    <div className="block-room-backdrop" onClick={onClose} aria-hidden="true">
      <div
        className="block-room-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="mark-clean-heading"
      >
        {/* 1. Drawer Header */}
        <div className="block-room-header">
          <div className="block-room-header-left">
            <div
              className="block-room-icon-badge"
              style={{
                backgroundColor: '#ecfdf5',
                borderColor: '#a7f3d0',
                color: '#059669'
              }}
            >
              <SweepingBroomIcon size={20} />
            </div>
            <h2 id="mark-clean-heading" className="block-room-title">
              Mark Room Clean
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="block-room-close-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* 2. Form Body */}
        <form onSubmit={handleDone} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="block-room-body" ref={bodyRef}>
            {/* Row 1: Room Type (Readonly) */}
            <div className="block-room-field-wrap">
              <label className="block-room-label">Room Type</label>
              <div
                className="block-room-input-box readonly"
                style={{ cursor: 'default' }}
              >
                <span className="block-room-input-text">
                  {rooms.length === 1 ? roomTypeDisplay : 'Multiple Room Types'}
                </span>
                <ChevronDown
                  size={16}
                  className="block-room-input-icon"
                  style={{ opacity: 0.55 }}
                />
              </div>
            </div>

            {/* Row 2: Room (Readonly) */}
            <div className="block-room-field-wrap">
              <label className="block-room-label">Room</label>
              <div
                className="block-room-input-box readonly"
                style={{ cursor: 'default' }}
              >
                <span className="block-room-input-text">{roomDisplay}</span>
                <ChevronDown
                  size={16}
                  className="block-room-input-icon"
                  style={{ opacity: 0.55 }}
                />
              </div>
            </div>

            {/* Row 3: Cleaner Name * */}
            <div className="block-room-field-wrap">
              <label className="block-room-label" htmlFor="hk-cleaner-name">
                Cleaned By (Cleaner Name) <span className="block-room-required-star">*</span>
              </label>
              <div className="block-room-input-box" style={{ paddingRight: '0.75rem' }}>
                <input
                  id="hk-cleaner-name"
                  ref={cleanerInputRef}
                  type="text"
                  value={cleanerName}
                  onChange={(e) => {
                    setCleanerName(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Enter cleaner name (e.g. Ramesh Kumar)"
                  style={{
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    width: '100%',
                    fontSize: '0.88rem',
                    fontWeight: 500,
                    color: '#0f172a'
                  }}
                />
                <User size={16} className="block-room-input-icon" />
              </div>
            </div>

            {/* Row 4: Cleaning Date & Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="block-room-field-wrap">
                <label className="block-room-label">
                  Cleaning Date
                </label>
                <CustomDatePicker
                  value={cleanedDate}
                  onChange={(val) => setCleanedDate(val)}
                  outputFormat="iso"
                  displayFormat="dmy"
                  highlightDate={getTodayIsoDate()}
                  placeholder="DD/MM/YYYY"
                />
              </div>

              <div className="block-room-field-wrap">
                <label className="block-room-label" htmlFor="hk-cleaned-time">
                  Cleaning Time <span className="block-room-required-star">*</span>
                </label>
                <div className="block-room-input-box" style={{ paddingRight: '0.75rem' }}>
                  <input
                    id="hk-cleaned-time"
                    type="time"
                    value={cleanedTime}
                    onChange={(e) => {
                      setCleanedTime(e.target.value);
                      if (errorMsg) setErrorMsg('');
                    }}
                    style={{
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      width: '100%',
                      fontSize: '0.88rem',
                      fontWeight: 500,
                      color: '#0f172a'
                    }}
                  />
                  <Clock size={16} className="block-room-input-icon" style={{ pointerEvents: 'none' }} />
                </div>
              </div>
            </div>

            {/* Row 5: Optional Remarks */}
            <div className="block-room-field-wrap">
              <label className="block-room-label" htmlFor="hk-cleaning-notes">
                Remarks (Optional)
              </label>
              <div className="block-room-input-box" style={{ height: 'auto', padding: '0.65rem 0.9rem' }}>
                <textarea
                  id="hk-cleaning-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Linen changed, bathroom sanitized..."
                  style={{
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    width: '100%',
                    resize: 'none',
                    fontSize: '0.86rem',
                    fontWeight: 500,
                    color: '#0f172a',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>

            {errorMsg && (
              <div
                style={{
                  padding: '0.65rem 0.9rem',
                  borderRadius: '8px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  fontSize: '0.82rem',
                  fontWeight: 600
                }}
              >
                {errorMsg}
              </div>
            )}
          </div>

          {/* 3. Footer Strip */}
          <div className="block-room-footer">
            <button
              type="button"
              onClick={handleClear}
              className="block-room-btn-clear"
            >
              Clear
            </button>

            <button
              type="submit"
              className="block-room-btn-apply"
              style={{
                backgroundColor: cleanerName.trim() ? '#059669' : '#93c5fd',
                opacity: cleanerName.trim() ? 1 : 0.85
              }}
            >
              Done
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? ReactDOM.createPortal(drawerElement, document.body)
    : drawerElement;
}
