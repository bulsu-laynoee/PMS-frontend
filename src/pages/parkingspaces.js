import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import normalizeImageUrl from '../utils/imageUrl';
import { FaSearch, FaPlus, FaEdit, FaTrash, FaTimes } from 'react-icons/fa';
import styles from '../styles/parkingspaces.module.css';

const Parkingspaces = () => {
  const navigate = useNavigate();
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchPlate, setSearchPlate] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [showBackgrounds, setShowBackgrounds] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [selectedLayout, setSelectedLayout] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    background_image: null
  });

  const token = localStorage.getItem('token');
  const fetchLayouts = async () => {
    try {
      await api.initCsrf();
      const response = await api.get('/parking-layouts');

      // Extract the layouts array from the response
      const layouts = response.data.data || [];

      // Attempt to fetch all assignments in a single batched call to reduce requests
      let assignmentsByLayout = {};
      try {
        const allAssignmentsResp = await api.get('/parking-assignments');
        const allAssignments = allAssignmentsResp.data || [];
        // Group assignments by layout id and then by parking_slot_id
        allAssignments.forEach(a => {
          const layoutId = a.layout_id || a.parking_layout_id || a.layout?.id || a.layout_id;
          if (!layoutId) return;
          if (!assignmentsByLayout[layoutId]) assignmentsByLayout[layoutId] = [];
          assignmentsByLayout[layoutId].push(a);
        });
      } catch (err) {
        // If batched endpoint isn't available, try a single request with layout_ids query param
        console.warn('Batched assignments fetch failed, trying query-param batch or chunked fallback', err);
        try {
          const layoutIds = layouts.map(l => l.id).filter(Boolean);
          if (layoutIds.length === 0) throw new Error('no-layout-ids');
          // Try /parking-assignments?layout_ids=1,2,3 style
          const byIdsResp = await api.get(`/parking-assignments?layout_ids=${layoutIds.join(',')}`);
          const byIds = byIdsResp.data || [];
          byIds.forEach(a => {
            const layoutId = a.layout_id || a.parking_layout_id || a.layout?.id || a.layout_id;
            if (!layoutId) return;
            if (!assignmentsByLayout[layoutId]) assignmentsByLayout[layoutId] = [];
            assignmentsByLayout[layoutId].push(a);
          });
        } catch (err2) {
          // Final fallback: chunked parallel requests with limited concurrency
          console.warn('Query-param batch failed, falling back to chunked per-layout requests', err2);
          const concurrency = 6; // limit parallel requests
          const chunk = (arr, size) => {
            const out = [];
            for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
            return out;
          };
          const chunks = chunk(layouts, concurrency);
          for (const c of chunks) {
            const promises = c.map(layout =>
              api.get(`/parking-assignments/by-layout/${layout.id}`).then(r => ({ layoutId: layout.id, data: r.data })).catch(() => ({ layoutId: layout.id, data: [] }))
            );
            const results = await Promise.all(promises);
            results.forEach(res => {
              assignmentsByLayout[res.layoutId] = res.data || [];
            });
          }
        }
      }

      const layoutsWithCounts = layouts.map((layout) => {
        if (!layout) return null;
        const spaces = layout.parking_slots || [];
        const assignments = assignmentsByLayout[layout.id] || [];
        // Map assignments to slots by parking_slot_id
        const slotAssignments = {};
        assignments.forEach(a => {
          if (a.parking_slot_id) slotAssignments[a.parking_slot_id] = a;
        });
        // Attach assignment to each slot
        const slotsWithAssignment = spaces.map(slot => ({
          ...slot,
          assignment: slotAssignments[slot.id] || null
        }));
        const total = slotsWithAssignment.length;
        const occupied = slotsWithAssignment.filter(space => 
          space.space_status === 'occupied' || 
          space.space_status === 'reserved'
        ).length;
        return {
          id: layout.id,
          name: layout.name || '',
          description: layout.description || '',
          current: occupied,
          total: total,
          parking_slots: slotsWithAssignment
        };
      }).filter(layout => layout !== null);

      setLayouts(layoutsWithCounts);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching layouts:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load parking layouts';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setModalMode('create');
    setFormData({ name: '', description: '', background_image: null });
    setShowModal(true);
  };

  const handleEdit = (layout, e) => {
    e.stopPropagation(); // Prevent navigation to parking-assignment
    navigate(`/home/edit-parking-layout/${layout.id}`);
  };

  const handleDelete = async (layoutId, e) => {
    e.stopPropagation(); // Prevent navigation to parking-assignment
    
    // Check if layoutId is valid
    if (!layoutId) {
      console.error('Invalid layout ID');
      window.showAlert('Cannot delete layout: Invalid ID', 'error');
      return;
    }

    if (window.confirm('Are you sure you want to delete this parking space layout?')) {
      try {
  await api.initCsrf();
        console.log('Deleting layout with ID:', layoutId); // Debug log
        
        // First verify the layout exists
        try {
          const checkResponse = await api.get(`/parking-layouts/${layoutId}`);
          console.log('Layout exists:', checkResponse.data);
        } catch (error) {
          console.error('Layout does not exist:', error);
          window.showAlert('Cannot delete layout: Layout not found', 'error');
          // Refresh the list to ensure UI is in sync
          await fetchLayouts();
          return;
        }
        
        // Attempt to delete the layout
        const response = await api.delete(`/parking-layouts/${layoutId}`);

        if (response.status === 200) {
          // Update state immediately
          setLayouts(prevLayouts => prevLayouts.filter(layout => layout.id !== layoutId));
          
          // Show success message
          window.showAlert('Parking layout deleted successfully', 'success');
          
          // No need to fetch layouts again unless there was an error
        }
      } catch (error) {
        console.error('Error deleting layout:', error);
        // Show more detailed error message
        let errorMessage = 'Failed to delete parking layout: ';
        if (error.response?.data?.message) {
          errorMessage += error.response.data.message;
        } else if (error.message) {
          errorMessage += error.message;
        } else {
          errorMessage += 'Unknown error occurred';
        }
  window.showAlert(errorMessage, 'error');
        
        // Only fetch on error to ensure UI is in sync if there was a problem
        await fetchLayouts();
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      let formDataToSend = new FormData(); // Changed to 'let' since we might reassign it
      formDataToSend.append('name', formData.name);
      formDataToSend.append('description', formData.description);
      if (formData.background_image) {
        formDataToSend.append('background_image', formData.background_image);
      }

      if (modalMode === 'create') {
        // Debug log to see what's being sent
        console.log('Form Data Content:', {
          name: formData.name,
          description: formData.description
        });
        
        // Log the actual FormData entries
        for (let pair of formDataToSend.entries()) {
          console.log(pair[0], pair[1]);
        }

        await api.initCsrf();
        const response = await api.post('/parking-layouts', formDataToSend, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'multipart/form-data'
          }
        });
        // Add the new layout to the state
        setLayouts([...layouts, response.data.data]);
      } else {
        // For edit mode, only update the name
        console.log('Edit mode - name value:', formData.name);
        
        // Send as JSON instead of FormData
        const updateData = {
          name: formData.name,
          _method: 'PUT'
        };
        
        // Debug log to verify data being sent
        console.log('Update data:', updateData);

        await api.initCsrf();
        const response = await api.post(`/parking-layouts/${selectedLayout.id}`, updateData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        console.log('Update response:', response.data);
        
        // Make sure we have valid data from the response
        if (response.data && response.data.data) {
          const updatedLayoutData = response.data.data;
          console.log('Updated layout data:', updatedLayoutData);
          
          // Update the layout in the state
          setLayouts(layouts.map(layout => {
            if (layout.id === selectedLayout.id) {
              console.log('Updating layout:', layout.id, 'New name:', updatedLayoutData.name);
              // Create a new layout object with all the required properties
              return {
                id: layout.id,
                name: updatedLayoutData.name,
                current: layout.current,
                total: layout.total,
                parking_slots: updatedLayoutData.parking_slots || layout.parking_slots,
                background_image: updatedLayoutData.background_image || layout.background_image,
                layout_data: updatedLayoutData.layout_data || layout.layout_data
              };
            }
            return layout;
          }));
        } else {
          console.error('Invalid response data:', response.data);
        }
      }

      setShowModal(false);
      setFormData({ name: '', description: '', background_image: null });
    } catch (error) {
      console.error('Error saving layout:', error);
      
      let errorMessage = 'An unexpected error occurred';
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        switch (error.response.status) {
          case 400:
            errorMessage = 'Invalid data provided: ' + (error.response.data.message || 'Please check your input');
            break;
          case 401:
            errorMessage = 'Authentication failed. Please log in again.';
            break;
          case 403:
            errorMessage = 'You do not have permission to perform this action.';
            break;
          case 404:
            errorMessage = 'Layout not found. It may have been deleted.';
            break;
          case 422:
            // Validation errors
            const validationErrors = error.response.data.errors;
            if (validationErrors) {
              errorMessage = Object.values(validationErrors)
                .flat()
                .join('\n');
            } else {
              errorMessage = 'Validation failed: ' + error.response.data.message;
            }
            break;
          case 500:
            errorMessage = 'Server error: ' + (error.response.data.error || 'Something went wrong on the server');
            break;
          default:
            errorMessage = error.response.data.message || 'An error occurred while saving the layout';
        }
      } else if (error.request) {
        // The request was made but no response was received
        errorMessage = 'No response from server. Please check your internet connection.';
      } else {
        // Something happened in setting up the request that triggered an Error
        errorMessage = 'Error: ' + error.message;
      }

      // Set the error in state for displaying in the UI
      setError(errorMessage);
      
      // Show error in a more user-friendly way (you might want to add a proper error display component)
  window.showAlert(errorMessage, 'error');
    }
  };

  useEffect(() => {
    fetchLayouts();
  }, []);

  const filteredLayouts = layouts
    .filter(layout => {
      // Filter by name
      const nameMatch = layout && layout.name && layout.name.toLowerCase().includes((searchTerm || '').toLowerCase());
      // Filter by vehicle plate number using assignments
      const plateMatch = searchPlate.trim() === '' || (layout.parking_slots && layout.parking_slots.some(slot => {
        if (!slot) return false;
        if (slot.assignment && slot.assignment.vehicle_plate) {
          return slot.assignment.vehicle_plate.toLowerCase().includes(searchPlate.toLowerCase());
        }
        return false;
      }));
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

  if (loading) {
    return (
      <div className={styles['loading-state']} style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: 'rgba(255, 255, 255, 0.9)'
      }}>
        <div className={styles['loading-spinner']} />
        <div className={styles['loading-text']}>Loading parking layouts...</div>
      </div>
    );
  }

  if (error) {
    return <div className={styles['error-state']}>{error}</div>;
  }

  return (
    <div className={styles['parking-container']}>
      <div className={styles['parking-header']}>
        <div className={styles['parking-search']}>
          <div className={styles['search-input-wrapper']}>
            <FaSearch className={styles['search-icon']} />
            <input
              type="text"
              placeholder="Search parking spaces..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles['search-input']}
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={styles['sort-select']}
          >
            <option value="name">Sort by Name</option>
            <option value="occupancy">Sort by Occupancy</option>
          </select>
          <button 
            className={styles['add-parking-btn']}
            onClick={() => navigate('/home/manage-parking-layout')}
          >
            <FaPlus />
            <span>Add Space</span>
          </button>
        </div>
      </div>

      {filteredLayouts.length === 0 ? (
        <div className={styles['empty-message']}>
          <span className={styles['empty-icon']}>🅿️</span>
          <p>No parking layouts found</p>
        </div>
      ) : (
        <div className={styles['parking-grid']}>
          {filteredLayouts.map(layout => {
            const occupancyRate = (layout.current / layout.total) * 100;
            let statusClass = styles['available'];
            if (occupancyRate >= 90) statusClass = styles['busy'];
            else if (occupancyRate >= 70) statusClass = styles['moderate'];

            return (
              <div
                key={layout.id}
                className={`${styles['parking-card']} ${statusClass}`}
                onClick={() => navigate(`/home/parking-assignment/${layout.id}`)}
              >
                <div className={styles['card-actions']}>
                  <button
                    className={styles['edit-btn']}
                    onClick={(e) => handleEdit(layout, e)}
                    title="Edit layout"
                  >
                    <FaEdit />
                  </button>
                  <button
                    className={styles['delete-btn']}
                    onClick={(e) => handleDelete(layout.id, e)}
                    title="Delete layout"
                  >
                    <FaTrash />
                  </button>
                </div>
                <div className={styles['card-content']}>
                  <h3 className={styles['card-title']}>{layout.name}</h3>
                  <div className={styles['card-details']}>
                    <div className={styles['card-stats']}>
                      <div className={styles['stat-item']}>
                        <span className={styles['stat-value']}>{layout.total}</span>
                        <span className={styles['stat-label']}>Total</span>
                      </div>
                      <div className={styles['stat-item']}>
                        <span className={styles['stat-value']}>{layout.total - layout.current}</span>
                        <span className={styles['stat-label']}>Available</span>
                      </div>
                      <div className={styles['stat-item']}>
                        <span className={styles['stat-value']}>{layout.current}</span>
                        <span className={styles['stat-label']}>Occupied</span>
                      </div>
                    </div>
                    <div className={styles['occupancy-circle']}>
                      <svg viewBox="0 0 36 36" className={styles['circular-chart']}>
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          stroke="#eee"
                          strokeWidth="2"
                          fill="none"
                        />
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          stroke="currentColor"
                          strokeWidth="2"
                          fill="none"
                          strokeDasharray={`${occupancyRate}, 100`}
                        />
                        <text x="18" y="18" className={styles['percentage']}>
                          {occupancyRate.toFixed(0)}%
                        </text>
                      </svg>
                    </div>
                    </div>
                    <div className={styles['layoutPreview']}>
                      {layout.backgroundImage && (
                        <img src={normalizeImageUrl(layout.backgroundImage)} alt={layout.name} />
                      )}
                    </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className={styles['add-parking-button-container']}>
       
      </div>

      {showModal && (
        <div className={styles['modal-overlay']}>
          <div className={styles['modal']}>
            <div className={styles['modal-header']}>
              <h2>{modalMode === 'create' ? 'Create New Parking Layout' : 'Edit Parking Layout'}</h2>
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
