import React, { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import './sliding-tabs.css';

const DEFAULT_TABS = [
  { id: 'all', label: 'Reservations', count: 14 },
  { id: 'arrivals', label: 'Arrivals', count: 0 },
  { id: 'in_house', label: 'In-house', count: 2 },
  { id: 'departures', label: 'Departures', count: 4 }
];

/**
 * Horizontal Navigation Tab Bar with a smooth sliding active underline indicator.
 *
 * Supports both controlled (`activeTab` + `onChange`) and uncontrolled usage.
 * Dynamically measures each tab's `offsetLeft` and `offsetWidth` via refs and glides
 * using a crisp deceleration curve (`cubic-bezier(0.22, 1, 0.36, 1)` over `300ms`).
 */
export default function SlidingTabBar({
  tabs = DEFAULT_TABS,
  activeTab: controlledActiveTab,
  onChange,
  className = '',
  ariaLabel = 'Navigation tabs'
}) {
  const [internalActiveTab, setInternalActiveTab] = useState(
    () => controlledActiveTab ?? tabs[0]?.id ?? ''
  );

  const isControlled = controlledActiveTab !== undefined;
  const activeTab = isControlled ? controlledActiveTab : internalActiveTab;

  const containerRef = useRef(null);
  const tabRefs = useRef({});
  const hasAnimatedRef = useRef(false);

  const [indicator, setIndicator] = useState({
    left: 0,
    width: 0,
    visible: false,
    animate: false
  });

  const measureActiveTab = useCallback(
    (shouldAnimate = true) => {
      const activeEl = tabRefs.current[activeTab];
      if (!activeEl) return;

      const nextLeft = activeEl.offsetLeft;
      const nextWidth = activeEl.offsetWidth;

      setIndicator((prev) => {
        if (
          prev.visible &&
          prev.left === nextLeft &&
          prev.width === nextWidth
        ) {
          return prev;
        }
        return {
          left: nextLeft,
          width: nextWidth,
          visible: true,
          animate: shouldAnimate && hasAnimatedRef.current
        };
      });

      if (!hasAnimatedRef.current) {
        // Enable smooth glide after initial paint snaps into position
        requestAnimationFrame(() => {
          hasAnimatedRef.current = true;
        });
      }
    },
    [activeTab]
  );

  // Measure synchronously before paint whenever activeTab or tab labels/counts change
  useLayoutEffect(() => {
    measureActiveTab(true);
  }, [measureActiveTab, tabs]);

  // Keep indicator synchronized on container/window resize and web font load
  useEffect(() => {
    const handleResize = () => measureActiveTab(false);
    window.addEventListener('resize', handleResize);

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => measureActiveTab(false));
      resizeObserver.observe(containerRef.current);
      Object.values(tabRefs.current).forEach((el) => {
        if (el) resizeObserver.observe(el);
      });
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => measureActiveTab(false));
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [measureActiveTab, tabs]);

  const handleSelect = (tabId) => {
    if (!isControlled) {
      setInternalActiveTab(tabId);
    }
    if (onChange) {
      onChange(tabId);
    }
  };

  const handleKeyDown = (e, currentIndex) => {
    if (!tabs.length) return;
    let nextIndex = null;

    if (e.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      const nextTab = tabs[nextIndex];
      handleSelect(nextTab.id);
      tabRefs.current[nextTab.id]?.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`sliding-tabs-nav relative flex items-center gap-6 border-b border-gray-200 ${className}`.trim()}
    >
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) {
                tabRefs.current[tab.id] = el;
              } else {
                delete tabRefs.current[tab.id];
              }
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => handleSelect(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`sliding-tab-btn relative inline-flex items-center gap-2 pb-2.5 pt-2 text-sm transition-colors duration-200 focus:outline-none ${
              isActive
                ? 'is-active text-blue-600 font-semibold'
                : 'text-gray-600 hover:text-gray-900 font-medium'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count !== null && (
              <span
                className={`sliding-tab-badge rounded-full text-xs font-medium px-2 py-0.5 transition-colors duration-200 ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-semibold'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}

      {/* Smooth Sliding Active Underline Indicator */}
      <span
        aria-hidden="true"
        className={`sliding-tab-indicator absolute bottom-0 left-0 h-[2.5px] bg-blue-600 rounded-t-full pointer-events-none ${
          indicator.animate ? 'is-animated' : ''
        }`}
        style={{
          transform: `translateX(${indicator.left}px)`,
          width: `${indicator.width}px`,
          opacity: indicator.visible ? 1 : 0,
          transition: indicator.animate
            ? 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1), width 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms ease'
            : 'none'
        }}
      />
    </div>
  );
}

