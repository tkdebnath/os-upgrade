import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import Dashboard from './Dashboard';
import DeviceList from './features/inventory/DeviceList';
import DeviceDetails from './features/inventory/DeviceDetails';
import JobHistory from './features/swimage/JobHistory';
import CheckRunner from './features/compliance/CheckRunner';
import ImageRepo from './features/swimage/ImageRepo';
import Settings from './features/settings/Settings';
import SiteDetail from './features/inventory/SiteDetail';
import SitesList from './features/inventory/SitesList';
import SiteManagement from './features/inventory/SiteManagement';
import ModelDetail from './features/inventory/ModelDetail';
import ModelsList from './features/inventory/ModelsList';
import ValidationSettings from './features/settings/ValidationSettings';
import UpgradeWizard from './features/swimage/UpgradeWizard';
import ScheduledJobs from './features/swimage/ScheduledJobs';
import JobDetails from './features/swimage/JobDetails';
import WorkflowEditor from './features/automation/WorkflowEditor';
import Login from './pages/Login';
import Profile from './pages/Profile';
import AdminPanel from './features/admin/AdminPanel';
import UserManagement from './features/admin/UserManagement';
import GroupManagement from './features/admin/GroupManagement';
import PermissionList from './features/admin/PermissionList';
import PermissionBundles from './features/admin/PermissionBundles';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="devices" element={<DeviceList />} />
            <Route path="devices/:id" element={<DeviceDetails />} />
            <Route path="sites" element={<SitesList />} />
            <Route path="sites/:id" element={<SiteDetail />} />
            <Route path="site-management" element={<SiteManagement />} />
            <Route path="models" element={<ModelsList />} />
            <Route path="models/:id" element={<ModelDetail />} />
            <Route path="jobs" element={<JobHistory />} />
            <Route path="jobs/:id" element={<JobDetails />} />
            <Route path="scheduled-jobs" element={<ScheduledJobs />} />
            <Route path="checks" element={<CheckRunner />} />
            <Route path="images" element={<ImageRepo />} />
            <Route path="settings" element={<Settings />} />
            <Route path="settings/validation" element={<ValidationSettings />} />
            <Route path="profile" element={<Profile />} />
            <Route path="standards" element={<ModelsList />} />
            <Route path="upgrade" element={<UpgradeWizard />} />
            <Route path="workflows" element={<WorkflowEditor />} />
            <Route path="admin" element={<AdminPanel />} />
            <Route path="admin/users" element={<UserManagement />} />
            <Route path="admin/groups" element={<GroupManagement />} />
            <Route path="admin/permissions" element={<PermissionList />} />
            <Route path="admin/bundles" element={<PermissionBundles />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
