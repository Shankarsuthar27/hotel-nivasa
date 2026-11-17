import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Tag,
  Plus,
  MoreVertical,
  SquarePen,
  Trash2,
  Percent,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import TaxRuleDrawerModal from './TaxRuleDrawerModal';
import ServiceChargeDrawerModal from './ServiceChargeDrawerModal';
import SlidingTabBar from '../common/SlidingTabBar';

export default function TaxServicesView({
  taxRules = [],
  serviceCharges = [],
  triggerAddTaxRule = 0,
  onCreateTaxRule,
  onUpdateTaxRule,
  onDeleteTaxRule,
  onCreateServiceCharge,
  onUpdateServiceCharge,
  onDeleteServiceCharge,
  showToast
}) {
  const [activeTab, setActiveTab] = useState('tax-rules'); // 'services' or 'tax-rules'
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [editingTaxRule, setEditingTaxRule] = useState(null);

  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingServiceCharge, setEditingServiceCharge] = useState(null);

  const [activeMenuId, setActiveMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);

  // Sync external header trigger button (+ Create Tax Rule)
  const lastTriggerRef = useRef(triggerAddTaxRule);
  useEffect(() => {
    if (triggerAddTaxRule > 0 && triggerAddTaxRule !== lastTriggerRef.current) {
      if (activeTab === 'tax-rules') {
        setEditingTaxRule(null);
        setIsTaxModalOpen(true);
      } else {
        setEditingServiceCharge(null);
        setIsServiceModalOpen(true);
      }
    }
    lastTriggerRef.current = triggerAddTaxRule;
  }, [triggerAddTaxRule, activeTab]);

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

  // Close dropdown on scroll or resize
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

  const handleToggleMenu = (e, id) => {
    e.stopPropagation();
    if (activeMenuId === id) {
      setActiveMenuId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 110;
    const menuWidth = 160;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < menuHeight + 20;

    setMenuPos({
      top: openUpwards ? Math.max(10, rect.top - menuHeight - 4) : rect.bottom + 4,
      left: Math.max(10, rect.right - menuWidth)
    });
    setActiveMenuId(id);
  };

  const handleOpenAddTaxRule = () => {
    setEditingTaxRule(null);
    setIsTaxModalOpen(true);
    setActiveMenuId(null);
  };

  const handleEditTaxRule = (rule) => {
    setEditingTaxRule(rule);
    setIsTaxModalOpen(true);
    setActiveMenuId(null);
  };

  const handleToggleTaxStatus = (rule) => {
    setActiveMenuId(null);
    const newStatus = rule.status === 'active' ? 'inactive' : 'active';
    if (onUpdateTaxRule) {
      onUpdateTaxRule(rule.id, { status: newStatus });
      if (showToast) {
        showToast(
          `Tax rule "${rule.name}" is now ${newStatus === 'active' ? 'Active' : 'Inactive'}.`,
          'success'
        );
      }
    }
  };

  const handleDeleteTaxRuleConfirm = (rule) => {
    setActiveMenuId(null);
    if (window.confirm(`Are you sure you want to delete the tax rule "${rule.name}"?`)) {
      if (onDeleteTaxRule) {
        onDeleteTaxRule(rule.id);
        if (showToast) {
          showToast(`Tax rule "${rule.name}" deleted successfully.`, 'info');
        }
      }
    }
  };

  const handleOpenAddService = () => {
    setEditingServiceCharge(null);
    setIsServiceModalOpen(true);
    setActiveMenuId(null);
  };

  const handleEditService = (charge) => {
    setEditingServiceCharge(charge);
    setIsServiceModalOpen(true);
    setActiveMenuId(null);
  };

  const handleToggleServiceStatus = (charge) => {
    setActiveMenuId(null);
    const newStatus = charge.status === 'active' ? 'inactive' : 'active';
    if (onUpdateServiceCharge) {
      onUpdateServiceCharge(charge.id, { status: newStatus });
      if (showToast) {
        showToast(
          `Service charge "${charge.name}" is now ${newStatus === 'active' ? 'Active' : 'Inactive'}.`,
          'success'
        );
      }
    }
  };

  const handleDeleteServiceConfirm = (charge) => {
    setActiveMenuId(null);
    if (window.confirm(`Are you sure you want to delete the service charge "${charge.name}"?`)) {
      if (onDeleteServiceCharge) {
        onDeleteServiceCharge(charge.id);
        if (showToast) {
          showToast(`Service charge "${charge.name}" deleted successfully.`, 'info');
        }
      }
    }
  };

  const handleSaveTaxRule = (ruleData, ruleId) => {
    if (ruleId) {
      if (onUpdateTaxRule) onUpdateTaxRule(ruleId, ruleData);
      if (showToast) showToast(`Tax rule "${ruleData.name}" updated successfully.`, 'success');
    } else {
      if (onCreateTaxRule) onCreateTaxRule(ruleData);
      if (showToast) showToast(`Tax rule "${ruleData.name}" created successfully.`, 'success');
    }
  };

  const handleSaveServiceCharge = (chargeData, chargeId) => {
    if (chargeId) {
      if (onUpdateServiceCharge) onUpdateServiceCharge(chargeId, chargeData);
      if (showToast) showToast(`Service charge "${chargeData.name}" updated successfully.`, 'success');
    } else {
      if (onCreateServiceCharge) onCreateServiceCharge(chargeData);
      if (showToast) showToast(`Service charge "${chargeData.name}" created successfully.`, 'success');
    }
  };

  const taxServicesTabs = useMemo(
    () => [
      { id: 'services', label: 'Service Categories & Charges', count: serviceCharges.length },
      { id: 'tax-rules', label: 'Tax Rules & Definitions', count: taxRules.length }
    ],
    [serviceCharges.length, taxRules.length]
  );

  return (
    <div className="properties-content-area" style={{ padding: '0 24px 24px' }}>
      {/* Subtab Navigation with Smooth Sliding Active Underline Indicator (Matching Image 1) */}
      <SlidingTabBar
        tabs={taxServicesTabs}
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId)}
        className="mb-5"
        ariaLabel="Tax & Services views"
      />

      {/* 1. Tab Content: Tax Rules & Definitions (Matching Image 1) */}
      {activeTab === 'tax-rules' && (
        <div className="properties-table-card" style={{ minHeight: '380px', border: 'none', boxShadow: 'none' }}>
          {taxRules.length === 0 ? (
            <div className="properties-empty-state" style={{ padding: '80px 24px' }}>
              <div className="properties-empty-icon-box">
                <Percent size={24} />
              </div>
              <h3 className="properties-empty-title">No Tax Rules Defined</h3>
              <p className="properties-empty-sub">
                Configure GST slabs, service charges, or local tax percentages to apply across all property folios.
              </p>
              <button
                type="button"
                className="properties-btn-primary"
                onClick={handleOpenAddTaxRule}
              >
                <Plus size={16} />
                <span>Create Tax Rule</span>
              </button>
            </div>
          ) : (
            <div className="properties-table-wrap">
              <table className="properties-table">
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>Tax Rule</th>
                    <th style={{ width: '10%' }}>Type</th>
                    <th style={{ width: '22%' }}>Rate Structure</th>
                    <th style={{ width: '20%' }}>Splits Breakdown</th>
                    <th style={{ width: '12%' }}>Inclusion</th>
                    <th style={{ width: '8%' }}>Status</th>
                    <th style={{ width: '6%', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {taxRules.map((rule) => {
                    const totalShare = (rule.splits || []).reduce(
                      (sum, sp) => sum + (parseFloat(sp.share) || 0),
                      0
                    );

                    return (
                      <tr key={rule.id}>
                        {/* Tax Rule Name */}
                        <td>
                          <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13.5px' }}>
                            {rule.name}
                          </div>
                        </td>

                        {/* Type Badge */}
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 10px',
                              borderRadius: '9999px',
                              backgroundColor: '#EFF6FF',
                              color: '#2563EB',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              letterSpacing: '0.02em',
                              border: '1px solid #DBEAFE'
                            }}
                          >
                            {rule.categoryType || 'GST'}
                          </span>
                        </td>

                        {/* Rate Structure (Matching Image 1: ₹1—₹7500 -> 5%, ₹7501—above -> 18%) */}
                        <td>
                          {rule.useSlabs && Array.isArray(rule.slabs) && rule.slabs.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {rule.slabs.map((slab, sIdx) => {
                                const maxStr =
                                  slab.max !== null && slab.max !== '' && slab.max !== undefined
                                    ? `₹${slab.max}`
                                    : 'above';
                                return (
                                  <div
                                    key={sIdx}
                                    style={{
                                      fontSize: '13px',
                                      color: '#334155',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <span>
                                      ₹{slab.min}—{maxStr}
                                    </span>
                                    <span style={{ color: '#64748B', margin: '0 2px' }}>➔</span>
                                    <span style={{ color: '#2563EB', fontWeight: 700 }}>
                                      {slab.rate}%
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ fontSize: '13.5px', color: '#0F172A', fontWeight: 600 }}>
                              <span style={{ color: '#2563EB' }}>{rule.rate || 0}%</span>{' '}
                              <span style={{ color: '#64748B', fontWeight: 400, fontSize: '12px' }}>
                                (Flat Rate)
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Splits Breakdown (Matching Image 1: CGST: 50%, SGST: 50%) */}
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {Array.isArray(rule.splits) && rule.splits.length > 0 ? (
                              rule.splits.map((split, spIdx) => {
                                const s = parseFloat(split.share) || 0;
                                const pct = totalShare > 0 ? Math.round((s / totalShare) * 100) : 50;
                                return (
                                  <span
                                    key={spIdx}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: '2px 8px',
                                      borderRadius: '9999px',
                                      backgroundColor: '#EFF6FF',
                                      color: '#2563EB',
                                      fontSize: '11.5px',
                                      fontWeight: 500,
                                      border: '1px solid #DBEAFE'
                                    }}
                                  >
                                    {split.name}: {pct}%
                                  </span>
                                );
                              })
                            ) : (
                              <span style={{ fontSize: '12.5px', color: '#94A3B8' }}>None</span>
                            )}
                          </div>
                        </td>

                        {/* Inclusion (Matching Image 1: EXCLUSIVE) */}
                        <td>
                          <span
                            style={{
                              fontSize: '12.5px',
                              fontWeight: 500,
                              color: '#475569',
                              letterSpacing: '0.02em'
                            }}
                          >
                            {rule.priceInclusion || 'EXCLUSIVE'}
                          </span>
                        </td>

                        {/* Status (Matching Image 1: Active) */}
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 10px',
                              borderRadius: '9999px',
                              backgroundColor: rule.status === 'active' ? '#ECFDF5' : '#F1F5F9',
                              color: rule.status === 'active' ? '#059669' : '#64748B',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              border: rule.status === 'active' ? '1px solid #A7F3D0' : '1px solid #E2E8F0'
                            }}
                          >
                            {rule.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Actions 3-dots */}
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={(e) => handleToggleMenu(e, rule.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#64748B',
                              cursor: 'pointer',
                              padding: '4px 6px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Actions"
                          >
                            <MoreVertical size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 2. Tab Content: Service Categories & Charges */}
      {activeTab === 'services' && (
        <div className="properties-table-card" style={{ minHeight: '380px', border: 'none', boxShadow: 'none' }}>
          {serviceCharges.length === 0 ? (
            <div className="properties-empty-state" style={{ padding: '80px 24px' }}>
              <div className="properties-empty-icon-box">
                <Tag size={24} />
              </div>
              <h3 className="properties-empty-title">No Service Charges Configured</h3>
              <p className="properties-empty-sub">
                Add extra hotel services such as Room Service, F&B, Airport Pickup, or Laundry to charge directly to guest folios.
              </p>
              <button
                type="button"
                className="properties-btn-primary"
                onClick={handleOpenAddService}
              >
                <Plus size={16} />
                <span>Add Service Charge</span>
              </button>
            </div>
          ) : (
            <div className="properties-table-wrap">
              <table className="properties-table">
                <thead>
                  <tr>
                    <th style={{ width: '25%' }}>Service Name</th>
                    <th style={{ width: '18%' }}>Category</th>
                    <th style={{ width: '15%' }}>SAC / HSN Code</th>
                    <th style={{ width: '14%' }}>Default Price</th>
                    <th style={{ width: '14%' }}>Tax Rule</th>
                    <th style={{ width: '8%' }}>Status</th>
                    <th style={{ width: '6%', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceCharges.map((charge) => {
                    const matchedTax = taxRules.find((tr) => tr.id === charge.taxRuleId);
                    return (
                      <tr key={charge.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13.5px' }}>
                            {charge.name}
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 10px',
                              borderRadius: '9999px',
                              backgroundColor: '#F1F5F9',
                              color: '#334155',
                              fontSize: '11.5px',
                              fontWeight: 500
                            }}
                          >
                            {charge.category}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '13px', color: '#64748B', fontFamily: 'monospace' }}>
                            {charge.sacCode || '—'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#0F172A' }}>
                            ₹{Number(charge.price || 0).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12.5px', color: '#2563EB', fontWeight: 500 }}>
                            {matchedTax ? matchedTax.name : 'Exempt / None'}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 10px',
                              borderRadius: '9999px',
                              backgroundColor: charge.status === 'active' ? '#ECFDF5' : '#F1F5F9',
                              color: charge.status === 'active' ? '#059669' : '#64748B',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              border: charge.status === 'active' ? '1px solid #A7F3D0' : '1px solid #E2E8F0'
                            }}
                          >
                            {charge.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={(e) => handleToggleMenu(e, charge.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#64748B',
                              cursor: 'pointer',
                              padding: '4px 6px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Actions"
                          >
                            <MoreVertical size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Popover Action Menu */}
      {activeMenuId && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: `${menuPos.top}px`,
            left: `${menuPos.left}px`,
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            zIndex: 1100,
            minWidth: '155px',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}
        >
          {activeTab === 'tax-rules' ? (
            <>
              {(() => {
                const rule = taxRules.find((r) => r.id === activeMenuId);
                if (!rule) return null;
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => handleEditTaxRule(rule)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        background: 'none',
                        border: 'none',
                        width: '100%',
                        textAlign: 'left',
                        fontSize: '13px',
                        color: '#0F172A',
                        fontWeight: 500,
                        cursor: 'pointer',
                        borderRadius: '6px',
                        transition: 'background-color 0.12s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <SquarePen size={14} color="#2563EB" />
                      <span>Edit Tax Rule</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleTaxStatus(rule)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        background: 'none',
                        border: 'none',
                        width: '100%',
                        textAlign: 'left',
                        fontSize: '13px',
                        color: '#0F172A',
                        fontWeight: 500,
                        cursor: 'pointer',
                        borderRadius: '6px',
                        transition: 'background-color 0.12s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {rule.status === 'active' ? (
                        <>
                          <XCircle size={14} color="#64748B" />
                          <span>Deactivate</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={14} color="#059669" />
                          <span>Activate</span>
                        </>
                      )}
                    </button>

                    <div style={{ height: '1px', backgroundColor: '#F1F5F9', margin: '2px 0' }} />

                    <button
                      type="button"
                      onClick={() => handleDeleteTaxRuleConfirm(rule)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        background: 'none',
                        border: 'none',
                        width: '100%',
                        textAlign: 'left',
                        fontSize: '13px',
                        color: '#EF4444',
                        fontWeight: 500,
                        cursor: 'pointer',
                        borderRadius: '6px',
                        transition: 'background-color 0.12s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <Trash2 size={14} color="#EF4444" />
                      <span>Delete Rule</span>
                    </button>
                  </>
                );
              })()}
            </>
          ) : (
            <>
              {(() => {
                const charge = serviceCharges.find((s) => s.id === activeMenuId);
                if (!charge) return null;
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => handleEditService(charge)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        background: 'none',
                        border: 'none',
                        width: '100%',
                        textAlign: 'left',
                        fontSize: '13px',
                        color: '#0F172A',
                        fontWeight: 500,
                        cursor: 'pointer',
                        borderRadius: '6px'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <SquarePen size={14} color="#2563EB" />
                      <span>Edit Service</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleServiceStatus(charge)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        background: 'none',
                        border: 'none',
                        width: '100%',
                        textAlign: 'left',
                        fontSize: '13px',
                        color: '#0F172A',
                        fontWeight: 500,
                        cursor: 'pointer',
                        borderRadius: '6px'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {charge.status === 'active' ? (
                        <>
                          <XCircle size={14} color="#64748B" />
                          <span>Deactivate</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={14} color="#059669" />
                          <span>Activate</span>
                        </>
                      )}
                    </button>

                    <div style={{ height: '1px', backgroundColor: '#F1F5F9', margin: '2px 0' }} />

                    <button
                      type="button"
                      onClick={() => handleDeleteServiceConfirm(charge)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        background: 'none',
                        border: 'none',
                        width: '100%',
                        textAlign: 'left',
                        fontSize: '13px',
                        color: '#EF4444',
                        fontWeight: 500,
                        cursor: 'pointer',
                        borderRadius: '6px'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <Trash2 size={14} color="#EF4444" />
                      <span>Delete Service</span>
                    </button>
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Tax Rule Slide-over Drawer Modal */}
      <TaxRuleDrawerModal
        isOpen={isTaxModalOpen}
        onClose={() => setIsTaxModalOpen(false)}
        onSaveRule={handleSaveTaxRule}
        ruleToEdit={editingTaxRule}
        showToast={showToast}
      />

      {/* Service Charge Slide-over Drawer Modal */}
      <ServiceChargeDrawerModal
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
        onSaveCharge={handleSaveServiceCharge}
        chargeToEdit={editingServiceCharge}
        taxRules={taxRules}
        showToast={showToast}
      />
    </div>
  );
}

