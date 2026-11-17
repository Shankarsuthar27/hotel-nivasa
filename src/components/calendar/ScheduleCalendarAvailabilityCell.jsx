import React, { memo } from 'react';

/**
 * ScheduleCalendarAvailabilityCell Component
 * Rebuilt exactly according to OTAL PMS (https://app.otalpms.com/schedule-calendar)
 * Inspect Specification & Measurements:
 * - Outer container: rendered at 69.14px × 43.2px, flex-col, center, padding 4px 0, cursor: crosshair
 *   background: color-mix(in oklab, var(--color-gray-50) 20%, transparent) / oklab(0.985 -0.00075442 -0.00185226 / 0.2)
 *   border-right: 0.8px solid oklch(0.967 0.003 264.542)
 * - Inner badge ("2"): rendered at 18.79px × 15.1px, text-red-500, bg-red-50, border-red-100/50, rounded-xl (12px)
 *   font-sans, 9px, font-bold 700, line-height 13.5px, padding 0 6px, margin 0 0 2px
 */
function ScheduleCalendarAvailabilityCell({
  count = 2,
  width,
  style = {},
  className = '',
  onClick
}) {
  return (
    <div
      className={`border-r border-gray-100 flex flex-col items-center justify-center py-1 bg-gray-50/20 schedule-cal-avail-cell ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        width: width !== undefined ? width : '69.1429px',
        height: '100%',
        minHeight: '43.2px',
        fontFamily: 'var(--font-serif, ui-serif, Georgia, Cambria, "Times New Roman", Times, serif)',
        fontSize: '16px',
        lineHeight: '24px',
        color: '#020817',
        backgroundColor: 'color-mix(in oklab, var(--color-gray-50, oklab(0.985 -0.00075442 -0.00185226)) 20%, transparent)',
        borderRight: '0.8px solid oklch(0.967 0.003 264.542)',
        padding: '4px 0px',
        cursor: 'crosshair',
        transition: 'all 0.15s ease',
        boxSizing: 'border-box',
        flexShrink: 0,
        ...style
      }}
      onClick={onClick}
      role="gridcell"
      aria-label={String(count)}
    >
      <div
        className="bg-red-50 text-red-500 text-[9px] font-bold px-1.5 rounded-xl border border-red-100/50 mb-0.5 schedule-cal-avail-badge"
        style={{
          display: 'block',
          fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji")',
          fontSize: '9px',
          fontWeight: 700,
          lineHeight: '13.5px',
          color: 'var(--color-red-500, oklch(0.637 0.237 25.331))',
          backgroundColor: 'var(--color-red-50, oklch(0.971 0.013 17.38))',
          border: '0.8px solid oklab(0.936 0.0304823 0.0097381 / 0.5)',
          borderRadius: '12px',
          padding: '0px 6px',
          margin: '0px 0px 2px 0px',
          cursor: 'crosshair',
          transition: 'all 0.15s ease',
          boxSizing: 'border-box'
        }}
      >
        {count}
      </div>
    </div>
  );
}

export default memo(ScheduleCalendarAvailabilityCell);

