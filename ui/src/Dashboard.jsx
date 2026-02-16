import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Network, Activity, Clock, PieChart as PieIcon, BarChart as BarIcon, CheckCircle, Zap, Play, Pause } from 'lucide-react';
import { useAuth } from './context/AuthContext';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const Dashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [devices, setDevices] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [stats, setStats] = useState({ analytics: null, ztp: null });
    const [ztpWorkflows, setZtpWorkflows] = useState([]);

    const initialJobStats = [
        { name: 'Success', value: 0, fill: '#10B981' },
        { name: 'Failed', value: 0, fill: '#EF4444' },
        { name: 'Running', value: 0, fill: '#3B82F6' },
    ];
    const [jobStats, setJobStats] = useState(initialJobStats);

    const fetchData = async () => {
        try {
            const [devRes, jobRes, statsRes, ztpRes] = await Promise.all([
                axios.get('/api/dcim/devices/'),
                axios.get('/api/core/jobs/'),
                axios.get('/api/core/dashboard/stats/'),
                axios.get('/api/core/ztp-workflows/')
            ]);
            const fetchedDevices = devRes.data.results || devRes.data;
            const fetchedJobs = jobRes.data.results || jobRes.data;
            const fetchedZtp = ztpRes.data.results || ztpRes.data;

            setDevices(fetchedDevices);
            setJobs(fetchedJobs);
            setStats(statsRes.data);
            setZtpWorkflows(fetchedZtp);

            setJobStats([
                { name: 'Success', value: fetchedJobs.filter(j => j.status === 'success').length, fill: '#10B981' },
                { name: 'Failed', value: fetchedJobs.filter(j => j.status === 'failed').length, fill: '#EF4444' },
                { name: 'Running', value: fetchedJobs.filter(j => j.status === 'running').length, fill: '#3B82F6' },
            ]);
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    };

    useEffect(() => {
        if (user && !user.is_superuser && !user.permissions?.includes('core.view_dashboard')) {
            navigate('/profile', { replace: true });
            return;
        }
        
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [user, navigate]);

    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-bold text-gray-800">Network Overview</h1>

            {/* Analytics Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Devices by Site */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase flex items-center mb-4">
                        <Network size={16} className="mr-2" /> Devices by Site
                    </h3>
                    <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.analytics?.by_site || []}
                                    cx="50%" cy="50%"
                                    innerRadius={40} outerRadius={60}
                                    paddingAngle={5}
                                    dataKey="value"
                                    nameKey="name"
                                >
                                    {(stats.analytics?.by_site || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value, name, props) => {
                                    const data = stats.analytics?.by_site || [];
                                    const total = data.reduce((sum, item) => sum + item.value, 0);
                                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                    return [`${value} (${percentage}%)`, name];
                                }} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Devices by Model */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase flex items-center mb-4">
                        <BarIcon size={16} className="mr-2" /> By Model
                    </h3>
                    <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.analytics?.by_model || []}>
                                <XAxis dataKey="name" hide />
                                <Tooltip formatter={(value) => [value, 'Devices']} labelStyle={{ color: '#6B7280' }} />
                                <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 4, 4]} name="Model" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Compliance Status */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase flex items-center mb-4">
                        <CheckCircle size={16} className="mr-2" /> Compliance
                    </h3>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.analytics?.compliance || []}
                                    cx="50%" cy="45%"
                                    innerRadius={0} outerRadius={55}
                                    dataKey="value"
                                >
                                    <Cell fill="#10B981" /> {/* Compliant - Green */}
                                    <Cell fill="#3B82F6" /> {/* Ahead - Blue */}
                                    <Cell fill="#EF4444" /> {/* Non-Compliant - Red */}
                                </Pie>
                                <Tooltip formatter={(value, name) => {
                                    const data = stats.analytics?.compliance || [];
                                    const total = data.reduce((sum, item) => sum + item.value, 0);
                                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                    return [`${value} devices (${percentage}%)`, name];
                                }} />
                                <Legend 
                                    layout="horizontal" 
                                    verticalAlign="bottom" 
                                    align="center"
                                    iconSize={10}
                                    wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Software Versions */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase flex items-center mb-4">
                        <PieIcon size={16} className="mr-2" /> Top Versions
                    </h3>
                    <div className="space-y-2">
                        {(stats.analytics?.by_version || []).slice(0, 5).map((v, i) => (
                            <div key={i} className="flex justify-between items-center text-sm">
                                <span className="text-gray-600 font-medium">{v.name}</span>
                                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-bold">{v.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Stats Section */}
                <section className="col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-700">
                        <Activity className="mr-2 h-5 w-5 text-blue-500" /> Job Statistics
                    </h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={jobStats}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: '#F3F4F6' }} />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                {/* Quick Actions / Recent Devices (Simplified) */}
                <section className="col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-semibold flex items-center text-gray-700">
                            <Network className="mr-2 h-5 w-5 text-purple-500" /> Managed Devices ({devices.length})
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-bold tracking-wider">
                                <tr>
                                    <th className="p-3">Hostname</th>
                                    <th className="p-3">Platform</th>
                                    <th className="p-3">Version</th>
                                    <th className="p-3">Site</th>
                                    <th className="p-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {devices.slice(0, 5).map(dev => (
                                    <tr key={dev.id} className="hover:bg-gray-50">
                                        <td className="p-3 font-medium text-gray-800">{dev.hostname}</td>
                                        <td className="p-3 text-gray-500">{dev.platform}</td>
                                        <td className="p-3 text-gray-500">{dev.version || 'Unknown'}</td>
                                        <td className="p-3 text-gray-500">{dev.site || 'Default'}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ring-1 ${dev.reachability === 'Reachable' ? 'bg-green-100 text-green-700 ring-green-200' :
                                                dev.reachability === 'Unreachable' ? 'bg-red-100 text-red-700 ring-red-200' :
                                                    'bg-gray-100 text-gray-600 ring-gray-200'
                                                }`}>
                                                {dev.reachability || 'Unknown'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {devices.length === 0 && <tr><td colSpan="5" className="p-4 text-center text-gray-400">No devices found.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Recent Jobs */}
                <section className="col-span-3 bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-700">
                        <Clock className="mr-2 h-5 w-5 text-orange-500" /> Recent Activity
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {jobs.slice(0, 6).map(job => (
                            <div key={job.id} className="border border-gray-100 bg-gray-50/50 p-4 rounded-lg flex justify-between items-center hover:border-blue-200 transition">
                                <div>
                                    <p className="font-semibold text-gray-800 text-sm">{job.device_hostname}</p>
                                    <p className="text-xs text-gray-500">Image: {job.image_filename}</p>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${job.status === 'success' ? 'bg-green-100 text-green-700 ring-1 ring-green-200' :
                                        job.status === 'failed' ? 'bg-red-100 text-red-700 ring-1 ring-red-200' :
                                            job.status === 'running' ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' : 'bg-gray-200 text-gray-600'
                                        }`}>
                                        {job.status}
                                    </span>
                                    <span className="text-[10px] text-gray-400 mt-1">{new Date(job.created_at).toLocaleTimeString()}</span>
                                </div>
                            </div>
                        ))}
                        {jobs.length === 0 && <p className="text-gray-400 col-span-3 text-center">No recent activity.</p>}
                    </div>
                </section>

                {/* ZTP Section - Zero Touch Provisioning */}
                <section className="col-span-3 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl shadow-sm border border-blue-100 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-semibold flex items-center text-gray-800">
                            <Zap size={20} className="mr-2 text-blue-600" /> Zero Touch Provisioning (ZTP)
                        </h2>
                        <button
                            onClick={() => navigate('/ztp')}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold flex items-center gap-2"
                        >
                            <Play size={16} /> Create ZTP Workflow
                        </button>
                    </div>

                    {/* ZTP Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-white p-4 rounded-lg border border-blue-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-semibold">Active Endpoints</p>
                                    <p className="text-2xl font-bold text-blue-600">{stats.ztp?.active_workflows || 0}</p>
                                </div>
                                <Activity className="text-blue-400" size={32} />
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-amber-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-semibold">Paused</p>
                                    <p className="text-2xl font-bold text-amber-600">{stats.ztp?.paused_workflows || 0}</p>
                                </div>
                                <Pause className="text-amber-400" size={32} />
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-green-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-semibold">Provisioned Today</p>
                                    <p className="text-2xl font-bold text-green-600">{stats.ztp?.total_provisioned_today || 0}</p>
                                </div>
                                <CheckCircle className="text-green-400" size={32} />
                            </div>
                        </div>
                    </div>

                    {/* Recent ZTP Workflows */}
                    <div className="bg-white rounded-lg border border-blue-100 overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                            <h3 className="text-sm font-semibold text-gray-700">Recent ZTP Endpoints</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-bold tracking-wider border-b border-gray-100">
                                    <tr>
                                        <th className="p-3">Endpoint Name</th>
                                        <th className="p-3">Workflow</th>
                                        <th className="p-3">Devices</th>
                                        <th className="p-3">Success Rate</th>
                                        <th className="p-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {ztpWorkflows.slice(0, 5).map(wf => {
                                        const successRate = wf.total_devices > 0 ? Math.round((wf.completed_devices / wf.total_devices) * 100) : 0;
                                        const getStatusColor = (status) => {
                                            const colors = {
                                                'active': 'bg-green-100 text-green-700 ring-green-200',
                                                'paused': 'bg-amber-100 text-amber-700 ring-amber-200',
                                                'completed': 'bg-blue-100 text-blue-700 ring-blue-200',
                                                'archived': 'bg-gray-100 text-gray-500 ring-gray-200'
                                            };
                                            return colors[status] || 'bg-gray-100 text-gray-600 ring-gray-200';
                                        };

                                        return (
                                            <tr key={wf.id} className="hover:bg-blue-50/30 cursor-pointer" onClick={() => navigate(`/ztp`)}>
                                                <td className="p-3 font-medium text-gray-800">{wf.name}</td>
                                                <td className="p-3 text-gray-600 text-xs">{wf.workflow_name || 'Not set'}</td>
                                                <td className="p-3 text-gray-600">
                                                    <span className="font-semibold">{wf.total_devices || 0}</span>
                                                    {wf.total_devices > 0 && (
                                                        <span className="text-xs text-gray-400 ml-1">
                                                            (✓{wf.completed_devices} ✗{wf.failed_devices})
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                                                            <div 
                                                                className="bg-blue-600 h-full transition-all duration-300"
                                                                style={{ width: `${successRate}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-gray-600 font-medium w-10 text-right">{successRate}%</span>
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ring-1 ${getStatusColor(wf.status)}`}>
                                                        {wf.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {ztpWorkflows.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="p-6 text-center text-gray-400">
                                                <Zap className="mx-auto mb-2 text-gray-300" size={32} />
                                                <p>No ZTP workflows configured. Set one up to auto-upgrade devices on first boot!</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ZTP Info Card */}
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-900">
                            <strong className="font-semibold">💡 True Zero Touch Provisioning!</strong> Device boots, hits webhook with creds, 
                            SWIM discovers it, checks if running right IOS, auto-upgrades to golden image if needed.
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Dashboard;
