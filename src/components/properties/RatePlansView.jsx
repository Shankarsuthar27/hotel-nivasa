import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Tag,
  Plus,
  MoreVertical,
  SquarePen,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import AddRatePlanModal from './AddRatePlanModal';

// Toggle switch icon matching exact user design (capsule with circle thumb)
const ToggleSwitchIcon = ({ checked = true }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: checked ? 'flex-end' : 'flex-start',
      width: '26px',
      height: '15px',
      borderRadius: '999px',
      border: `2px solid ${checked ? '#16a34a' : '#94a3b8'}`,
      backgroundColor: '#ffffff',
      padding: '1px 2px',
      boxSizing: 'border-box',
      transition: 'all 0.15s ease',
      flexShrink: 0
    }}
  >
    <span
      style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: checked ? '#16a34a' : '#94a3b8',
        transition: 'all 0.15s ease'
      }}
    />
  </span>
);

export default function RatePlansView({
  ratePlans = [],
  mealPlans = [],
  roomTypes = [],
  triggerAddRatePlan = 0,
  onCreateRatePlan,
  onUpdateRatePlan,
  onDeleteRatePlan,
  showToast
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);

  // Sync external header trigger button (+ Create Rate Plan in Top Nav)
  const lastTriggerRef = useRef(triggerAddRatePlan);
  useEffect(() => {
    if (triggerAddRatePlan > 0 && triggerAddRatePlan !== lastTriggerRef.current) {
      setEditingPlan(null);
      setIsModalOpen(true);
    }
    lastTriggerRef.current = triggerAddRatePlan;
  }, [triggerAddRatePlan]);

  // Close action dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuId(null);
      }
    }
    if (activeMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeMenuId]);

  // Auto close popover on window/container scroll or resize
  useEffect(() => {
    if (!activeMenuId) return;
    const handleClose = () => setActiveMenuId(null);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [activeMenuId]);

  const handleToggleMenu = (e, planId, idx) => {
    e.stopPropagation();
    if (activeMenuId === planId) {
      setActiveMenuId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 92;
    const menuWidth = 142;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < menuHeight + 20 || (ratePlans.length > 1 && idx === ratePlans.length - 1 && spaceBelow < 180);

    setMenuPos({
      top: openUpwards ? Math.max(10, rect.top - menuHeight - 4) : rect.bottom + 4,
      left: Math.max(10, rect.right - menuWidth)
    });
    setActiveMenuId(planId);
  };

  const handleOpenAdd = () => {
    setEditingPlan(null);
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  // Deduplicate rate plans by both ID and code so duplicate rows and React key warnings can never occur
  const uniqueRatePlans = useMemo(() => {
    const byId = new Map();
    const byCode = new Map();
    const obsoleteRatePlanKeys = new Set(['rp_test_plan', 'test plan', '132']);

    (ratePlans || []).forEach((rp) => {
      if (!rp) return;
      const idKey = (rp.id || '').trim();
      const codeKey = (rp.code || '').trim().toUpperCase();
      const nameKey = (rp.name || '').trim().toLowerCase();
      if (obsoleteRatePlanKeys.has(idKey.toLowerCase()) || obsoleteRatePlanKeys.has(codeKey.toLowerCase()) || obsoleteRatePlanKeys.has(nameKey)) {
        return;
      }
      if (!idKey && !codeKey) return;

      const existing = (idKey && byId.get(idKey)) || (codeKey && byCode.get(codeKey));
      if (!existing) {
        const item = { ...rp, id: idKey || `rp_${codeKey}`, code: codeKey || rp.code || '' };
        if (idKey) byId.set(idKey, item);
        if (codeKey) byCode.set(codeKey, item);
      } else {
        const prevHasRates = existing.roomTypeRates && Object.values(existing.roomTypeRates).some(r => r && (r.active || r.basePrice > 0));
        const curHasRates = rp.roomTypeRates && Object.values(rp.roomTypeRates).some(r => r && (r.active || r.basePrice > 0));
        const canonicalId = existing.id || idKey;
        const canonicalCode = existing.code || codeKey;
        const merged = (curHasRates && !prevHasRates)
          ? { ...existing, ...rp, id: canonicalId, code: canonicalCode }
          : { ...rp, ...existing, id: canonicalId, code: canonicalCode };

        if (canonicalId) byId.set(canonicalId, merged);
        if (canonicalCode) byCode.set(canonicalCode, merged);
        if (idKey) byId.set(idKey, merged);
        if (codeKey) byCode.set(codeKey, merged);
      }
    });

    return Array.from(new Set(byId.values()));
  }, [ratePlans]);

  const handleToggleStatus = (plan) => {
    const isCurrentlyActive = plan.status !== 'INACTIVE';
    const nextStatus = isCurrentlyActive ? 'INACTIVE' : 'ACTIVE';
    if (onUpdateRatePlan) {
      onUpdateRatePlan(plan.id || plan.code, { ...plan, status: nextStatus });
    }
    setActiveMenuId(null);
    if (showToast) {
      showToast(`Rate plan "${plan.name}" marked as ${nextStatus === 'ACTIVE' ? 'Active' : 'Inactive'}`);
    }
  };

  const handleDelete = (plan) => {
    if (onDeleteRatePlan) {
      onDeleteRatePlan(plan.id || plan.code);
    }
    setActiveMenuId(null);
    if (showToast) {
      showToast(`Deleted rate plan "${plan.name}"`);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        minHeight: 'calc(100vh - 54px)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {uniqueRatePlans.length === 0 ? (
        /* Empty State */
        <div className="properties-empty-state" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div className="properties-empty-icon-box">
            <Tag size={26} color="#64748B" />
          </div>
          <h2 className="properties-empty-title">No Rate Plans Found</h2>
          <p className="properties-empty-sub">
            Get started by creating a new rate plan for your property.
          </p>
          <button
            type="button"
            className="properties-btn-primary"
            onClick={handleOpenAdd}
          >
            <Plus size={16} />
            <span>Create Rate Plan</span>
          </button>
        </div>
      ) : (
        /* Flush Edge-to-Edge Data Table (Matching Image 1) */
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backgroundColor: '#FFFFFF'
          }}
        >
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table
              className="properties-table"
              style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}
            >
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ width: '28%', padding: '14px 16px 14px 24px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                    Rate Plan
                  </th>
                  <th style={{ width: '18%', padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                    Short Code
                  </th>
                  <th style={{ width: '18%', padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                    Status
                  </th>
                  <th style={{ width: '26%', padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                    Meal Plan
                  </th>
                  <th style={{ width: '10%', padding: '14px 24px 14px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {uniqueRatePlans.map((rp, idx) => {
                  const mealPlanDisplay =
                    rp.mealPlanName && rp.mealPlanName !== '-'
                      ? rp.mealPlanName
                      : rp.mealPlanId
                      ? mealPlans.find((m) => m.id === rp.mealPlanId)?.name || '-'
                      : '-';

                  const planKey = rp.id || rp.code || `rp_${idx}`;

                  return (
                    <tr key={planKey} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      {/* 1. Rate Plan Name */}
                      <td style={{ padding: '15px 16px 15px 24px' }}>
                        <strong style={{ color: '#0F172A', fontWeight: 700, fontSize: '14px' }}>
                          {rp.name}
                        </strong>
                      </td>

                      {/* 2. Short Code */}
                      <td style={{ padding: '15px 16px' }}>
                        <span className="properties-code-pill">{rp.code}</span>
                      </td>

                      {/* 3. Status */}
                      <td style={{ padding: '15px 16px' }}>
                        <span className="properties-status-pill">
                          {rp.status === 'INACTIVE' ? 'Inactive' : 'Active'}
                        </span>
                      </td>

                      {/* 4. Meal Plan */}
                      <td style={{ padding: '15px 16px' }}>
                        <span style={{ color: mealPlanDisplay === '-' ? '#64748B' : '#334155', fontSize: '13.5px', fontWeight: 500 }}>
                          {mealPlanDisplay}
                        </span>
                      </td>

                      {/* 5. Action (3-Dots + Popover Menu) */}
                      <td
                        className="properties-action-cell"
                        style={{ position: 'relative', textAlign: 'center', padding: '15px 24px 15px 16px' }}
                      >
                        <button
                          type="button"
                          className="properties-action-btn"
                          onClick={(e) => handleToggleMenu(e, planKey, idx)}
                          title="Actions"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {activeMenuId === planKey && (
                          <div
                            className="rate-plan-action-menu"
                            ref={menuRef}
                            style={{
                              position: 'fixed',
                              top: `${menuPos.top}px`,
                              left: `${menuPos.left}px`,
                              zIndex: 9999
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="rate-plan-action-item edit"
                              onClick={() => handleEdit(rp)}
                            >
                              <SquarePen size={16} strokeWidth={2.2} color="#475569" />
                              <span>Edit</span>
                            </button>
                            <div className="rate-plan-action-divider" />
                            <button
                              type="button"
                              className={`rate-plan-action-item toggle-status ${rp.status === 'INACTIVE' ? 'is-inactive' : 'is-active'}`}
                              onClick={() => handleToggleStatus(rp)}
                            >
                              <ToggleSwitchIcon checked={rp.status !== 'INACTIVE'} />
                              <span>{rp.status === 'INACTIVE' ? 'Inactive' : 'Active'}</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer (Matching Image 1) */}
          <div
            className="properties-pagination-footer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 24px',
              borderTop: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF'
            }}
          >
            <div className="properties-pagination-text" style={{ fontSize: '13px', color: '#64748B' }}>
              Showing{' '}
              <strong style={{ color: '#0F172A', fontWeight: 600 }}>
                {uniqueRatePlans.length > 0 ? `1–${uniqueRatePlans.length}` : '0–0'}
              </strong>{' '}
              of <strong style={{ color: '#0F172A', fontWeight: 600 }}>{uniqueRatePlans.length}</strong> results
            </div>

            <div className="properties-pagination-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="properties-page-btn"
                disabled
                title="Previous page"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                className="properties-page-btn active"
                title="Page 1"
              >
                1
              </button>
              <button
                type="button"
                className="properties-page-btn"
                disabled
                title="Next page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Rate Plan Drawer Modal */}
      {isModalOpen && (
        <AddRatePlanModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingPlan(null);
          }}
          onCreateRatePlan={onCreateRatePlan}
          onUpdateRatePlan={onUpdateRatePlan}
          ratePlanToEdit={editingPlan}
          mealPlans={mealPlans}
          roomTypes={roomTypes}
          showToast={showToast}
        />
      )}
    </div>
  );
}

