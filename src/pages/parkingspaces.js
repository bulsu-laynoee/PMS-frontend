import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import normalizeImageUrl from '../utils/imageUrl';
import { FaSearch, FaPlus, FaEdit, FaTrash, FaTimes, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import styles from '../styles/parkingspaces.module.css';

const Parkingspaces = () => {
    const navigate = useNavigate();
    const [layouts, setLayouts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [searchPlate, setSearchPlate] = useState("");
    const [plateError, setPlateError] = useState('');
    const [sortBy, setSortBy] = useState("name");
    const [showBackgrounds, setShowBackgrounds] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [selectedLayout, setSelectedLayout] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        background_image: null
    });
    // --- *** NEW HELPER FUNCTION TO FIX COUNTING *** ---

    /**

     * Calculates the correct counts based on actual assignments, not stale slot status.
     * @param {object} layout - The layout object from /api/parking-layouts
     * @param {object} allAssignments - A map of { layout_id: [assignments...] }
     * @returns {object} - { total, occupied, available, slotsWithAssignment }
     */
    const calculateLayoutCounts = (layout, allAssignments = {}) => {
        if (!layout || !layout.parking_slots) {
            // Return zero counts if layout has no slots
            return { total: 0, occupied: 0, available: 0, slotsWithAssignment: [] };
        }

        const spaces = layout.parking_slots;
        // Get assignments specific to this layout ID
        const assignmentsForThisLayout = allAssignments[layout.id] || [];
        // Create a map of *active or reserved* assignments by slot ID
        // This ensures we only count current, valid assignments
        const activeSlotAssignments = new Map();
        assignmentsForThisLayout.forEach(a => {
            // Check for active/reserved status
            if (a.parking_slot_id && (a.status === 'active' || a.status === 'reserved')) {

                activeSlotAssignments.set(a.parking_slot_id, a);

            }

        });

        let occupiedCount = 0;
        // Map assignments to slots and update their status visually
        const slotsWithAssignment = spaces.map(slot => {
            const assignment = activeSlotAssignments.get(slot.id) || null;
            let currentStatus = 'available'; // Default to available

            if (assignment) {
                occupiedCount++; // Increment occupied count
                currentStatus = assignment.status; // Set status from assignment (e.g., 'active' or 'reserved')
            } else {
                // If no active assignment, mark as available, even if DB is stale
                currentStatus = 'available';
            }
            return {
                ...slot,
                space_status: currentStatus, // This is the TRUE, real-time status
                assignment: assignment
            };
        });

        const total = slotsWithAssignment.length;
        const available = total - occupiedCount;
        // Return all calculated data
        return { total, occupied: occupiedCount, available, slotsWithAssignment };
    };
    // --- *** END OF NEW FUNCTION *** ---
    // When user presses Enter in the plate search, navigate to matched layout/slot if found
    const handlePlateSearchSubmit = (e) => {
        // if called from key event, prevent default
        if (e && e.preventDefault) e.preventDefault();
        // clear previous error
        setPlateError('');
        const plate = (searchPlate || '').trim().toLowerCase();
        if (!plate) {
            const msg = 'Please enter a plate number to search';
            setPlateError(msg);
            window.showAlert && window.showAlert(msg, 'error');
            // clear after a short delay
            setTimeout(() => setPlateError(''), 3500);
            return;
        }

        // Look for first layout that has a matching occupied/reserved slot
        // First try to match vehicle plate
        for (const layout of layouts) {
            if (!layout || !layout.parking_slots) continue;
            const match = (layout.parking_slots || []).find(slot => {
                const plateVal = slot?.assignment?.vehicle_plate || '';
                return String(plateVal).toLowerCase().includes(plate);
            });
            if (match) {
                // navigate to assignment page and focus the slot
                navigate(`/home/parking-assignment/${layout.id}?slot=${match.id}`);
                return;
            }
        }

        // If no plate match, try matching by parking code / slot identifier (name, space_number, slot_number)
        for (const layout of layouts) {
            if (!layout || !layout.parking_slots) continue;
            const codeMatch = (layout.parking_slots || []).find(slot => {
                const candidates = [slot.name, slot.space_number, slot.slot_number];
                return candidates.some(c => c && String(c).toLowerCase().includes(plate));
            });
            if (codeMatch) {
                navigate(`/home/parking-assignment/${layout.id}?slot=${codeMatch.id}`);
                return;
            }
        }

        window.showAlert && window.showAlert(`No parked vehicle found for plate: ${searchPlate}`, 'error');
        setPlateError(`No parked vehicle found for plate: ${searchPlate}`);
        setTimeout(() => setPlateError(''), 4000);
    };
    const fetchLayouts = async () => {
        setLoading(true);
        setError(null);
        try {
            await api.initCsrf();
            // 1. Fetch all layouts
            const response = await api.get('/parking-layouts');
            const layoutsData = response.data.data || [];
            // 2. Fetch ALL assignments
            let assignmentsByLayout = {};
            try {
                const allAssignmentsResp = await api.get('/parking-assignments');
                const allAssignments = allAssignmentsResp.data || [];
                // 3. Group assignments by their layout_id
                allAssignments.forEach(a => {
                    // Try to find layout_id, checking nested parkingSlot
                    const layoutId = a.layout_id || a.parking_layout_id || a.layout?.id || a.parking_slot?.layout_id;
                    if (!layoutId) {
                         // console.warn("Assignment found with no layout_id", a.id);
                         return;
                    }
                    if (!assignmentsByLayout[layoutId]) assignmentsByLayout[layoutId] = [];
                    assignmentsByLayout[layoutId].push(a);
                });
            } catch (err) {
                 console.warn('Could not fetch all assignments:', err);
                 // Keep your robust fallback logic here if needed
            }
            // 4. Map layouts and calculate correct counts
            const layoutsWithCounts = layoutsData.map((layout) => {
                if (!layout) return null;
                // Calculate counts using the new helper function
                // This provides the *correct* occupied/available count
                const { total, occupied, available, slotsWithAssignment } = calculateLayoutCounts(layout, assignmentsByLayout);

                // Return the layout object with CORRECTED counts
                return {
                    id: layout.id,
                    name: layout.name || '',
                    description: layout.description || '',
                    current: occupied, // Use new correct 'occupied' count
                    total: total,
                    parking_slots: slotsWithAssignment, // Use slots with merged assignments
                    backgroundImage: layout.background_image || null,
                    is_active: layout.is_active === undefined ? true : !!layout.is_active,
                };
            }).filter(layout => layout !== null);
            // --- *** END OF UPDATE *** ---

            setLayouts(layoutsWithCounts);

        } catch (error) {
            console.error('Error fetching layouts:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Failed to load parking layouts';
            setError(errorMessage);
        } finally {
             setLoading(false);
        }
    };
    // --- (handleCreate, handleEdit, handleDelete, handleToggleActive remain the same) ---
    const handleCreate = () => {
        setModalMode('create');
        setSelectedLayout(null);
        setFormData({ name: '', description: '', background_image: null });
        setError(null);
        setShowModal(true);
    };

    const handleEdit = (layout, e) => {
        e.stopPropagation();
        navigate(`/home/edit-parking-layout/${layout.id}`);
    };

    const handleDelete = async (layoutId, e) => {
        e.stopPropagation();
        if (!layoutId) {
            window.showAlert('Cannot delete layout: Invalid ID', 'error');
            return;
        }
        if (window.confirm('Are you sure you want to delete this parking space layout? This action cannot be undone.')) {
            try {
                await api.initCsrf();
                await api.delete(`/parking-layouts/${layoutId}`);
                setLayouts(prevLayouts => prevLayouts.filter(layout => layout.id !== layoutId));
                window.showAlert('Parking layout deleted successfully', 'success');
            } catch (error) {
                console.error('Error deleting layout:', error);
                let errorMessage = 'Failed to delete parking layout: ';
                errorMessage += error.response?.data?.message || error.message || 'Unknown error';
                window.showAlert(errorMessage, 'error');
                await fetchLayouts();
            }
        }
    };

    const handleToggleActive = async (layoutId, currentIsActive, e) => {
        e.stopPropagation();
        const newIsActive = !currentIsActive;
        const action = newIsActive ? 'enable' : 'disable';

        if (window.confirm(`Are you sure you want to ${action} this parking layout?`)) {
            setLayouts(prevLayouts => prevLayouts.map(layout =>
                layout.id === layoutId ? { ...layout, is_active: newIsActive } : layout
            ));

            try {
                await api.initCsrf();
                await api.put(`/parking-layouts/${layoutId}`, { is_active: newIsActive });
                 window.showAlert(`Parking layout ${action}d successfully`, 'success');
                 await fetchLayouts(); // Re-fetch to get accurate data
            } catch (error) {
                 console.error(`Error ${action}ing layout:`, error);
                let errorMessage = `Failed to ${action} parking layout: `;
                errorMessage += error.response?.data?.message || error.message || 'Unknown error';
                window.showAlert(errorMessage, 'error');
                setLayouts(prevLayouts => prevLayouts.map(layout =>
                    layout.id === layoutId ? { ...layout, is_active: currentIsActive } : layout
                ));
            }
        }
    };
    // --- (handleSubmit remains the same) ---

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        const token = localStorage.getItem('token');

        try {
            await api.initCsrf();
            if (modalMode === 'create') {
                const formDataToSend = new FormData();
                formDataToSend.append('name', formData.name);
                formDataToSend.append('description', formData.description);
                if (formData.background_image) {
                    formDataToSend.append('background_image', formData.background_image);
                }

                const response = await api.post('/parking-layouts', formDataToSend, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
                });
                 const newLayoutData = response.data.data || {};
                 const { total, occupied, available, slotsWithAssignment } = calculateLayoutCounts(newLayoutData, {});
                 const newLayout = {
                     ...newLayoutData,
                     current: occupied,
                     total: total,
                     parking_slots: slotsWithAssignment,
                     is_active: newLayoutData.is_active === undefined ? true : !!newLayoutData.is_active
                 };
                setLayouts(prevLayouts => [...prevLayouts, newLayout]);
                window.showAlert('Layout created successfully!', 'success');
            } else if (modalMode === 'edit' && selectedLayout) {
                const updateData = { name: formData.name };
                 const response = await api.put(`/parking-layouts/${selectedLayout.id}`, updateData, {
                     headers: {
                         'Authorization': `Bearer ${token}`,
                         'Accept': 'application/json',
                         'Content-Type': 'application/json'
                     }
                 });

                 if (response.data && response.data.data) {
                    await fetchLayouts(); // Re-fetch to get fresh counts
                    window.showAlert('Layout updated successfully!', 'success');
                 } else {
                    throw new Error('Invalid response data received after update.');
                 }
            }
            setShowModal(false);
        } catch (error) {
            console.error('Error saving layout:', error);
            let errorMessage = 'Failed to save layout: ';
            if (error.response) {
                if (error.response.status === 422 && error.response.data.errors) {
                    errorMessage += Object.values(error.response.data.errors).flat().join(' ');
                } else {
                    errorMessage += error.response.data?.message || `Server responded with status ${error.response.status}`;
                }
            } else {
                errorMessage += error.message || 'Network error or request setup issue.';
            }
            setError(errorMessage);
        }
    };

    // --- (useEffect and filteredLayouts remain the same) ---
    useEffect(() => {
        fetchLayouts();
    }, []); // Runs once on mount

    const filteredLayouts = layouts
        .filter(layout => {
            if (!layout) return false;
            const nameMatch = layout.name && layout.name.toLowerCase().includes((searchTerm || '').toLowerCase());
            const plateMatch = !searchPlate || (layout.parking_slots && layout.parking_slots.some(slot =>
                slot?.assignment?.vehicle_plate?.toLowerCase().includes(searchPlate.toLowerCase())
            ));
            return nameMatch && plateMatch;
        })

        .sort((a, b) => {
             if (sortBy === 'name') {
                 return (a.name || '').localeCompare(b.name || '');
             }
             const aRate = a.total ? (a.current / a.total) : 0;
             const bRate = b.total ? (b.current / b.total) : 0;
             return bRate - aRate;
        });

    // --- (Loading/Error JSX remains the same) ---
    if (loading) {
        return (
            <div className={styles['loading-state']}>
                <div className={styles['loading-spinner']} />
                <div className={styles['loading-text']}>Loading parking layouts...</div>
            </div>
        );
    }
    if (!loading && layouts.length === 0 && error) {
        return <div className={styles['error-state']}>{error}</div>;
    }
    // --- (Render/JSX part) ---
    return (
        <div className={styles['parking-container']}>
            <div className={styles['parking-header']}>
                <div className={styles['parking-search']}>
                    <div className={styles['search-input-wrapper']}>
                        <FaSearch className={styles['search-icon']} />
                        <input type="text" placeholder="Search parking spaces..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={styles['search-input']} />
                    </div>
                    <div className={styles['search-input-wrapper']}>
                        <FaSearch className={styles['search-icon']} />
                        <input
                            type="text"
                            placeholder="Search Plate Number..."
                            value={searchPlate}
                            onChange={(e) => setSearchPlate(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handlePlateSearchSubmit(e); }}
                            className={`${styles['search-input']} ${plateError ? styles['search-input-error'] : ''}`}
                        />
                    </div>
                    {plateError && <div className={styles['plate-error-message']}>{plateError}</div>}
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={styles['sort-select']}>
                        <option value="name">Sort by Name</option>
                        <option value="occupancy">Sort by Occupancy</option>
                    </select>
                 <button className={styles['add-parking-btn']} 
                     onClick={() => navigate('/home/manage-parking-layout')} // <-- Changed line
                      > 
                        <FaPlus />
                        <span>Add Space</span>
                  </button>
  
                </div>
            </div>
            {!loading && error && <div className={styles['error-inline']}>{error}</div>}

            {filteredLayouts.length === 0 && !loading ? (
                <div className={styles['empty-message']}>
                    <span className={styles['empty-icon']}>🅿️</span>
                    <p>No parking layouts found matching your criteria</p>
                </div>
            ) : (
                <div className={styles['parking-grid']}>
                    {filteredLayouts.map(layout => {
                        // --- *** UPDATED: Use correct variables from new calculation *** ---
                        const occupied = layout.current;
                        const total = layout.total;
                        const available = total - occupied; // Correct available count
                        const occupancyRate = total > 0 ? (occupied / total) * 100 : 0;

                        let statusClass = styles['available'];
                        if (!layout.is_active) statusClass = styles['disabled-status'];
                        else if (occupancyRate >= 90) statusClass = styles['busy'];
                        else if (occupancyRate >= 70) statusClass = styles['moderate'];

                        const matchedSlots = searchPlate ? (layout.parking_slots || []).filter(slot =>
                            slot?.assignment?.vehicle_plate && String(slot.assignment.vehicle_plate).toLowerCase().includes((searchPlate || '').toLowerCase())
                        ) : [];

                        return (
                            <div
                                key={layout.id}
                                className={`${styles['parking-card']} ${statusClass} ${!layout.is_active ? styles['disabled-layout'] : ''}`}
                                onClick={() => {
                                    if (layout.is_active) {
                                        navigate(`/home/parking-assignment/${layout.id}`)
                                    }
                                }}
                                style={{ pointerEvents: layout.is_active ? 'auto' : 'none' }}
                            >
                                <div className={styles['card-actions']}>
                                    <button
                                        className={`${styles['toggle-btn']} ${layout.is_active ? styles['toggle-btn-active'] : styles['toggle-btn-inactive']}`}
                                        onClick={(e) => handleToggleActive(layout.id, layout.is_active, e)}
                                        title={layout.is_active ? "Disable layout" : "Enable layout"}
                                        style={{ pointerEvents: 'auto' }}
                                    >
                                        {layout.is_active ? <FaToggleOn /> : <FaToggleOff />}
                                    </button>
                                    <button
                                        className={styles['edit-btn']}
                                        onClick={(e) => handleEdit(layout, e)}
                                        title="Edit layout"
                                        style={{ pointerEvents: 'auto' }}
                                    >
                                        <FaEdit />
                                    </button>
                                    <button
                                        className={styles['delete-btn']}
                                        onClick={(e) => handleDelete(layout.id, e)}
                                        title="Delete layout"
                                        style={{ pointerEvents: 'auto' }}
                                    >
                                        <FaTrash />
                                    </button>
                                </div>
                                <div className={styles['card-content']}>
                                    <h3 className={styles['card-title']}>{layout.name}</h3>
                                    {!layout.is_active && <span className={styles['disabled-badge']}>DISABLED</span>}
                                    <div className={styles['card-details']}>
                                        <div className={styles['card-stats']}>
                                            <div className={styles['stat-item']}>
                                                <span className={styles['stat-value']}>{total}</span>
                                                <span className={styles['stat-label']}>Total</span>
                                            </div>
                                            <div className={styles['stat-item']}>
                                                {/* --- FIX: Use correct 'available' variable --- */}
                                                <span className={styles['stat-value']}>{available}</span>
                                                <span className={styles['stat-label']}>Available</span>
                                            </div>
                                            <div className={styles['stat-item']}>
                                                {/* --- FIX: Use correct 'occupied' variable --- */}
                                                <span className={styles['stat-value']}>{occupied}</span>
                                                <span className={styles['stat-label']}>Occupied</span>
                                            </div>
                                        </div>
                                        <div className={styles['occupancy-circle']}>
                                            <svg viewBox="0 0 36 36" className={styles['circular-chart']}>
                                                <path
                                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                    stroke="#eee" strokeWidth="2" fill="none"
                                                />
                                                <path
                                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                    stroke="currentColor" strokeWidth="2" fill="none"
                                                    strokeDasharray={layout.is_active ? `${occupancyRate.toFixed(2)}, 100` : '0, 100'}
                                                />
                                                <text x="18" y="20.35" className={styles['percentage']}>
                                                    {layout.is_active ? `${occupancyRate.toFixed(0)}%` : 'N/A'}
                                                </text>
                                            </svg>
                                        </div>
                                    </div>
                                    {layout.backgroundImage && showBackgrounds && (
                                         <div className={styles['layoutPreview']}>
                                             <img src={normalizeImageUrl(layout.backgroundImage)} alt={layout.name} />
                                         </div>
                                     )}
                                    {matchedSlots && matchedSlots.length > 0 && (
                                        <div className={styles['match-row']} style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {matchedSlots.map(ms => (
                                                <button
                                                    key={`match-${ms.id}`}
                                                    className={styles['view-driver-btn']}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/home/parking-assignment/${layout.id}?slot=${ms.id}`);
                                                    }}
                                                >
                                                    View driver: {ms.assignment?.vehicle_plate} (Slot {ms.name || ms.space_number || ms.slot_number})
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
             {/* Modal */}
            {showModal && (
                <div className={styles['modal-overlay']}>
                    <div className={styles['modal']}>
                        <div className={styles['modal-header']}>
                            <h2>{modalMode === 'create' ? 'Create New Parking Layout' : `Edit Layout: ${selectedLayout?.name || ''}`}</h2>
                            <button className={styles['close-btn']} onClick={() => setShowModal(false)}>
                                <FaTimes />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className={styles['modal-form']}>
                            {error && (
                                <div className={styles['error-message']}>
                                    <FaTimes className={styles['error-icon']} />
                                    <span>{error}</span>
                                    <button
                                        type="button"
                                        className={styles['error-close']}
                                        onClick={() => setError(null)}
                                        aria-label="Close error message"
                                    >
                                        <FaTimes />
                                    </button>
                                </div>
                            )}
                            <div className={styles['form-group']}>
                                <label htmlFor="name">Layout Name</label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    required
                                    placeholder="Enter layout name"
                                />
                            </div>
                            {modalMode === 'create' && (
                                <>
                                    <div className={styles['form-group']}>
                                        <label htmlFor="description">Description</label>
                                        <textarea
                                            id="description"
                                            name="description"
                                            value={formData.description}
                                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                                            placeholder="Enter layout description"
                                            rows="3"
                                        />
                                    </div>
                                    <div className={styles['form-group']}>
                                        <label htmlFor="background_image">Background Image</label>
                                        <input
                                            type="file"
                                            id="background_image"
                                            name="background_image"
                                            accept="image/*"
                                            onChange={(e) => setFormData({...formData, background_image: e.target.files[0]})}
                                        />
                                    </div>
                                </>
                            )}
                            <div className={styles['form-actions']}>
                                <button type="button" className={styles['cancel-btn']} onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className={styles['submit-btn']}>
                                    {modalMode === 'create' ? 'Create Layout' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
export default Parkingspaces;