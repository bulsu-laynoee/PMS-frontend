import React, { useState, useEffect } from 'react';
import api from '../utils/api'; // Assuming you have an api utility
import styles from 'assets/AnalyticsDashboard.module.css'; // We will create this file
import { FaChartBar, FaUsers, FaCarCrash, FaHourglassEnd, FaClock } from 'react-icons/fa';

// A simple component for displaying individual stats
const StatCard = ({ title, value, icon, color }) => (
    <div className={styles.statCard}>
        <div className={styles.statIcon} style={{ backgroundColor: color }}>
            {icon}
        </div>
        <div className={styles.statContent}>
            <div className={styles.statValue}>{value}</div>
            <div className={styles.statTitle}>{title}</div>
        </div>
    </div>
);

const AnalyticsDashboard = () => {
    const [parkingStats, setParkingStats] = useState({ totals: null, by_layout: [] });
    const [driverReports, setDriverReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAnalytics = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch both sets of data in parallel
                const [statsResponse, reportsResponse] = await Promise.all([
                    api.get('/analytics/parking-stats'),
                    api.get('/analytics/driver-reports')
                ]);

                setParkingStats(statsResponse.data);
                setDriverReports(reportsResponse.data);

            } catch (err) {
                console.error("Failed to load analytics:", err);
                setError("Failed to load analytics data. Please try again later.");
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, []);

    if (loading) {
        return <div className={styles.loading}>Loading Analytics...</div>;
    }

    if (error) {
        return <div className={styles.error}>{error}</div>;
    }

    return (
        <div className={styles.dashboardContainer}>
            <h1 className={styles.dashboardTitle}>Analytics Dashboard</h1>

            {/* Parking Assignment Statistics */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    <FaChartBar /> Total Parking Assignments
                </h2>
                <div className={styles.statGrid}>
                    <StatCard 
                        title="Last 1 Hour" 
                        value={parkingStats?.totals?.last_hour ?? '0'} 
                        icon={<FaClock size={22} />}
                        color="#ef4444"
                    />
                    <StatCard 
                        title="Last 6 Hours" 
                        value={parkingStats?.totals?.last_6_hours ?? '0'} 
                        icon={<FaHourglassEnd size={22} />}
                        color="#f97316"
                    />
                    <StatCard 
                        title="Last 24 Hours" 
                        value={parkingStats?.totals?.last_24_hours ?? '0'} 
                        icon={<FaClock size={22} />}
                        color="#eab308"
                    />
                    <StatCard 
                        title="Last 3 Days" 
                        value={parkingStats?.totals?.last_3_days ?? '0'} 
                        icon={<FaChartBar size={22} />}
                        color="#22c55e"
                    />
                    <StatCard 
                        title="Last 7 Days" 
                        value={parkingStats?.totals?.last_7_days ?? '0'} 
                        icon={<FaChartBar size={22} />}
                        color="#3b82f6"
                    />
                </div>
            </div>

            {/* NEW: Parking Assignments by Layout */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    <FaChartBar /> Assignments by Layout
                </h2>
                <div className={styles.tableWrapper}>
                    <table className={styles.reportTable}>
                        <thead>
                            <tr>
                                <th>Layout Name</th>
                                <th>Last 1 Hr</th>
                                <th>Last 6 Hrs</th>
                                <th>Last 24 Hrs</th>
                                <th>Last 3 Days</th>
                                <th>Last 7 Days</th>
                            </tr>
                        </thead>
                        <tbody>
                            {parkingStats?.by_layout?.length > 0 ? (
                                parkingStats.by_layout.map((layout) => (
                                    <tr key={layout.layout_name}>
                                        <td>{layout.layout_name}</td>
                                        <td>{layout.last_hour}</td>
                                        <td>{layout.last_6_hours}</td>
                                        <td>{layout.last_24_hours}</td>
                                        <td>{layout.last_3_days}</td>
                                        <td>{layout.last_7_days}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6">No layout statistics found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Driver Report Statistics */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    <FaUsers /> Driver Report Rankings
                </h2>
                <div className={styles.tableWrapper}>
                    <table className={styles.reportTable}>
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Driver Name</th>
                                <th>Position</th>
                                <th>Total Reports</th>
                            </tr>
                        </thead>
                        <tbody>
                            {driverReports.length > 0 ? (
                                driverReports.map((report, index) => (
                                    <tr key={report.reported_user_id}>
                                        <td>{index + 1}</td>
                                        <td>{report.name}</td>
                                        <td>{report.position}</td>
                                        <td>
                                            <span className={styles.reportCount}>
                                                <FaCarCrash /> {report.report_count}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4">No driver reports found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;