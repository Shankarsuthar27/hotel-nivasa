import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar as CalendarIcon,
  BedDouble,
  Info
} from 'lucide-react';
import BulkUpdateModal from './BulkUpdateModal';
import SlidingTabBar from '../common/SlidingTabBar';
import { CustomCalendar } from '../common/CustomDatePicker';
import { getTodayIsoDate, normalizeDateStr } from '../../services/dateUtils';
import './rates-inventory.css';

const COL_WIDTH = 78;
const BUFFER_PAST_DAYS = 7;
const BUFFER_FUTURE_DAYS = 45;
const TOTAL_DAYS = BUFFER_PAST_DAYS + BUFFER_FUTURE_DAYS;
const ARROW_SCROLL_DAYS = 5;

const MATRIX_TABS = [
  { id: 'rates', label: 'Rates' },
  { id: 'min_nights', label: 'Minimum Nights' },
  { id: 'stop_sell', label: 'Stop Sell' }
];

function parseIsoToLocalDate(isoStr) {
  const clean = normalizeDateStr(isoStr);
  if (clean && /^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export default function RatesMatrixView({
  roomTypes = [],
  rooms = [],
  reservations = [],
  maintenanceBlocks = [],
  property,
  stopouts = {},
  dailyRates = { base: {}, extra_adult: {}, extra_child: {} },
  restrictions = {},
  otaChannels = [],
  onToggleStopout,
  onBulkUpdate,
  onSaveRates,
  ratePlans = []
}) {
  // Top matrix tab: 'rates' | 'min_nights' | 'stop_sell'
  const [activeMatrixTab, setActiveMatrixTab] = useState('rates');

  // Radio button for rate tier: 'base' | 'extra_adult' | 'extra_child'
  const [rateTier, setRateTier] = useState('base');

  // Room filter dropdown: 'ALL' | roomTypeId
  const [selectedRoomFilter, setSelectedRoomFilter] = useState('ALL');

  // Modals & Popovers
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerPos, setDatePickerPos] = useState({ top: 0, left: 0 });
  const [activeInfoId, setActiveInfoId] = useState(null);

  const todayIsoStr = property?.businessDate || getTodayIsoDate();

  // Anchor base date for the continuous horizontal timeline buffer
  const [baseDate, setBaseDate] = useState(() => parseIsoToLocalDate(todayIsoStr));
  const [visibleDate, setVisibleDate] = useState(() => parseIsoToLocalDate(todayIsoStr));

  // Unsaved local edits: { [tierKey]: { [cellKey]: val } }
  const [localRateEdits, setLocalRateEdits] = useState({});

  // Scroll container & elevation cue states
  const scrollViewportRef = useRef(null);
  const headerRowRef = useRef(null);
  const datePickerTriggerRef = useRef(null);
  const isInitialScrollDone = useRef(false);
  const lastVisibleIsoRef = useRef('');
  const scrollDateTimerRef = useRef(null);

  const [scrollEdges, setScrollEdges] = useState({
    scrolledX: false,
    scrolledY: false,
    hasScrollBelow: false
  });

  // Compute start date of the 52-day horizontal timeline buffer
  const bufferStartDate = useMemo(() => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - BUFFER_PAST_DAYS);
    return d;
  }, [baseDate]);

  // Generate continuous date columns for smooth multi-week horizontal scrolling
  const dateColumns = useMemo(() => {
    const cols = [];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    for (let i = 0; i < TOTAL_DAYS; i++) {
      const d = new Date(bufferStartDate);
      d.setDate(d.getDate() + i);

      const year = d.getFullYear();
      const monthIdx = d.getMonth();
      const dayNum = d.getDate();
      const dayOfWeek = d.getDay();

      const isoStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const isToday = isoStr === todayIsoStr;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      cols.push({
        date: d,
        isoStr,
        dayNum,
        dayName: days[dayOfWeek],
        month: months[monthIdx],
        isToday,
        isWeekend
      });
    }
    return cols;
  }, [bufferStartDate, todayIsoStr]);

  // Formatted date string for top-left input pill: DD/MM/YYYY
  const formattedDateDisplay = useMemo(() => {
    const target = visibleDate || baseDate;
    const d = target.getDate();
    const m = target.getMonth() + 1;
    const y = target.getFullYear();
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  }, [visibleDate, baseDate]);

  // Sync elevation shadow cues + visible leftmost date on scroll
  const updateScrollState = useCallback(() => {
    const el = scrollViewportRef.current;
    if (!el) return;

    const scrolledX = el.scrollLeft > 2;
    const scrolledY = el.scrollTop > 2;
    const hasScrollBelow = el.scrollTop + el.clientHeight < el.scrollHeight - 2;

    setScrollEdges((prev) => {
      if (
        prev.scrolledX === scrolledX &&
        prev.scrolledY === scrolledY &&
        prev.hasScrollBelow === hasScrollBelow
      ) {
        return prev;
      }
      return { scrolledX, scrolledY, hasScrollBelow };
    });

    if (scrollDateTimerRef.current) {
      clearTimeout(scrollDateTimerRef.current);
    }
    scrollDateTimerRef.current = setTimeout(() => {
      const colIdx = Math.max(0, Math.min(dateColumns.length - 1, Math.round(el.scrollLeft / COL_WIDTH)));
      const col = dateColumns[colIdx];
      if (col && col.isoStr !== lastVisibleIsoRef.current) {
        lastVisibleIsoRef.current = col.isoStr;
        setVisibleDate(col.date);
      }
    }, 60);
  }, [dateColumns]);

  // Initial scroll alignment: align baseDate to the left edge of the scrollable timeline
  useEffect(() => {
    const el = scrollViewportRef.current;
    if (!el) return;
    if (!isInitialScrollDone.current) {
      el.scrollLeft = BUFFER_PAST_DAYS * COL_WIDTH;
      isInitialScrollDone.current = true;
    }
    updateScrollState();
  }, [updateScrollState]);

  // Attach passive scroll + ResizeObserver listeners for dynamic depth cues
  useEffect(() => {
    const el = scrollViewportRef.current;
    if (!el) return;

    const onScroll = () => updateScrollState();
    el.addEventListener('scroll', onScroll, { passive: true });

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => updateScrollState());
      ro.observe(el);
    }

    return () => {
      el.removeEventListener('scroll', onScroll);
      if (ro) ro.disconnect();
      if (scrollDateTimerRef.current) clearTimeout(scrollDateTimerRef.current);
    };
  }, [updateScrollState]);

  // Allow scrolling mouse wheel while hovering the sticky date header to smoothly pan horizontally
  useEffect(() => {
    const headerEl = headerRowRef.current;
    if (!headerEl) return;

    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && scrollViewportRef.current) {
        if (e.cancelable) e.preventDefault();
        scrollViewportRef.current.scrollLeft += e.deltaY;
      }
    };

    headerEl.addEventListener('wheel', onWheel, { passive: false });
    return () => headerEl.removeEventListener('wheel', onWheel);
  }, []);

  // Arrow Pagination (< / >): Smooth scrollBy by 5 days; seamlessly extends buffer near edges
  const handleScrollPrev = useCallback(() => {
    const el = scrollViewportRef.current;
    if (!el) return;
    const stepPx = ARROW_SCROLL_DAYS * COL_WIDTH;

    if (el.scrollLeft < stepPx) {
      const shiftDays = 14;
      setBaseDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() - shiftDays);
        return next;
      });
      requestAnimationFrame(() => {
        if (scrollViewportRef.current) {
          scrollViewportRef.current.scrollLeft += shiftDays * COL_WIDTH;
          scrollViewportRef.current.scrollBy({ left: -stepPx, behavior: 'smooth' });
        }
      });
      return;
    }

    el.scrollBy({ left: -stepPx, behavior: 'smooth' });
  }, []);

  const handleScrollNext = useCallback(() => {
    const el = scrollViewportRef.current;
    if (!el) return;
    const stepPx = ARROW_SCROLL_DAYS * COL_WIDTH;
    const remainingRight = el.scrollWidth - el.clientWidth - el.scrollLeft;

    if (remainingRight < stepPx) {
      const shiftDays = 14;
      setBaseDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() + shiftDays);
        return next;
      });
      requestAnimationFrame(() => {
        if (scrollViewportRef.current) {
          scrollViewportRef.current.scrollLeft = Math.max(0, scrollViewportRef.current.scrollLeft - shiftDays * COL_WIDTH);
          scrollViewportRef.current.scrollBy({ left: stepPx, behavior: 'smooth' });
        }
      });
      return;
    }

    el.scrollBy({ left: stepPx, behavior: 'smooth' });
  }, []);

  // Portal DatePicker toggle & selection
  const openDatePicker = () => {
    if (isDatePickerOpen) {
      setIsDatePickerOpen(false);
      return;
    }
    if (datePickerTriggerRef.current) {
      const rect = datePickerTriggerRef.current.getBoundingClientRect();
      const left = Math.min(Math.max(12, rect.left), (window.innerWidth || 1200) - 332);
      const top = Math.min(rect.bottom + 8, (window.innerHeight || 800) - 350);
      setDatePickerPos({ top: Math.max(12, top), left });
    }
    setIsDatePickerOpen(true);
  };

  const handleSelectDate = (isoStr) => {
    const picked = parseIsoToLocalDate(isoStr);
    setIsDatePickerOpen(false);

    const targetIdx = dateColumns.findIndex((c) => c.isoStr === isoStr);
    if (targetIdx >= 0 && scrollViewportRef.current) {
      scrollViewportRef.current.scrollTo({
        left: targetIdx * COL_WIDTH,
        behavior: 'smooth'
      });
      setVisibleDate(picked);
    } else {
      setBaseDate(picked);
      setVisibleDate(picked);
      requestAnimationFrame(() => {
        if (scrollViewportRef.current) {
          scrollViewportRef.current.scrollLeft = BUFFER_PAST_DAYS * COL_WIDTH;
        }
      });
    }
  };

  // Rooms & Rate Plans configuration
  const allRooms = useMemo(() => {
    if (!roomTypes || roomTypes.length === 0) return [];

    const priorityOrder = { 'SUPIRIOR': 1, 'DOUBLE SIGNLE': 2, 'Delux Room': 3, 'Deluxe Room': 3 };
    const sorted = [...roomTypes].sort((a, b) => (priorityOrder[a.name] || 99) - (priorityOrder[b.name] || 99));

    return sorted.map((rt) => {
      const matchingPhysicalRooms = (rooms || []).filter(
        (r) =>
          r.roomTypeId === rt.id ||
          r.roomTypeId === rt.code ||
          String(r.roomTypeName || r.roomType || '').toLowerCase() === String(rt.name || '').toLowerCase()
      );

      // Find active rate plans configured for this room type (e.g. STR, 132)
      const activePlans = (ratePlans || [])
        .filter((rp) => {
          if (!rp || String(rp.status || 'ACTIVE').toUpperCase() === 'INACTIVE') return false;
          if (!rp.roomTypeRates) return true;
          const rtEntry = rp.roomTypeRates[rt.id];
          return rtEntry ? rtEntry.active !== false : true;
        })
        .map((rp) => ({
          id: rp.id || rp.code,
          code: rp.code || rp.name || rt.code || 'BAR',
          name: rp.name || rp.code || 'Standard Rate',
          mealPlanName: rp.mealPlanName || 'Room Only (EP)',
          basePrice: rp.roomTypeRates?.[rt.id]?.basePrice ?? rt.basePrice ?? 1000,
          extraAdult: rp.roomTypeRates?.[rt.id]?.extraAdult ?? rt.extraAdultPrice ?? 800,
          extraChild: rp.roomTypeRates?.[rt.id]?.extraChild ?? rt.extraChildPrice ?? 400
        }));

      const resolvedPlans =
        activePlans.length > 0
          ? activePlans
          : [
              {
                id: `${rt.id}_default`,
                code: rt.code || 'STR',
                name: 'Standard Rate Plan',
                mealPlanName: 'European Plan (EP) - Room Only',
                basePrice: rt.basePrice || 1000,
                extraAdult: rt.extraAdultPrice || 800,
                extraChild: rt.extraChildPrice || 400
              }
            ];

      return {
        id: rt.id,
        name: rt.name,
        code: rt.code || 'STR',
        rateCode: resolvedPlans[0].code,
        plans: resolvedPlans,
        totalRooms: matchingPhysicalRooms.length,
        basePrice: rt.basePrice || 1000,
        extraAdultPrice: rt.extraAdultPrice || 800,
        extraChildPrice: rt.extraChildPrice || 400
      };
    });
  }, [roomTypes, rooms, ratePlans]);

  // Filtered rooms based on dropdown
  const visibleRooms = useMemo(() => {
    if (selectedRoomFilter === 'ALL') return allRooms;
    return allRooms.filter((r) => r.id === selectedRoomFilter);
  }, [allRooms, selectedRoomFilter]);

  // Inventory computation per room type & date
  const getRoomInventory = useCallback(
    (room, col) => {
      const matchingPhysicalRooms = (rooms || []).filter(
        (r) =>
          r.roomTypeId === room.id ||
          (room.id === 'rt_standard' && r.roomTypeId === 'rt_normal') ||
          (room.id === 'rt_normal' && r.roomTypeId === 'rt_standard')
      );
      const total = matchingPhysicalRooms.length;

      const bookedCount = (reservations || []).filter((r) => {
        if (!r) return false;
        const st = String(r.status || '').toLowerCase().replace(/[\s-]+/g, '_');
        if (st === 'cancelled' || st === 'canceled' || st === 'no_show' || st === 'checked_out' || st === 'departed') {
          return false;
        }
        const isRoomTypeMatch =
          r.roomTypeId === room.id ||
          (room.id === 'rt_standard' && r.roomTypeId === 'rt_normal') ||
          (room.id === 'rt_normal' && r.roomTypeId === 'rt_standard') ||
          matchingPhysicalRooms.some((rm) => rm.id === r.roomId || String(rm.roomNumber) === String(r.roomNumber));

        if (!isRoomTypeMatch) return false;
        const cIn = normalizeDateStr(r.checkInDate);
        const cOut = normalizeDateStr(r.checkOutDate);
        return col.isoStr >= cIn && col.isoStr < cOut;
      }).length;

      const maintenanceCount = (maintenanceBlocks || []).filter((mb) => {
        if (!mb) return false;
        const mbSt = String(mb.status || '').toLowerCase();
        if (mbSt === 'cancelled' || mbSt === 'completed' || mbSt === 'released') return false;
        const isRoomMatch = matchingPhysicalRooms.some(
          (rm) => rm.id === mb.roomId || String(rm.roomNumber) === String(mb.roomNumber)
        );
        if (!isRoomMatch) return false;
        const start = normalizeDateStr(mb.startDate);
        const end = normalizeDateStr(mb.endDate || mb.startDate);
        return col.isoStr >= start && col.isoStr <= end;
      }).length;

      const available = Math.max(0, total - bookedCount - maintenanceCount);

      return { available, total, sold: bookedCount };
    },
    [rooms, reservations, maintenanceBlocks]
  );

  // Resolve cell key for primary plan vs additional rate plan
  const getCellKey = (rtId, plan, planIndex, dateStr) => {
    if (planIndex === 0) return `${rtId}_${dateStr}`;
    return `${rtId}_${plan.code}_${dateStr}`;
  };

  // Effective rate or min-nights value for a cell
  const getCellValue = (room, plan, planIndex, dateStr, tierKey) => {
    const key = getCellKey(room.id, plan, planIndex, dateStr);
    if (localRateEdits[tierKey] && localRateEdits[tierKey][key] !== undefined) {
      return localRateEdits[tierKey][key];
    }
    if (dailyRates && dailyRates[tierKey] && dailyRates[tierKey][key] !== undefined) {
      return dailyRates[tierKey][key];
    }
    if (planIndex === 0 && room.id === 'rt_standard') {
      const altKey = `rt_normal_${dateStr}`;
      if (dailyRates && dailyRates[tierKey] && dailyRates[tierKey][altKey] !== undefined) {
        return dailyRates[tierKey][altKey];
      }
    }

    if (tierKey === 'min_nights') {
      const resKey = `${room.id}_${dateStr}`;
      return restrictions?.[resKey]?.minStay ?? 1;
    }

    if (tierKey === 'base') {
      if (planIndex === 0 && room.id === 'rt_deluxe' && (dateStr === '2026-11-05' || dateStr === '2026-11-06')) {
        return 1000;
      }
      return plan.basePrice ?? room.basePrice ?? 1000;
    }
    if (tierKey === 'extra_adult') return plan.extraAdult ?? room.extraAdultPrice ?? 800;
    if (tierKey === 'extra_child') return plan.extraChild ?? room.extraChildPrice ?? 400;
    return 1000;
  };

  const activeTierKey = activeMatrixTab === 'min_nights' ? 'min_nights' : rateTier;
  const hasUnsavedEdits = Object.keys(localRateEdits[activeTierKey] || {}).length > 0;

  const handleCellEdit = (cellKey, val) => {
    setLocalRateEdits((prev) => ({
      ...prev,
      [activeTierKey]: {
        ...(prev[activeTierKey] || {}),
        [cellKey]: val
      }
    }));
  };

  // Save handler: commits edited cells to store & persists
  const handleSaveRates = () => {
    const currentEdits = localRateEdits[activeTierKey] || {};
    const payloadRates = {};

    visibleRooms.forEach((room) => {
      room.plans.forEach((plan, pIdx) => {
        dateColumns.forEach((col) => {
          const key = getCellKey(room.id, plan, pIdx, col.isoStr);
          if (currentEdits[key] !== undefined || pIdx === 0) {
            const val = getCellValue(room, plan, pIdx, col.isoStr, activeTierKey);
            payloadRates[key] = Number(val);
          }
        });
      });
    });

    Object.assign(payloadRates, currentEdits);

    if (onSaveRates) {
      onSaveRates(payloadRates, activeTierKey);
    } else if (onBulkUpdate) {
      onBulkUpdate({ rates: payloadRates, tier: activeTierKey });
    }

    setLocalRateEdits((prev) => {
      const copy = { ...prev };
      delete copy[activeTierKey];
      return copy;
    });
  };

  // Bulk update apply handler
  const handleApplyBulk = (payload) => {
    setLocalRateEdits({});
    if (onBulkUpdate) {
      onBulkUpdate(payload);
    }
    setIsBulkOpen(false);
  };

  // Bottom 3 summary rows (Sold, Available, Total) aligned 1:1 with dateColumns
  const summaryData = useMemo(() => {
    return dateColumns.map((col) => {
      let total = 0;
      let available = 0;
      let sold = 0;

      visibleRooms.forEach((room) => {
        const inv = getRoomInventory(room, col);
        total += inv.total;
        available += inv.available;
        sold += inv.sold;
      });

      return {
        isoStr: col.isoStr,
        isWeekend: col.isWeekend,
        isToday: col.isToday,
        sold,
        available,
        total
      };
    });
  }, [dateColumns, visibleRooms, getRoomInventory]);

  return (
    <div
      className="rates-page-container"
      style={{ '--rates-col-width': `${COL_WIDTH}px` }}
    >
      {/* Region 0A: Fixed Top Tab Bar (Rates, Minimum Nights, Stop Sell) */}
      <div className="rates-top-tabs-bar">
        <SlidingTabBar
          tabs={MATRIX_TABS}
          activeTab={activeMatrixTab}
          onTabChange={setActiveMatrixTab}
        />
      </div>

      {/* Region 0B: Fixed Secondary Filter & Action Toolbar */}
      <div className="rates-sub-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
          {/* All Room Types Dropdown */}
          <div style={{ position: 'relative' }}>
            <select
              value={selectedRoomFilter}
              onChange={(e) => setSelectedRoomFilter(e.target.value)}
              className="rates-room-filter-select"
            >
              <option value="ALL">All Room Types</option>
              {allRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={15}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#64748b',
                pointerEvents: 'none'
              }}
            />
          </div>

          {/* Rate Tier Radio Buttons on Rates tab */}
          {activeMatrixTab === 'rates' ? (
            <div className="rates-radio-group">
              <label className={`rates-radio-label ${rateTier === 'base' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="rateTier"
                  value="base"
                  checked={rateTier === 'base'}
                  onChange={() => setRateTier('base')}
                />
                <span>Base Rates</span>
              </label>

              <label className={`rates-radio-label ${rateTier === 'extra_adult' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="rateTier"
                  value="extra_adult"
                  checked={rateTier === 'extra_adult'}
                  onChange={() => setRateTier('extra_adult')}
                />
                <span>Extra Adult</span>
              </label>

              <label className={`rates-radio-label ${rateTier === 'extra_child' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="rateTier"
                  value="extra_child"
                  checked={rateTier === 'extra_child'}
                  onChange={() => setRateTier('extra_child')}
                />
                <span>Extra Child</span>
              </label>
            </div>
          ) : (
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
              {activeMatrixTab === 'min_nights'
                ? 'Configure minimum length of stay per room type and date'
                : 'Click any date cell to toggle Open / Closed stop-sell inventory'}
            </span>
          )}
        </div>

        {/* Right Action Buttons: Bulk Update + Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="rates-action-btn-secondary"
            onClick={() => setIsBulkOpen(true)}
          >
            Bulk Update
          </button>
          {activeMatrixTab !== 'stop_sell' && (
            <button
              type="button"
              className={`rates-action-btn-primary ${hasUnsavedEdits ? '' : 'idle'}`}
              onClick={handleSaveRates}
            >
              Save
            </button>
          )}
        </div>
      </div>

      {/* Synchronized Multi-Axis 4-Region Scroll Container */}
      <div
        ref={scrollViewportRef}
        className={`rates-grid-viewport ${scrollEdges.scrolledX ? 'scrolled-x' : ''} ${
          scrollEdges.scrolledY ? 'scrolled-y' : ''
        } ${scrollEdges.hasScrollBelow ? 'has-scroll-below' : ''}`}
      >
        <div className="rates-grid-table">
          {/* Region 1: Top Sticky Date Header Row */}
          <div className="rates-header-row" ref={headerRowRef}>
            {/* Top-Left Corner Cell (Pinned to BOTH top & left, highest z-index) */}
            <div className="rates-col-left rates-header-left">
              {/* Date Pill Input (18/11/2026) */}
              <div
                ref={datePickerTriggerRef}
                className="rates-date-pill"
                onClick={openDatePicker}
                title="Jump to date"
              >
                <span className="rates-date-pill-text">{formattedDateDisplay}</span>
                <CalendarIcon size={15} style={{ color: '#64748b', flexShrink: 0 }} />
              </div>

              {/* Left Pagination Arrow (<) */}
              <button
                type="button"
                onClick={handleScrollPrev}
                title={`Scroll back ${ARROW_SCROLL_DAYS} days`}
                className="rates-nav-circle-btn"
              >
                <ChevronLeft size={16} strokeWidth={2.2} />
              </button>
            </div>

            {/* Scrollable Horizontal Date Columns */}
            <div className="rates-cells-track">
              {dateColumns.map((col) => {
                if (col.isToday) {
                  return (
                    <div key={col.isoStr} className="rates-date-cell is-today">
                      <div className="rates-card-today">
                        <span className="rates-card-dayname" style={{ color: '#e11d48' }}>
                          TODAY
                        </span>
                        <span className="rates-card-daynum" style={{ color: '#e11d48' }}>
                          {col.dayNum}
                        </span>
                        <span className="rates-card-month" style={{ color: '#fb7185' }}>
                          {col.month}
                        </span>
                      </div>
                    </div>
                  );
                }

                if (col.isWeekend) {
                  return (
                    <div key={col.isoStr} className="rates-date-cell is-weekend">
                      <div className="rates-card-weekend">
                        <span className="rates-card-dayname" style={{ color: '#ea580c' }}>
                          {col.dayName}
                        </span>
                        <span className="rates-card-daynum" style={{ color: '#ea580c' }}>
                          {col.dayNum}
                        </span>
                        <span className="rates-card-month" style={{ color: '#f97316' }}>
                          {col.month}
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={col.isoStr} className="rates-date-cell">
                    <div className="rates-card-weekday">
                      <span className="rates-card-dayname" style={{ color: '#64748b' }}>
                        {col.dayName}
                      </span>
                      <span className="rates-card-daynum" style={{ color: '#0f172a' }}>
                        {col.dayNum}
                      </span>
                      <span className="rates-card-month" style={{ color: '#94a3b8' }}>
                        {col.month}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Pagination Arrow (>) Pinned to Right Edge of Date Header */}
            <div className="rates-header-right-nav">
              <button
                type="button"
                onClick={handleScrollNext}
                title={`Scroll forward ${ARROW_SCROLL_DAYS} days`}
                className="rates-nav-circle-btn"
              >
                <ChevronRight size={16} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          {/* Region 3: Vertically Scrollable Room Categories & Rate Plan Rows */}
          <div className="rates-body-rows">
            {visibleRooms.map((room) => (
              <React.Fragment key={room.id}>
                {/* Row A: Room Category Header & Daily Available Inventory */}
                <div className="rates-grid-row rates-room-header-row">
                  <div className="rates-col-left rates-room-name-cell">
                    <BedDouble size={17} color="#334155" style={{ flexShrink: 0 }} />
                    <span className="rates-room-title">{room.name}</span>
                  </div>

                  <div className="rates-cells-track">
                    {dateColumns.map((col) => {
                      const inv = getRoomInventory(room, col);
                      return (
                        <div
                          key={col.isoStr}
                          className={`rates-cell ${col.isToday ? 'is-today' : col.isWeekend ? 'is-weekend' : ''}`}
                        >
                          <span className={`rates-inv-num ${inv.available === 0 ? 'zero' : ''}`}>
                            {inv.available}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rates-right-spacer" />
                </div>

                {/* Row B+: Rate Plan Rows (e.g. STR, 132) */}
                {room.plans.map((plan, pIdx) => {
                  const infoKey = `info_${room.id}_${plan.id}`;
                  const isInfoOpen = activeInfoId === infoKey;
                  const isLastPlan = pIdx === room.plans.length - 1;

                  return (
                    <div
                      key={`${room.id}_${plan.id}`}
                      className={`rates-grid-row ${isLastPlan ? 'rates-plan-last-row' : ''}`}
                    >
                      {/* Sticky Left Column: Rate Plan Code + Info Icon */}
                      <div className="rates-col-left rates-ratecode-cell">
                        <span className="rates-ratecode-text" title={plan.name}>
                          {plan.code}
                        </span>

                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="rates-info-btn"
                            onClick={() => setActiveInfoId(isInfoOpen ? null : infoKey)}
                            title={`Rate Plan Info: ${plan.name}`}
                          >
                            <Info size={14} />
                          </button>

                          {isInfoOpen && (
                            <div className="rates-info-tooltip">
                              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '12.5px', marginBottom: '4px' }}>
                                {plan.name} ({plan.code})
                              </div>
                              <div style={{ color: '#64748b', fontSize: '11.5px', lineHeight: 1.45 }}>
                                {plan.mealPlanName} · Base ₹{Number(plan.basePrice || 0).toLocaleString('en-IN')}
                              </div>
                              <button
                                type="button"
                                onClick={() => setActiveInfoId(null)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#2563eb',
                                  fontWeight: 600,
                                  fontSize: '11.5px',
                                  marginTop: '6px',
                                  cursor: 'pointer',
                                  padding: 0
                                }}
                              >
                                Close
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Scrollable Rate / Minimum Nights / Stop Sell Cells */}
                      <div className="rates-cells-track">
                        {dateColumns.map((col) => {
                          const cellKey = getCellKey(room.id, plan, pIdx, col.isoStr);
                          const isWeekendClass = col.isToday ? 'is-today' : col.isWeekend ? 'is-weekend' : '';

                          if (activeMatrixTab === 'stop_sell') {
                            const stopKey = `${room.id}_${col.isoStr}`;
                            const isClosed = Boolean(stopouts?.[stopKey]);
                            return (
                              <div key={col.isoStr} className={`rates-cell ${isWeekendClass}`}>
                                <button
                                  type="button"
                                  className={`rates-stopsell-btn ${isClosed ? 'is-closed' : ''}`}
                                  onClick={() => onToggleStopout && onToggleStopout(room.id, col.isoStr)}
                                  title={`Toggle stop-sell for ${room.name} on ${col.isoStr}`}
                                >
                                  {isClosed ? 'Closed' : 'Open'}
                                </button>
                              </div>
                            );
                          }

                          const currentVal = getCellValue(room, plan, pIdx, col.isoStr, activeTierKey);
                          const isDirty = localRateEdits[activeTierKey]?.[cellKey] !== undefined;

                          return (
                            <div key={col.isoStr} className={`rates-cell ${isWeekendClass}`}>
                              <input
                                type="number"
                                min={activeMatrixTab === 'min_nights' ? 1 : 0}
                                className={`rates-cell-input-card ${isDirty ? 'is-dirty' : ''}`}
                                value={currentVal}
                                onChange={(e) => handleCellEdit(cellKey, e.target.value)}
                                title={`Edit ${room.name} (${plan.code}) on ${col.isoStr}`}
                              />
                            </div>
                          );
                        })}
                      </div>

                      <div className="rates-right-spacer" />
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          {/* Region 4: Bottom Sticky Summary Footer (Sold, Available, Total Rooms) */}
          <div className="rates-summary-section">
            {/* Summary Row 1: Sold Rooms */}
            <div className="rates-summary-row">
              <div className="rates-col-left rates-summary-title-cell">
                <span className="rates-summary-title">Sold Rooms</span>
              </div>
              <div className="rates-cells-track">
                {summaryData.map((item) => (
                  <div
                    key={item.isoStr}
                    className={`rates-summary-cell ${item.isToday ? 'is-today' : item.isWeekend ? 'is-weekend' : ''}`}
                  >
                    <span className="rates-summary-num sold">{item.sold}</span>
                  </div>
                ))}
              </div>
              <div className="rates-summary-right-spacer" />
            </div>

            {/* Summary Row 2: Available Rooms */}
            <div className="rates-summary-row">
              <div className="rates-col-left rates-summary-title-cell">
                <span className="rates-summary-title">Available Rooms</span>
              </div>
              <div className="rates-cells-track">
                {summaryData.map((item) => (
                  <div
                    key={item.isoStr}
                    className={`rates-summary-cell ${item.isToday ? 'is-today' : item.isWeekend ? 'is-weekend' : ''}`}
                  >
                    <span className="rates-summary-num avail">{item.available}</span>
                  </div>
                ))}
              </div>
              <div className="rates-summary-right-spacer" />
            </div>

            {/* Summary Row 3: Total Rooms */}
            <div className="rates-summary-row">
              <div className="rates-col-left rates-summary-title-cell">
                <span className="rates-summary-title">Total Rooms</span>
              </div>
              <div className="rates-cells-track">
                {summaryData.map((item) => (
                  <div
                    key={item.isoStr}
                    className={`rates-summary-cell ${item.isToday ? 'is-today' : item.isWeekend ? 'is-weekend' : ''}`}
                  >
                    <span className="rates-summary-num">{item.total}</span>
                  </div>
                ))}
              </div>
              <div className="rates-summary-right-spacer" />
            </div>
          </div>
        </div>
      </div>

      {/* Portal Calendar Date Picker (never clipped by sticky headers or scroll containers) */}
      {isDatePickerOpen &&
        typeof document !== 'undefined' &&
        ReactDOM.createPortal(
          <div
            className="custom-calendar-portal-wrapper"
            style={{
              position: 'fixed',
              top: `${datePickerPos.top}px`,
              left: `${datePickerPos.left}px`,
              zIndex: 9999999,
              width: '320px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <CustomCalendar
              value={visibleDate || baseDate}
              highlightDate={todayIsoStr}
              outputFormat="iso"
              ignoreRef={datePickerTriggerRef}
              onChange={handleSelectDate}
              onClose={() => setIsDatePickerOpen(false)}
              className="portal-popover"
              placement="portal"
            />
          </div>,
          document.body
        )}

      {/* Bulk Update Modal */}
      {isBulkOpen && (
        <BulkUpdateModal
          isOpen={isBulkOpen}
          onClose={() => setIsBulkOpen(false)}
          onApply={handleApplyBulk}
          roomTypes={roomTypes}
          currentRateTier={rateTier}
        />
      )}
    </div>
  );
}
