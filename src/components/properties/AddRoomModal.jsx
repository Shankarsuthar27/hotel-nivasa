import React, { useState, useEffect, useRef } from 'react';
import { DoorClosed, X, ChevronDown, Trash2, ClipboardList, PlusCircle, Check } from 'lucide-react';

export default function AddRoomModal({
  isOpen,
  onClose,
  roomTypes = [],
  existingRooms = [],
  onAddRooms,
  onCreateRoomType,
  showToast
}) {
  const [activeMode, setActiveMode] = useState('single'); // 'single' | 'bulk'
  const [roomNumber, setRoomNumber] = useState('');
  const [selectedRoomType, setSelectedRoomType] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [roomTypeSearch, setRoomTypeSearch] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [stagedRooms, setStagedRooms] = useState([]);
  const [error, setError] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setActiveMode('single');
      setRoomNumber('');
      setSelectedRoomType(null);
      setIsDropdownOpen(false);
      setRoomTypeSearch('');
      setPasteText('');
      setStagedRooms([]);
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  if (!isOpen) return null;

  // Filter room types based on search input
  const filteredRoomTypes = (roomTypes || []).filter((rt) =>
    (rt.name || '').toLowerCase().includes(roomTypeSearch.trim().toLowerCase()) ||
    (rt.code || '').toLowerCase().includes(roomTypeSearch.trim().toLowerCase())
  );

  const isExactMatch = (roomTypes || []).some(
    (rt) => rt.name?.toLowerCase() === roomTypeSearch.trim().toLowerCase()
  );

  const handleStageRoom = () => {
    const cleanNum = roomNumber.trim();
    if (!cleanNum) {
      setError('Please enter a room number');
      return;
    }
    if (!selectedRoomType) {
      setError('Please select or enter a room type');
      return;
    }

    const numLower = cleanNum.toLowerCase();
    const isExisting = (existingRooms || []).some(
      (r) => String(r.roomNumber || '').trim().toLowerCase() === numLower
    );

    // If already in staged rooms, update it
    setStagedRooms((prev) => {
      const existingIdx = prev.findIndex((r) => r.roomNumber.toLowerCase() === numLower);
      const stagedItem = {
        id: `staged_${Date.now()}_${Math.random()}`,
        roomNumber: cleanNum,
        roomTypeId: selectedRoomType.id,
        roomTypeName: selectedRoomType.name,
        isExisting
      };
      if (existingIdx !== -1) {
        const next = [...prev];
        next[existingIdx] = stagedItem;
        return next;
      }
      return [...prev, stagedItem];
    });

    setRoomNumber('');
    setError('');
  };

  const handleRemoveStagedRoom = (id) => {
    setStagedRooms((prev) => prev.filter((r) => r.id !== id));
  };

  // Bulk Parse Pasted Rooms
  const handleParsePastedRooms = () => {
    const text = pasteText.trim();
    if (!text) {
      setError('Please paste your room data into the text box');
      return;
    }

    const lines = text.split(/\r?\n/);
    const parsedList = [];

    lines.forEach((line) => {
      let cleanLine = line.trim();
      if (!cleanLine) return;
      // Strip out common user prompt notes if present
      cleanLine = cleanLine.replace(/it was not adding.*$/i, '').trim();
      if (!cleanLine) return;

      // Try splitting by tabs first, then commas, then multiple spaces
      let parts = cleanLine.split(/\t+/);
      if (parts.length === 1) {
        parts = cleanLine.split(/,{1,}/);
      }
      if (parts.length === 1) {
        // Regex match: room number followed by text and optional status
        const match = cleanLine.match(/^(\d+[a-zA-Z]?)\s+([^\t,]+?)(?:\s+(active|clean|dirty|maintenance|inactive))?$/i);
        if (match) {
          parts = [match[1], match[2], match[3] || 'Active'];
        } else {
          parts = cleanLine.split(/\s{2,}/);
        }
      }

      const rawNum = parts[0]?.trim();
      let rawType = parts[1]?.trim();
      const rawStatus = parts[2]?.trim() || 'Active';

      if (!rawNum) return;
      const cleanNum = rawNum.replace(/[^0-9a-zA-Z_-]/g, '');
      if (!cleanNum) return;

      if (!rawType) rawType = 'Delux Room';

      // Normalize common room type names
      let finalTypeName = rawType;
      const typeLower = rawType.toLowerCase();
      if (typeLower.startsWith('sup')) {
        finalTypeName = 'SUPIRIOR';
      } else if (typeLower.startsWith('del')) {
        finalTypeName = 'Delux Room';
      } else if (typeLower.startsWith('dou')) {
        finalTypeName = 'DOUBLE SIGNLE';
      }

      // Find matching existing room type
      const matchedRt = (roomTypes || []).find(
        (rt) =>
          rt.name?.toLowerCase() === finalTypeName.toLowerCase() ||
          rt.code?.toLowerCase() === finalTypeName.toLowerCase() ||
          rt.id?.toLowerCase() === finalTypeName.toLowerCase()
      );

      const rtId = matchedRt ? matchedRt.id : finalTypeName;
      const rtName = matchedRt ? matchedRt.name : finalTypeName;
      const isExisting = (existingRooms || []).some(
        (r) => String(r.roomNumber || '').trim().toLowerCase() === cleanNum.toLowerCase()
      );

      parsedList.push({
        id: `staged_${Date.now()}_${Math.random()}`,
        roomNumber: cleanNum,
        roomTypeId: rtId,
        roomTypeName: rtName,
        status: rawStatus,
        isExisting
      });
    });

    if (parsedList.length === 0) {
      setError('Could not recognize room numbers in the pasted text. Please verify the format.');
      return;
    }

    // Merge into stagedRooms
    setStagedRooms((prev) => {
      const merged = [...prev];
      parsedList.forEach((item) => {
        const idx = merged.findIndex((r) => r.roomNumber.toLowerCase() === item.roomNumber.toLowerCase());
        if (idx !== -1) {
          merged[idx] = item;
        } else {
          merged.push(item);
        }
      });
      return merged;
    });

    setPasteText('');
    setActiveMode('single'); // Switch to review staged rooms
    setError('');
  };

  const canAutoStageCurrent = Boolean(roomNumber.trim() && selectedRoomType);
  const effectiveCreateCount =
    stagedRooms.length +
    (canAutoStageCurrent &&
    !stagedRooms.some((r) => r.roomNumber.toLowerCase() === roomNumber.trim().toLowerCase())
      ? 1
      : 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    let roomsToCreate = [...stagedRooms];

    // If user typed a room number & selected a room type without clicking "+ Add", include it automatically
    if (canAutoStageCurrent) {
      const cleanNum = roomNumber.trim();
      const numLower = cleanNum.toLowerCase();
      if (!roomsToCreate.some((r) => r.roomNumber.toLowerCase() === numLower)) {
        roomsToCreate.push({
          roomNumber: cleanNum,
          roomTypeId: selectedRoomType.id,
          roomTypeName: selectedRoomType.name,
          isExisting: (existingRooms || []).some(
            (r) => String(r.roomNumber || '').trim().toLowerCase() === numLower
          )
        });
      }
    }

    if (roomsToCreate.length === 0) {
      setError('Please enter a room number and select a room type');
      return;
    }

    if (onAddRooms) {
      onAddRooms(
        roomsToCreate.map((r) => ({
          roomNumber: r.roomNumber,
          roomTypeId: r.roomTypeId,
          roomTypeName: r.roomTypeName,
          status: r.status || 'Active'
        }))
      );
    }

    if (showToast) {
      showToast(
        `Success: Saved ${roomsToCreate.length} room${roomsToCreate.length !== 1 ? 's' : ''}`
      );
    }

    onClose();
  };

  return (
    <div className="meal-plan-drawer-overlay" onClick={onClose}>
      <div
        className="meal-plan-drawer-container"
        style={{ maxWidth: '640px' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="meal-plan-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="meal-plan-drawer-icon-badge">
              <DoorClosed size={18} color="#2563EB" />
            </div>
            <h3 className="meal-plan-drawer-title">Add Rooms</h3>
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

        {/* Mode Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            padding: '0 24px',
            gap: '24px'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveMode('single')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 2px',
              fontSize: '13px',
              fontWeight: activeMode === 'single' ? 600 : 500,
              color: activeMode === 'single' ? '#2563EB' : '#64748B',
              border: 'none',
              borderBottom: activeMode === 'single' ? '2px solid #2563EB' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              marginBottom: '-1px'
            }}
          >
            <DoorClosed size={15} />
            <span>Room by Room</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('bulk')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 2px',
              fontSize: '13px',
              fontWeight: activeMode === 'bulk' ? 600 : 500,
              color: activeMode === 'bulk' ? '#2563EB' : '#64748B',
              border: 'none',
              borderBottom: activeMode === 'bulk' ? '2px solid #2563EB' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              marginBottom: '-1px'
            }}
          >
            <ClipboardList size={15} />
            <span>Paste / Bulk Import</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="meal-plan-drawer-form">
          <div className="meal-plan-drawer-body">
            {error && (
              <div
                style={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#DC2626',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 500
                }}
              >
                {error}
              </div>
            )}

            {/* TAB 1: Single Room Adding */}
            {activeMode === 'single' && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1.8fr auto',
                  gap: '12px',
                  alignItems: 'flex-end'
                }}
              >
                {/* Field 1: Room Number */}
                <div className="meal-plan-drawer-field">
                  <label className="meal-plan-drawer-label">Room Number</label>
                  <input
                    type="text"
                    className="meal-plan-drawer-input"
                    placeholder="e.g. 101, 201, 301"
                    value={roomNumber}
                    onChange={(e) => {
                      setRoomNumber(e.target.value);
                      if (error) setError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleStageRoom();
                      }
                    }}
                  />
                </div>

                {/* Field 2: Room Type Searchable Combobox */}
                <div className="meal-plan-drawer-field" style={{ position: 'relative' }} ref={dropdownRef}>
                  <label className="meal-plan-drawer-label">Room Type</label>
                  <div
                    className="meal-plan-drawer-input"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  >
                    <span style={{ color: selectedRoomType ? '#0F172A' : '#94A3B8', fontWeight: selectedRoomType ? 600 : 400 }}>
                      {selectedRoomType ? selectedRoomType.name : 'Select or type room type'}
                    </span>
                    <ChevronDown
                      size={16}
                      color="#64748B"
                      style={{
                        transform: isDropdownOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease'
                      }}
                    />
                  </div>

                  {/* Dropdown Menu */}
                  {isDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                        zIndex: 100,
                        maxHeight: '260px',
                        overflowY: 'auto',
                        padding: '6px'
                      }}
                    >
                      {/* Search / Type input inside dropdown */}
                      <div style={{ padding: '4px', marginBottom: '4px' }}>
                        <input
                          ref={searchInputRef}
                          type="text"
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '8px 10px',
                            fontSize: '13px',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            outline: 'none'
                          }}
                          placeholder="Search or enter room type name..."
                          value={roomTypeSearch}
                          onChange={(e) => setRoomTypeSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (roomTypeSearch.trim()) {
                                setSelectedRoomType({
                                  id: roomTypeSearch.trim(),
                                  name: roomTypeSearch.trim(),
                                  isNew: true
                                });
                                setIsDropdownOpen(false);
                                setRoomTypeSearch('');
                                if (error) setError('');
                              }
                            }
                          }}
                        />
                      </div>

                      {/* Option to create a new room type if user typed something custom */}
                      {roomTypeSearch.trim() && !isExactMatch && (
                        <div
                          style={{
                            padding: '9px 12px',
                            fontSize: '13px',
                            color: '#2563EB',
                            fontWeight: 600,
                            backgroundColor: '#EFF6FF',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '4px'
                          }}
                          onClick={() => {
                            setSelectedRoomType({
                              id: roomTypeSearch.trim(),
                              name: roomTypeSearch.trim(),
                              isNew: true
                            });
                            setIsDropdownOpen(false);
                            setRoomTypeSearch('');
                            if (error) setError('');
                          }}
                        >
                          <PlusCircle size={15} color="#2563EB" />
                          <span>+ Create "{roomTypeSearch.trim()}" as Room Type</span>
                        </div>
                      )}

                      {/* List existing room types */}
                      {filteredRoomTypes.map((rt) => (
                        <div
                          key={rt.id || rt.name}
                          style={{
                            padding: '9px 12px',
                            fontSize: '13.5px',
                            color: '#1E293B',
                            fontWeight: selectedRoomType?.id === rt.id ? 600 : 500,
                            backgroundColor:
                              selectedRoomType?.id === rt.id ? '#EFF6FF' : 'transparent',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'background-color 0.12s'
                          }}
                          onMouseEnter={(e) => {
                            if (selectedRoomType?.id !== rt.id) {
                              e.currentTarget.style.backgroundColor = '#F8FAFC';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedRoomType?.id !== rt.id) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }
                          }}
                          onClick={() => {
                            setSelectedRoomType(rt);
                            setIsDropdownOpen(false);
                            setRoomTypeSearch('');
                            if (error) setError('');
                          }}
                        >
                          <span>{rt.name}</span>
                          {selectedRoomType?.id === rt.id && <Check size={14} color="#2563EB" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* + Add Button */}
                <div>
                  <button
                    type="button"
                    onClick={handleStageRoom}
                    disabled={!roomNumber.trim() || !selectedRoomType}
                    style={{
                      height: '40px',
                      padding: '0 20px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      backgroundColor:
                        roomNumber.trim() && selectedRoomType ? '#0F172A' : '#F1F5F9',
                      color: roomNumber.trim() && selectedRoomType ? '#FFFFFF' : '#94A3B8',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      cursor:
                        roomNumber.trim() && selectedRoomType ? 'pointer' : 'not-allowed',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    + Add
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Bulk Paste Mode */}
            {activeMode === 'bulk' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.4' }}>
                  Paste room numbers and room types below (separated by tab, comma, or spaces):
                </div>
                <textarea
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    height: '140px',
                    padding: '12px',
                    fontSize: '13.5px',
                    fontFamily: 'monospace',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                  placeholder={`101\tDelux Room\tActive\n102\tDelux Room\tActive\n201\tSUPIRIOR\tActive\n202\tSUPIRIOR\tActive\n301\tDOUBLE SIGNLE\tActive`}
                  value={pasteText}
                  onChange={(e) => {
                    setPasteText(e.target.value);
                    if (error) setError('');
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={handleParsePastedRooms}
                    disabled={!pasteText.trim()}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: pasteText.trim() ? '#2563EB' : '#E2E8F0',
                      color: pasteText.trim() ? '#FFFFFF' : '#94A3B8',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: pasteText.trim() ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Parse & Stage All Rooms
                  </button>
                </div>
              </div>
            )}

            {/* Added Rooms Section */}
            <div style={{ marginTop: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px'
                }}
              >
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#475569'
                  }}
                >
                  {stagedRooms.length} Ready to Save
                </span>
                {stagedRooms.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStagedRooms([])}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#EF4444',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Dashed Box when empty */}
              {stagedRooms.length === 0 ? (
                <div
                  style={{
                    border: '1px dashed #CBD5E1',
                    borderRadius: '12px',
                    padding: '36px 24px',
                    textAlign: 'center',
                    backgroundColor: '#FFFFFF',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94A3B8',
                      marginBottom: '10px'
                    }}
                  >
                    <DoorClosed size={20} />
                  </div>
                  <span style={{ fontSize: '13.5px', color: '#64748B', fontWeight: 500 }}>
                    No rooms added yet. Enter a room above or use Bulk Import.
                  </span>
                </div>
              ) : (
                /* Staged Rooms List */
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '220px',
                    overflowY: 'auto'
                  }}
                >
                  {stagedRooms.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '14px',
                            color: '#0F172A'
                          }}
                        >
                          Room {item.roomNumber}
                        </span>
                        <span style={{ color: '#94A3B8' }}>•</span>
                        <span
                          style={{
                            fontSize: '12.5px',
                            color: '#2563EB',
                            fontWeight: 600,
                            backgroundColor: '#EFF6FF',
                            padding: '2px 8px',
                            borderRadius: '4px'
                          }}
                        >
                          {item.roomTypeName}
                        </span>
                        {item.isExisting && (
                          <span
                            style={{
                              fontSize: '11px',
                              color: '#059669',
                              backgroundColor: '#ECFDF5',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 600
                            }}
                          >
                            Update
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveStagedRoom(item.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#94A3B8',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
                        title="Remove"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="meal-plan-drawer-footer">
            <button
              type="button"
              className="meal-plan-drawer-btn-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="meal-plan-drawer-btn-create"
              disabled={effectiveCreateCount === 0}
              style={{
                opacity: effectiveCreateCount === 0 ? 0.6 : 1,
                cursor: effectiveCreateCount === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              Save {effectiveCreateCount} Room{effectiveCreateCount === 1 ? '' : 's'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
