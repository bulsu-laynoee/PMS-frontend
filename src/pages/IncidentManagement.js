import React, { useState, useEffect, useCallback } from 'react';
import { FaExclamationTriangle, FaClock, FaEye, FaCheckCircle } from 'react-icons/fa';
import { API_BASE_URL } from '../utils/api';
import '../assets/style.css';

const IncidentManagement = () => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');

  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/incidents`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (err) {
        console.error('Failed to parse incidents response JSON:', err, 'raw:', text);
      }

      if (response.ok) {
        // Backend returns { success: true, data: [...] }
        // Accept also { incidents: [...] } or a raw array
        let incidentsArr = [];
        if (Array.isArray(data)) {
          incidentsArr = data;
        } else if (data && Array.isArray(data.data)) {
          incidentsArr = data.data;
        } else if (data && Array.isArray(data.incidents)) {
          incidentsArr = data.incidents;
        } else {
          console.warn('Unexpected incidents payload shape:', data);
          incidentsArr = [];
        }

        // Add normalized fields for safer comparisons in the UI
        const normalized = incidentsArr.map((inc) => ({
          ...inc,
          _status: inc.status ? String(inc.status).toLowerCase() : null,
          _severity: inc.severity ? String(inc.severity).toLowerCase() : null,
        }));

        console.debug('Fetched incidents:', normalized);
        setIncidents(normalized);
      } else {
        console.error('Failed fetching incidents:', response.status, text, data);
      }
    } catch (error) {
      console.error('Error fetching incidents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const updateIncidentStatus = async (incidentId, status, resolvedBy = null) => {
    try {
      const token = localStorage.getItem('token');
      const payload = { status };
      if (status === 'closed') {
        if (resolvedBy) payload.resolved_by = resolvedBy;
        // controller accepts ISO date string
        payload.resolved_at = new Date().toISOString();
      }

      const response = await fetch(`${API_BASE_URL}/api/incidents/${incidentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (err) { console.error('Invalid JSON from update:', err, text); }

      if (response.ok) {
        console.debug('Incident updated:', data);
        fetchIncidents(); // Refresh the list
        setSelectedIncident(null);
      } else {
        console.error('Failed to update incident:', response.status, data || text);
      }
    } catch (error) {
      console.error('Error updating incident:', error);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high': return '#dc3545';
      case 'medium': return '#fd7e14';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'open': return '#dc3545';
      case 'acknowledged': return '#fd7e14';
      case 'closed': return '#28a745';
      default: return '#6c757d';
    }
  };

  const filteredIncidents = incidents.filter(incident => {
    const incidentStatus = incident._status || (incident.status ? String(incident.status).toLowerCase() : '');
    const incidentSeverity = incident._severity || (incident.severity ? String(incident.severity).toLowerCase() : '');
    const statusMatch = filterStatus === 'all' || incidentStatus === filterStatus;
    const severityMatch = filterSeverity === 'all' || incidentSeverity === filterSeverity;
    return statusMatch && severityMatch;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading incidents...</div>
      </div>
    );
  }

  return (
    <div className="incident-management p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Incident Management</h1>
        
        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Status Filter:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Severity Filter:</label>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2"
            >
              <option value="all">All Severity</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        {/* Statistics Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '20px', 
          marginBottom: '30px' 
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '8px', 
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)', 
            padding: '24px', 
            borderLeft: '4px solid #3b82f6' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ 
                  fontSize: '12px', 
                  fontWeight: '500', 
                  color: '#6b7280', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  margin: '0 0 8px 0'
                }}>Total Incidents</p>
                <p style={{ 
                  fontSize: '2rem', 
                  fontWeight: 'bold', 
                  color: '#111827',
                  margin: 0
                }}>{incidents.length}</p>
              </div>
              <FaExclamationTriangle style={{ color: '#3b82f6', fontSize: '24px' }} />
            </div>
          </div>
          
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '8px', 
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)', 
            padding: '24px', 
            borderLeft: '4px solid #ef4444' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ 
                  fontSize: '12px', 
                  fontWeight: '500', 
                  color: '#6b7280', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  margin: '0 0 8px 0'
                }}>Open</p>
                <p style={{ 
                  fontSize: '2rem', 
                  fontWeight: 'bold', 
                  color: '#dc2626',
                  margin: 0
                }}>{incidents.filter(i => i.status === 'open').length}</p>
              </div>
              <FaClock style={{ color: '#ef4444', fontSize: '24px' }} />
            </div>
          </div>
          
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '8px', 
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)', 
            padding: '24px', 
            borderLeft: '4px solid #eab308' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ 
                  fontSize: '12px', 
                  fontWeight: '500', 
                  color: '#6b7280', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  margin: '0 0 8px 0'
                }}>Acknowledged</p>
                <p style={{ 
                  fontSize: '2rem', 
                  fontWeight: 'bold', 
                  color: '#ca8a04',
                  margin: 0
                }}>{incidents.filter(i => i.status === 'acknowledged').length}</p>
              </div>
              <FaEye style={{ color: '#eab308', fontSize: '24px' }} />
            </div>
          </div>
          
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '8px', 
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)', 
            padding: '24px', 
            borderLeft: '4px solid #22c55e' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ 
                  fontSize: '12px', 
                  fontWeight: '500', 
                  color: '#6b7280', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  margin: '0 0 8px 0'
                }}>Closed</p>
                <p style={{ 
                  fontSize: '2rem', 
                  fontWeight: 'bold', 
                  color: '#16a34a',
                  margin: 0
                }}>{incidents.filter(i => i.status === 'closed').length}</p>
              </div>
              <FaCheckCircle style={{ color: '#22c55e', fontSize: '24px' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reporter
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Severity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredIncidents.map((incident) => (
              <tr key={incident.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{incident.title}</div>
                  <div className="text-sm text-gray-500">{incident.location}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {incident.reporter?.name || 'Unknown'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                    {incident.type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span 
                    className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full text-white"
                    style={{ backgroundColor: getSeverityColor(incident.severity) }}
                  >
                    {incident.severity?.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span 
                    className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full text-white"
                    style={{ backgroundColor: getStatusColor(incident.status) }}
                  >
                    {incident.status?.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(incident.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => setSelectedIncident(incident)}
                    className="text-indigo-600 hover:text-indigo-900 mr-3"
                  >
                    View
                  </button>
                  {incident.status !== 'closed' && (
                    <>
                      {incident.status === 'open' && (
                        <button
                          onClick={() => updateIncidentStatus(incident.id, 'acknowledged')}
                          className="text-yellow-600 hover:text-yellow-900 mr-3"
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        onClick={() => updateIncidentStatus(incident.id, 'closed', 1)} // TODO: get current admin user ID
                        className="text-green-600 hover:text-green-900"
                      >
                        Close
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredIncidents.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No incidents found matching the current filters.
          </div>
        )}
      </div>

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-screen overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Incident Details</h2>
                <button
                  onClick={() => setSelectedIncident(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">{selectedIncident.title}</h3>
                  <div className="flex gap-2 mt-2">
                    <span 
                      className="px-2 py-1 text-xs font-semibold rounded-full text-white"
                      style={{ backgroundColor: getSeverityColor(selectedIncident.severity) }}
                    >
                      {selectedIncident.severity?.toUpperCase()}
                    </span>
                    <span 
                      className="px-2 py-1 text-xs font-semibold rounded-full text-white"
                      style={{ backgroundColor: getStatusColor(selectedIncident.status) }}
                    >
                      {selectedIncident.status?.toUpperCase()}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Reporter</label>
                    <p className="text-sm text-gray-900">{selectedIncident.reporter?.name || 'Unknown'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <p className="text-sm text-gray-900">{selectedIncident.type}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Location</label>
                    <p className="text-sm text-gray-900">{selectedIncident.location || 'Not specified'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date</label>
                    <p className="text-sm text-gray-900">
                      {new Date(selectedIncident.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <p className="text-sm text-gray-900 mt-1 p-3 bg-gray-50 rounded">
                    {selectedIncident.description}
                  </p>
                </div>

                {selectedIncident.attachments && selectedIncident.attachments.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Attachments</label>
                    <div className="mt-2 space-y-2">
                      {selectedIncident.attachments.map((attachment, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">{attachment.original_name}</span>
                          <a
                            href={`${API_BASE_URL}/storage/${attachment.path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-900 text-sm"
                          >
                            Download
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedIncident.resolver && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Resolved By</label>
                    <p className="text-sm text-gray-900">{selectedIncident.resolver.name}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(selectedIncident.resolved_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              {selectedIncident.status !== 'closed' && (
                <>
                  {selectedIncident.status === 'open' && (
                    <button
                      onClick={() => updateIncidentStatus(selectedIncident.id, 'acknowledged')}
                      className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    onClick={() => updateIncidentStatus(selectedIncident.id, 'closed', 1)} // TODO: get current admin user ID
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Close Incident
                  </button>
                </>
              )}
              <button
                onClick={() => setSelectedIncident(null)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncidentManagement;
