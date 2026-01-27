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
import GoldenStandards from './features/settings/GoldenStandards';
import ValidationSettings from './features/settings/ValidationSettings';
import UpgradeWizard from './features/swimage/UpgradeWizard';
import ScheduledJobs from './features/swimage/ScheduledJobs';
import JobDetails from './features/swimage/JobDetails';
import WorkflowEditor from './features/automation/WorkflowEditor';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="devices" element={<DeviceList />} />
          <Route path="devices/:id" element={<DeviceDetails />} />
          <Route path="sites" element={<SitesList />} />
          <Route path="sites/:id" element={<SiteDetail />} />
          <Route path="site-management" element={<SiteManagement />} />
          <Route path="models/:id" element={<ModelDetail />} />
          <Route path="jobs" element={<JobHistory />} />
          <Route path="jobs/:id" element={<JobDetails />} />
          <Route path="scheduled-jobs" element={<ScheduledJobs />} />
          <Route path="checks" element={<CheckRunner />} />
          <Route path="images" element={<ImageRepo />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/validation" element={<ValidationSettings />} />
          <Route path="standards" element={<GoldenStandards />} />
          <Route path="upgrade" element={<UpgradeWizard />} />
          <Route path="workflows" element={<WorkflowEditor />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
