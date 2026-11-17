import React, { useState, useEffect } from 'react';
import { FileText, X, Plus, Trash2 } from 'lucide-react';

export default function TaxRuleDrawerModal({
  isOpen,
  onClose,
  onSaveRule,
  ruleToEdit = null,
  showToast
}) {
  const [name, setName] = useState('');
  const [presentationLabel, setPresentationLabel] = useState('');
  const [categoryType, setCategoryType] = useState('GST');
  const [calculationMode, setCalculationMode] = useState('percentage');
  const [priceInclusion, setPriceInclusion] = useState('EXCLUSIVE');
  const [useSlabs, setUseSlabs] = useState(true);
  const [flatRate, setFlatRate] = useState(12);
  const [slabs, setSlabs] = useState([
    { min: 1, max: 7500, rate: 5 },
    { min: 7501, max: '', rate: 18 }
  ]);
  const [splits, setSplits] = useState([
    { name: 'CGST', share: 0.5 },
    { name: 'SGST', share: 0.5 }
  ]);
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (ruleToEdit) {
        setName(ruleToEdit.name || '');
        setPresentationLabel(ruleToEdit.presentationLabel || '');
        setCategoryType(ruleToEdit.categoryType || 'GST');
        setCalculationMode(ruleToEdit.calculationMode || 'percentage');
        setPriceInclusion(ruleToEdit.priceInclusion || 'EXCLUSIVE');
        setUseSlabs(ruleToEdit.useSlabs === true);
        setFlatRate(ruleToEdit.rate ?? 12);
        if (Array.isArray(ruleToEdit.slabs) && ruleToEdit.slabs.length > 0) {
          setSlabs(
            ruleToEdit.slabs.map((s) => ({
              min: s.min ?? 1,
              max: s.max === null || s.max === undefined ? '' : s.max,
              rate: s.rate ?? 0
            }))
          );
        } else {
          setSlabs([
            { min: 1, max: 7500, rate: 5 },
            { min: 7501, max: '', rate: 18 }
          ]);
        }
        if (Array.isArray(ruleToEdit.splits) && ruleToEdit.splits.length > 0) {
          setSplits(ruleToEdit.splits.map((sp) => ({ ...sp })));
        } else {
          setSplits([
            { name: 'CGST', share: 0.5 },
            { name: 'SGST', share: 0.5 }
          ]);
        }
        setIsActive(ruleToEdit.status !== 'inactive');
        setError('');
      } else {
        setName('');
        setPresentationLabel('');
        setCategoryType('GST');
        setCalculationMode('percentage');
        setPriceInclusion('EXCLUSIVE');
        setUseSlabs(true);
        setFlatRate(12);
        setSlabs([
          { min: 1, max: 7500, rate: 5 },
          { min: 7501, max: '', rate: 18 }
        ]);
        setSplits([
          { name: 'CGST', share: 0.5 },
          { name: 'SGST', share: 0.5 }
        ]);
        setIsActive(true);
        setError('');
      }
    }
  }, [isOpen, ruleToEdit]);

  if (!isOpen) return null;

  // Calculate percentage dynamically for each split
  const totalShare = splits.reduce((sum, s) => sum + (parseFloat(s.share) || 0), 0);

  const getSplitPercentage = (splitShare) => {
    const s = parseFloat(splitShare) || 0;
    if (totalShare <= 0) return 0;
    return Math.round((s / totalShare) * 100);
  };

  const handleAddSlab = () => {
    let nextMin = 1;
    if (slabs.length > 0) {
      const last = slabs[slabs.length - 1];
      const lastMax = parseFloat(last.max);
      if (!isNaN(lastMax) && lastMax > 0) {
        nextMin = lastMax + 1;
      } else {
        const lastMin = parseFloat(last.min);
        nextMin = !isNaN(lastMin) ? lastMin + 5000 : 7501;
      }
    }
    setSlabs([...slabs, { min: nextMin, max: '', rate: 18 }]);
  };

  const handleUpdateSlab = (index, field, value) => {
    const updated = [...slabs];
    updated[index] = { ...updated[index], [field]: value };
    setSlabs(updated);
  };

  const handleRemoveSlab = (index) => {
    if (slabs.length <= 1) {
      if (showToast) showToast('A tax rule with slabs must have at least one bracket', 'warning');
      return;
    }
    setSlabs(slabs.filter((_, i) => i !== index));
  };

  const handleAddSplit = () => {
    setSplits([...splits, { name: 'NEW_TAX', share: 0.5 }]);
  };

  const handleUpdateSplit = (index, field, value) => {
    const updated = [...splits];
    updated[index] = { ...updated[index], [field]: value };
    setSplits(updated);
  };

  const handleRemoveSplit = (index) => {
    if (splits.length <= 1) {
      if (showToast) showToast('At least one component split is required', 'warning');
      return;
    }
    setSplits(splits.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Tax Rule Name is required.');
      return;
    }

    const cleanedSlabs = slabs.map((s) => ({
      min: Number(s.min) || 0,
      max: s.max === '' || s.max === null || isNaN(Number(s.max)) ? null : Number(s.max),
      rate: Number(s.rate) || 0
    }));

    const cleanedSplits = splits.map((sp) => ({
      name: (sp.name || 'TAX').trim().toUpperCase(),
      share: parseFloat(sp.share) || 0.5
    }));

    const ruleData = {
      name: name.trim(),
      presentationLabel: (presentationLabel || name).trim(),
      categoryType,
      calculationMode,
      priceInclusion,
      useSlabs,
      rate: Number(flatRate) || 0,
      slabs: cleanedSlabs,
      splits: cleanedSplits,
      status: isActive ? 'active' : 'inactive'
    };

    onSaveRule(ruleData, ruleToEdit ? ruleToEdit.id : null);
    onClose();
  };

  return (
    <div
      className="meal-plan-drawer-overlay"
      onClick={onClose}
      style={{
        zIndex: 1050,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(1px)'
      }}
    >
      <div
        className="meal-plan-drawer-container"
        style={{
          maxWidth: '580px',
          width: '100%',
          backgroundColor: '#ffffff',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.15)'
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header (Matching Reference Images) */}
        <div className="meal-plan-drawer-header" style={{ height: '64px', borderBottom: '1px solid #E2E8F0', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                backgroundColor: '#EFF6FF',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563EB'
              }}
            >
              <FileText size={18} />
            </div>
            <h3
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '16px',
                fontWeight: 700,
                color: '#0F172A',
                margin: 0
              }}
            >
              {ruleToEdit ? 'Edit Tax Rule' : 'Create Tax Rule'}
            </h3>
          </div>
          <button
            type="button"
            className="meal-plan-drawer-close-btn"
            onClick={onClose}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '22px'
            }}
          >
            {error && (
              <div
                style={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FEE2E2',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  color: '#DC2626',
                  fontSize: '13px',
                  fontWeight: 500
                }}
              >
                {error}
              </div>
            )}

            {/* Row 1: Tax Rule Name * & Invoice Presentation Label (Optional) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0F172A',
                    marginBottom: '6px'
                  }}
                >
                  Tax Rule Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="India Hotel Slab GST"
                  className="meal-plan-drawer-input"
                  style={{
                    width: '100%',
                    height: '40px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '0 12px',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0F172A',
                    marginBottom: '6px'
                  }}
                >
                  Invoice Presentation Label (Optional)
                </label>
                <input
                  type="text"
                  value={presentationLabel}
                  onChange={(e) => setPresentationLabel(e.target.value)}
                  placeholder="e.g. GST or Sales Tax"
                  className="meal-plan-drawer-input"
                  style={{
                    width: '100%',
                    height: '40px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '0 12px',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Row 2: Tax Category Type * */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#0F172A',
                  marginBottom: '6px'
                }}
              >
                Tax Category Type <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                value={categoryType}
                onChange={(e) => setCategoryType(e.target.value)}
                className="meal-plan-drawer-input"
                style={{
                  width: '100%',
                  height: '40px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '0 12px',
                  fontSize: '13.5px',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="GST">GST (Goods & Services Tax)</option>
                <option value="VAT">VAT (Value Added Tax)</option>
                <option value="Service Charge">Service Charge</option>
                <option value="Occupancy / City Tax">Occupancy / City Tax</option>
                <option value="Luxury Tax">Luxury Tax</option>
                <option value="Custom Surcharge">Custom Surcharge</option>
              </select>
            </div>

            {/* Row 3: Rate Calculation Mode * & Price Inclusion * */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0F172A',
                    marginBottom: '6px'
                  }}
                >
                  Rate Calculation Mode <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={calculationMode}
                  onChange={(e) => setCalculationMode(e.target.value)}
                  className="meal-plan-drawer-input"
                  style={{
                    width: '100%',
                    height: '40px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '0 12px',
                    fontSize: '13.5px',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (₹)</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0F172A',
                    marginBottom: '6px'
                  }}
                >
                  Price Inclusion <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={priceInclusion}
                  onChange={(e) => setPriceInclusion(e.target.value)}
                  className="meal-plan-drawer-input"
                  style={{
                    width: '100%',
                    height: '40px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '0 12px',
                    fontSize: '13.5px',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="EXCLUSIVE">EXCLUSIVE (Added on top of price)</option>
                  <option value="INCLUSIVE">INCLUSIVE (Included in room/service price)</option>
                </select>
              </div>
            </div>

            {/* Section: Use Amount Slabs (Price Brackets)? */}
            <div
              style={{
                borderTop: '1px solid #F1F5F9',
                paddingTop: '18px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '4px'
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
                  Use Amount Slabs (Price Brackets)?
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12.5px', color: '#475569', fontWeight: 500 }}>
                    Slabs Active
                  </span>
                  <button
                    type="button"
                    onClick={() => setUseSlabs(!useSlabs)}
                    style={{
                      width: '42px',
                      height: '24px',
                      borderRadius: '12px',
                      backgroundColor: useSlabs ? '#2563EB' : '#CBD5E1',
                      border: 'none',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease',
                      padding: '2px'
                    }}
                  >
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        position: 'absolute',
                        top: '2px',
                        left: useSlabs ? '20px' : '2px',
                        transition: 'left 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }}
                    />
                  </button>
                </div>
              </div>

              <p style={{ fontSize: '12.5px', color: '#64748B', margin: '0 0 14px 0' }}>
                Define tax rate percentage based on transaction amount brackets:
              </p>

              {useSlabs ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {slabs.map((slab, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                    >
                      {/* Min ₹ */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          border: '1px solid #E2E8F0',
                          borderRadius: '8px',
                          padding: '0 10px',
                          height: '38px',
                          flex: 1,
                          backgroundColor: '#ffffff'
                        }}
                      >
                        <span style={{ fontSize: '12px', color: '#64748B', marginRight: '6px', whiteSpace: 'nowrap' }}>
                          Min ₹
                        </span>
                        <input
                          type="number"
                          value={slab.min}
                          onChange={(e) => handleUpdateSlab(idx, 'min', e.target.value)}
                          placeholder="1"
                          style={{
                            border: 'none',
                            outline: 'none',
                            width: '100%',
                            fontSize: '13px',
                            color: '#0F172A',
                            fontWeight: 500
                          }}
                        />
                      </div>

                      {/* Max ₹ */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          border: '1px solid #E2E8F0',
                          borderRadius: '8px',
                          padding: '0 10px',
                          height: '38px',
                          flex: 1,
                          backgroundColor: '#ffffff'
                        }}
                      >
                        <span style={{ fontSize: '12px', color: '#64748B', marginRight: '6px', whiteSpace: 'nowrap' }}>
                          Max ₹
                        </span>
                        <input
                          type="text"
                          value={slab.max}
                          onChange={(e) => handleUpdateSlab(idx, 'max', e.target.value)}
                          placeholder="No max"
                          style={{
                            border: 'none',
                            outline: 'none',
                            width: '100%',
                            fontSize: '13px',
                            color: '#0F172A',
                            fontWeight: 500
                          }}
                        />
                      </div>

                      {/* % Tax */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          border: '1px solid #E2E8F0',
                          borderRadius: '8px',
                          padding: '0 10px',
                          height: '38px',
                          width: '100px',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        <span style={{ fontSize: '12px', color: '#64748B', marginRight: '6px', whiteSpace: 'nowrap' }}>
                          % Tax
                        </span>
                        <input
                          type="number"
                          value={slab.rate}
                          onChange={(e) => handleUpdateSlab(idx, 'rate', e.target.value)}
                          placeholder="5"
                          style={{
                            border: 'none',
                            outline: 'none',
                            width: '100%',
                            fontSize: '13px',
                            color: '#2563EB',
                            fontWeight: 600
                          }}
                        />
                      </div>

                      {/* Delete Slab Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveSlab(idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#EF4444',
                          cursor: 'pointer',
                          padding: '6px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Remove slab"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddSlab}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '7px 14px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#0F172A',
                      cursor: 'pointer',
                      marginTop: '6px',
                      width: 'fit-content',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#2563EB';
                      e.currentTarget.style.color = '#2563EB';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#E2E8F0';
                      e.currentTarget.style.color = '#0F172A';
                    }}
                  >
                    <Plus size={15} />
                    <span>Add Price Bracket Slab</span>
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '0 12px',
                    height: '40px',
                    maxWidth: '220px',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <span style={{ fontSize: '13px', color: '#64748B', marginRight: '8px' }}>
                    Standard Tax Rate:
                  </span>
                  <input
                    type="number"
                    value={flatRate}
                    onChange={(e) => setFlatRate(e.target.value)}
                    placeholder="12"
                    style={{
                      border: 'none',
                      outline: 'none',
                      width: '60px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#2563EB'
                    }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>%</span>
                </div>
              )}
            </div>

            {/* Section: Tax Component Splits (Matching Reference Images 3 & 4) */}
            <div
              style={{
                borderTop: '1px solid #F1F5F9',
                paddingTop: '18px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '4px'
                }}
              >
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
                    Tax Component Splits
                  </span>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                    Split tax into ledger components (e.g. CGST 50% + SGST 50%)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddSplit}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: '#0F172A',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#2563EB';
                    e.currentTarget.style.color = '#2563EB';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#E2E8F0';
                    e.currentTarget.style.color = '#0F172A';
                  }}
                >
                  <Plus size={14} />
                  <span>Add Split</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                {splits.map((split, idx) => {
                  const pct = getSplitPercentage(split.share);
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        backgroundColor: '#ffffff',
                        gap: '12px'
                      }}
                    >
                      {/* Split Name */}
                      <input
                        type="text"
                        value={split.name}
                        onChange={(e) => handleUpdateSplit(idx, 'name', e.target.value)}
                        placeholder="Component Name (e.g. CGST)"
                        style={{
                          border: 'none',
                          outline: 'none',
                          fontSize: '13.5px',
                          color: '#0F172A',
                          fontWeight: 500,
                          flex: 1,
                          textTransform: 'uppercase'
                        }}
                      />

                      {/* Share Input */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12.5px', color: '#64748B' }}>Share:</span>
                        <input
                          type="number"
                          step="any"
                          value={split.share}
                          onChange={(e) => handleUpdateSplit(idx, 'share', e.target.value)}
                          placeholder="0.5"
                          style={{
                            border: '1px solid #E2E8F0',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            width: '68px',
                            textAlign: 'center',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#0F172A',
                            outline: 'none'
                          }}
                        />
                      </div>

                      {/* Percentage Display */}
                      <div
                        style={{
                          minWidth: '44px',
                          textAlign: 'right',
                          fontSize: '13px',
                          color: '#64748B',
                          fontWeight: 500
                        }}
                      >
                        {pct}%
                      </div>

                      {/* Delete Split Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveSplit(idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#EF4444',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Remove split"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section: Status Active (Matching Reference Images 3 & 4) */}
            <div
              style={{
                borderTop: '1px solid #F1F5F9',
                paddingTop: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
                  Status Active
                </span>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                  Inactive tax rules will not be applied to future folio charges
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                style={{
                  width: '42px',
                  height: '24px',
                  borderRadius: '12px',
                  backgroundColor: isActive ? '#2563EB' : '#CBD5E1',
                  border: 'none',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  padding: '2px'
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    position: 'absolute',
                    top: '2px',
                    left: isActive ? '20px' : '2px',
                    transition: 'left 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }}
                />
              </button>
            </div>
          </div>

          {/* Sticky Drawer Footer */}
          <div
            style={{
              height: '68px',
              borderTop: '1px solid #E2E8F0',
              padding: '0 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              backgroundColor: '#ffffff'
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '9px 24px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#2563EB',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1D4ED8')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2563EB')}
            >
              {ruleToEdit ? 'Update Tax Rule' : 'Create Tax Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

