import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import './custom-picker.css';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Parses YYYY-MM-DD, DD/MM/YYYY, or Date object into { year, month (0-11), day }
 */
export function parseDateValue(val) {
  if (!val) return null;

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return {
      year: val.getFullYear(),
      month: val.getMonth(),
      day: val.getDate()
    };
  }

  if (typeof val === 'string') {
    const clean = val.trim();
    if (!clean) return null;

    // YYYY-MM-DD or YYYY/MM/DD
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(clean)) {
      const parts = clean.split(/[-/T ]/).map(Number);
      return {
        year: parts[0],
        month: Math.max(0, Math.min(11, parts[1] - 1)),
        day: parts[2] || 1
      };
    }

    // DD/MM/YYYY or DD-MM-YYYY
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(clean)) {
      const parts = clean.split(/[-/ ]/).map(Number);
      return {
        day: parts[0] || 1,
        month: Math.max(0, Math.min(11, parts[1] - 1)),
        year: parts[2] || new Date().getFullYear()
      };
    }

    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return {
        year: d.getFullYear(),
        month: d.getMonth(),
        day: d.getDate()
      };
    }
  }

  return null;
}

/**
 * Format helpers
 */
export function toIsoDate(year, month, day) {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function toDmyDate(year, month, day) {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${dd}/${mm}/${year}`;
}

/**
 * Compare two { year, month, day }
 * < 0 if d1 < d2, 0 if equal, > 0 if d1 > d2
 */
export function compareDates(d1, d2) {
  if (!d1 || !d2) return 0;
  if (d1.year !== d2.year) return d1.year - d2.year;
  if (d1.month !== d2.month) return d1.month - d2.month;
  return d1.day - d2.day;
}

/**
 * CustomCalendar Popover Component
 * Exactly matches the visual design in the reference screenshot
 */
export function CustomCalendar({
  value,
  onChange,
  minDate,
  maxDate,
  highlightDate,
  outputFormat = 'iso', // 'iso' ('YYYY-MM-DD') or 'dmy' ('DD/MM/YYYY')
  onClose,
  className = '',
  style = {},
  placement = 'bottom'
}) {
  const popoverRef = useRef(null);

  // Parse current values
  const parsedValue = useMemo(() => parseDateValue(value), [value]);
  const parsedMin = useMemo(() => parseDateValue(minDate), [minDate]);
  const parsedMax = useMemo(() => parseDateValue(maxDate), [maxDate]);
  const parsedHighlight = useMemo(() => parseDateValue(highlightDate), [highlightDate]);

  // Today
  const today = useMemo(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }, []);

  // Calendar View month & year
  const [viewYear, setViewYear] = useState(() => {
    if (parsedValue) return parsedValue.year;
    if (parsedMin) return parsedMin.year;
    return today.year;
  });

  const [viewMonth, setViewMonth] = useState(() => {
    if (parsedValue) return parsedValue.month;
    if (parsedMin) return parsedMin.month;
    return today.month;
  });

  // Quick picker view for fast Month / Year jumps
  const [quickViewMode, setQuickViewMode] = useState('days'); // 'days' | 'months' | 'years'
  const [autoPlacement, setAutoPlacement] = useState(placement);

  // Auto detect viewport boundary overflow to keep calendar fully on screen (for inline/non-portal popovers)
  useEffect(() => {
    if (placement === 'portal' || className?.includes('portal-popover')) return;
    if (!popoverRef.current) return;
    const rect = popoverRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    const isRight = placement.includes('right') || rect.right > viewportWidth - 12;
    const isTop = placement.includes('top') || (rect.bottom > viewportHeight - 12 && rect.top > 350);

    const calculated = `${isTop ? 'top' : 'bottom'}-${isRight ? 'right' : 'left'}`;
    setAutoPlacement(calculated);
  }, [placement, className]);

  // Sync view when external value changes
  useEffect(() => {
    if (parsedValue) {
      setViewYear(parsedValue.year);
      setViewMonth(parsedValue.month);
    }
  }, [parsedValue?.year, parsedValue?.month]);

  // Outside click listener
  useEffect(() => {
    function handleDocClick(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        if (onClose) onClose();
      }
    }
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [onClose]);

  // Navigation handlers
  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Select day handler
  const handleDaySelect = (day, month = viewMonth, year = viewYear, e) => {
    if (e) e.stopPropagation();

    // Check min/max disabled
    const targetDate = { year, month, day };
    if (parsedMin && compareDates(targetDate, parsedMin) < 0) return;
    if (parsedMax && compareDates(targetDate, parsedMax) > 0) return;

    const isoStr = toIsoDate(year, month, day);
    const dmyStr = toDmyDate(year, month, day);
    const result = outputFormat === 'dmy' ? dmyStr : isoStr;

    if (onChange) {
      onChange(result, { year, month, day, iso: isoStr, dmy: dmyStr });
    }
    if (onClose) {
      onClose();
    }
  };

  // Calendar Day Grid calculations
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  // Previous month trailing days
  const prevDays = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    prevDays.push(daysInPrevMonth - i);
  }

  // Current month days
  const currentDays = [];
  for (let i = 1; i <= daysInCurrentMonth; i++) {
    currentDays.push(i);
  }

  // Next month leading days (complete to 35 or 42 cells)
  const totalCells = prevDays.length + currentDays.length > 35 ? 42 : 35;
  const nextDays = [];
  const remainingCells = totalCells - (prevDays.length + currentDays.length);
  for (let i = 1; i <= remainingCells; i++) {
    nextDays.push(i);
  }

  // Year options for quick jump (around viewYear)
  const yearOptions = useMemo(() => {
    const list = [];
    const base = Math.floor(viewYear / 12) * 12;
    for (let y = base - 2; y <= base + 15; y++) {
      list.push(y);
    }
    return list;
  }, [viewYear]);

  return (
    <div
      ref={popoverRef}
      className={`custom-calendar-popover placement-${autoPlacement || placement} ${className}`}
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Bar matching Reference Image */}
      <div className="custom-cal-header">
        {/* Previous Month Button (Boxed rounded button) */}
        <button
          type="button"
          className="custom-cal-nav-btn"
          onClick={handlePrevMonth}
          aria-label="Previous month"
        >
          <ChevronLeft size={16} strokeWidth={2.4} />
        </button>

        {/* Center Title (Bold "Month Year", click to toggle quick jump) */}
        <div
          className="custom-cal-title"
          onClick={() => {
            setQuickViewMode((prev) => (prev === 'days' ? 'months' : 'days'));
          }}
          title="Click to jump month or year"
        >
          {MONTH_NAMES[viewMonth]} {viewYear}
        </div>

        {/* Next Month Button (Boxed rounded button) */}
        <button
          type="button"
          className="custom-cal-nav-btn"
          onClick={handleNextMonth}
          aria-label="Next month"
        >
          <ChevronRight size={16} strokeWidth={2.4} />
        </button>
      </div>

      {/* Quick Month Selector View */}
      {quickViewMode === 'months' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Select Month</span>
            <button
              type="button"
              className="custom-cal-switch-btn"
              onClick={() => setQuickViewMode('years')}
            >
              {viewYear} ▾
            </button>
          </div>
          <div className="custom-cal-quick-picker">
            {MONTH_NAMES.map((name, idx) => {
              const isCurrent = viewMonth === idx;
              return (
                <div
                  key={name}
                  className={`custom-cal-quick-item ${isCurrent ? 'active' : ''}`}
                  onClick={() => {
                    setViewMonth(idx);
                    setQuickViewMode('days');
                  }}
                >
                  {name.substring(0, 3)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Year Selector View */}
      {quickViewMode === 'years' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Select Year</span>
            <button
              type="button"
              className="custom-cal-switch-btn"
              onClick={() => setQuickViewMode('months')}
            >
              Back to Months
            </button>
          </div>
          <div className="custom-cal-quick-picker">
            {yearOptions.map((y) => {
              const isCurrent = viewYear === y;
              return (
                <div
                  key={y}
                  className={`custom-cal-quick-item ${isCurrent ? 'active' : ''}`}
                  onClick={() => {
                    setViewYear(y);
                    setQuickViewMode('months');
                  }}
                >
                  {y}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Standard Days View */}
      {quickViewMode === 'days' && (
        <>
          {/* Weekday Row (Su Mo Tu We Th Fr Sa) */}
          <div className="custom-cal-weekdays">
            {WEEKDAY_NAMES.map((w) => (
              <span key={w} className="custom-cal-weekday">
                {w}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="custom-cal-grid">
            {/* Trailing Days of Previous Month */}
            {prevDays.map((d) => {
              const prevMonthIdx = viewMonth === 0 ? 11 : viewMonth - 1;
              const prevYearVal = viewMonth === 0 ? viewYear - 1 : viewYear;
              const targetDate = { year: prevYearVal, month: prevMonthIdx, day: d };
              const isDisabled =
                (parsedMin && compareDates(targetDate, parsedMin) < 0) ||
                (parsedMax && compareDates(targetDate, parsedMax) > 0);

              return (
                <div key={`prev-${d}`} className="custom-cal-day-cell">
                  <button
                    type="button"
                    className={`custom-cal-day-btn other-month ${isDisabled ? 'disabled' : ''}`}
                    onClick={(e) => handleDaySelect(d, prevMonthIdx, prevYearVal, e)}
                    disabled={isDisabled}
                  >
                    {d}
                  </button>
                </div>
              );
            })}

            {/* Current Month Days */}
            {currentDays.map((d) => {
              const targetDate = { year: viewYear, month: viewMonth, day: d };

              // Check if selected
              const isSelected =
                parsedValue &&
                parsedValue.year === viewYear &&
                parsedValue.month === viewMonth &&
                parsedValue.day === d;

              // Check if highlighted (e.g. 17 in screenshot or arrival / today)
              const isHighlighted =
                parsedHighlight &&
                parsedHighlight.year === viewYear &&
                parsedHighlight.month === viewMonth &&
                parsedHighlight.day === d;

              // Check disabled
              const isDisabled =
                (parsedMin && compareDates(targetDate, parsedMin) < 0) ||
                (parsedMax && compareDates(targetDate, parsedMax) > 0);

              return (
                <div key={`curr-${d}`} className="custom-cal-day-cell">
                  <button
                    type="button"
                    className={`custom-cal-day-btn ${
                      isSelected ? 'selected' : ''
                    } ${isHighlighted && !isSelected ? 'highlighted' : ''} ${
                      isDisabled ? 'disabled' : ''
                    }`}
                    onClick={(e) => handleDaySelect(d, viewMonth, viewYear, e)}
                    disabled={isDisabled}
                  >
                    {d}
                  </button>
                </div>
              );
            })}

            {/* Leading Days of Next Month */}
            {nextDays.map((d) => {
              const nextMonthIdx = viewMonth === 11 ? 0 : viewMonth + 1;
              const nextYearVal = viewMonth === 11 ? viewYear + 1 : viewYear;
              const targetDate = { year: nextYearVal, month: nextMonthIdx, day: d };
              const isDisabled =
                (parsedMin && compareDates(targetDate, parsedMin) < 0) ||
                (parsedMax && compareDates(targetDate, parsedMax) > 0);

              return (
                <div key={`next-${d}`} className="custom-cal-day-cell">
                  <button
                    type="button"
                    className={`custom-cal-day-btn other-month ${isDisabled ? 'disabled' : ''}`}
                    onClick={(e) => handleDaySelect(d, nextMonthIdx, nextYearVal, e)}
                    disabled={isDisabled}
                  >
                    {d}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * CustomDatePicker Field Component
 * Supports trigger input box with calendar popover dropdown
 */
export default function CustomDatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  readOnly = false,
  minDate,
  maxDate,
  highlightDate,
  outputFormat = 'iso', // 'iso' ('YYYY-MM-DD') or 'dmy' ('DD/MM/YYYY')
  displayFormat = 'dmy', // 'dmy' ('DD/MM/YYYY') or 'iso' ('YYYY-MM-DD')
  label,
  required = false,
  className = '',
  inputClassName = '',
  placement = 'auto',
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef(null);
  const popoverPortalRef = useRef(null);

  const parsed = useMemo(() => parseDateValue(value), [value]);

  // Formatted display text
  const displayText = useMemo(() => {
    if (!parsed) return '';
    if (displayFormat === 'iso') {
      return toIsoDate(parsed.year, parsed.month, parsed.day);
    }
    return toDmyDate(parsed.year, parsed.month, parsed.day);
  }, [parsed, displayFormat]);

  // Dynamic placement calculation
  const updatePopoverPos = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1200;
    const popoverHeight = 330;
    const popoverWidth = 320;

    let top = rect.bottom + 6;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Prefer opening below; only flip to top if space below is too small AND ample space above exists
    if (placement === 'top' || (placement === 'auto' && spaceBelow < popoverHeight && spaceAbove >= popoverHeight + 20)) {
      top = rect.top - popoverHeight - 6;
    } else if (spaceBelow < popoverHeight && spaceAbove < popoverHeight + 20) {
      // If neither side has enough clearance, clamp so top is never cut off
      top = Math.max(16, viewportHeight - popoverHeight - 16);
    }

    // Horizontal alignment: align with left of trigger, clamp to screen width
    let left = rect.left;
    if (placement.includes('right') || left + popoverWidth > viewportWidth - 16) {
      left = Math.max(16, rect.right - popoverWidth);
    }
    if (left < 16) {
      left = 16;
    }

    setPopoverPos({ top, left });
  };

  const toggleOpen = () => {
    if (disabled || readOnly) return;
    if (!isOpen) {
      updatePopoverPos();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Keep popover position synchronized on scroll and resize
  useEffect(() => {
    if (!isOpen) return;
    updatePopoverPos();

    const handleScroll = (e) => {
      // Don't reposition if scroll event happened inside calendar dropdown
      if (popoverPortalRef.current && popoverPortalRef.current.contains(e.target)) return;
      updatePopoverPos();
    };
    const handleResize = () => updatePopoverPos();

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;
    function handleDocClick(e) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        popoverPortalRef.current &&
        !popoverPortalRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleDateChange = (val) => {
    if (onChange) {
      onChange(val);
    }
    setIsOpen(false);
  };

  return (
    <div className={`custom-picker-wrap custom-datetime-control ${className}`} ref={containerRef} style={style}>
      {label && (
        <label className="custom-cal-label custom-picker-label">
          {label} {required && <span className="custom-cal-star custom-picker-star">*</span>}
        </label>
      )}

      {/* Input Trigger Button */}
      <div
        className={`custom-date-box custom-picker-trigger ${isOpen ? 'active' : ''} ${
          disabled ? 'disabled' : ''
        } ${inputClassName}`}
        onClick={toggleOpen}
      >
        {displayText ? (
          <span className="custom-date-text custom-picker-value">{displayText}</span>
        ) : (
          <span className="custom-picker-placeholder">{placeholder}</span>
        )}
        <Calendar size={16} color="#64748b" style={{ flexShrink: 0 }} />
      </div>

      {/* Calendar Popover - Portal rendered at document body with clamped position */}
      {isOpen && typeof document !== 'undefined'
        ? ReactDOM.createPortal(
            <div
              ref={popoverPortalRef}
              className="custom-calendar-portal-wrapper"
              style={{
                position: 'fixed',
                top: `${popoverPos.top}px`,
                left: `${popoverPos.left}px`,
                zIndex: 9999999,
                width: '320px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <CustomCalendar
                value={value}
                onChange={handleDateChange}
                minDate={minDate}
                maxDate={maxDate}
                highlightDate={highlightDate}
                outputFormat={outputFormat}
                onClose={() => setIsOpen(false)}
                className="portal-popover"
                placement="portal"
              />
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
