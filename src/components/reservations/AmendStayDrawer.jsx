import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import './amend-stay-drawer.css';
import { Calendar, ChevronDown, X, Check } from 'lucide-react';
import { pmsStore } from '../../services/pmsStore';
import { normalizeDateStr } from '../../services/dateUtils';
import { CustomCalendar } from '../common/CustomDatePicker';

// Helper: Convert YYYY-MM-DD to DD/MM/YYYY
function isoToDmy(isoStr) {
  if (!isoStr) return '';
  const clean = normalizeDateStr(isoStr);
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoStr;
}

// Helper: Convert DD/MM/YYYY to YYYY-MM-DD
function dmyToIso(dmyStr) {
  if (!dmyStr) return '';
  const str = String(dmyStr).trim();
  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return normalizeDateStr(dmyStr);
}

// Helper: Add days to a given YYYY-MM-DD string
function addDaysToIso(isoDateStr, days) {
  if (!isoDateStr) return '';
  const parts = isoDateStr.split('-');
  if (parts.length === 3) {
    const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    dt.setDate(dt.getDate() + Number(days));
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return isoDateStr;
}

// Helper: Calculate night difference between two YYYY-MM-DD strings
function getDiffNights(isoStart, isoEnd) {
  if (!isoStart || !isoEnd) return 1;
  const s = new Date(isoStart).getTime();
  const e = new Date(isoEnd).getTime();
  const diffDays = Math.round((e - s) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

export default function AmendStayDrawer({
  isOpen,
  onClose,
  reservation,
  rooms = [],
  roomTypes = [],
  onSave
}) {
  const [arrivalDmy, setArrivalDmy] = useState('');
  const [departureDmy, setDepartureDmy] = useState('');
  const [nights, setNights] = useState(1);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [isRoomMenuOpen, setIsRoomMenuOpen] = useState(false);
  const [isDepartureCalOpen, setIsDepartureCalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const departureWrapRef = useRef(null);
  const roomDropdownRef = useRef(null);

  // Sync state whenever reservation changes or drawer opens
  useEffect(() => {
    if (reservation && isOpen) {
      const inIso = normalizeDateStr(reservation.checkInDate) || '2026-11-13';
      const outIso = normalizeDateStr(reservation.checkOutDate) || '2026-11-17';
      const calcNights = Number(reservation.nights) || getDiffNights(inIso, outIso);

      setArrivalDmy(isoToDmy(inIso));
      setDepartureDmy(isoToDmy(outIso));
      setNights(calcNights);
      setSelectedRoomId(reservation.roomId || reservation.assignedRoomId || '');
      setIsRoomMenuOpen(false);
      setIsDepartureCalOpen(false);
    }
  }, [reservation, isOpen]);

  // Lock background scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('drawer-open', 'modal-open');
      const prevBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.classList.remove('drawer-open', 'modal-open');
        document.body.style.overflow = prevBodyOverflow;
      };
    }
  }, [isOpen]);

  // Close room dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (roomDropdownRef.current && !roomDropdownRef.current.contains(e.target)) {
        setIsRoomMenuOpen(false);
      }
    }
    if (isRoomMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isRoomMenuOpen]);

  if (!isOpen || !reservation) return null;

  // Resolve room details
  const storeRooms = rooms.length > 0 ? rooms : (pmsStore?.getState()?.rooms || []);
  const storeRoomTypes = roomTypes.length > 0 ? roomTypes : (pmsStore?.getState()?.roomTypes || []);

  const assignedRoomObj = storeRooms.find(
    (r) => r.id === selectedRoomId || r.roomNumber === reservation.roomNumber
  );

  const matchedRt = storeRoomTypes.find(
    (rt) => rt.id === (assignedRoomObj?.roomTypeId || reservation.roomTypeId)
  );

  const roomTypeLabel = matchedRt?.name || reservation.roomTypeName || 'Premium';
  const roomNumberLabel = assignedRoomObj?.roomNumber || reservation.roomNumber || '302';
  const displayRoomTag = `${roomTypeLabel} - ${roomNumberLabel}`;

  // Date Change Handlers
  const handleDepartureChange = (newDmy) => {
    setDepartureDmy(newDmy);
    const inIso = dmyToIso(arrivalDmy);
    const outIso = dmyToIso(newDmy);
    if (/^\d{4}-\d{2}-\d{2}$/.test(inIso) && /^\d{4}-\d{2}-\d{2}$/.test(outIso)) {
      const computedNights = getDiffNights(inIso, outIso);
      setNights(computedNights);
    }
  };

  const handleNightsChange = (val) => {
    const num = Math.max(1, parseInt(val, 10) || 1);
    setNights(num);
    const inIso = dmyToIso(arrivalDmy);
    if (/^\d{4}-\d{2}-\d{2}$/.test(inIso)) {
      const outIso = addDaysToIso(inIso, num);
      setDepartureDmy(isoToDmy(outIso));
    }
  };

  // Save changes
  const handleSave = async () => {
    try {
      setIsSaving(true);
      const inIso = dmyToIso(arrivalDmy);
      const outIso = dmyToIso(departureDmy);

      const payload = {
        checkInDate: inIso,
        checkOutDate: outIso,
        nights: Number(nights) || 1,
        roomId: selectedRoomId || reservation.roomId,
        roomNumber: assignedRoomObj?.roomNumber || reservation.roomNumber
      };

      if (onSave) {
        await onSave(reservation.id, payload);
      } else {
        await pmsStore.amendStay(reservation.id, payload);
      }
      onClose();
    } catch (err) {
      console.error('Failed to amend stay:', err);
      alert('Could not update stay. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const drawerContent = (
    <div className="amend-stay-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="amend-stay-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Header matching OTAL PMS Image */}
        <div className="amend-stay-header">
          <div className="amend-stay-header-left">
            <div className="amend-stay-icon-box">
              <Calendar size={20} />
            </div>
            <h2 className="amend-stay-title">Amend Stay</h2>
          </div>
          <button
            type="button"
            className="amend-stay-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Form matching image specifications */}
        <div className="amend-stay-body">
          {/* 1. Select Rooms */}
          <div className="amend-stay-field-group" ref={roomDropdownRef}>
            <label className="amend-stay-label">Select Rooms</label>
            <div
              className={`amend-stay-select-container ${isRoomMenuOpen ? 'open' : ''}`}
              onClick={() => setIsRoomMenuOpen((prev) => !prev)}
            >
              <div className="amend-stay-chips-wrap">
                <div className="amend-stay-chip">
                  <span>{displayRoomTag}</span>
                  <button
                    type="button"
                    className="amend-stay-chip-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Toggle room menu if cleared
                      setIsRoomMenuOpen(true);
                    }}
                    title="Remove room"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="amend-stay-dropdown-arrow">
                <ChevronDown size={16} />
              </div>
            </div>

            {/* Room Options Dropdown */}
            {isRoomMenuOpen && (
              <div className="amend-stay-room-menu">
                {storeRooms.map((rm) => {
                  const rt = storeRoomTypes.find((t) => t.id === rm.roomTypeId);
                  const label = `${rt?.name || 'Room'} - ${rm.roomNumber}`;
                  const isSelected = rm.id === selectedRoomId || rm.roomNumber === roomNumberLabel;

                  return (
                    <div
                      key={rm.id}
                      className={`amend-stay-room-option ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedRoomId(rm.id);
                        setIsRoomMenuOpen(false);
                      }}
                    >
                      <span>{label}</span>
                      {isSelected && <Check size={14} color="#2563eb" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Arrival : (Fixed/Read-Only: Arrival Date cannot be amended) */}
          <div className="amend-stay-field-group">
            <label className="amend-stay-label">Arrival :</label>
            <div className="amend-stay-input-wrap">
              <input
                type="text"
                className="amend-stay-input disabled"
                value={arrivalDmy}
                readOnly
                disabled
                title="Arrival date cannot be changed"
                placeholder="DD/MM/YYYY"
              />
              <button
                type="button"
                className="amend-stay-cal-btn"
                disabled
                title="Arrival date cannot be changed"
              >
                <Calendar size={18} />
              </button>
            </div>
          </div>

          {/* 3. Departure : */}
          <div className="amend-stay-field-group">
            <label className="amend-stay-label">Departure :</label>
            <div className="amend-stay-input-wrap" ref={departureWrapRef}>
              <input
                type="text"
                className="amend-stay-input"
                value={departureDmy}
                onChange={(e) => handleDepartureChange(e.target.value)}
                onClick={() => setIsDepartureCalOpen((prev) => !prev)}
                placeholder="DD/MM/YYYY"
              />
              <button
                type="button"
                className="amend-stay-cal-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDepartureCalOpen((prev) => !prev);
                }}
                title="Choose Departure Date"
              >
                <Calendar size={18} />
              </button>

              {isDepartureCalOpen && (
                <CustomCalendar
                  value={departureDmy}
                  minDate={arrivalDmy}
                  highlightDate={reservation.checkInDate || arrivalDmy}
                  outputFormat="dmy"
                  onChange={(newDmy) => {
                    handleDepartureChange(newDmy);
                    setIsDepartureCalOpen(false);
                  }}
                  onClose={() => setIsDepartureCalOpen(false)}
                />
              )}
            </div>
          </div>

          {/* 4. Nights : */}
          <div className="amend-stay-field-group">
            <label className="amend-stay-label">Nights :</label>
            <div className="amend-stay-input-wrap">
              <input
                type="number"
                min="1"
                className="amend-stay-input no-icon"
                value={nights}
                onChange={(e) => handleNightsChange(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Footer Buttons matching Image 1 & 2 */}
        <div className="amend-stay-footer">
          <button
            type="button"
            className="amend-stay-btn-cancel"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="amend-stay-btn-save"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? ReactDOM.createPortal(drawerContent, document.body)
    : drawerContent;
}
