import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../pages/ParkingAssignmentPage.module.css';
import api from '../utils/api';

const ParkingOverviewModal = ({ layout, assignments, onClose, fetchLayout, fetchAssignments }) => {
    const navigate = useNavigate();
    const [smartSearch, setSmartSearch] = useState('');

    // Smart search: matches assignee name, vehicle plate, or slot name/number
    const filteredSlots = (layout.parking_slots || []).filter(slot => {
        const assignment = assignments[String(slot.id)];
        const q = (smartSearch || '').trim().toLowerCase();
        if (!q) return true; // no filter

        const checks = [];
        if (assignment) {
            if (assignment.name) checks.push(String(assignment.name).toLowerCase());
            if (assignment.vehicle_plate) checks.push(String(assignment.vehicle_plate).toLowerCase());
            if (assignment.vehicle_details) checks.push(String(assignment.vehicle_details).toLowerCase());
        }

        // Slot identifiers
        const slotName = slot.metadata && slot.metadata.name ? String(slot.metadata.name) : '';
        if (slot.name) checks.push(String(slot.name).toLowerCase());
        if (slot.space_number) checks.push(String(slot.space_number).toLowerCase());
        if (slot.slot_number) checks.push(String(slot.slot_number).toLowerCase());
        if (slotName) checks.push(slotName.toLowerCase());

        // Also include space_status and type for convenience
        if (slot.space_status) checks.push(String(slot.space_status).toLowerCase());
        if (slot.space_type) checks.push(String(slot.space_type).toLowerCase());

        return checks.some(field => field && field.includes(q));
    });

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.tableTitle}>{layout?.name ? `${layout.name} Parking Overview` : 'Parking Space Overview'}</h2>
                    <button 
                        className={styles.closeButton}
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
                    <input
                        type="text"
                        placeholder="Search name, plate, or slot..."
                        value={smartSearch}
                        onChange={e => setSmartSearch(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { /* let the table show results */ } }}
                        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', minWidth: '360px' }}
                    />
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.parkingTable}>
                        <thead>
                            <tr>
                                <th>Space Number</th>
                                <th>Status</th>
                                <th>Assignee</th>
                                <th>Type</th>
                                <th>Faculty Position</th>
                                <th>Vehicle Details</th>
                                <th>Vehicle Color</th>
                                <th>Start Time</th>
                                <th>End Time</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSlots.map(slot => {
                                const assignment = assignments[String(slot.id)];
                                return (
                                    <tr
                                        key={slot.id}
                                        className={slot.space_status === 'reserved' ? styles.reservedRow : 
                                                               slot.space_status === 'occupied' ? styles.occupiedRow : 
                                                               styles.availableRow}
                                        onClick={() => {
                                            // Navigate to the assignment page and focus the slot
                                            try {
                                                navigate(`/home/parking-assignment/${layout.id}?slot=${slot.id}`);
                                            } catch (err) {
                                                console.warn('Navigation failed:', err);
                                            }
                                            // Close modal after navigating
                                            if (typeof onClose === 'function') onClose();
                                        }}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td>{slot.metadata && slot.metadata.name ? slot.metadata.name : (slot.name || slot.space_number)}</td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${styles[slot.space_status]}`}>
                                                {slot.space_status.charAt(0).toUpperCase() + slot.space_status.slice(1)}
                                            </span>
                                        </td>
                                        <td>{assignment ? assignment.name : '-'}</td>
                                        <td>{assignment ? (assignment.assignee_type === 'faculty' ? 'Faculty' : 'Guest') : '-'}</td>
                                        <td>{assignment && assignment.assignee_type === 'faculty' ? (assignment.faculty_position || '-') : '-'}</td>
                                        <td>{assignment ? assignment.vehicle_details : '-'}</td>
                                        <td>{assignment ? assignment.vehicle_color || '-' : '-'}</td>
                                        <td>{assignment ? new Date(assignment.start_time).toLocaleString() : '-'}</td>
                                        <td>{assignment?.end_time ? new Date(assignment.end_time).toLocaleString() : '-'}</td>
                                        <td>
                                            {assignment && (
                                                <button
                                                    className={styles.unassignTableButton}
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm('Are you sure you want to unassign this parking space?')) {
                                                            try {
                                                                await api.initCsrf();
                                                                await api.post(`/parking-assignments/${assignment.id}/end`);
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
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ParkingOverviewModal;
