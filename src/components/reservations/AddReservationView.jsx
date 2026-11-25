import React, { useState, useMemo, useRef, useEffect } from 'react';
import './add-reservation.css';
import {
  Home,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Moon,
  Star,
  ShieldAlert,
  Tag,
  CheckCircle2,
  DollarSign,
  Maximize2,
  Minimize2,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2
} from 'lucide-react';
import { calculateRoomTax, isDefaultTaxInclusive } from '../../services/taxEngine';
import ReservationConfirmationModal from './ReservationConfirmationModal';
import CustomTimePickerModal from '../common/CustomTimePickerModal';
import CustomDatePicker from '../common/CustomDatePicker';
import { navigate } from '../../services/router';
import { pmsStore } from '../../services/pmsStore';
import {
  normalizeDateStr,
  getTodayIsoDate,
  getNextDayIsoDate,
  getCurrentTimeString,
  doDateRangesOverlap,
  isResMatchingRoom
} from '../../services/dateUtils';

// Venus / Female Icon matching OTAL
const VenusIcon = ({ size = 15, color = '#c026d3' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="5" />
    <line x1="12" y1="13" x2="12" y2="21" />
    <line x1="9" y1="17" x2="15" y2="17" />
  </svg>
);

// Custom Pixel-Matched Calendar Icon from screenshot
const CalendarIconCustom = ({ size = 16, color = '#64748b' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2.5" />
    <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" />
    <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" />
    <line x1="3" y1="10" x2="21" y2="10" strokeWidth="1.5" />
    <rect x="7" y="13" width="2" height="2" rx="0.5" fill={color} stroke="none" />
    <rect x="11" y="13" width="2" height="2" rx="0.5" fill={color} stroke="none" />
    <rect x="15" y="13" width="2" height="2" rx="0.5" fill={color} stroke="none" />
    <rect x="7" y="17" width="2" height="2" rx="0.5" fill={color} stroke="none" />
    <rect x="11" y="17" width="2" height="2" rx="0.5" fill={color} stroke="none" />
    <rect x="15" y="17" width="2" height="2" rx="0.5" fill={color} stroke="none" />
  </svg>
);

// Custom Pixel-Matched Clock Icon from screenshot
const ClockIconCustom = ({ size = 16, color = '#1e293b' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9.5" />
    <polyline points="12 7 12 12 15.5 14" />
  </svg>
);

// Custom Down Chevron
const ChevronDownCustom = ({ size = 13, color = '#334155', isOpen = false }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// Custom Time Picker matching screenshot using CustomTimePickerModal
function CustomTimePicker({ value, onChange, label = 'Time', required = true, placement = 'left', onSetCurrentTime }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const currentTimeFallback = useMemo(() => getCurrentTimeString(), []);

  return (
    <div
      className={`custom-datetime-control ${isOpen ? 'has-open-picker' : ''}`}
      ref={containerRef}
      style={{ position: 'relative', zIndex: isOpen ? 1300 : undefined }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <label className="custom-cal-label" style={{ marginBottom: 0 }}>
          {label} {required && <span className="custom-cal-star">*</span>}
        </label>
        {onSetCurrentTime && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSetCurrentTime();
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: '0 2px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#2563eb',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              lineHeight: 1
            }}
            title="Set to Current Time"
          >
            <Clock size={11} color="#2563eb" />
            <span>Set Current Time</span>
          </button>
        )}
      </div>
      <div
        className={`custom-time-box ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: 'pointer' }}
      >
        <div className="custom-time-left">
          <ClockIconCustom />
          <span className="custom-time-text">{value || currentTimeFallback}</span>
        </div>
        <ChevronDownCustom isOpen={isOpen} />
      </div>

      <CustomTimePickerModal
        isOpen={isOpen}
        value={value || currentTimeFallback}
        onClose={() => setIsOpen(false)}
        onSave={(newTime) => {
          onChange(newTime);
          setIsOpen(false);
        }}
        label="Select time"
        placement={placement}
      />
    </div>
  );
}

// Helper to check if a room belongs to a given room type
function isMatchingRoomType(room, targetRoomTypeId) {
  if (!room || !targetRoomTypeId) return false;
  if (room.roomTypeId === targetRoomTypeId) return true;
  if (targetRoomTypeId === 'rt_standard' && (room.roomTypeId === 'rt_normal' || room.roomTypeId === 'rt_standard')) return true;
  if (targetRoomTypeId === 'rt_normal' && (room.roomTypeId === 'rt_normal' || room.roomTypeId === 'rt_standard')) return true;
  return false;
}

export default function AddReservationView({
  property = {},
  rooms = [],
  roomTypes = [],
  ratePlans = [],
  taxRules = [],
  reservations = [],
  maintenanceBlocks = [],
  initialData = null,
  onBack,
  onNavigate,
  onSubmit
}) {
  const todayStr = useMemo(() => getTodayIsoDate(), []);
  const initialCheckIn = initialData?.date || initialData?.checkInDate || todayStr;
  const initialCheckOut = initialData?.checkOutDate || getNextDayIsoDate(initialCheckIn);

  // Live subscription to pmsStore for immediate reaction to state updates
  const [storeState, setStoreState] = useState(() => pmsStore?.getState() || {});

  useEffect(() => {
    if (!pmsStore?.subscribe) return;
    const unsub = pmsStore.subscribe((newState) => {
      setStoreState(newState);
    });
    return unsub;
  }, []);

  // Live Tax Rules & Definitions from store/props
  const liveTaxRules = useMemo(() => {
    if (Array.isArray(storeState.taxRules) && storeState.taxRules.length > 0) return storeState.taxRules;
    if (Array.isArray(taxRules) && taxRules.length > 0) return taxRules;
    const storeRules = pmsStore?.getState()?.taxRules;
    if (Array.isArray(storeRules) && storeRules.length > 0) return storeRules;
    return undefined;
  }, [storeState.taxRules, taxRules]);

  const defaultInclTax = useMemo(() => isDefaultTaxInclusive(liveTaxRules), [liveTaxRules]);

  // Merge reservations from props and store
  const allReservations = useMemo(() => {
    const listProps = Array.isArray(reservations) ? reservations : [];
    const listStore = Array.isArray(storeState.reservations)
      ? storeState.reservations
      : (pmsStore?.getState()?.reservations || []);
    const map = new Map();
    [...listProps, ...listStore].forEach((r) => {
      if (r && (r.id || r.bookingReference)) {
        map.set(String(r.id || r.bookingReference), r);
      }
    });
    return Array.from(map.values());
  }, [reservations, storeState.reservations]);

  // Merge rooms from props and store (deduplicated by physical room number; live store wins)
  const allRooms = useMemo(() => {
    const listProps = Array.isArray(rooms) ? rooms : [];
    const listStore = Array.isArray(storeState.rooms)
      ? storeState.rooms
      : (pmsStore?.getState()?.rooms || []);
    const map = new Map();
    [...listProps, ...listStore].forEach((rm) => {
      if (rm && (rm.id || rm.roomNumber)) {
        const key = String(rm.roomNumber || rm.id).trim().toLowerCase().replace(/^rm_/, '');
        map.set(key, rm);
      }
    });
    return Array.from(map.values());
  }, [rooms, storeState.rooms]);

  // Merge maintenance blocks
  const allMaintenanceBlocks = useMemo(() => {
    const listProps = Array.isArray(maintenanceBlocks) ? maintenanceBlocks : [];
    const listStore = Array.isArray(storeState.maintenanceBlocks)
      ? storeState.maintenanceBlocks
      : (pmsStore?.getState()?.maintenanceBlocks || []);
    return [...listProps, ...listStore];
  }, [maintenanceBlocks, storeState.maintenanceBlocks]);

  // Stay Details State - defaults to today's date and next day
  const [checkInDate, setCheckInDate] = useState(initialCheckIn);
  const [checkInTime, setCheckInTime] = useState(() => initialData?.checkInTime || getCurrentTimeString());
  const [checkOutDate, setCheckOutDate] = useState(initialCheckOut);
  const [checkOutTime, setCheckOutTime] = useState('11:00');
  const [reservationType, setReservationType] = useState('CONFIRMED');
  const [marketSegment, setMarketSegment] = useState('corporate');
  const [bookingSource, setBookingSource] = useState('walk-in');
  const [sendConfirmationMail, setSendConfirmationMail] = useState(true);
  const [createdReservation, setCreatedReservation] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(null); // 'checkin' | 'confirm'

  // Sync dates & times when explicit initialData is passed (e.g. clicking a specific cell on calendar)
  useEffect(() => {
    if (initialData?.date || initialData?.checkInDate) {
      const inDate = initialData.date || initialData.checkInDate;
      setCheckInDate(inDate);
      setCheckOutDate(initialData.checkOutDate || getNextDayIsoDate(inDate));
    }
    if (initialData?.checkInTime) {
      setCheckInTime(initialData.checkInTime);
    } else {
      setCheckInTime(getCurrentTimeString());
    }
  }, [initialData]);

  // Remove scrollbar from page and lock scrolling when confirmation modal or loading screen is shown
  useEffect(() => {
    if (!createdReservation && !isSubmitting) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.classList.add('has-res-modal-open');

    const overlay = document.querySelector('.add-res-fullscreen-overlay');
    let originalOverlayOverflow = '';
    if (overlay) {
      originalOverlayOverflow = overlay.style.overflow;
      overlay.style.overflow = 'hidden';
      overlay.classList.add('has-modal-open');
    }

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.classList.remove('has-res-modal-open');
      if (overlay) {
        overlay.style.overflow = originalOverlayOverflow;
        overlay.classList.remove('has-modal-open');
      }
    };
  }, [createdReservation, isSubmitting]);

  const handleCheckInChange = (newDate) => {
    setCheckInDate(newDate);
    const start = new Date(newDate);
    const end = new Date(checkOutDate);
    if (end <= start) {
      setCheckOutDate(getNextDayIsoDate(newDate));
    }
  };

  const handleCheckOutChange = (newDate) => {
    const start = new Date(checkInDate);
    const end = new Date(newDate);
    if (end <= start) {
      setCheckOutDate(getNextDayIsoDate(checkInDate));
    } else {
      setCheckOutDate(newDate);
    }
  };

  // 4 Toggle Flags
  const [isVIP, setIsVIP] = useState(false);
  const [isSingleLady, setIsSingleLady] = useState(false);
  const [noPosting, setNoPosting] = useState(false);
  const [isComplimentary, setIsComplimentary] = useState(false);
  const [specialRequests, setSpecialRequests] = useState('');

  // Browser fullscreen state
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => setIsBrowserFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsBrowserFullscreen(false)).catch(() => {});
    }
  };

  // Room Configuration: Multi-room support
  const defaultRoomTypeId =
    initialData?.room?.roomTypeId ||
    roomTypes.find((rt) => rt.name.toLowerCase().includes('delux'))?.id ||
    roomTypes[0]?.id ||
    'rt_deluxe';

  const [configuredRooms, setConfiguredRooms] = useState([
    {
      id: 1,
      roomTypeId: defaultRoomTypeId,
      ratePlanCode: '',
      ratePlanName: '',
      roomId: initialData?.room?.id || '',
      roomNumber: initialData?.room?.roomNumber || '',
      roomsCount: 1,
      adults: 1,
      children: 2,
      rate: ''
    }
  ]);

  const [activeDropdown, setActiveDropdown] = useState(null); // `${rm.id}-roomType` | `${rm.id}-ratePlan` | `${rm.id}-roomNo`

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        !e.target.closest('.room-config-dropdown-container') &&
        !e.target.closest('.add-res-custom-dropdown-container')
      ) {
        setActiveDropdown(null);
      }
    }
    if (activeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeDropdown]);

  const getRoomTypeRatesFromPlan = (rp, roomTypeId) => {
    if (!rp || !rp.roomTypeRates || typeof rp.roomTypeRates !== 'object') return null;
    if (rp.roomTypeRates[roomTypeId]) return rp.roomTypeRates[roomTypeId];
    if (roomTypeId === 'rt_standard' && rp.roomTypeRates.rt_normal) return rp.roomTypeRates.rt_normal;
    if (roomTypeId === 'rt_normal' && rp.roomTypeRates.rt_standard) return rp.roomTypeRates.rt_standard;
    const currentRt = roomTypes.find((t) => t.id === roomTypeId);
    if (currentRt) {
      const rtNameLower = currentRt.name.trim().toLowerCase();
      for (const [key, val] of Object.entries(rp.roomTypeRates)) {
        const matchedRt = roomTypes.find((t) => t.id === key);
        if (matchedRt && matchedRt.name.trim().toLowerCase() === rtNameLower) {
          return val;
        }
      }
    }
    return null;
  };

  const isRoomTypeActiveInRatePlan = (rp, roomTypeId) => {
    if (!rp) return false;
    if (rp.status && rp.status !== 'ACTIVE') return false;
    const rates = getRoomTypeRatesFromPlan(rp, roomTypeId);
    return rates?.active === true;
  };

  const handleSelectRoomType = (rmId, rt) => {
    setConfiguredRooms((prev) =>
      prev.map((r) => {
        if (r.id !== rmId) return r;

        let updatedRatePlanCode = r.ratePlanCode;
        let updatedRatePlanName = r.ratePlanName;
        let updatedRate = '';

        if (r.ratePlanCode) {
          const rp = ratePlans.find((p) => p.code === r.ratePlanCode || p.id === r.ratePlanCode);
          if (rp && isRoomTypeActiveInRatePlan(rp, rt.id)) {
            const rtRates = getRoomTypeRatesFromPlan(rp, rt.id);
            updatedRate = rtRates?.basePrice || rp.basePrice || rt.basePrice || '';
          } else {
            // Not active for this new room type: clear rate plan
            updatedRatePlanCode = '';
            updatedRatePlanName = '';
            updatedRate = '';
          }
        }

        const firstAvail = allRooms.find(
          (rmItem) => isMatchingRoomType(rmItem, rt.id) && isRoomAvailableForRow(rmItem, rmId)
        );

        return {
          ...r,
          roomTypeId: rt.id,
          roomId: firstAvail ? firstAvail.id : '',
          roomNumber: firstAvail ? firstAvail.roomNumber : '',
          ratePlanCode: updatedRatePlanCode,
          ratePlanName: updatedRatePlanName,
          adults: rt.baseAdults || 1,
          children: rt.baseChildren ?? 0,
          rate: updatedRate
        };
      })
    );
    setActiveDropdown(null);
  };

  const handleSelectRatePlan = (rmId, rp) => {
    setConfiguredRooms((prev) =>
      prev.map((r) => {
        if (r.id !== rmId) return r;
        const rtRates = getRoomTypeRatesFromPlan(rp, r.roomTypeId);
        const autoRate = rtRates?.basePrice || rp.basePrice || '';

        return {
          ...r,
          ratePlanCode: rp.code,
          ratePlanName: rp.name,
          rate: autoRate && autoRate > 0 ? autoRate : r.rate
        };
      })
    );
    setActiveDropdown(null);
  };

  // Room availability check: Exclude any room that is booked or occupied for the reservation dates,
  // in maintenance, or already chosen in another row of this multi-room configuration
  const isRoomAvailableForRow = (room, forRowId) => {
    if (!room || !room.id) return false;

    const thisRoomNum = String(room.roomNumber || room.id).trim().toLowerCase().replace(/^rm_/, '');

    // 1. Prevent selecting the exact same room across different rows in this form
    const isSelectedInOtherRow = configuredRooms.some((other) => {
      if (other.id === forRowId) return false;
      if (!other.roomId || other.roomId === 'unassigned') return false;
      const otherNum = String(other.roomNumber || other.roomId).trim().toLowerCase().replace(/^rm_/, '');
      if (otherNum === thisRoomNum) return true;
      return isResMatchingRoom({ roomId: other.roomId, roomNumber: other.roomId }, room);
    });
    if (isSelectedInOtherRow) return false;

    // 2. Exclude rooms under maintenance or out of order
    if (
      room.status === 'maintenance' ||
      room.operational === 'maintenance' ||
      room.operational === 'out_of_order'
    ) {
      return false;
    }

    const reqIn = normalizeDateStr(checkInDate);
    const reqOut = normalizeDateStr(checkOutDate);

    // 3. Exclude rooms with active maintenance blocks overlapping stay dates
    const hasConflictingBlock = allMaintenanceBlocks.some((mb) => {
      if (!mb) return false;
      const mbStatus = String(mb.status || '').toLowerCase();
      if (mbStatus === 'cancelled' || mbStatus === 'completed' || mbStatus === 'released') return false;
      const match = isResMatchingRoom({ roomId: mb.roomId, roomNumber: mb.roomNumber }, room);
      if (!match) return false;
      const mbStart = normalizeDateStr(mb.startDate);
      const mbEnd = normalizeDateStr(mb.endDate || mb.startDate);
      if (!mbStart || !mbEnd) return false;
      return reqIn <= mbEnd && reqOut > mbStart;
    });
    if (hasConflictingBlock) return false;

    const isInactiveResStatus = (statusVal) => {
      const s = String(statusVal || '').toLowerCase().replace(/[\s-]+/g, '_');
      return (
        s === 'cancelled' ||
        s === 'canceled' ||
        s === 'no_show' ||
        s === 'noshow' ||
        s === 'checked_out' ||
        s === 'checkedout' ||
        s === 'departed'
      );
    };

    // 4. Exclude rooms currently held by an active in-house guest whose stay overlaps requested dates
    if (
      room.operational === 'occupied' ||
      room.status === 'occupied'
    ) {
      const holdingRes = room.currentReservationId
        ? allReservations.find(
            (r) =>
              r.id === room.currentReservationId ||
              r.bookingReference === room.currentReservationId
          )
        : allReservations.find((r) => {
            const st = String(r?.status || '').toLowerCase().replace(/[\s-]+/g, '_');
            return (st === 'in_house' || st === 'checked_in') && isResMatchingRoom(r, room);
          });

      if (holdingRes && !isInactiveResStatus(holdingRes.status)) {
        const hIn = normalizeDateStr(holdingRes.checkInDate);
        const hOut = normalizeDateStr(holdingRes.checkOutDate);
        const today = getTodayIsoDate();
        const effectiveHOut = hOut < today ? getNextDayIsoDate(today) : hOut;
        if (doDateRangesOverlap(reqIn, reqOut, hIn, effectiveHOut)) {
          return false;
        }
      }
    }

    // 5. Exclude rooms with conflicting active bookings in the system (ignore checked-out, cancelled, no-show)
    const hasConflictingRes = allReservations.some((res) => {
      if (!res) return false;
      const statusNorm = String(res.status || '').toLowerCase().replace(/[\s-]+/g, '_');
      if (isInactiveResStatus(statusNorm)) return false;

      // Check if this reservation is for this room
      if (!isResMatchingRoom(res, room)) return false;

      const resIn = normalizeDateStr(res.checkInDate);
      const resOut = normalizeDateStr(res.checkOutDate);

      if (statusNorm === 'in_house' || statusNorm === 'checked_in') {
        const today = getTodayIsoDate();
        const effectiveResOut = resOut < today ? getNextDayIsoDate(today) : resOut;
        return doDateRangesOverlap(reqIn, reqOut, resIn, effectiveResOut);
      }

      return doDateRangesOverlap(reqIn, reqOut, resIn, resOut);
    });
    if (hasConflictingRes) return false;

    return true;
  };

  // Auto-sanitize configured rooms if stay dates change or if an assigned room is no longer available
  useEffect(() => {
    setConfiguredRooms((prev) =>
      prev.map((rm) => {
        if (!rm.roomId || rm.roomId === 'unassigned') {
          const avail = allRooms.find(
            (r) => isMatchingRoomType(r, rm.roomTypeId) && isRoomAvailableForRow(r, rm.id)
          );
          if (avail) {
            return { ...rm, roomId: avail.id, roomNumber: avail.roomNumber };
          }
          return { ...rm, roomId: '', roomNumber: '' };
        }
        const targetRoom = allRooms.find((r) =>
          isResMatchingRoom({ roomId: rm.roomId, roomNumber: rm.roomId }, r)
        );
        if (!targetRoom || !isRoomAvailableForRow(targetRoom, rm.id)) {
          const fallback = allRooms.find(
            (r) => isMatchingRoomType(r, rm.roomTypeId) && isRoomAvailableForRow(r, rm.id)
          );
          return {
            ...rm,
            roomId: fallback ? fallback.id : '',
            roomNumber: fallback ? fallback.roomNumber : ''
          };
        }
        return rm;
      })
    );
  }, [checkInDate, checkOutDate, allReservations, allMaintenanceBlocks, allRooms]);

  const handleSelectRoomNo = (rmId, roomIdVal) => {
    if (!roomIdVal || roomIdVal === 'unassigned') {
      setConfiguredRooms((prev) =>
        prev.map((r) => (r.id === rmId ? { ...r, roomId: '', roomNumber: '' } : r))
      );
      setActiveDropdown(null);
      return;
    }
    const selectedObj = allRooms.find((r) => r.id === roomIdVal || r.roomNumber === roomIdVal);
    const selNum = String(selectedObj?.roomNumber || roomIdVal).trim().toLowerCase().replace(/^rm_/, '');
    const selectedRt = selectedObj
      ? roomTypes.find((rt) => rt.id === selectedObj.roomTypeId || rt.name?.toLowerCase() === String(selectedObj.roomTypeId).toLowerCase())
      : null;

    setConfiguredRooms((prev) =>
      prev.map((r) => {
        if (r.id === rmId) {
          return {
            ...r,
            roomId: roomIdVal,
            roomNumber: selectedObj?.roomNumber || roomIdVal,
            roomTypeId: selectedObj?.roomTypeId || r.roomTypeId,
            roomTypeName: selectedRt?.name || r.roomTypeName
          };
        }
        // If another row already had this room assigned, clear it to avoid duplicate room assignment
        const rNum = String(r.roomNumber || r.roomId).trim().toLowerCase().replace(/^rm_/, '');
        if (
          rNum === selNum ||
          isResMatchingRoom(
            { roomId: r.roomId, roomNumber: r.roomId },
            selectedObj || { id: roomIdVal, roomNumber: roomIdVal }
          )
        ) {
          return { ...r, roomId: '', roomNumber: '' };
        }
        return r;
      })
    );
    setActiveDropdown(null);
  };

  const handleSelectAdults = (rmId, count) => {
    setConfiguredRooms((prev) =>
      prev.map((r) => (r.id === rmId ? { ...r, adults: count } : r))
    );
    setActiveDropdown(null);
  };

  const handleSelectChildren = (rmId, count) => {
    setConfiguredRooms((prev) =>
      prev.map((r) => (r.id === rmId ? { ...r, children: count } : r))
    );
    setActiveDropdown(null);
  };

  const handleAddRoomRow = () => {
    const defaultRt = roomTypes.find((rt) => rt.id === defaultRoomTypeId) || roomTypes[0];
    const nextId = (configuredRooms.reduce((max, r) => Math.max(max, r.id), 0) || 0) + 1;
    const firstAvail = allRooms.find(
      (r) => defaultRt && isMatchingRoomType(r, defaultRt.id) && isRoomAvailableForRow(r, nextId)
    );
    setConfiguredRooms((prev) => [
      ...prev,
      {
        id: nextId,
        roomTypeId: defaultRt?.id || defaultRoomTypeId,
        ratePlanCode: '',
        ratePlanName: '',
        roomId: firstAvail ? firstAvail.id : '',
        roomNumber: firstAvail ? firstAvail.roomNumber : '',
        roomsCount: 1,
        adults: defaultRt?.baseAdults || 1,
        children: defaultRt?.baseChildren ?? 0,
        rate: ''
      }
    ]);
  };

  const handleRemoveRoomRow = (id) => {
    setConfiguredRooms((prev) => {
      if (prev.length <= 1) {
        const defaultRt = roomTypes.find((rt) => rt.id === defaultRoomTypeId) || roomTypes[0];
        const firstAvail = allRooms.find(
          (r) => defaultRt && isMatchingRoomType(r, defaultRt.id) && isRoomAvailableForRow(r, 1)
        );
        return [
          {
            id: 1,
            roomTypeId: defaultRt?.id || defaultRoomTypeId,
            ratePlanCode: '',
            ratePlanName: '',
            roomId: firstAvail ? firstAvail.id : '',
            roomNumber: firstAvail ? firstAvail.roomNumber : '',
            roomsCount: 1,
            adults: defaultRt?.baseAdults || 1,
            children: defaultRt?.baseChildren ?? 0,
            rate: ''
          }
        ];
      }
      return prev.filter((r) => r.id !== id);
    });
  };

  const handleUpdateRoomRow = (id, fieldOrPatch, maybeValue) => {
    setConfiguredRooms((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (typeof fieldOrPatch === 'object') {
          return { ...r, ...fieldOrPatch };
        }
        return { ...r, [fieldOrPatch]: maybeValue };
      })
    );
  };

  // Guest Details State
  const [guestTitle, setGuestTitle] = useState('Mr.');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [email, setEmail] = useState('');
  const [nationality, setNationality] = useState('Indian');
  const [idType, setIdType] = useState('Aadhaar Card');
  const [idNumber, setIdNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [zip, setZip] = useState('');

  // Billing & Advance Payment State
  const [taxExempt, setTaxExempt] = useState(false);
  const [billTo, setBillTo] = useState('Guest');
  const [company, setCompany] = useState('');
  const [guestGstin, setGuestGstin] = useState('');
  const [collectAdvance, setCollectAdvance] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [paymentReference, setPaymentReference] = useState('');

  // Calculations: Nights
  const nights = useMemo(() => {
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }, [checkInDate, checkOutDate]);

  // Formatted display dates
  const formatDisplayDate = (dStr) => {
    if (!dStr) return '';
    const parts = String(dStr).split('-');
    if (parts.length === 3) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const y = parts[0];
      return `${d} ${months[mIdx] || ''} ${y}`;
    }
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const checkInFormatted = formatDisplayDate(checkInDate);
  const checkOutFormatted = formatDisplayDate(checkOutDate);

  // Financial calculations (driven dynamically by active Tax Rules & Definitions)
  const financialSummary = useMemo(() => {
    let roomBaseTotal = 0;
    let taxesTotal = 0;
    let grossTotalSum = 0;
    const splitsMap = new Map();

    configuredRooms.forEach((r) => {
      const rowInclTax = typeof r.inclTax === 'boolean' ? r.inclTax : defaultInclTax;
      const calc = calculateRoomTax(Number(r.rate) || 0, nights, {
        isComplimentary,
        isTaxExempt: taxExempt,
        isTaxInclusive: rowInclTax,
        taxRules: liveTaxRules
      });
      roomBaseTotal += calc.taxableAmount;
      taxesTotal += calc.totalTax;
      grossTotalSum += calc.grossTotal;

      (calc.splitsBreakdown || []).forEach((sp) => {
        const key = `${sp.name}_${sp.rate}`;
        const prev = splitsMap.get(key) || { name: sp.name, rate: sp.rate, sharePct: sp.sharePct, amount: 0 };
        prev.amount = Math.round((prev.amount + sp.amount) * 100) / 100;
        splitsMap.set(key, prev);
      });
    });

    return {
      totalRoomCharges: Math.round(roomBaseTotal * 100) / 100,
      totalTaxes: Math.round(taxesTotal * 100) / 100,
      grandTotal: isComplimentary ? 0 : Math.round(grossTotalSum * 100) / 100,
      splitsSummary: Array.from(splitsMap.values())
    };
  }, [configuredRooms, nights, taxExempt, isComplimentary, defaultInclTax, liveTaxRules]);

  const { totalRoomCharges, totalTaxes, grandTotal, splitsSummary } = financialSummary;
  const advanceVal = collectAdvance ? Number(advanceAmount) || 0 : 0;
  const balanceDue = Math.max(0, Math.round((grandTotal - advanceVal) * 100) / 100);

  // Check if all configured rooms are specifically assigned to an available room
  const isRoomAssignedAndAvailable = useMemo(() => {
    if (!configuredRooms || configuredRooms.length === 0) return false;
    return configuredRooms.every((cr) => {
      if (!cr.roomId || cr.roomId === 'unassigned') return false;
      const targetRoom = allRooms.find((r) =>
        isResMatchingRoom({ roomId: cr.roomId, roomNumber: cr.roomId }, r)
      );
      if (!targetRoom) return false;
      return isRoomAvailableForRow(targetRoom, cr.id);
    });
  }, [configuredRooms, allRooms, isRoomAvailableForRow]);

  // Handle Form Submit (Supports 'in_house' direct check-in or 'confirmed')
  const handleConfirmBooking = async (e, overrideStatus = null) => {
    e?.preventDefault();
    if (isSubmitting) return; // Prevent double-clicks / repeated submissions

    if (!firstName.trim()) {
      alert('Please enter guest First Name');
      return;
    }
    if (!phone.trim()) {
      alert('Please enter guest Phone Number');
      return;
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      alert('Phone must be 10-15 digits');
      return;
    }
    if (!email.trim()) {
      alert('Please enter guest Email Address');
      return;
    }

    if (overrideStatus === 'in_house' && !isRoomAssignedAndAvailable) {
      alert('Please assign an available room in Room Configuration to check-in directly.');
      return;
    }

    if (collectAdvance && advanceVal > 0 && !paymentMode) {
      alert('Please select a Payment Method for the advance payment.');
      return;
    }

    const primaryRoom = configuredRooms[0] || {};
    const fullGuestName = `${guestTitle} ${firstName.trim()} ${lastName.trim()}`.trim();
    const targetStatus = overrideStatus || (reservationType ? reservationType.toLowerCase() : 'confirmed');

    const primaryAssignedRm = allRooms.find((r) => isResMatchingRoom({ roomId: primaryRoom.roomId, roomNumber: primaryRoom.roomId }, r));
    const effectiveRtId = primaryAssignedRm?.roomTypeId || primaryRoom.roomTypeId;
    const matchedRtObj = roomTypes.find((rt) => rt.id === effectiveRtId || rt.name?.toLowerCase() === String(effectiveRtId).toLowerCase());
    const primaryRoomTypeName = matchedRtObj?.name || primaryRoom.roomTypeName || 'Normal';

    const bookingPayload = {
      guestName: fullGuestName,
      guestPhone: `${countryCode} ${phone.trim()}`,
      guestEmail: email.trim(),
      nationality,
      checkInDate,
      checkOutDate,
      checkInTime: checkInTime || getCurrentTimeString(),
      actualCheckInTime: targetStatus === 'in_house' ? (checkInTime || getCurrentTimeString()) : undefined,
      arrivalTime: checkInTime || getCurrentTimeString(),
      checkedInAt: targetStatus === 'in_house' ? new Date().toISOString() : undefined,
      checkOutTime,
      nights,
      roomsCount: configuredRooms.length || 1,
      roomId: primaryRoom.roomId === 'unassigned' ? '' : primaryRoom.roomId,
      roomNumber: primaryRoom.roomId && primaryRoom.roomId !== 'unassigned'
        ? (primaryAssignedRm?.roomNumber || '')
        : '',
      roomTypeId: effectiveRtId,
      roomTypeName: primaryRoomTypeName,
      ratePlanCode: primaryRoom.ratePlanCode || 'BAR_EP',
      baseRatePerNight: Number(primaryRoom.rate) || 2500,
      isTaxInclusive: typeof primaryRoom.inclTax === 'boolean' ? primaryRoom.inclTax : defaultInclTax,
      totalRoomCharges,
      taxAmount: totalTaxes,
      totalAmount: grandTotal,
      paidAmount: advanceVal,
      balanceDue,
      adults: Number(primaryRoom.adults) || 1,
      children: Number(primaryRoom.children) || 0,
      configuredRooms: configuredRooms.map((cr) => {
        const rowRm = allRooms.find((r) => isResMatchingRoom({ roomId: cr.roomId, roomNumber: cr.roomId }, r));
        const rowRtId = rowRm?.roomTypeId || cr.roomTypeId;
        const rowRt = roomTypes.find((rt) => rt.id === rowRtId || rt.name?.toLowerCase() === String(rowRtId).toLowerCase());
        return {
          roomId: cr.roomId === 'unassigned' ? '' : cr.roomId,
          roomNumber: cr.roomId && cr.roomId !== 'unassigned'
            ? (rowRm?.roomNumber || '')
            : '',
          roomTypeId: rowRtId,
          roomTypeName: rowRt?.name || cr.roomTypeName || 'Normal',
          ratePlanCode: cr.ratePlanCode,
          rate: Number(cr.rate) || 0,
          inclTax: typeof cr.inclTax === 'boolean' ? cr.inclTax : defaultInclTax,
          adults: cr.adults,
          children: cr.children
        };
      }),
      status: targetStatus,
      billTo: billTo || 'Guest',
      company: company || '',
      guestGstin: guestGstin || '',
      bookingSource: bookingSource.toUpperCase().replace('-', '_'),
      marketSegment: marketSegment || 'corporate',
      isVIP,
      isSingleLady,
      noPosting,
      isComplimentary,
      isTaxExempt: taxExempt,
      specialRequests: specialRequests || '',
      notes: specialRequests || '',
      sendConfirmationMail: !!sendConfirmationMail,
      advanceAmount: advanceVal,
      paymentMethod: paymentMode,
      paymentReference: paymentReference || 'Direct',
      primaryGuest: {
        name: fullGuestName,
        title: guestTitle,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        countryCode,
        email: email.trim(),
        gstin: guestGstin.trim(),
        company: company || '',
        nationality,
        idType,
        idNumber: idNumber.trim(),
        address: address.trim(),
        city: city.trim(),
        state: stateName.trim(),
        zip: zip.trim()
      }
    };

    setIsSubmitting(true);
    setSubmittingAction(overrideStatus === 'in_house' ? 'checkin' : 'confirm');

    try {
      if (onSubmit) {
        const res = await onSubmit(bookingPayload);
        if (res) {
          setCreatedReservation(res);
        }
      }
    } catch (err) {
      console.error('[AddReservationView] Booking submission error:', err);
      alert(err?.message || 'Failed to process booking. Please try again.');
    } finally {
      setIsSubmitting(false);
      setSubmittingAction(null);
    }
  };

  return (
    <div className="add-res-page" style={{ padding: 0 }}>
      {/* Header Banner - Exact OTAL PMS Specification */}
      <header className="max-[1370px]:h-12 h-14 border-b border-gray-100 bg-white flex items-center justify-between max-[1370px]:px-4 px-4 shrink-0 otal-add-res-header">
        <div className="flex items-center gap-2 small-title-4 font-medium otal-header-breadcrumbs">
          <span className="material-symbols-outlined select-none text-gray-500 otal-header-crumb-home" style={{ fontSize: '18px' }}>home</span>
          <span
            className="text-gray-600 otal-header-crumb-pms"
            onClick={() => onNavigate ? onNavigate('dashboard') : onBack ? onBack() : null}
            style={{ cursor: 'pointer' }}
          >
            PMS
          </span>
          <span className="material-symbols-outlined select-none text-gray-400 otal-header-crumb-chevron" style={{ fontSize: '16px' }}>chevron_right</span>
          <span
            className="transition-colors text-gray-600 hover:text-[#3B82F6] cursor-pointer otal-header-crumb-link"
            onClick={() => onNavigate ? onNavigate('reservations') : onBack ? onBack() : null}
          >
            Reservations
          </span>
          <span className="material-symbols-outlined select-none text-gray-400 otal-header-crumb-chevron" style={{ fontSize: '16px' }}>chevron_right</span>
          <span className="transition-colors text-gray-900 font-bold otal-header-crumb-active">Add Reservation</span>
        </div>
        <div className="flex-1 max-w-md px-8 otal-header-spacer" />
        <div className="flex items-center gap-3 otal-header-actions" />
      </header>

      {/* Main page content wrapper */}
      <div className="add-res-content-wrap">
        {/* 2. Main 2-Column Grid */}
        <div className="add-res-layout">
        {/* Left Form Column */}
        <div className="add-res-form-column">
          {/* Card 1: Stay Details */}
          <div className="add-res-card">
            <div className="add-res-card-header">
              <div>
                <h2 className="add-res-card-title">Stay Details</h2>
                <p className="add-res-card-subtitle">Basic details for your reservation stay.</p>
              </div>
            </div>

            {/* Check-in / Night / Check-out Row */}
            <div className="add-res-dates-row">
              <CustomDatePicker
                label="Check-in"
                required={true}
                value={checkInDate}
                onChange={handleCheckInChange}
              />

              <CustomTimePicker
                label="Check-in Time"
                required={true}
                value={checkInTime}
                onChange={(t) => setCheckInTime(t)}
                onSetCurrentTime={() => setCheckInTime(getCurrentTimeString())}
                placement="left"
              />

              <div className="add-res-night-pill-center">
                <Moon size={14} />
                <span>{nights} {nights === 1 ? 'Night' : 'Nights'}</span>
              </div>

              <CustomDatePicker
                label="Check-out"
                required={true}
                value={checkOutDate}
                onChange={handleCheckOutChange}
              />

              <CustomTimePicker
                label="Time"
                required={true}
                value={checkOutTime}
                onChange={(t) => setCheckOutTime(t)}
                placement="right"
              />
            </div>

            {/* Reservation Type & Market Segment */}
            <div className="add-res-grid-2">
              <div className="add-res-field-group">
                <label className="add-res-field-label">
                  Reservation Type <span className="add-res-required">*</span>
                </label>
                <select
                  className="add-res-select"
                  value="CONFIRMED"
                  disabled
                  style={{
                    backgroundColor: '#f8fafc',
                    color: '#0f172a',
                    cursor: 'not-allowed',
                    opacity: 0.95
                  }}
                  title="Reservation Type is fixed as CONFIRMED and cannot be changed"
                >
                  <option value="CONFIRMED">CONFIRMED</option>
                </select>
              </div>

              <div className="add-res-field-group">
                <label className="add-res-field-label">
                  Market Segment <span className="add-res-required">*</span>
                </label>
                <select
                  className="add-res-select"
                  value={marketSegment}
                  onChange={(e) => setMarketSegment(e.target.value)}
                >
                  <option value="corporate">corporate</option>
                  <option value="fit">fit</option>
                  <option value="group">group</option>
                  <option value="marriage/social">marriage/social</option>
                  <option value="mice">mice</option>
                  <option value="ota">ota</option>
                </select>
              </div>
            </div>

            {/* Booking Source */}
            <div className="add-res-field-group" style={{ marginBottom: '1.25rem' }}>
              <label className="add-res-field-label">
                Booking Source <span className="add-res-required">*</span>
              </label>
              <select
                className="add-res-select"
                value={bookingSource}
                onChange={(e) => setBookingSource(e.target.value)}
              >
                <option value="walk-in">walk-in</option>
                <option value="Direct Phone">Direct Phone</option>
                <option value="Website">Website</option>
                <option value="Booking.com">Booking.com</option>
                <option value="MakeMyTrip">MakeMyTrip</option>
                <option value="Agoda">Agoda</option>
                <option value="Airbnb">Airbnb</option>
              </select>
            </div>

            {/* 4 Colored Toggle Badges */}
            <div className="add-res-toggles-row">
              {/* VIP */}
              <div
                className={`toggle-pill-card vip ${isVIP ? 'active' : ''}`}
                onClick={() => setIsVIP(!isVIP)}
              >
                <div className="toggle-pill-left">
                  <Star size={16} color="#d97706" />
                  <span>Is VIP</span>
                </div>
                <div className={`toggle-switch-track ${isVIP ? 'on-amber' : ''}`}>
                  <div className="toggle-switch-thumb" />
                </div>
              </div>

              {/* Single Lady */}
              <div
                className={`toggle-pill-card lady ${isSingleLady ? 'active' : ''}`}
                onClick={() => setIsSingleLady(!isSingleLady)}
              >
                <div className="toggle-pill-left">
                  <VenusIcon size={16} color="#c026d3" />
                  <span>Single Lady</span>
                </div>
                <div className={`toggle-switch-track ${isSingleLady ? 'on-pink' : ''}`}>
                  <div className="toggle-switch-thumb" />
                </div>
              </div>

              {/* No Posting */}
              <div
                className={`toggle-pill-card nopost ${noPosting ? 'active' : ''}`}
                onClick={() => setNoPosting(!noPosting)}
              >
                <div className="toggle-pill-left">
                  <span className="material-symbols-outlined select-none" style={{ fontSize: '16px' }}>
                    block
                  </span>
                  <span>No Posting</span>
                </div>
                <div className={`toggle-switch-track ${noPosting ? 'on-rose' : ''}`}>
                  <div className="toggle-switch-thumb" />
                </div>
              </div>

              {/* Complimentary */}
              <div
                className={`toggle-pill-card comp ${isComplimentary ? 'active' : ''}`}
                onClick={() => setIsComplimentary(!isComplimentary)}
              >
                <div className="toggle-pill-left">
                  <Tag size={16} color="#16a34a" />
                  <span>Complimentary</span>
                </div>
                <div className={`toggle-switch-track ${isComplimentary ? 'on-emerald' : ''}`}>
                  <div className="toggle-switch-thumb" />
                </div>
              </div>
            </div>

            {/* Special Requests */}
            <div className="add-res-field-group">
              <label className="add-res-field-label">Special Requests</label>
              <textarea
                className="add-res-textarea"
                placeholder="e.g. Extra bed, late check in..."
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
              />
            </div>
          </div>

          {/* Card 2: Room Configuration (Matching User Screenshots) */}
          <div className="add-res-card" style={{ overflow: 'visible' }}>
            <div className="add-res-card-header">
              <div>
                <h2 className="add-res-card-title">Room Configuration</h2>
                <p className="add-res-card-subtitle">Configure room details, guest occupancy, and applicable rates.</p>
              </div>
              <button
                type="button"
                className="btn-add-room-outline"
                onClick={handleAddRoomRow}
              >
                <Plus size={15} />
                <span>Add More Room</span>
              </button>
            </div>

            <div style={{ overflow: 'visible', width: '100%' }}>
              <table className="room-config-table">
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>
                      Room Type <span className="required-star">*</span>
                    </th>
                    <th style={{ width: '20%' }}>
                      Rate Plan <span className="required-star">*</span>
                    </th>
                    <th style={{ width: '9%', textAlign: 'center' }}>
                      Rooms
                    </th>
                    <th style={{ width: '18%' }}>
                      Room No
                    </th>
                    <th style={{ width: '16%', textAlign: 'center' }}>
                      Guests (A / C)
                    </th>
                    <th style={{ width: '11%' }}>
                      Rate (₹)
                    </th>
                    <th style={{ width: '4%', textAlign: 'center' }} />
                  </tr>
                </thead>
                <tbody>
                  {configuredRooms.map((rm) => {
                    const currentRoomType = roomTypes.find((rt) => rt.id === rm.roomTypeId);
                    const matchingRooms = allRooms.filter(
                      (r) => isMatchingRoomType(r, rm.roomTypeId) && isRoomAvailableForRow(r, rm.id)
                    );
                    const selectedRoom = (rm.roomId && rm.roomId !== 'unassigned')
                      ? allRooms.find((r) =>
                          isResMatchingRoom({ roomId: rm.roomId, roomNumber: rm.roomId }, r)
                        )
                      : null;
                    const selectedRatePlan = ratePlans.find((rp) => rp.code === rm.ratePlanCode || rp.id === rm.ratePlanCode);
                    const availableRatePlans = ratePlans.filter((rp) => isRoomTypeActiveInRatePlan(rp, rm.roomTypeId));

                    // Occupancy options based on room type
                    const maxAdultsCount = currentRoomType?.maxAdults || 4;
                    const maxChildrenCount = currentRoomType?.maxChildren ?? 2;
                    const adultOptions = Array.from({ length: maxAdultsCount }, (_, i) => i + 1);
                    const childOptions = Array.from({ length: maxChildrenCount + 1 }, (_, i) => i);

                    return (
                      <tr key={rm.id}>
                        {/* 1. Room Type */}
                        <td>
                          <div className="room-config-dropdown-container" style={{ position: 'relative' }}>
                            <button
                              type="button"
                              className="room-config-select-btn"
                              onClick={() => setActiveDropdown(activeDropdown === `${rm.id}-roomType` ? null : `${rm.id}-roomType`)}
                            >
                              <span>{currentRoomType?.name || 'Delux Room'}</span>
                              {activeDropdown === `${rm.id}-roomType` ? (
                                <ChevronUp size={15} color="#475569" />
                              ) : (
                                <ChevronDown size={15} color="#475569" />
                              )}
                            </button>

                            {activeDropdown === `${rm.id}-roomType` && (
                              <div className="room-config-popover" style={{ top: 'calc(100% + 4px)', left: 0 }}>
                                {roomTypes.map((rt) => (
                                  <div
                                    key={rt.id}
                                    className="room-config-popover-item"
                                    onClick={() => handleSelectRoomType(rm.id, rt)}
                                  >
                                    <span style={{ fontWeight: rt.id === rm.roomTypeId ? 600 : 400 }}>{rt.name}</span>
                                    {rt.id === rm.roomTypeId && <Check size={14} color="#2563EB" />}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 2. Rate Plan (Filtered by Room Type Activation) */}
                        <td>
                          <div className="room-config-dropdown-container" style={{ position: 'relative' }}>
                            <button
                              type="button"
                              className="room-config-select-btn"
                              onClick={() => setActiveDropdown(activeDropdown === `${rm.id}-ratePlan` ? null : `${rm.id}-ratePlan`)}
                            >
                              <span style={{ color: rm.ratePlanName || selectedRatePlan?.name ? '#0F172A' : '#64748B' }}>
                                {rm.ratePlanName || selectedRatePlan?.name || 'Select Type'}
                              </span>
                              {activeDropdown === `${rm.id}-ratePlan` ? (
                                <ChevronUp size={15} color="#475569" />
                              ) : (
                                <ChevronDown size={15} color="#475569" />
                              )}
                            </button>

                            {activeDropdown === `${rm.id}-ratePlan` && (
                              <div className="room-config-popover" style={{ top: 'calc(100% + 4px)', left: 0, minWidth: '150px' }}>
                                {availableRatePlans.length > 0 ? (
                                  availableRatePlans.map((rp) => {
                                    const isSelected = rm.ratePlanCode === rp.code || rm.ratePlanName === rp.name;
                                    return (
                                      <div
                                        key={rp.id || rp.code}
                                        className="room-config-popover-item"
                                        onClick={() => handleSelectRatePlan(rm.id, rp)}
                                      >
                                        <span style={{ fontWeight: isSelected ? 600 : 400 }}>
                                          {rp.name}
                                        </span>
                                        {isSelected && <Check size={14} color="#2563EB" />}
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="room-config-popover-item" style={{ color: '#94a3b8', cursor: 'default' }}>
                                    <span>No active rate plans</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 3. Rooms (Aligned Center - Fixed to 1 / Non-changeable) */}
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="text"
                            readOnly
                            disabled
                            className="room-config-rooms-input"
                            value="1"
                            title="Rooms count is fixed to 1 and cannot be changed"
                            style={{
                              backgroundColor: '#f8fafc',
                              color: '#0f172a',
                              cursor: 'not-allowed',
                              userSelect: 'none'
                            }}
                          />
                        </td>

                        {/* 4. Room No (Matching Image 2 - Opens Upward with Checkmark) */}
                        <td>
                          <div className="room-config-dropdown-container" style={{ position: 'relative' }}>
                            <button
                              type="button"
                              className="room-config-select-btn"
                              onClick={() => setActiveDropdown(activeDropdown === `${rm.id}-roomNo` ? null : `${rm.id}-roomNo`)}
                            >
                              <span>
                                {selectedRoom
                                  ? selectedRoom.roomNumber
                                  : rm.roomId && rm.roomId !== 'unassigned'
                                  ? rm.roomId
                                  : 'Select Room'}
                              </span>
                              {activeDropdown === `${rm.id}-roomNo` ? (
                                <ChevronUp size={15} color="#475569" />
                              ) : (
                                <ChevronDown size={15} color="#475569" />
                              )}
                            </button>

                            {activeDropdown === `${rm.id}-roomNo` && (
                              <div className="room-config-popover" style={{ bottom: 'calc(100% + 4px)', left: 0, minWidth: '150px' }}>
                                {/* Available Rooms of Selected Room Type */}
                                {matchingRooms.length > 0 ? (
                                  matchingRooms.map((r) => {
                                    const isSelected = rm.roomId === r.id;
                                    return (
                                      <div
                                        key={r.id}
                                        className="room-config-popover-item"
                                        onClick={() => handleSelectRoomNo(rm.id, r.id)}
                                      >
                                        <span style={{ fontWeight: isSelected ? 600 : 400 }}>{r.roomNumber}</span>
                                        {isSelected && <Check size={14} color="#2563EB" />}
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div
                                    className="room-config-popover-item"
                                    style={{ color: '#94a3b8', cursor: 'default', fontSize: '0.82rem', padding: '8px 12px' }}
                                  >
                                    <span>No available rooms</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 5. Guests (A / C) (Aligned Center & Custom Popover matching Image 2) */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '8px', margin: '0 auto' }}>
                            {/* Adults */}
                            <div className="room-config-dropdown-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                              <button
                                type="button"
                                className="room-config-mini-btn"
                                onClick={() => setActiveDropdown(activeDropdown === `${rm.id}-adults` ? null : `${rm.id}-adults`)}
                              >
                                <span>{rm.adults}</span>
                                {activeDropdown === `${rm.id}-adults` ? (
                                  <ChevronUp size={13} color="#64748B" />
                                ) : (
                                  <ChevronDown size={13} color="#64748B" />
                                )}
                              </button>
                              <span className="room-config-sublabel">Adults</span>

                              {activeDropdown === `${rm.id}-adults` && (
                                <div
                                  className="room-config-popover room-config-mini-popover"
                                  style={{ top: '46px', left: '50%', transform: 'translateX(-50%)' }}
                                >
                                  {adultOptions.map((num) => {
                                    const isSelected = rm.adults === num;
                                    return (
                                      <div
                                        key={num}
                                        className="room-config-popover-item room-config-mini-popover-item"
                                        onClick={() => handleSelectAdults(rm.id, num)}
                                      >
                                        <span style={{ fontWeight: isSelected ? 600 : 400 }}>{num}</span>
                                        {isSelected && <Check size={13} color="#2563EB" />}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Children */}
                            <div className="room-config-dropdown-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                              <button
                                type="button"
                                className="room-config-mini-btn"
                                onClick={() => setActiveDropdown(activeDropdown === `${rm.id}-children` ? null : `${rm.id}-children`)}
                              >
                                <span>{rm.children}</span>
                                {activeDropdown === `${rm.id}-children` ? (
                                  <ChevronUp size={13} color="#64748B" />
                                ) : (
                                  <ChevronDown size={13} color="#64748B" />
                                )}
                              </button>
                              <span className="room-config-sublabel">Children</span>

                              {activeDropdown === `${rm.id}-children` && (
                                <div
                                  className="room-config-popover room-config-mini-popover"
                                  style={{ top: '46px', left: '50%', transform: 'translateX(-50%)' }}
                                >
                                  {childOptions.map((num) => {
                                    const isSelected = rm.children === num;
                                    return (
                                      <div
                                        key={num}
                                        className="room-config-popover-item room-config-mini-popover-item"
                                        onClick={() => handleSelectChildren(rm.id, num)}
                                      >
                                        <span style={{ fontWeight: isSelected ? 600 : 400 }}>{num}</span>
                                        {isSelected && <Check size={13} color="#2563EB" />}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 6. Rate (₹) with Incl. tax toggle & live slab tax preview */}
                        <td>
                          {(() => {
                            const isRowInclTax =
                              typeof rm.inclTax === 'boolean' ? rm.inclTax : defaultInclTax;
                            const rowRateNum = Number(rm.rate) || 0;
                            const rowTaxPreview = calculateRoomTax(rowRateNum, 1, {
                              isComplimentary,
                              isTaxExempt: taxExempt,
                              isTaxInclusive: isRowInclTax,
                              taxRules: liveTaxRules
                            });
                            const taxRateTag =
                              rowTaxPreview.calculationMode === 'fixed' &&
                              rowTaxPreview.fixedTaxPerNight > 0
                                ? `₹${rowTaxPreview.fixedTaxPerNight}`
                                : `${rowTaxPreview.gstRate}%`;
                            return (
                              <div className="room-config-rate-cell">
                                <input
                                  type="number"
                                  className="room-config-rate-input"
                                  placeholder="Enter amount"
                                  value={rm.rate}
                                  onChange={(e) => handleUpdateRoomRow(rm.id, 'rate', e.target.value)}
                                />
                                <label className="room-config-incl-tax-label">
                                  <input
                                    type="checkbox"
                                    checked={isRowInclTax}
                                    onChange={(e) =>
                                      handleUpdateRoomRow(rm.id, 'inclTax', e.target.checked)
                                    }
                                  />
                                  <span>Incl. tax</span>
                                </label>
                                {rowRateNum > 0 && (
                                  <div className="room-config-tax-hint">
                                    Tax ({taxRateTag}): {rowTaxPreview.totalTax.toFixed(2)} | Total{' '}
                                    {rowTaxPreview.grossTotal.toFixed(2)}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* 7. Action (Red Trash Bin) */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="room-config-trash-btn"
                            onClick={() => handleRemoveRoomRow(rm.id)}
                            title="Remove Room"
                          >
                            <Trash2 size={16} color="#EF4444" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 3: Guest Information (Matching User Screenshot) */}
          <div className="guest-info-card">
            <h2 className="guest-info-title">Guest Information</h2>
            <p className="guest-info-subtitle">
              Please provide the primary guest's contact and identification details for this reservation.
            </p>

            <div className="guest-info-room-badge">
              Room 1
            </div>

            {/* Row 1: Title, First Name, Last Name */}
            <div className="guest-info-row-1">
              <div className="add-res-field-group">
                <label className="guest-field-label">Title</label>
                <div className="guest-select-wrapper">
                  <select
                    className="guest-select"
                    value={guestTitle}
                    onChange={(e) => setGuestTitle(e.target.value)}
                  >
                    <option value="Mr.">Mr.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Ms.">Ms.</option>
                    <option value="Dr.">Dr.</option>
                  </select>
                  <ChevronDown size={14} className="guest-select-arrow" />
                </div>
              </div>

              <div className="add-res-field-group">
                <label className="guest-field-label">
                  First Name <span className="guest-required">*</span>
                </label>
                <input
                  type="text"
                  className="guest-input"
                  placeholder="Enter first name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>

              <div className="add-res-field-group">
                <label className="guest-field-label">Last Name</label>
                <input
                  type="text"
                  className="guest-input"
                  placeholder="Enter last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            {/* Row 2: Phone Number, Email Address */}
            <div className="guest-info-row-2">
              <div className="add-res-field-group">
                <label className="guest-field-label">
                  Phone Number <span className="guest-required">*</span>
                </label>
                <div className="guest-phone-group">
                  <div className="guest-phone-prefix">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                    >
                      <option value="+91">+91</option>
                      <option value="+1">+1</option>
                      <option value="+44">+44</option>
                      <option value="+971">+971</option>
                    </select>
                    <ChevronDown
                      size={12}
                      color="#64748B"
                      style={{ position: 'absolute', right: '6px', pointerEvents: 'none' }}
                    />
                  </div>
                  <input
                    type="tel"
                    className="guest-phone-input"
                    placeholder="Enter phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                {phone.trim().length > 0 && (phone.replace(/\D/g, '').length < 10 || phone.replace(/\D/g, '').length > 15) && (
                  <div className="guest-phone-error-msg">
                    Phone must be 10-15 digits
                  </div>
                )}
              </div>

              <div className="add-res-field-group">
                <label className="guest-field-label">
                  Email Address <span className="guest-required">*</span>
                </label>
                <input
                  type="email"
                  className="guest-input"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Sticky Column: Billing Summary */}
        <div className="add-res-billing-card">
          <div className="add-res-billing-header">
            <h3 className="add-res-billing-title">Billing Summary</h3>
            <button
              type="button"
              className="btn-billing-top-confirm"
              onClick={(e) => handleConfirmBooking(e, 'confirmed')}
            >
              Confirm Booking
            </button>
          </div>

          {/* Dates Bar */}
          <div className="add-res-billing-dates">
            <div className="billing-date-block">
              <span className="billing-date-label">Check-in</span>
              <span className="billing-date-val">{checkInFormatted}</span>
            </div>

            <div className="billing-night-pill">
              <Moon size={13} />
              <span>{nights} {nights === 1 ? 'Night' : 'Nights'}</span>
            </div>

            <div className="billing-date-block" style={{ textAlign: 'right' }}>
              <span className="billing-date-label">Check-out</span>
              <span className="billing-date-val">{checkOutFormatted}</span>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="billing-line-row">
            <span>Room Charges</span>
            <span style={{ fontWeight: 600 }}>₹{totalRoomCharges.toFixed(2)}</span>
          </div>

          <div className="billing-line-row">
            <span>Taxes</span>
            <span style={{ fontWeight: 600 }}>₹{totalTaxes.toFixed(2)}</span>
          </div>

          {totalTaxes > 0 && splitsSummary.length > 0 && (
            <div className="billing-tax-splits-list">
              {splitsSummary.map((sp, idx) => (
                <div key={`${sp.name}_${idx}`} className="billing-tax-split-row">
                  <span>
                    {sp.name} ({sp.rate > 0 ? `${sp.rate}%` : `${sp.sharePct}%`})
                  </span>
                  <span>₹{sp.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          <label className="billing-tax-exempt-row">
            <input
              type="checkbox"
              checked={taxExempt}
              onChange={(e) => setTaxExempt(e.target.checked)}
            />
            <span>Tax Exempt</span>
          </label>

          <label className="billing-tax-exempt-row" style={{ marginTop: '4px' }}>
            <input
              type="checkbox"
              checked={sendConfirmationMail}
              onChange={(e) => setSendConfirmationMail(e.target.checked)}
            />
            <span>Send Confirmation Mail</span>
          </label>

          <div className="billing-divider" />

          <div className="billing-line-row bold">
            <span>Grand Total</span>
            <span style={{ fontSize: '1.05rem', color: '#0f172a' }}>₹{grandTotal.toFixed(2)}</span>
          </div>

          <div className="billing-line-row bold" style={{ color: balanceDue > 0 ? '#ef4444' : '#059669' }}>
            <span>Balance Due</span>
            <span style={{ fontSize: '1.05rem' }}>₹{balanceDue.toFixed(2)}</span>
          </div>

          {/* Bill To matching Image 1 */}
          <div className="add-res-billto-row">
            <span className="add-res-billto-label">Bill To</span>
            <div className="add-res-custom-dropdown-container">
              <button
                type="button"
                className={`add-res-custom-select-btn ${activeDropdown === 'billTo' ? 'open' : ''}`}
                onClick={() => setActiveDropdown(activeDropdown === 'billTo' ? null : 'billTo')}
              >
                <span>{billTo || 'Guest'}</span>
                {activeDropdown === 'billTo' ? (
                  <ChevronUp size={15} color="#475569" />
                ) : (
                  <ChevronDown size={15} color="#475569" />
                )}
              </button>

              {activeDropdown === 'billTo' && (
                <div className="add-res-custom-popover">
                  <div
                    className={`add-res-custom-popover-item ${billTo === 'Guest' ? 'selected' : ''}`}
                    onClick={() => {
                      setBillTo('Guest');
                      setActiveDropdown(null);
                    }}
                  >
                    <span>Guest</span>
                    {billTo === 'Guest' && <Check size={15} color="#3b82f6" strokeWidth={2.5} />}
                  </div>
                  <div
                    className={`add-res-custom-popover-item ${billTo === 'Company' ? 'selected' : ''}`}
                    onClick={() => {
                      setBillTo('Company');
                      setActiveDropdown(null);
                    }}
                  >
                    <span>Company</span>
                    {billTo === 'Company' && <Check size={15} color="#3b82f6" strokeWidth={2.5} />}
                  </div>
                </div>
              )}
            </div>
          </div>

          {billTo === 'Company' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              <div className="add-res-billto-row">
                <span className="add-res-billto-label">Company</span>
                <select
                  className="add-res-input"
                  style={{ fontSize: '13px', padding: '6px 10px', height: '34px' }}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                >
                  <option value="">Select Company</option>
                  <option value="tcs">Tata Consultancy Services</option>
                  <option value="infosys">Infosys Limited</option>
                </select>
              </div>
              <div className="add-res-billto-row">
                <span className="add-res-billto-label">Guest GSTIN</span>
                <input
                  type="text"
                  className="add-res-input"
                  style={{ fontSize: '13px', padding: '6px 10px', height: '34px' }}
                  placeholder="Enter Guest GSTIN"
                  value={guestGstin}
                  onChange={(e) => setGuestGstin(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Advance Payment Card */}
          <div className="add-res-advance-box">
            <div className="add-res-advance-header">
              <div>
                <h4 className="advance-box-title">Collect Advance Payment</h4>
                <p className="advance-box-sub">Record a payment at reservation creation</p>
              </div>
              <div
                className={`toggle-switch-track ${collectAdvance ? 'on' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setCollectAdvance(!collectAdvance)}
              >
                <div className="toggle-switch-thumb" />
              </div>
            </div>

            {collectAdvance && (
              <div className="advance-fields-dropdown">
                <div className="add-res-field-group">
                  <label className="add-res-field-label">Advance Amount (₹)</label>
                  <input
                    type="number"
                    className="add-res-input"
                    placeholder="e.g. 2500"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(e.target.value)}
                  />
                </div>

                {/* Payment Method matching Image 2 */}
                <div className="add-res-field-group">
                  <label className="add-res-field-label">
                    Payment Method <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div className="add-res-custom-dropdown-container">
                    <button
                      type="button"
                      className={`add-res-custom-select-btn ${activeDropdown === 'paymentMethod' ? 'open' : ''}`}
                      onClick={() => setActiveDropdown(activeDropdown === 'paymentMethod' ? null : 'paymentMethod')}
                    >
                      <span style={!paymentMode ? { color: '#94a3b8', fontWeight: 400 } : undefined}>
                        {paymentMode || 'Select Payment Mode'}
                      </span>
                      {activeDropdown === 'paymentMethod' ? (
                        <ChevronUp size={15} color="#475569" />
                      ) : (
                        <ChevronDown size={15} color="#475569" />
                      )}
                    </button>

                    {activeDropdown === 'paymentMethod' && (
                      <div className="add-res-custom-popover">
                        {['CARD', 'CASH', 'UPI', 'BANK', 'TDS'].map((method) => {
                          const isSelected = paymentMode === method;
                          return (
                            <div
                              key={method}
                              className={`add-res-custom-popover-item ${isSelected ? 'selected' : ''}`}
                              onClick={() => {
                                setPaymentMode(method);
                                setActiveDropdown(null);
                              }}
                            >
                              <span>{method}</span>
                              {isSelected && <Check size={15} color="#3b82f6" strokeWidth={2.5} />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="add-res-field-group">
                  <label className="add-res-field-label">Reference / Note</label>
                  <input
                    type="text"
                    className="add-res-input"
                    placeholder="e.g. UPI Ref / Receipt No"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Total Amount */}
          <div className="billing-total-row">
            <span className="billing-total-label">Total Amount</span>
            <span className="billing-total-amount">INR {grandTotal.toFixed(2)}</span>
          </div>

          {/* Send Confirmation Mail Checkbox */}
          <label className="billing-confirmation-checkbox-wrap">
            <input
              type="checkbox"
              checked={sendConfirmationMail}
              onChange={(e) => setSendConfirmationMail(e.target.checked)}
            />
            <span>Send Confirmation Mail</span>
          </label>

          {/* Dual Action Buttons: Check-In & Confirm Booking */}
          <div className="add-res-billing-actions">
            <button
              type="button"
              className={`btn-billing-checkin ${isRoomAssignedAndAvailable ? 'active' : 'disabled'} ${isSubmitting && submittingAction === 'checkin' ? 'loading' : ''}`}
              onClick={(e) => handleConfirmBooking(e, 'in_house')}
              disabled={isSubmitting || !isRoomAssignedAndAvailable}
              title={
                isRoomAssignedAndAvailable
                  ? 'Direct Check-In (In-House)'
                  : 'Assign an available room to enable Check-In'
              }
            >
              {isSubmitting && submittingAction === 'checkin' ? (
                <>
                  <Loader2 size={16} className="animate-spin" style={{ marginRight: '6px' }} />
                  Checking In...
                </>
              ) : (
                'Check-In'
              )}
            </button>
            <button
              type="button"
              className={`btn-billing-confirm-outline ${isSubmitting && submittingAction === 'confirm' ? 'loading' : ''}`}
              onClick={(e) => handleConfirmBooking(e, 'confirmed')}
              disabled={isSubmitting}
            >
              {isSubmitting && submittingAction === 'confirm' ? (
                <>
                  <Loader2 size={16} className="animate-spin" style={{ marginRight: '6px' }} />
                  Confirming...
                </>
              ) : (
                'Confirm Booking'
              )}
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Reservation Confirmation Pop-up with Reservation Number & Summary Card (Step 1.7) */}
      {createdReservation && (
        <ReservationConfirmationModal
          isOpen={!!createdReservation}
          reservation={createdReservation}
          onClose={() => {
            const target = createdReservation;
            const targetId = target?.id || (target?.bookingReference ? target.bookingReference.replace('#', '').toLowerCase() : 'res_1');
            setCreatedReservation(null);
            navigate(`/reservations/${targetId}/edit`);
          }}
          onViewBookingDetails={(res) => {
            const target = res || createdReservation;
            const targetId = target?.id || (target?.bookingReference ? target.bookingReference.replace('#', '').toLowerCase() : 'res_1');
            setCreatedReservation(null);
            navigate(`/reservations/${targetId}/edit`);
          }}
        />
      )}

      {/* Full-Screen Loading Screen / Double-Click Shield */}
      {isSubmitting && (
        <div className="add-res-loading-backdrop" aria-busy="true" aria-live="assertive">
          <div className="add-res-loading-card">
            <div className={`add-res-loading-icon-wrap ${submittingAction === 'confirm' ? 'confirm-mode' : ''}`}>
              <Loader2 size={34} className="animate-spin" />
            </div>
            <div className="add-res-loading-title">
              {submittingAction === 'checkin' ? 'Checking In Guest...' : 'Confirming Reservation...'}
            </div>
            <div className="add-res-loading-sub">
              {submittingAction === 'checkin'
                ? 'Allocating room, updating live occupancy and generating guest folio. Please wait...'
                : 'Securing dates, calculating taxes and generating reservation reference. Please wait...'}
            </div>
            <div className="add-res-loading-bar-wrap">
              <div className={`add-res-loading-bar-fill ${submittingAction === 'confirm' ? 'confirm-mode' : ''}`} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
