import React, { memo } from 'react';

/**
 * ScheduleCalendarAvailabilityCell Component
 * Matches OTAL PMS Schedule Calendar Cozy & Wide grid specification.
 */
function ScheduleCalendarAvailabilityCell({
  count = 0,
  width,
  style = {},
  className = '',
  onClick
}) {
  return (
    <div
      className={`schedule-cal-avail-cell ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        width: width !== undefined ? width : '100%',
        height: '100%',
        minHeight: '44px',
        backgroundColor: '#ffffff',
        padding: '4px 0',
        cursor: 'pointer',
        boxSizing: 'border-box',
        flexShrink: 0,
        ...style
      }}
      onClick={onClick}
      role="gridcell"
      aria-label={String(count)}
    >
      <div
        className="schedule-cal-avail-badge"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
          fontSize: '10.5px',
          fontWeight: 700,
          lineHeight: 1,
          color: 'var(--color-red-500, #ef4444)',
          backgroundColor: 'var(--color-red-50, #fef2f2)',
          border: '1px solid rgba(254, 202, 202, 0.55)',
          borderRadius: '9999px',
          minWidth: '24px',
          height: '18px',
          padding: '0 7px',
          boxSizing: 'border-box'
        }}
      >
        {count}
      </div>
    </div>
  );
}

export default memo(ScheduleCalendarAvailabilityCell);
