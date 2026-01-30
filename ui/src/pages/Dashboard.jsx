import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, AlertTriangle, Box, Wifi, Shield, Zap, Globe, Server, Layers, Clock, CheckCircle, XCircle, FileText, Download, ChevronDown, ChevronUp, Play, X } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const Card = ({ title, children, className = "" }) => (
    <div className={`bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col ${className}`}>
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-gray-500 font-medium text-sm uppercase tracking-wide">{title}</h3>
            <button className="text-blue-600 text-xs font-semibold hover:underline">View Details</button>
        </div>
        <div className="flex-1">
            {children}
        </div>
    </div>
);

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('scheduled'); // scheduled | history
    const [expandedJobId, setExpandedJobId] = useState(null);

    const fetchAll = async () => {
        try {
            const [statsRes, jobsRes] = await Promise.all([
                axios.get('/api/core/dashboard/stats/'),
                axios.get('/api/core/jobs/')
            ]);
            setStats(statsRes.data);
            setJobs(jobsRes.data);
        } catch (err) {
            console.error("Dashboard fetch failed", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
        const interval = setInterval(fetchAll, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    const handleCancelJob = async (jobId) => {
        if (!confirm("Are you sure you want to cancel this scheduled job?")) return;
        try {
            await axios.post(`/api/jobs/${jobId}/cancel/`);
            fetchAll();
        } catch (err) {
            alert("Failed to cancel job: " + (err.response?.data?.error || err.message));
        }
    };

    const toggleJobExpand = (id) => {
        if (expandedJobId === id) setExpandedJobId(null);
        else setExpandedJobId(id);
    };

    const s = stats || {
        health: { percentage: 0, reachable: 0, unreachable: 0 },
        issues: { critical: 0, warning: 0 },
        network: { sites: 0, devices: 0, unprovisioned: 0, unclaimed: 0 }
    };

    // Calculate chart data based on stats
    // If no data, show empty gray circle
    const hasData = s.network.devices > 0;
    const healthData = hasData ? [
        { name: 'Healthy', value: s.health.reachable, color: '#10b981' }, // green-500
        { name: 'Unhealthy', value: s.health.unreachable, color: '#ef4444' }, // red-500
    ] : [{ name: 'No Data', value: 1, color: '#e5e7eb' }];

    if (loading) return <div className="p-8 text-gray-500 text-center">Loading Dashboard...</div>;

    return (
        <div className="space-y-8">

            {/* Welcome Banner / Alerts */}
            {s.issues.critical > 0 ? (
                <div className="bg-white p-6 rounded-lg border border-red-200 border-l-4 border-l-red-500 flex items-start shadow-sm">
                    <AlertTriangle className="text-red-500 mr-3 mt-1" size={20} />
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Attention Required</h2>
                        <p className="text-gray-600 text-sm mt-1">There are {s.issues.critical} critical issues (failed jobs) in the last 24 hours.</p>
                    </div>
                </div>
            ) : (
                <div className="bg-white p-6 rounded-lg border border-green-200 border-l-4 border-l-green-500 flex items-start shadow-sm">
                    <Shield className="text-green-500 mr-3 mt-1" size={20} />
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">System Healthy</h2>
                        <p className="text-gray-600 text-sm mt-1">No critical issues detected in the last 24 hours.</p>
                    </div>
                </div>
            )}

            {/* Assurance Summary Section */}
            <div>
                <h2 className="text-xl font-light text-gray-500 mb-4">Assurance Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Health Card */}
                    <Card title="Health">
                        <div className="flex items-center space-x-8">
                            <div className="relative h-32 w-32">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={healthData} innerRadius={40} outerRadius={55} dataKey="value" startAngle={90} endAngle={-270}>
                                            {healthData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex items-center justify-center flex-col">
                                    <span className={`text-3xl font-light ${hasData ? 'text-blue-600' : 'text-gray-300'}`}>
                                        {hasData ? `${s.health.percentage}%` : 'N/A'}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <div className="mb-4">
                                    <span className="text-3xl font-light text-green-600">{s.health.reachable}</span>
                                    <p className="text-xs text-gray-500 uppercase">Reachable</p>
                                </div>
                                <div>
                                    <span className="text-3xl font-light text-red-500">{s.health.unreachable}</span>
                                    <p className="text-xs text-gray-500 uppercase">Unreachable</p>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-4">Real-time status</p>
                    </Card>

                    {/* Critical Issues Card */}
                    <Card title="Critical Issues">
                        <div className="flex justify-around items-center h-full">
                            <div className="text-center">
                                <p className={`text-5xl font-light ${s.issues.critical > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                                    {s.issues.critical}
                                </p>
                                <p className="text-xs font-bold text-gray-400 mt-2">Failed Jobs</p>
                            </div>
                            <div className="h-16 w-px bg-gray-200"></div>
                            <div className="text-center">
                                <p className="text-5xl font-light text-gray-400">{s.issues.warning}</p>
                                <p className="text-xs font-bold text-gray-400 mt-2">Warnings</p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-4 text-center">Last 24 Hours</p>
                    </Card>

                    {/* Network Insights */}
                    <Card title="Network Insights">
                        <div className="flex flex-col items-center justify-center h-full text-center p-4">
                            <Box className="text-blue-200 mb-3" size={48} />
                            <p className="text-sm text-gray-600">Device compliance tracking and upgrade history.</p>
                            <a href="#" className="text-blue-600 text-xs font-semibold mt-2 hover:underline">View Reports</a>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Jobs Section */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-8">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <h2 className="font-semibold text-gray-700">Job Activity</h2>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setActiveTab('scheduled')}
                            className={`px-3 py-1 text-xs font-medium rounded-full ${activeTab === 'scheduled' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            Scheduled ({jobs.filter(j => j.status === 'scheduled').length})
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-3 py-1 text-xs font-medium rounded-full ${activeTab === 'history' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            History
                        </button>
                    </div>
                </div>

                <div className="divide-y divide-gray-100">
                    {activeTab === 'scheduled' && (
                        <div>
                            {jobs.filter(j => j.status === 'scheduled').length === 0 ? (
                                <div className="p-8 text-center text-gray-400 text-sm">No scheduled jobs.</div>
                            ) : (
                                jobs.filter(j => j.status === 'scheduled').map(job => (
                                    <div key={job.id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                                        <div className="flex items-center space-x-3">
                                            <div className="bg-blue-100 p-2 rounded-full">
                                                <Clock size={16} className="text-blue-600" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900">{job.device_hostname}</div>
                                                <div className="text-xs text-gray-500">
                                                    Scheduled for: {new Date(job.activation_time).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                            <span className="text-xs font-mono bg-blue-50 text-blue-600 px-2 py-1 rounded">
                                                ID: {job.id}
                                            </span>
                                            <button
                                                onClick={() => handleCancelJob(job.id)}
                                                className="text-red-600 hover:text-red-800 text-xs font-medium border border-red-200 px-3 py-1 rounded hover:bg-red-50 flex items-center"
                                            >
                                                <X size={12} className="mr-1" />
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div>
                            {jobs.filter(j => j.status !== 'scheduled').slice(0, 10).map(job => (
                                <div key={job.id} className="border-b border-gray-100 last:border-0">
                                    <div
                                        className="p-4 flex justify-between items-center hover:bg-blue-50/50 cursor-pointer transition-colors"
                                        onClick={() => toggleJobExpand(job.id)}
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className={`p-2 rounded-full ${job.status === 'success' ? 'bg-green-100' :
                                                    job.status === 'failed' ? 'bg-red-100' :
                                                        job.status === 'cancelled' ? 'bg-gray-100' :
                                                            'bg-yellow-100'
                                                }`}>
                                                {job.status === 'success' ? <CheckCircle size={16} className="text-green-600" /> :
                                                    job.status === 'failed' ? <XCircle size={16} className="text-red-600" /> :
                                                        job.status === 'cancelled' ? <XCircle size={16} className="text-gray-600" /> :
                                                            <Activity size={16} className="text-yellow-600" />}
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900">{job.device_hostname}</div>
                                                <div className="text-xs text-gray-500 capitalize">
                                                    {job.status} • {job.image_filename} • {new Date(job.created_at).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center">
                                            {expandedJobId === job.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {expandedJobId === job.id && (
                                        <div className="bg-gray-50 p-4 border-t border-gray-100 text-sm">

                                            {/* Progress Steps */}
                                            {job.steps && job.steps.length > 0 && (
                                                <div className="mb-4">
                                                    <h4 className="font-semibold text-gray-700 mb-2 text-xs uppercase">Progress Analysis</h4>
                                                    <div className="space-y-2">
                                                        {job.steps.map((step, idx) => (
                                                            <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border border-gray-200">
                                                                <span className="text-gray-600">{step.name}</span>
                                                                <div className="flex items-center space-x-2">
                                                                    <span className="text-xs text-gray-400">{step.timestamp}</span>
                                                                    <span className={`text-xs px-2 py-0.5 rounded ${step.status === 'success' ? 'bg-green-100 text-green-700' :
                                                                            step.status === 'failed' ? 'bg-red-100 text-red-700' :
                                                                                'bg-yellow-100 text-yellow-700'
                                                                        }`}>{step.status}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Logs */}
                                            <div className="mb-4">
                                                <h4 className="font-semibold text-gray-700 mb-2 text-xs uppercase">Execution Log</h4>
                                                <pre className="bg-gray-900 text-gray-300 p-3 rounded font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-60 overflow-y-auto">
                                                    {job.log || "No logs available."}
                                                </pre>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex justify-end space-x-2">
                                                <a
                                                    href={`/api/jobs/${job.id}/download_diffs/`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center space-x-1 px-3 py-1.5 bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-50 text-xs font-medium"
                                                >
                                                    <Download size={14} />
                                                    <span>Download Pre/Post Diffs</span>
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Network Snapshot Section */}
            <div>
                <h2 className="text-xl font-light text-gray-500 mb-4">Network Snapshot</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Sites */}
                    <Card title="Sites">
                        <div className="flex items-end space-x-2">
                            <span className="text-6xl font-light text-blue-600">{s.network.sites}</span>
                        </div>
                        <div className="mt-4 space-y-1">
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Total Sites</span>
                                <span className="font-bold text-blue-600">{s.network.sites}</span>
                            </div>
                        </div>
                        <button className="text-blue-600 text-sm font-semibold mt-6 hover:underline flex items-center">
                            <Globe size={16} className="mr-1" /> Manage Sites
                        </button>
                    </Card>

                    {/* Network Devices */}
                    <Card title="Network Devices">
                        <div className="flex items-end space-x-2">
                            <span className="text-6xl font-light text-blue-600">{s.network.devices}</span>
                        </div>
                        <div className="mt-4 space-y-1">
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Unclaimed</span>
                                <span className="font-bold text-gray-400">{s.network.unclaimed}</span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Unprovisioned</span>
                                <span className="font-bold text-gray-400">{s.network.unprovisioned}</span>
                            </div>
                        </div>
                        <button className="text-blue-600 text-sm font-semibold mt-4 hover:underline flex items-center">
                            <Server size={16} className="mr-1" /> View Inventory
                        </button>
                    </Card>

                    {/* QoS Policies */}
                    <Card title="Image Compliance">
                        <div className="flex items-end space-x-2">
                            <span className="text-6xl font-light text-blue-600">--</span>
                        </div>
                        <div className="mt-4 space-y-1">
                            <p className="text-xs text-gray-500">Golden Image compliance data not yet available.</p>
                        </div>
                        <button className="text-blue-600 text-sm font-semibold mt-6 hover:underline flex items-center">
                            <Layers size={16} className="mr-1" /> Manage Images
                        </button>
                    </Card>

                </div>
            </div>
        </div>
    );
};

export default Dashboard;
