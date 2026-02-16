import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Server, Activity, ShieldCheck, Clock, Edit, RefreshCw, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import EditDeviceModal from './EditDeviceModal';
import { useAuth } from '../../context/AuthContext';

const DeviceDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [device, setDevice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);
    const [fileServers, setFileServers] = useState([]);

    // Permission check helper
    const can = (perm) => {
        if (!user) return false;
        return user.is_superuser || (user.permissions && user.permissions.includes(perm));
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            const [devRes, fsRes] = await Promise.all([
                axios.get(`/api/dcim/devices/${id}/`),
                axios.get('/api/images/file-servers/')
            ]);
            setDevice(devRes.data);
            setFileServers(fsRes.data.results || fsRes.data);
        } catch (error) {
            console.error("Failed to fetch details", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-gray-500">Loading device details...</div>;
    if (!device) return <div className="p-8 text-red-500">Device not found.</div>;

    // Helper to get FS Name
    const getFSName = (id) => {
        if (!id) return 'Default (Global)';
        const fs = fileServers.find(f => f.id === id);
        return fs ? fs.name : 'Unknown';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
                <button
                    onClick={() => navigate('/devices')}
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                        <Server className="mr-3 text-blue-600" size={24} />
                        {device.hostname}
                    </h1>
                    <p className="text-sm text-gray-500 font-mono mt-1">{device.ip_address}</p>
                </div>
                <div className="ml-auto flex space-x-2 items-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${device.reachability === 'Reachable' ? 'bg-green-100 text-green-700' :
                        device.reachability === 'Unreachable' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-500'
                        }`}>
                        {device.reachability}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                        {device.family}
                    </span>
                    {can('devices.change_device') && (
                        <button
                            onClick={() => setShowEditModal(true)}
                            className="ml-4 flex items-center px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-semibold text-gray-700 transition"
                        >
                            <Edit size={14} className="mr-2" /> Edit Configuration
                        </button>
                    )}
                </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center">
                        <Activity className="mr-2" size={16} /> System Info
                    </h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between border-b border-gray-50 py-2">
                            <span className="text-gray-500">Platform</span>
                            <span className="font-medium text-gray-900">{device.platform}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-50 py-2">
                            <span className="text-gray-500">Version</span>
                            <span className="font-medium text-gray-900">{device.version || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-50 py-2">
                            <span className="text-gray-500">Site</span>
                            <span className="font-medium text-gray-900">{device.site || 'Global'}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-50 py-2">
                            <span className="text-gray-500">Username</span>
                            <span className="font-medium text-gray-900">{device.username}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-50 py-2 bg-blue-50/30 px-2 -mx-2 rounded">
                            <span className="text-blue-800 font-semibold">Preferred File Server</span>
                            <span className="font-medium text-blue-900">{getFSName(device.preferred_file_server)}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center">
                        <ShieldCheck className="mr-2" size={16} /> Compliance & Security
                    </h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between border-b border-gray-50 py-2">
                            <span className="text-gray-500">Config Compliance</span>
                            <span className={`font-medium ${device.version && device.version !== 'Unknown' ? 'text-green-600' : 'text-gray-400'
                                }`}>
                                {device.version && device.version !== 'Unknown' ? 'Compliant' : 'Not Synced'}
                            </span>
                        </div>
                        <div className="flex justify-between border-b border-gray-50 py-2">
                            <span className="text-gray-500">Image Compliance</span>
                            <span className={`font-medium ${device.compliance_status === 'Compliant' ? 'text-green-600' :
                                    device.compliance_status === 'Ahead' ? 'text-blue-600' :
                                        device.compliance_status === 'Non-Compliant' ? 'text-red-600' :
                                            'text-gray-500'
                                }`}>
                                {device.compliance_status || 'No Standard'}
                            </span>
                        </div>
                        <div className="flex justify-between border-b border-gray-50 py-2">
                            <span className="text-gray-500">Last Scan</span>
                            <span className="font-medium text-gray-900 flex items-center">
                                <Clock size={12} className="mr-1" />
                                {device.last_sync_time
                                    ? new Date(device.last_sync_time).toLocaleString()
                                    : 'Never'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Associated Jobs */}
            <DeviceJobs deviceId={id} />

            {/* Sync History */}
            <SyncHistory deviceId={id} />

            {/* Edit Modal */}
            {showEditModal && (
                <EditDeviceModal
                    device={device}
                    onClose={() => setShowEditModal(false)}
                    onSuccess={fetchData}
                />
            )}
        </div>
    );
};

const DeviceJobs = ({ deviceId }) => {
    const [jobs, setJobs] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                // Fetch all jobs and filter client side for now, or use API filter if available
                const res = await axios.get('/api/core/jobs/');
                const allJobs = res.data.results || res.data;
                const devJobs = allJobs.filter(j => j.device === parseInt(deviceId) || j.device_id === parseInt(deviceId));
                // Sort by ID desc
                devJobs.sort((a, b) => b.id - a.id);
                setJobs(devJobs);
            } catch (e) {
                console.error("Failed to fetch device jobs", e);
            }
        };
        fetchJobs();
    }, [deviceId]);

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center">
                <Activity className="mr-2" size={16} /> Job History
            </h3>
            {jobs.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No jobs found for this device.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
                            <tr>
                                <th className="p-3">ID</th>
                                <th className="p-3">Task</th>
                                <th className="p-3">Status</th>
                                <th className="p-3">Time</th>
                                <th className="p-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {jobs.map(job => (
                                <tr key={job.id} className="hover:bg-blue-50/50">
                                    <td className="p-3 font-mono">#{job.id}</td>
                                    <td className="p-3">{job.task_name || 'Operation'}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${['success', 'distributed'].includes(job.status) ? 'bg-green-100 text-green-700' :
                                            ['failed', 'cancelled'].includes(job.status) ? 'bg-red-100 text-red-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>
                                            {job.status}
                                        </span>
                                    </td>
                                    <td className="p-3 text-gray-500 text-xs">{new Date(job.created_at).toLocaleString()}</td>
                                    <td className="p-3 text-right">
                                        <button
                                            onClick={() => navigate(`/jobs/${job.id}`)}
                                            className="text-blue-600 hover:text-blue-800 text-xs font-bold"
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const SyncHistory = ({ deviceId }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        fetchHistory();
    }, [deviceId]);

    const fetchHistory = async () => {
        try {
            const res = await axios.get(`/api/dcim/devices/${deviceId}/sync_history/`);
            setHistory(res.data);
        } catch (error) {
            console.error("Failed to fetch sync history", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center text-gray-500">
                    <RefreshCw className="animate-spin mr-2" size={16} />
                    Loading sync history...
                </div>
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center">
                    <RefreshCw className="mr-2" size={16} /> Sync History
                </h3>
                <p className="text-gray-500 text-sm">No sync history available.</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center">
                <RefreshCw className="mr-2" size={16} /> Sync History
            </h3>
            <div className="space-y-3">
                {history.map((sync) => (
                    <div key={sync.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div
                            className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                            onClick={() => setExpandedId(expandedId === sync.id ? null : sync.id)}
                        >
                            <div className="flex items-center space-x-3">
                                <span className={`w-2 h-2 rounded-full ${sync.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                <span className="text-sm font-medium">{new Date(sync.timestamp).toLocaleString()}</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${sync.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                    {sync.status}
                                </span>
                                {sync.version_discovered && (
                                    <span className="text-xs text-gray-500">v{sync.version_discovered}</span>
                                )}
                                {sync.model_discovered && (
                                    <span className="text-xs text-gray-500">{sync.model_discovered}</span>
                                )}
                            </div>
                            <div className="flex items-center space-x-2">
                                {Object.keys(sync.changes || {}).length > 0 && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                        {Object.keys(sync.changes).length} change(s)
                                    </span>
                                )}
                                {expandedId === sync.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                        </div>

                        {expandedId === sync.id && (
                            <div className="p-3 bg-gray-50 border-t border-gray-200">
                                {sync.status === 'failed' ? (
                                    <div className="flex items-start text-red-600 text-sm">
                                        <AlertCircle className="mr-2 mt-0.5 flex-shrink-0" size={16} />
                                        <span>{sync.error_message}</span>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {sync.changes && Object.keys(sync.changes).length > 0 ? (
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="text-left text-gray-500">
                                                        <th className="pb-2 font-medium">Field</th>
                                                        <th className="pb-2 font-medium">Previous Value</th>
                                                        <th className="pb-2 font-medium">New Value</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Object.entries(sync.changes).map(([field, change]) => (
                                                        <tr key={field} className="border-t border-gray-200">
                                                            <td className="py-2 font-medium capitalize">{field}</td>
                                                            <td className="py-2 text-red-600">{change.old || '-'}</td>
                                                            <td className="py-2 text-green-600">{change.new || '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <p className="text-gray-500 text-sm">No changes detected (values remained the same).</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DeviceDetails;
