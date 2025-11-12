import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from "pages/Login";
import { RequireAuth, PublicRoute } from 'components/RequireAuth';
import Dashboard from 'pages/dashboard';
import Home from 'pages/home';
import Parkingspaces from 'pages/parkingspaces';
import UserList from 'pages/userlist';
import EditParking from 'pages/editparkingspace';
import ForgotPassword from 'pages/forgotpassword'; 
import Messages from 'pages/messages';
import PendingList from 'pages/pendinglist';
import ManageParkingLayout from 'pages/ManageParkingLayout';
import ParkingAssignmentPage from 'pages/ParkingAssignmentPage';
import EditParkingLayout from 'pages/EditParkingLayout';
import Settings from 'pages/Settings';
import AdminCreateUser from 'pages/AdminCreateUser';
import IncidentManagement from 'pages/IncidentManagement';
import Notifications from 'pages/notifications';
import FeedbackPage from 'pages/feedback';
import AnalyticsDashboard from 'pages/AnalyticsDashboard';

const MainRoutes = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                <Route path="/forgotpassword" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
                <Route path="/home" element={<RequireAuth><Home /></RequireAuth>}>
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="parkingspaces" element={<Parkingspaces />} />
                    <Route path="parking-assignment/:layoutId" element={<ParkingAssignmentPage />} />
                    <Route path="manage-parking-layout" element={<ManageParkingLayout />} />
                    <Route path="edit-parking-layout/:id" element={<EditParkingLayout />} />
                    <Route path="userlist" element={<UserList />} />
                    <Route path="admin/create-user" element={<AdminCreateUser />} />
                    <Route path="editparkingspace" element={<EditParking />} />
                    <Route path="messages/:conversationId?" element={<Messages />} />
                    <Route path="notifications" element={<Notifications />} />
                    <Route path="feedback" element={<FeedbackPage />} />
                    <Route path="incidents" element={<IncidentManagement />} />
                    <Route path="pendinglist" element={<PendingList />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="analytics-dashboard" element={<AnalyticsDashboard />} />
                </Route>
            </Routes>
        </Router>
    );
};

export default MainRoutes;
