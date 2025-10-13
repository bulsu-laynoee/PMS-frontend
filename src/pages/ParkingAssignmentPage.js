// NOTE: We render texts below inside an SVG layer. SVG <text> elements now use rotation transforms.
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './ParkingAssignmentPage.module.css';
import api from '../utils/api';
import normalizeImageUrl from '../utils/imageUrl';
import { 
    FaPlus, FaMinus, FaExpand, FaCar, FaRotateRight, FaRotateLeft, 
    FaCopy, FaDrawPolygon, FaCircle, FaArrowLeft, FaEye, FaEyeSlash,
    FaMotorcycle, FaBicycle, FaWheelchair, FaBolt, FaSquareParking,
    FaTable, FaTimes
} from 'react-icons/fa6';
import ParkingOverviewModal from '../components/ParkingOverviewModal';
// Tooltip component
const Tooltip = ({ assignment, slot, anchorEl }) => {
    const [mounted, setMounted] = useState(false);
    const portalRef = useRef(document.createElement('div'));

    useEffect(() => {
        const el = portalRef.current;
        el.id = 'tooltip-portal';
        document.body.appendChild(el);
        setMounted(true);

        return () => {
            document.body.removeChild(el);
        };
    }, []);

    if (!mounted || !anchorEl) return null;

    const rect = anchorEl.getBoundingClientRect();
    const tooltipStyle = {
        position: 'fixed',
        top: rect.top - 120,
        left: rect.left + (rect.width / 2),
        transform: 'translateX(-50%)',
        zIndex: 999999
    };

    return ReactDOM.createPortal(
        <div className={`${styles.tooltip} ${assignment?.is_reserved ? styles.reservedTooltip : ''}`} style={tooltipStyle}>
            <div className={styles.tooltipContent}>
                {assignment ? (
                    <>
                        <div className={styles.tooltipRow}>
                            <span className={styles.tooltipLabel}>Name:</span>
                            <span>{assignment.name}</span>
                        </div>
                        <div className={styles.tooltipRow}>
                            <span className={styles.tooltipLabel}>Contact:</span>
                            <span>{assignment.contact_number}</span>
                        </div>
                        <div className={styles.tooltipRow}>
                            <span className={styles.tooltipLabel}>Vehicle:</span>
                            <span>{assignment.vehicle_details}</span>
                        </div>
                        <div className={styles.tooltipRow}>
                            <span className={styles.tooltipLabel}>Type:</span>
                            <span>{assignment.assignee_type === 'faculty' ? 'Faculty' : 'Guest'}</span>
                        </div>
                        {assignment.assignee_type === 'faculty' && (
                            <div className={styles.tooltipRow}>
                                <span className={styles.tooltipLabel}>Faculty Position:</span>
                                <span>{assignment.faculty_position || '-'}</span>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div className={styles.tooltipRow}>
                            <span className={styles.tooltipLabel}>Status:</span>
                            <span>Available</span>
                        </div>
                        <div className={styles.tooltipRow}>
                            <span className={styles.tooltipLabel}>Space Type:</span>
                            <span>{slot.space_type ? slot.space_type.charAt(0).toUpperCase() + slot.space_type.slice(1) : 'Standard'}</span>
                        </div>
                        <div className={styles.tooltipRow}>
                            <span className={styles.tooltipLabel}>Space #:</span>
                            <span>{slot.name || slot.space_number || slot.slot_number}</span>
                        </div>
                    </>
                )}
            </div>
        </div>,
        portalRef.current
    );
};

// Icon helpers are defined later to avoid duplicate declarations

const TooltipPortal = ({ children }) => {
    const portalRef = useRef(null);

    if (!portalRef.current) {
        const existingPortal = document.getElementById('tooltip-portal');
        if (existingPortal) {
            portalRef.current = existingPortal;
        } else {
            const el = document.createElement('div');
            el.id = 'tooltip-portal';
            document.body.appendChild(el);
            portalRef.current = el;
        }
    }

    return ReactDOM.createPortal(children, portalRef.current);
};

const ParkingAssignmentPage = () => {
    const navigate = useNavigate();
    const { layoutId } = useParams();

    // Manual refresh handler
    const handleRefresh = async () => {
        setLoading(true);
        await Promise.all([
            fetchLayout(),
            fetchAssignments()
        ]);
        setLoading(false);
    };
    
    // Component state
    const [layout, setLayout] = useState(null);
    const [allUsers, setAllUsers] = useState([]);
    const [allVehicles, setAllVehicles] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [showBackground, setShowBackground] = useState(false);
    const [assignments, setAssignments] = useState({});
    const [lines, setLines] = useState([]);
    const [texts, setTexts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const [draggedAssignment, setDraggedAssignment] = useState(null);
    const [hoveredSlotId, setHoveredSlotId] = useState(null);
    const layoutSectionRef = useRef(null);
    const isPanningRef = useRef(false);
    const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
    // start with a safe minimal size; compute real size after layout dims are known
    const [scrollInnerSize, setScrollInnerSize] = useState({ w: 1, h: 1 });
    const [showOverviewModal, setShowOverviewModal] = useState(false);
    // Zoom state for layout view (non-destructive scaling)
    const [viewScale, setViewScale] = useState(1);
    const ABS_MIN_VIEW_SCALE = 0.25;
    const MAX_VIEW_SCALE = 3;
    const VIEW_ZOOM_STEP = 0.1;

    const getMinViewScale = () => (layout && (layout.image_path || layout.background_image) ? 1 : ABS_MIN_VIEW_SCALE);

    const handleZoomIn = () => setViewScale(s => Math.min(MAX_VIEW_SCALE, +(s + VIEW_ZOOM_STEP).toFixed(2)));
    const handleZoomOut = () => setViewScale(s => Math.max(getMinViewScale(), +(s - VIEW_ZOOM_STEP).toFixed(2)));
    const handleResetZoom = () => setViewScale(1);
    const [formData, setFormData] = useState({
        assignee_type: 'guest',
        assignment_type: 'assign',
        name: '',
        contact: '',
        vehicle_type: '',
        vehicle_plate: '',
        vehicle_color: '',
        start_time: new Date().toISOString().slice(0, 16),
        end_time: '',
        faculty_position: '',
    });
    const [formError, setFormError] = useState(null);
    // Tooltip state
    const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, slot: null, assignment: null });
    const [tooltipAnchor, setTooltipAnchor] = useState(null);

    // Function to handle slot hover state
    const handleSlotHover = useCallback((slot, isEnter, event) => {
        if (!isEnter) {
            setHoveredSlotId(null);
            return;
        }
        setHoveredSlotId(slot.id);
    }, []);

    const fetchLayout = useCallback(async () => {
        try {
            await api.initCsrf();
            const response = await api.get(`/parking-layouts/${layoutId}`);
            const layoutData = response.data;
            
            // Debug logging for API response
            console.log('Raw API Response:', {
                fullResponse: response.data,
                parkingSlots: response.data?.data?.parking_slots,
                sampleSlot: response.data?.data?.parking_slots?.[0],
                metadata: response.data?.data?.parking_slots?.[0]?.metadata
            });
            
            if (!layoutData || !layoutData.data) {
                throw new Error('No layout data found in response');
            }
            
            const rawLayoutData = layoutData.data.layout_data || {};
            
            // Ensure we have the proper data structure
            const processedLayout = {
                ...layoutData.data,
                layout_data: {
                    parking_slots: rawLayoutData.parking_slots || [],
                    lines: rawLayoutData.lines || [],
                    texts: rawLayoutData.texts || []
                },
                parking_slots: (layoutData.data.parking_slots || []).map(slot => ({
                    ...slot,
                    rotation: parseFloat(slot.rotation || slot.metadata?.rotation || 0),  // Try direct rotation first, then metadata
                    x_coordinate: parseFloat(slot.position_x || slot.x_coordinate || 0),
                    y_coordinate: parseFloat(slot.position_y || slot.y_coordinate || 0),
                    width: parseFloat(slot.width || slot.metadata?.width || 60),
                    height: parseFloat(slot.height || slot.metadata?.height || 120),
                    metadata: {
                        ...slot.metadata,
                        rotation: slot.rotation || slot.metadata?.rotation || 0  // Sync rotation to metadata
                    }
                }))
            };

            // Extract lines/texts from processed layout data (safe defaults)
            const { lines: extractedLines = [], texts: extractedTexts = [] } = processedLayout.layout_data || {};

            // If backend uses a background_image field, normalize to a usable image_path (full URL when possible)
            if (processedLayout.background_image && !processedLayout.image_path) {
                try {
                    const base = (api.defaults && api.defaults.baseURL) || process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
                    const origin = base.replace(/\/api\/?$/, '');
                    const bg = processedLayout.background_image;
                    if (/^https?:\/\//i.test(bg)) {
                        // already a full URL
                        processedLayout.image_path = bg;
                    } else {
                        const clean = String(bg).replace(/^\/+/, '');
                        if (clean.startsWith('storage/')) {
                            processedLayout.image_path = `${origin}/${clean}`;
                        } else {
                            // assume it's the storage path or filename
                            processedLayout.image_path = `${origin}/storage/${clean}`;
                        }
                    }
                } catch (err) {
                    // fallback: try using the raw value as-is
                    processedLayout.image_path = processedLayout.background_image;
                }
            }

            // Set the extracted elements and layout data
            setLines(extractedLines);
            setTexts(extractedTexts);
            setLayout(processedLayout);
            
            // Add debug logging
           
            setLoading(false);
        } catch (error) {
            console.error('Error fetching layout:', error);
            console.error('Error details:', error.response?.data);
            setLayout(null);
            setLoading(false);
        }
    }, [layoutId]);

    const processAssignmentData = (assignment) => {
        if (!assignment || !assignment.parking_slot_id) return null;
        
        // Only process active or reserved assignments
        if (assignment.status !== 'active' && assignment.status !== 'reserved') {
            return null;
        }
        
        // Determine if this is a reservation
        const isReserved = assignment.assignment_type === 'reserve' || assignment.status === 'reserved';
        
        // Ensure dimensions are properly set
        const slot = assignment.parking_slot || {};
        return {
            ...assignment,
            id: assignment.id,
            name: assignment.guest_name || assignment.user?.name || '',
            contact_number: assignment.guest_contact || assignment.user?.contact || '',
            vehicle_details: `${assignment.vehicle_type || ''} ${assignment.vehicle_plate || ''} (${assignment.vehicle_color || ''})`.trim(),
            status: assignment.status,
            is_reserved: isReserved,
            space_status: isReserved ? 'reserved' : 'occupied',
            width: parseFloat(slot.width || slot.metadata?.width || 60),
            height: parseFloat(slot.height || slot.metadata?.height || 120),
            x_coordinate: parseFloat(slot.position_x || slot.x_coordinate || 0),
            y_coordinate: parseFloat(slot.position_y || slot.y_coordinate || 0),
            rotation: parseFloat(slot.rotation || slot.metadata?.rotation || 0)
        };
    };

    const fetchAssignments = useCallback(async () => {
        if (!layoutId) return; // Need layoutId to fetch assignments
        
        try {
            await api.initCsrf();
            console.log('🔄 Starting assignment fetch cycle...');
            
            const response = await api.get('/parking-assignments');
            
            // Get assignments data
            const assignmentsData = response.data || [];
            console.log('📥 Raw API Response:', response.data);
            
            // Create assignments map with processed data
            const newAssignmentsMap = {};
            
            // Process each assignment and only include active or reserved assignments
            assignmentsData.forEach(assignment => {
                if (assignment?.parking_slot_id && 
                    (assignment.status === 'active' || assignment.status === 'reserved')) {
                    const slotId = String(assignment.parking_slot_id);
                    newAssignmentsMap[slotId] = processAssignmentData(assignment);
                }
            });
            
            console.log('Processed assignments:', newAssignmentsMap);
            setAssignments(newAssignmentsMap);
            
        } catch (error) {
            console.error('Error fetching assignments:', error);
        }
    }, [layoutId]);

    // Fetch all users with vehicles for assignment autoload
    const fetchUsersAndVehicles = useCallback(async () => {
        try {
            await api.initCsrf();
            // New endpoint returns users with vehicles embedded
            const res = await api.get('/users-with-vehicles');
            const raw = res.data.data || res.data || [];
            const users = Array.isArray(raw) ? raw : Object.values(raw || {});
            setAllUsers(users);
            // Build a flat vehicles list for any other needs
            const flatVehicles = [];
            users.forEach(u => {
                if (Array.isArray(u.vehicles)) {
                    u.vehicles.forEach(v => flatVehicles.push(v));
                }
            });
            setAllVehicles(flatVehicles);
        } catch (err) {
            console.error('Failed to fetch users-with-vehicles for assignment autoload', err);
        }
    }, []);

    useEffect(() => {
        // Fetch both layout and assignments on mount or when layoutId changes
        if (layoutId) {
            handleRefresh();
            fetchUsersAndVehicles();
        }
    }, [layoutId, fetchLayout, fetchAssignments]);

    // Debug effect to track assignments and hover state
    useEffect(() => {
        console.log('State Update:', {
            assignmentsCount: Object.keys(assignments).length,
            assignments,
            hoveredSlotId,
            hasHoveredAssignment: hoveredSlotId ? !!assignments[String(hoveredSlotId)] : false,
            hoveredAssignment: hoveredSlotId ? assignments[String(hoveredSlotId)] : null
        });
    }, [assignments, hoveredSlotId]);

    // Effect to sync layout state with assignments
    useEffect(() => {
        if (!layout || !assignments) return;

        setLayout(prev => {
            if (!prev) return prev;
            
            const updatedSlots = prev.parking_slots?.map(slot => {
                const slotId = String(slot.id);
                const assignment = assignments[slotId];
                
                if (!assignment) {
                    return {
                        ...slot,
                        space_status: 'available',
                        assignment_type: null,
                        status: 'available',
                        is_reserved: false,
                        assignment: null
                    };
                }
                
                const isReserved = assignment.is_reserved || 
                    assignment.assignment_type === 'reserve' || 
                    assignment.status === 'reserved';
                
                return {
                    ...slot,
                    space_status: isReserved ? 'reserved' : 'occupied',
                    assignment_type: assignment.assignment_type,
                    status: isReserved ? 'reserved' : 'active',
                    is_reserved: isReserved,
                    assignment: {
                        ...assignment,
                        status: isReserved ? 'reserved' : 'active',
                        space_status: isReserved ? 'reserved' : 'occupied'
                    }
                };
            });

            if (JSON.stringify(prev.parking_slots) === JSON.stringify(updatedSlots)) {
                return prev;
            }

            return {
                ...prev,
                parking_slots: updatedSlots
            };
        });
    }, [layout, assignments]);

    const handleSlotClick = (slot) => {
        console.log('Slot clicked:', {
            id: slot.id,
            space_number: slot.space_number,
            space_status: slot.space_status,
            full_slot: slot
        });

        const isOccupiedOrReserved = slot.space_status === 'occupied' || slot.space_status === 'reserved';
        
        if (!isOccupiedOrReserved) {
            console.log('Showing form for available slot:', slot.id);
            setSelectedSlot(slot);
            setShowForm(true);
            setFormData(prev => ({
                ...prev,
                parking_slot_id: slot.id
            }));
            // preload users/vehicles if small data set
            fetchUsersAndVehicles();
        } else {
            console.log('Form not shown because slot is occupied/reserved:', slot.space_status);
        }
    };

    const handleDragStart = (e, slot) => {
        if (slot.space_status === 'occupied' || slot.space_status === 'reserved') {
            e.stopPropagation();
            const assignment = assignments[String(slot.id)];
            console.log('Starting drag with assignment:', assignment);
            if (!assignment) {
                console.error('No assignment found for slot:', slot.id);
                return;
            }
            setDraggedAssignment(assignment);
            e.dataTransfer.setData('text/plain', slot.id);
            e.dataTransfer.effectAllowed = 'move';
        }
    };

    const handleDragEnd = (e) => {
        e.preventDefault();
        setDraggedAssignment(null);
        setIsDragging(false);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e, targetSlot) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!draggedAssignment || !draggedAssignment.id) {
            console.error('No valid dragged assignment found');
            setDraggedAssignment(null);
            setIsDragging(false);
            return;
        }

        try {
            await api.initCsrf();

            // Get the target slot's assignment if it exists
            const targetAssignment = assignments[String(targetSlot.id)];

            // Removed: Prevent switching between same type of vehicle

            const response = await api.post(`/parking-assignments/${draggedAssignment.id}/switch-parking`, {
                new_slot_id: targetSlot.id,
                target_assignment_id: targetAssignment?.id // Send the target assignment ID if it exists
            });

            // Update local assignments state before fetching fresh data
            const { source_assignment, target_assignment } = response.data;
            
            setAssignments(prev => {
                const updated = { ...prev };
                
                // Update source assignment
                if (source_assignment) {
                    delete updated[String(source_assignment.parking_slot_id)];
                    updated[String(targetSlot.id)] = processAssignmentData(source_assignment);
                }
                
                // Update target assignment if it exists
                if (target_assignment) {
                    delete updated[String(targetSlot.id)];
                    updated[String(target_assignment.parking_slot_id)] = processAssignmentData(target_assignment);
                }
                
                return updated;
            });

            // Get fresh data to ensure state is correct
            await Promise.all([fetchLayout(), fetchAssignments()]);
            setDraggedAssignment(null);
            setIsDragging(false);
            window.showAlert('Parking space reassigned successfully!', 'success');
        } catch (error) {
            console.error('Error reassigning space:', error);
            const errorMessage = error.response?.data?.message || error.message;
            setFormError(errorMessage);
            // Show error in a more user-friendly way
            // Extract the actual error message from the response
            let formattedError = errorMessage;
            if (error.response?.data?.error) {
                formattedError = error.response.data.error;
            } else if (error.response?.data?.message && error.response.data.message !== 'Error switching parking slot') {
                formattedError = error.response.data.message;
            }
            window.showAlert(formattedError, 'error');
        } finally {
            setDraggedAssignment(null);
            setIsDragging(false);
        }
    };

    const handleAssignment = async (e) => {
        e.preventDefault();
        setLoading(true);
        setFormError(null);
        try {
            // Create the payload with all required fields
            const payload = {
                ...formData,
                parking_slot_id: selectedSlot.id,
                purpose: formData.purpose || '',
                guest_name: formData.name, // Always use the name field
                guest_contact: formData.contact // Always use the contact field
            };
            await api.initCsrf();
            const isReservation = formData.assignment_type === 'reserve';
            const assignmentData = {
                parking_slot_id: selectedSlot.id,
                guest_name: formData.name,
                guest_contact: formData.contact,
                vehicle_plate: formData.vehicle_plate,
                vehicle_type: formData.vehicle_type,
                vehicle_color: formData.vehicle_color,
                start_time: formData.start_time,
                end_time: formData.end_time || null,
                purpose: formData.purpose,
                assignment_type: formData.assignment_type,
                assignee_type: formData.assignee_type,
                faculty_position: formData.faculty_position // <-- ensure this is sent
            };
            
            // Show loading state
            setLoading(true);
            
            const response = await api.post('/parking-assignments', assignmentData);

            // Update assignments locally first
            const newAssignment = response.data.assignment;
            setAssignments(prev => ({
                ...prev,
                [String(newAssignment.parking_slot_id)]: processAssignmentData(newAssignment)
            }));

            // Then refresh data from server
            await Promise.all([fetchLayout(), fetchAssignments()]);
            
            setFormData({
                assignee_type: 'guest',
                assignment_type: 'assign',
                name: '',
                contact: '',
                vehicle_type: '',
                vehicle_plate: '',
                vehicle_color: '',
                start_time: new Date().toISOString().slice(0, 16),
                end_time: '',
                purpose: '',
                faculty_position: ''
            });
            setSelectedSlot(null);
            setShowForm(false);
            
            setFormError(null);
            setShowForm(false);
        } catch (error) {
            setLoading(false); // Stop loading immediately on error
            // Show error in both form and alert
            if (error.response?.status === 422) {
                const validationErrors = error.response.data.errors;
                if (validationErrors) {
                    // Get all validation error messages
                    const errorMessages = Object.values(validationErrors)
                        .flat()
                        .join('\n');
                    setFormError(errorMessages);
                    alert(errorMessages);
                } else {
                    const message = error.response.data.message || 'Validation failed';
                    setFormError(message);
                    alert(message);
                }
            } else {
                const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to create parking assignment';
                setFormError(errorMessage);
                alert(errorMessage);
            }
            return;
        }
        setLoading(false); // Stop loading after success
        // Reset form data
        setFormData({
            assignee_type: 'guest',
            assignment_type: 'assign',
            name: '',
            contact: '',
            vehicle_type: '',
            vehicle_plate: '',
            vehicle_color: '',
            start_time: new Date().toISOString().slice(0, 16),
            end_time: '',
            purpose: '',
            faculty_position: ''
        });
        setSelectedSlot(null);
        setShowForm(false);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // When admin selects a user to autoload, populate form fields and vehicle options
    const handleSelectUser = (userId) => {
        const u = allUsers.find(x => String(x.id) === String(userId));
        if (!u) return;
        // populate fields from user
        setFormData(prev => ({
            ...prev,
            name: u.name || '',
            contact: u.contact_number || u.contact || '',
            assignee_type: (u.role || '').toLowerCase() === 'faculty' ? 'faculty' : 'guest',
            faculty_position: u.faculty_position || ''
        }));
        // vehicles are now embedded on the user object
        const vs = Array.isArray(u.vehicles) ? u.vehicles : [];
        // filter vehicles by compatibility with the selected slot's space type
        const compatibleVehicles = (vs || []).filter(v => {
            const vtype = (v.vehicle_type || v.vehicle_type || '').toLowerCase();
            const spaceType = selectedSlot?.space_type || null;
            return isVehicleCompatible(vtype, spaceType);
        });
        // If one compatible vehicle, autofill plate/type/color
        if (compatibleVehicles.length === 1) {
            const v = compatibleVehicles[0];
            setFormData(prev => ({ ...prev, vehicle_plate: v.plate_number || '', vehicle_type: v.vehicle_type || '', vehicle_color: v.vehicle_color || '' }));
        } else if (compatibleVehicles.length > 1) {
            // clear plate and vehicle_type to let admin choose from compatible list
            setFormData(prev => ({ ...prev, vehicle_plate: '', vehicle_type: '', vehicle_color: '', _no_compatible_user_vehicles: false }));
        } else {
            // no compatible vehicles for this slot
            setFormData(prev => ({ ...prev, vehicle_plate: '', vehicle_type: '', vehicle_color: '', _no_compatible_user_vehicles: true }));
        }
        // store selected user vehicles (compatible) in local state for UI
        setFormData(prev => ({ ...prev, _selected_user_vehicles: compatibleVehicles }));
    };

    // Lookup vehicle by plate number and autofill form (loads vehicle then user)
    const handleLookupByPlate = async () => {
        const plate = (formData._lookup_plate || '').trim();
        if (!plate) {
            const msg = 'Please enter a plate number to look up';
            setFormError(msg);
            window.showAlert && window.showAlert(msg, 'error');
            return;
        }

        try {
            await api.initCsrf();

            // Prefer the dedicated lookup endpoint which returns a single vehicle (case-insensitive exact match)
            let vehicle = null;
            try {
                const r = await api.get(`/vehicles/lookup-by-plate/${encodeURIComponent(plate)}`);
                vehicle = r.data?.data || r.data || null;
            } catch (err) {
                // ignore and fall back to search below
                console.debug('Exact lookup endpoint failed, falling back to search', err);
            }

            // If exact lookup returned nothing, try partial search endpoint but only accept exact-plate matches
            let candidates = [];
            if (!vehicle) {
                const s = await api.get('/vehicles/search', { params: { q: plate } });
                const matches = s.data?.data || s.data || [];
                // Only accept matches that are exact plate matches (case-insensitive)
                candidates = Array.isArray(matches) ? matches.filter(v => String(v.plate_number || '').toLowerCase() === plate.toLowerCase()) : [];
                if (candidates.length === 0) {
                    const msg = `No vehicle found for plate ${plate}`;
                    setFormError(msg);
                    window.showAlert && window.showAlert(msg, 'error');
                    return;
                }
            } else {
                candidates = [vehicle];
            }

            // At this point we have one or more exact-plate candidates
            if (!Array.isArray(candidates) || candidates.length === 0) {
                const msg = `No vehicle found for plate ${plate}`;
                setFormError(msg);
                window.showAlert && window.showAlert(msg, 'error');
                return;
            }

            // If a slot is selected, filter by compatibility; otherwise accept all candidates
            const spaceType = selectedSlot?.space_type || null;
            const compatible = spaceType ? candidates.filter(v => isVehicleCompatible((v.vehicle_type || v.type || '').toLowerCase(), spaceType)) : candidates.slice();

            if (compatible.length === 0) {
                // Found vehicle(s) with that plate, but none are compatible with the selected slot
                const msg = spaceType ? `Vehicle found but not compatible with this slot type (${spaceType}).` : `Vehicle found but slot compatibility could not be determined.`;
                setFormError(msg);
                window.showAlert && window.showAlert(msg, 'error');
                return;
            }

            // If multiple compatible vehicles, populate the picklist so admin can choose
            let chosenVehicle = null;
            if (compatible.length === 1) {
                chosenVehicle = compatible[0];
            } else {
                // populate picklist and let the user pick; show info alert
                setFormData(prev => ({ ...prev, _selected_user_vehicles: compatible }));
                const msg = `Multiple vehicles found for plate ${plate}. Please choose the correct one from the vehicle selector.`;
                window.showAlert && window.showAlert(msg, 'info');
                return;
            }

            // Determine user info: vehicle may include user or vehicle-level userDetails
            let user = vehicle.user || null;

            // Try to extract contact from vehicle.userDetails, vehicle.user (flattened), or nested userDetail
            const contactFromVehicleUserDetails = vehicle.userDetails?.contact_number || vehicle.userDetails?.contact || null;
            const contactFromUserDirect = vehicle.user?.contact_number || vehicle.user?.contact || null;
            const contactFromUserNested = vehicle.user?.userDetail?.contact_number || vehicle.user?.userDetail?.contact || null;

            // If user not present but vehicle has user_id, try fetching the user resource
            if (!user && vehicle.user_id) {
                try {
                    const ures = await api.get(`/users/${vehicle.user_id}`);
                    user = ures.data?.data || ures.data || null;
                } catch (err) {
                    console.debug('Failed to fetch user for vehicle lookup', err);
                }
            }

            // If still no contact, try the users-with-vehicles endpoint (returns contact_number) as fallback
            let contactFallback = '';
            if ((!contactFromVehicleUserDetails && !contactFromUserDirect && !contactFromUserNested) && vehicle.user_id) {
                try {
                    const all = await api.get('/users-with-vehicles');
                    const raw = all.data?.data || all.data || [];
                    const found = (Array.isArray(raw) ? raw : Object.values(raw || {})).find(u => String(u.id) === String(vehicle.user_id));
                    if (found) contactFallback = found.contact_number || found.contact || '';
                } catch (err) {
                    console.debug('Failed to fetch users-with-vehicles for contact fallback', err);
                }
            }

            // Build sensible name/contact fallbacks
            const resolvedName = user?.name || vehicle.userDetails?.firstname || vehicle.userDetails?.name || '';
            const resolvedContact = user?.contact_number || user?.contact || contactFromVehicleUserDetails || contactFromUserDirect || contactFromUserNested || contactFallback || '';

            // Populate form fields from user and vehicle and clear any previous error
            setFormError(null);
            setFormData(prev => ({
                ...prev,
                _lookup_plate: plate,
                name: resolvedName || prev.name || '',
                contact: resolvedContact || prev.contact || '',
                assignee_type: (user?.role || '').toLowerCase() === 'faculty' ? 'faculty' : prev.assignee_type || 'guest',
                faculty_position: user?.faculty_position || prev.faculty_position || '',
                _selected_user_vehicles: user && Array.isArray(user.vehicles) ? user.vehicles : (user ? [] : prev._selected_user_vehicles),
                vehicle_plate: vehicle.plate_number || vehicle.vehicle_plate || prev.vehicle_plate || '',
                vehicle_type: vehicle.vehicle_type || vehicle.type || prev.vehicle_type || '',
                vehicle_color: vehicle.vehicle_color || vehicle.color || prev.vehicle_color || ''
            }));

            window.showAlert && window.showAlert(`Loaded data for plate ${vehicle.plate_number || plate}`, 'success');
        } catch (err) {
            console.error('Plate lookup failed', err);
            const msg = 'Failed to lookup vehicle by plate';
            setFormError(msg);
            window.showAlert && window.showAlert(msg, 'error');
        }
    };

    const isVehicleCompatible = (vehicleType = '', spaceType = '') => {
        if (!spaceType) return true; // unknown space type -> allow
        const vt = (vehicleType || '').toLowerCase();
        const st = String(spaceType || '').toLowerCase();
        switch (st) {
            case 'compact':
                return vt === 'motorcycle' || vt === 'bicycle';
            case 'standard':
                return vt === 'car' || vt === 'suv' || vt === 'sedan' || vt === 'van';
            case 'handicap':
                return vt === 'car' || vt === 'suv' || vt === 'van';
            case 'ev':
                return vt === 'car' || vt === 'suv' || vt === 'van';
            default:
                return true;
        }
    };

    // Pan (drag-to-scroll) handlers
    const handleMouseDown = (e) => {
        // Only start pan when left button and not interacting with form fields
        if (e.button !== 0) return;
        const el = layoutSectionRef.current;
        if (!el) return;
        isPanningRef.current = true;
        panStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            scrollLeft: el.scrollLeft,
            scrollTop: el.scrollTop
        };
    setIsDragging(true);
    if (layoutSectionRef.current) layoutSectionRef.current.classList.add('dragging');
    };

    const handleMouseMove = (e) => {
        if (!isPanningRef.current) return;
        const el = layoutSectionRef.current;
        if (!el) return;
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        // Invert movement so dragging the page moves content naturally
        el.scrollLeft = panStartRef.current.scrollLeft - dx;
        el.scrollTop = panStartRef.current.scrollTop - dy;
    };

    const handleMouseUp = (e) => {
        isPanningRef.current = false;
    setIsDragging(false);
    if (layoutSectionRef.current) layoutSectionRef.current.classList.remove('dragging');
    };

    const handleWheel = (e) => {
        // Allow vertical scroll by default; prevent pinch-zoom or unexpected scrolls
        // If ctrlKey is pressed, treat as zoom intent (do nothing here)
        if (e.ctrlKey) return;
        // Use default scrolling behavior
    };

    const resetView = () => {
        // Center the scroll to the middle of the scaled canvas
        const el = layoutSectionRef.current;
        if (!el) return;
    const targetLeft = (Math.max(canvasWidth * viewScale, scrollInnerSize.w) - el.clientWidth) / 2;
    const targetTop = (Math.max(canvasHeight * viewScale, scrollInnerSize.h) - el.clientHeight) / 2;
        el.scrollLeft = Math.max(0, targetLeft);
        el.scrollTop = Math.max(0, targetTop);
        setViewScale(1);
    };

    const getSpaceTypeIcon = (spaceType) => {
        switch (spaceType) {
            case 'handicap':
                return <FaWheelchair className={styles.spaceTypeIcon} />;
            case 'compact':
                return <FaMotorcycle className={styles.spaceTypeIcon} />;
            case 'ev':
                return <FaBolt className={styles.spaceTypeIcon} />;
            default:
                return <FaSquareParking className={styles.spaceTypeIcon} />;
        }
    };

    const getVehicleIcon = (vehicleType) => {
        switch (vehicleType?.toLowerCase()) {
            case 'motorcycle':
                return <FaMotorcycle className={styles.vehicleIcon} />;
            case 'bicycle':
                return <FaBicycle className={styles.vehicleIcon} />;
            default:
                return <FaCar className={styles.vehicleIcon} />;
        }
    };

    // Determine canvas dimensions from layout if provided in any common field, otherwise compute from elements or fall back to 1024x768
    const explicitWidth = Number(layout?.layout_data?.width || layout?.width || layout?.layout_width || layout?.metadata?.width) || 0;
    const explicitHeight = Number(layout?.layout_data?.height || layout?.height || layout?.layout_height || layout?.metadata?.height) || 0;

    // Helper to compute extents from slots, texts, and lines when explicit size is not provided
    const computeExtents = () => {
        if (!layout) return { w: 0, h: 0 };
        let maxX = 0;
        let maxY = 0;

        const slots = layout.parking_slots || [];
        slots.forEach(s => {
            const x = Number(s.x_coordinate || s.position_x || s.x || 0) || 0;
            const y = Number(s.y_coordinate || s.position_y || s.y || 0) || 0;
            const w = Number(s.width || s.metadata?.width || s.w || 0) || 0;
            const h = Number(s.height || s.metadata?.height || s.h || 0) || 0;
            maxX = Math.max(maxX, x + w);
            maxY = Math.max(maxY, y + h);
        });

        const txts = layout.layout_data?.texts || layout.texts || texts || [];
        txts.forEach(t => {
            const x = Number(t.x || t.position_x || 0) || 0;
            const y = Number(t.y || t.position_y || 0) || 0;
            const fontSize = Number(t.fontSize || t.font_size || t.size) || 16;
            const length = (t.text || t.content || '').length || 4;
            // approximate text width
            const approxW = Math.max(20, length * fontSize * 0.6);
            const approxH = fontSize * 1.2;
            maxX = Math.max(maxX, x + approxW);
            maxY = Math.max(maxY, y + approxH);
        });

        const lns = layout.layout_data?.lines || layout.lines || lines || [];
        lns.forEach(l => {
            const pts = l.points || [];
            for (let i = 0; i < pts.length; i += 2) {
                const px = Number(pts[i]) || 0;
                const py = Number(pts[i + 1]) || 0;
                maxX = Math.max(maxX, px);
                maxY = Math.max(maxY, py);
            }
        });

        return { w: Math.ceil(maxX), h: Math.ceil(maxY) };
    };

    // Enforce strict canvas size
    const canvasWidth = 1024;
    const canvasHeight = 768;

    // Use normalized background URL where possible
    const bgUrl = layout ? normalizeImageUrl(layout.image_path || layout.background_image) : null;

    // Keep the scroll-inner effective size in sync with canvas dimensions and zoom
    useEffect(() => {
    const container = layoutSectionRef.current;
    const containerW = container ? container.clientWidth : 0;
    const containerH = container ? container.clientHeight : 0;
    const w = Math.max(1, Math.round(canvasWidth * viewScale), containerW);
    const h = Math.max(1, Math.round(canvasHeight * viewScale), containerH);
    setScrollInnerSize({ w, h });
    }, [canvasWidth, canvasHeight, viewScale]);

    // Auto-fit the canvas into the viewport when the layout first loads so users
    // at 100% browser zoom can see the whole canvas without changing browser zoom.
    useEffect(() => {
        if (!layout) return;
        const el = layoutSectionRef.current;
        if (!el) return;
        const containerW = el.clientWidth;
        const containerH = el.clientHeight;
        const scaleW = containerW / canvasWidth;
        const scaleH = containerH / canvasHeight;
        const fitScale = Math.min(1, scaleW, scaleH);
        // Only reduce scale automatically (don't force increase above 1)
        if (fitScale < 1) {
            // Respect minimum view scale (don't zoom out below actual size when background exists)
            const min = getMinViewScale();
            setViewScale(Math.max(min, +fitScale.toFixed(2)));
        }
    }, [layout, canvasWidth, canvasHeight]);

    // On window resize, if the user is at default zoom (1), auto-fit the canvas
    // so they don't need to change browser zoom to see the whole layout.
    useEffect(() => {
        const handleResize = () => {
            if (!layout) return;
            const el = layoutSectionRef.current;
            if (!el) return;
            const containerW = el.clientWidth;
            const containerH = el.clientHeight;
            const scaleW = containerW / canvasWidth;
            const scaleH = containerH / canvasHeight;
            const fitScale = Math.min(1, scaleW, scaleH);
            // Only auto-adjust when user hasn't manually zoomed (viewScale === 1)
            if (viewScale === 1 && fitScale < 1) {
                const min = getMinViewScale();
                setViewScale(Math.max(min, +fitScale.toFixed(2)));
            }
        };

        window.addEventListener('resize', handleResize);
        // call once to ensure correct initial fit on dynamic viewports
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, [layout, canvasWidth, canvasHeight, viewScale]);

    if (loading) {
        return (
            <div className={styles.pageContainer}>
                <div className={styles.header}>
                    <button 
                        onClick={() => navigate('/home/parkingspaces')} 
                        className={styles.backButton}
                        title="Back to Parking Spaces"
                    >
                        <FaArrowLeft />
                    </button>
                    <h1>Loading Parking Layout</h1>
                </div>
                <div className={styles.loading}>Loading parking layout...</div>
            </div>
        );
    }

    if (!layout) {
        return <div className={styles.error}>Error loading layout. Please try again.</div>;
    }

    // Removed unused variables 'total' and 'occupied'

    // In your main render, add:
    // {renderTexts()}



    return (
        <div className={styles.pageContainer}>
            <div className={styles.header}>
                <button 
                    onClick={() => navigate('/home/parkingspaces')} 
                    className={styles.backButton}
                    title="Back to Parking Spaces"
                >
                    <FaArrowLeft />
                </button>
                <h1>
                    {layout.name}
                    <span style={{ 
                        fontSize: '1rem', 
                        opacity: 0.7, 
                        marginLeft: '12px',
                        fontWeight: 'normal' 
                    }}>
                        Select a Space to Assign
                    </span>
                </h1>
                <div className={styles.controls}>
                    <button 
                        onClick={handleRefresh}
                        className={styles.refreshButton}
                        title="Refresh Layout and Assignments"
                        disabled={loading}
                        style={{ marginRight: 8 }}
                    >
                        {loading ? 'Refreshing...' : <FaRotateRight />}
                    </button>

                    <button
                        onClick={handleZoomIn}
                        className={styles.refreshButton}
                        title="Zoom In"
                        style={{ marginRight: 8 }}
                    >
                        <FaPlus />
                    </button>
                    <button
                        onClick={handleZoomOut}
                        className={styles.refreshButton}
                        title="Zoom Out"
                        style={{ marginRight: 8 }}
                    >
                        <FaMinus />
                    </button>
                    <button
                        onClick={handleResetZoom}
                        className={styles.refreshButton}
                        title="Reset Zoom"
                        style={{ marginRight: 8 }}
                    >
                        <FaExpand />
                    </button>

                    <button
                        onClick={() => {
                            // Center the view on the whole canvas or the selected slot
                            const el = layoutSectionRef.current;
                            if (!el) return;
                            if (selectedSlot) {
                                // Center on selected slot coordinates
                                const slotCenterX = (selectedSlot.x_coordinate || selectedSlot.position_x || 0) + (selectedSlot.width || 0) / 2;
                                const slotCenterY = (selectedSlot.y_coordinate || selectedSlot.position_y || 0) + (selectedSlot.height || 0) / 2;
                                const targetLeft = slotCenterX * viewScale - (el.clientWidth / 2);
                                const targetTop = slotCenterY * viewScale - (el.clientHeight / 2);
                                el.scrollLeft = Math.max(0, targetLeft);
                                el.scrollTop = Math.max(0, targetTop);
                            } else {
                                // Center the whole canvas
                                const targetLeft = (canvasWidth * viewScale - el.clientWidth) / 2;
                                const targetTop = (canvasHeight * viewScale - el.clientHeight) / 2;
                                el.scrollLeft = Math.max(0, targetLeft);
                                el.scrollTop = Math.max(0, targetTop);
                            }
                        }}
                        className={styles.refreshButton}
                        title="Center View"
                        style={{ marginRight: 8 }}
                    >
                        ⤾
                    </button>

                    <button 
                        onClick={() => setShowBackground(!showBackground)}
                        className={`${styles.bgToggle} ${!showBackground ? styles.bgHidden : ''}`}
                        title={showBackground ? "Hide Background" : "Show Background"}
                    >
                        {showBackground ? <FaEyeSlash /> : <FaEye />}
                    </button>
                    <button 
                        onClick={() => setShowOverviewModal(true)}
                        className={styles.overviewButton}
                        title="Show Parking Overview"
                    >
                        <FaTable />
                    </button>
                </div>
            </div>

            <div 
                className={`${styles.layoutSection} ${!showBackground ? styles.hideBg : ''}`}
                ref={layoutSectionRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                style={{ 
                    // Keep the section full width/viewport height so modals and page layout remain intact
                    width: '100%',
                    minHeight: '60vh',
                    margin: '0 auto', 
                    position: 'relative', 
                    overflow: 'auto', 
                    // Always keep the outer container white so the canvas area looks consistent
                    backgroundColor: '#ffffff',
                    transition: 'background-color 0.3s ease'
                }}
            >
                {/* Inner scroll container sized to the scaled canvas so scrolling maps to the visual area */}
                <div className={styles.layoutScrollInner} style={{ width: `${scrollInnerSize.w}px`, height: `${scrollInnerSize.h}px` }}>
                    <div className={styles.layoutWrapper} style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px`, position: 'relative', transform: `scale(${viewScale})`, transformOrigin: 'top left' }}>
                        <div 
                            className={`${styles.layoutContainer} ${!showBackground ? styles.hideBg : ''}`}
                            style={{
                                backgroundImage: showBackground && bgUrl ? `url(${bgUrl})` : 'none',
                                width: `${canvasWidth}px`,
                                height: `${canvasHeight}px`,
                                backgroundSize: `${canvasWidth}px ${canvasHeight}px`,
                                backgroundPosition: 'center',
                                backgroundRepeat: 'no-repeat',
                                position: 'relative',
                                pointerEvents: 'auto',
                                backgroundColor: '#ffffff',
                                margin: 0,
                                padding: 0,
                                boxSizing: 'border-box'
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                        >
                        {/* Debug output */}
                       

                        {/* Render lines */}
                        <svg
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                width: '100%',
                                height: '100%',
                                pointerEvents: 'none',
                                zIndex: 1,
                                overflow: 'visible'
                            }}
                        >
                            {(lines || []).map((line, index) => (
                                <line
                                    key={`line-${index}`}
                                    x1={line.points?.[0] || 0}
                                    y1={line.points?.[1] || 0}
                                    x2={line.points?.[2] || 0}
                                    y2={line.points?.[3] || 0}
                                    stroke={line.stroke || '#fff'}
                                    strokeWidth={line.strokeWidth || 2}
                                    vectorEffect="non-scaling-stroke"
                                    opacity={0.6}
                                />
                            ))}
                        </svg>

                        {/* Render texts */}
                        <svg
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                width: '100%',
                                height: '100%',
                                pointerEvents: 'none',
                                zIndex: 2,
                                overflow: 'visible'
                            }}
                        >
                            {(texts || []).map((text, index) => {
                                const rotation = typeof text.rotation === 'number' ? text.rotation : (text.metadata?.rotation || 0);
                                const transform = `translate(${text.x}, ${text.y}) rotate(${rotation})`;
                                return (
                                    <text
                                        key={`text-${index}`}
                                        x={0}
                                        y={0}
                                        transform={transform}
                                        fill={text.fill || '#fff'}
                                        style={{ 
                                            fontSize: `${text.fontSize}px`,
                                            textShadow: '1px 1px 2px black',
                                            userSelect: 'none'
                                        }}
                                        dominantBaseline="middle"
                                        textAnchor="middle"
                                        filter="drop-shadow(1px 1px 2px rgba(0,0,0,0.8))"
                                    >
                                        {text.text || text.content || 'Text'}
                                    </text>
                                );
                            })}
                        </svg>

                        <div className={styles.slotMapWrapper} style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            width: `${canvasWidth}px`,
                            height: `${canvasHeight}px`,
                            padding: 0,
                            margin: 0,
                            boxSizing: 'border-box',
                            pointerEvents: 'auto',
                            zIndex: 10
                        }}>
                            {layout.parking_slots.map(slot => {
                                const isAssigned = slot.space_status === 'occupied' || slot.space_status === 'reserved';
                                const spaceTypeClass = styles[slot.space_type] || '';
                                return (
                                    <div
                                        key={slot.id}
                                        className={`${styles.parkingSpace} 
                                            ${slot.space_status === 'reserved' ? styles.reserved : 
                                            slot.space_status === 'occupied' ? styles.occupied : ''}
                                            ${spaceTypeClass}`}
                                        style={{
                                            left: `${slot.x_coordinate}px`,
                                            top: `${slot.y_coordinate}px`,
                                            width: `${slot.width}px`,
                                            height: `${slot.height}px`,
                                            transform: `rotate(${slot.rotation}deg)`,
                                            transformOrigin: 'center center',
                                            position: 'absolute',
                                            pointerEvents: 'auto',
                                            cursor: 'pointer',
                                            zIndex: 10,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            
                                            boxSizing: 'border-box',
                                           
                                            transition: 'all 0.3s ease'
                                        }}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            console.log('Click event fired on slot:', {
                                                id: slot.id,
                                                space_number: slot.space_number,
                                                space_status: slot.space_status,
                                                isAssigned
                                            });
                                            handleSlotClick(slot);
                                        }}
                                        draggable={isAssigned}
                                        onDragStart={(e) => handleDragStart(e, slot)}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, slot)}
                                        onMouseEnter={(e) => {
                                            console.log('Mouse entered slot:', {
                                                slotId: slot.id,
                                                status: slot.space_status,
                                                hasAssignment: !!assignments[String(slot.id)],
                                                assignmentDetails: assignments[String(slot.id)],
                                                currentHoveredId: hoveredSlotId
                                            });
                                            setHoveredSlotId(slot.id);
                                            setTooltipAnchor(e.currentTarget);
                                        }}
                                        onMouseLeave={() => {
                                            console.log('Mouse left slot:', {
                                                slotId: slot.id,
                                                wasHovered: hoveredSlotId === slot.id
                                            });
                                            setHoveredSlotId(null);
                                            setTooltipAnchor(null);
                                        }}
                                    >
                                        <div className={styles.spaceNumber}>
                                            <div 
                                            className={styles.slotContent}
                                            style={{
                                                '--slot-width': `${slot.width}px`,
                                                '--slot-height': `${slot.height}px`,
                                                '--slot-scale': Math.min(slot.width / 60, slot.height / 120),
                                                '--rotation': `${slot.rotation}deg`
                                            }}
                                        >
                                            {isAssigned ? (
                                                <div className={styles.slotIcons}>
                                                    {getVehicleIcon(slot.assignment?.vehicle_type)}
                                                    {slot.space_status === 'reserved' && <span className={styles.reservedTag}>R</span>}
                                                </div>
                                            ) : (
                                                <div className={styles.spaceNumber}>
                                                    {getSpaceTypeIcon(slot.space_type)}
                                                    <span>
                                                        {slot.name || slot.space_number || slot.slot_number}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                            {(() => {
                                                const assignment = assignments[String(slot.id)];
                                                const shouldShowTooltip = hoveredSlotId === slot.id && tooltipAnchor;
                                                
                                                if (!shouldShowTooltip) return null;
                                                
                                                const rect = tooltipAnchor.getBoundingClientRect();
                                                const tooltipStyle = {
                                                    position: 'fixed',
                                                    top: rect.top - 120, // Adjust this value based on tooltip height
                                                    left: rect.left + (rect.width / 2),
                                                    transform: 'translateX(-50%)',
                                                    zIndex: 999999
                                                };
                                                
                                                return (
                                                    <TooltipPortal>
                                                        <div className={`${styles.tooltip} ${assignment?.is_reserved ? styles.reservedTooltip : ''}`} style={tooltipStyle}>
                                                            <div className={styles.tooltipContent}>
                                                            {assignment ? (
                                                                <>
                                                                    <div className={styles.tooltipRow}>
                                                                        <span className={styles.tooltipLabel}>Name:</span>
                                                                        <span>{assignment.name}</span>
                                                                    </div>
                                                                    <div className={styles.tooltipRow}>
                                                                        <span className={styles.tooltipLabel}>Contact:</span>
                                                                        <span>{assignment.contact_number}</span>
                                                                    </div>
                                                                    <div className={styles.tooltipRow}>
                                                                        <span className={styles.tooltipLabel}>Vehicle:</span>
                                                                        <span>{assignment.vehicle_details}</span>
                                                                    </div>
                                                                    <div className={styles.tooltipRow}>
                                                                        <span className={styles.tooltipLabel}>Type:</span>
                                                                        <span>{assignment.assignee_type === 'faculty' ? 'Faculty' : 'Guest'}</span>
                                                                    </div>
                                                                    {assignment.assignee_type === 'faculty' && (
                                                                        <div className={styles.tooltipRow}>
                                                                            <span className={styles.tooltipLabel}>Faculty Position:</span>
                                                                            <span>{assignment.faculty_position || '-'}</span>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <div className={styles.tooltipRow}>
                                                                        <span className={styles.tooltipLabel}>Status:</span>
                                                                        <span>Available</span>
                                                                    </div>
                                                                    <div className={styles.tooltipRow}>
                                                                        <span className={styles.tooltipLabel}>Space Type:</span>
                                                                        <span>{slot.space_type ? slot.space_type.charAt(0).toUpperCase() + slot.space_type.slice(1) : 'Standard'}</span>
                                                                    </div>
                                                                    <div className={styles.tooltipRow}>
                                                                        <span className={styles.tooltipLabel}>Space #:</span>
                                                                        <span>{slot.name || slot.space_number || slot.slot_number}</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                        {assignment && (
                                                            <button
                                                                className={styles.unassignButton}
                                                                style={{ pointerEvents: 'auto', zIndex: 1000 }}
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    if (window.confirm('Are you sure you want to unassign this parking space?')) {
                                                                        try {
                                                                                await api.initCsrf();
                                                                                const assignmentId = assignments[String(slot.id)]?.id;
                                                                                if (!assignmentId) throw new Error('No valid assignment ID found');
                                                                                await api.post(`/parking-assignments/${assignmentId}/end`);
                                                                            // Get fresh data to ensure state is correct
                                                                            await Promise.all([fetchLayout(), fetchAssignments()]);
                                                                                                                                            window.showAlert('Parking space unassigned successfully!', 'success');
                                                                        } catch (error) {
                                                                window.showAlert('Failed to unassign parking space', 'error');
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                Unassign
                                                            </button>
                                                        )}
                                                        </div>
                                                    </TooltipPortal>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {showOverviewModal && (
                <ParkingOverviewModal 
                    layout={layout}
                    assignments={assignments}
                    onClose={() => setShowOverviewModal(false)}
                    fetchLayout={fetchLayout}
                    fetchAssignments={fetchAssignments}
                />
            )}

            {showForm && (
                <div className={styles.formContainer}>
                    <div className={styles.formHeader}>
                        <h2>Assign Space {selectedSlot.slot_number}</h2>
                        <button 
                            className={styles.closeButton}
                            onClick={() => {
                                setShowForm(false);
                                setFormError(null);
                            }}
                        >
                            ×
                        </button>

                    <button
                        onClick={() => {
                            // Fit the canvas into the current viewport without changing browser zoom
                            const el = layoutSectionRef.current;
                            if (!el) return;
                            const containerW = el.clientWidth;
                            const containerH = el.clientHeight;
                            const scaleW = containerW / canvasWidth;
                            const scaleH = containerH / canvasHeight;
                            const fitScale = Math.min(1, scaleW, scaleH);
                            setViewScale(+fitScale.toFixed(2));
                            // center after scaling
                            const targetLeft = (canvasWidth * fitScale - el.clientWidth) / 2;
                            const targetTop = (canvasHeight * fitScale - el.clientHeight) / 2;
                            el.scrollLeft = Math.max(0, targetLeft);
                            el.scrollTop = Math.max(0, targetTop);
                        }}
                        className={styles.refreshButton}
                        title="Fit to View"
                        style={{ marginRight: 8 }}
                    >
                        Fit
                    </button>
                    </div>
                    {formError && (
                        <div className={styles.formError}>
                            {formError}
                        </div>
                    )}
                    
                    <form onSubmit={handleAssignment}>
                        <div className={styles.formGroup}>
                            <label>Type of Use</label>
                            <div className={styles.radioGroup}>
                                <label>
                                    <input
                                        type="radio"
                                        name="assignment_type"
                                        value="assign"
                                        checked={formData.assignment_type === 'assign'}
                                        onChange={handleInputChange}
                                    />
                                    Assign Now
                                </label>
                                <label>
                                    <input
                                        type="radio"
                                        name="assignment_type"
                                        value="reserve"
                                        checked={formData.assignment_type === 'reserve'}
                                        onChange={handleInputChange}
                                    />
                                    Reserve
                                </label>
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>User Type</label>
                            <div className={styles.radioGroup}>
                                <label>
                                    <input
                                        type="radio"
                                        name="assignee_type"
                                        value="guest"
                                        checked={formData.assignee_type === 'guest'}
                                        onChange={handleInputChange}
                                        required
                                    />
                                    Guest
                                </label>
                                <label>
                                    <input
                                        type="radio"
                                        name="assignee_type"
                                        value="faculty"
                                        checked={formData.assignee_type === 'faculty'}
                                        onChange={handleInputChange}
                                        required
                                    />
                                    Faculty
                                </label>
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Name</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                required
                                placeholder="Enter name"
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Contact Number</label>
                            <input
                                type="text"
                                name="contact"
                                value={formData.contact}
                                onChange={handleInputChange}
                                required
                                placeholder="Enter contact number"
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Vehicle Type</label>
                            {/* Autoload user and vehicles */}
                            <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <label>Lookup by Plate Number </label>
                                    <input
                                        type="text"
                                        name="_lookup_plate"
                                        value={formData._lookup_plate || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, _lookup_plate: e.target.value }))}
                                        placeholder="Enter plate number and click Lookup"
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button type="button" onClick={handleLookupByPlate} className={styles.refreshButton}>Lookup</button>
                                    <button type="button" onClick={() => { setFormData(prev => ({ ...prev, _lookup_plate: '', vehicle_plate: '', vehicle_type: '', vehicle_color: '' })); window.showAlert && window.showAlert('Plate lookup cleared', 'info'); }} className={styles.refreshButton}>Clear</button>
                                </div>
                            </div>

                            {/* If a user was selected and they have multiple vehicles, show a vehicle selector */}
                            {Array.isArray(formData._selected_user_vehicles) && formData._selected_user_vehicles.length > 1 && (
                                <div className={styles.formGroup}>
                                    <label>Select Vehicle</label>
                                    <select name="_selected_vehicle" onChange={(e) => {
                                        const vid = e.target.value;
                                        const sel = (formData._selected_user_vehicles || []).find(x => String(x.id) === String(vid));
                                        if (sel) {
                                            setFormData(prev => ({ ...prev, vehicle_plate: sel.plate_number || '', vehicle_type: sel.vehicle_type || '', vehicle_color: sel.vehicle_color || '' }));
                                        }
                                    }}>
                                        <option value="">-- choose vehicle --</option>
                                        {formData._selected_user_vehicles.map(v => (
                                            <option key={v.id} value={v.id}>{v.plate_number} - {v.vehicle_type || 'Unknown'}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <select
                                name="vehicle_type"
                                value={formData.vehicle_type}
                                onChange={handleInputChange}
                                required
                            >
                                <option value="">Select vehicle type</option>
                                {selectedSlot?.space_type === 'compact' ? (
                                    <>
                                        <option value="motorcycle">Motorcycle</option>
                                        <option value="bicycle">Bicycle</option>
                                    </>
                                ) : selectedSlot?.space_type === 'standard' ? (
                                    <>
                                        <option value="car">Car</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="car">Car</option>
                                        <option value="motorcycle">Motorcycle</option>
                                        <option value="bicycle">Bicycle</option>
                                    </>
                                )}
                            </select>
                            {selectedSlot?.space_type === 'compact' && (
                                <small className={styles.spaceTypeNote}>
                                    This is a compact space - only motorcycles and bicycles are allowed
                                </small>
                            )}
                            {selectedSlot?.space_type === 'standard' && (
                                <small className={styles.spaceTypeNote}>
                                    This is a standard space - only cars are allowed
                                </small>
                            )}
                            {selectedSlot?.space_type === 'handicap' && (
                                <small className={styles.spaceTypeNote}>
                                    This is a handicap-accessible parking space
                                </small>
                            )}
                            {selectedSlot?.space_type === 'ev' && (
                                <small className={styles.spaceTypeNote}>
                                    This is an electric vehicle charging space
                                </small>
                            )}
                        </div>

                        <div className={styles.formGroup}>
                            <label>Vehicle Plate Number</label>
                            <input
                                type="text"
                                name="vehicle_plate"
                                value={formData.vehicle_plate}
                                onChange={handleInputChange}
                                required
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Vehicle Color</label>
                            <input
                                type="text"
                                name="vehicle_color"
                                value={formData.vehicle_color}
                                onChange={handleInputChange}
                                placeholder="Enter vehicle color"
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Start Time</label>
                            <input
                                type="datetime-local"
                                name="start_time"
                                value={formData.start_time}
                                onChange={handleInputChange}
                                required
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>End Time (Optional)</label>
                            <input
                                type="datetime-local"
                                name="end_time"
                                value={formData.end_time}
                                onChange={handleInputChange}
                            />
                        </div>

                        {formData.assignee_type === 'faculty' ? (
                            <div className={styles.formGroup}>
                                <label>Faculty Position</label>
                                <input
                                    type="text"
                                    name="faculty_position"
                                    value={formData.faculty_position || ''}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="Enter faculty position"
                                />
                            </div>
                        ) : (
                            <div className={styles.formGroup}>
                                <label>Purpose of Visit</label>
                                <textarea
                                    name="purpose"
                                    value={formData.purpose || ''}
                                    onChange={handleInputChange}
                                    rows="3"
                                    required
                                    placeholder="Enter purpose of visit"
                                />
                            </div>
                        )}

                        <div className={styles.formActions}>
                            <button 
                                type="submit" 
                                className={`${styles.submitButton} ${formData.assignment_type === 'reserve' ? styles.reserveButton : ''}`}
                            >
                                {formData.assignment_type === 'reserve' ? 'Reserve Space' : 'Assign Space'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
        </div>
    );
};

export default ParkingAssignmentPage;