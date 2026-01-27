import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Server, Activity, ShieldCheck, Clock, Edit } from 'lucide-react';
import EditDeviceModal from './EditDeviceModal';

const DeviceDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [device, setDevice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);
    const [fileServers, setFileServers] = useState([]);

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            const [devRes, fsRes] = await Promise.all([
                axios.get(`/api/devices/${id}/`),
                axios.get('/api/file-servers/')
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
                    <button
                        onClick={() => setShowEditModal(true)}
                        className="ml-4 flex items-center px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-semibold text-gray-700 transition"
                    >
                        <Edit size={14} className="mr-2" /> Edit Configuration
                    </button>
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
                            <span className="font-medium text-green-600">Compliant</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-50 py-2">
                            <span className="text-gray-500">Image Compliance</span>
                            <span className="font-medium text-yellow-600">Check Pending</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-50 py-2">
                            <span className="text-gray-500">Last Scan</span>
                            <span className="font-medium text-gray-900 flex items-center">
                                <Clock size={12} className="mr-1" /> 2 hours ago
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Associated Jobs */}
            <DeviceJobs deviceId={id} />

            <div className="mt-8 bg-blue-50 p-4 rounded text-center text-blue-700 text-sm">
                Placeholder for more detailed configuration, interfaces, and telemetry history.
            </div>

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
                const res = await axios.get('/api/jobs/');
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

export default DeviceDetails;
