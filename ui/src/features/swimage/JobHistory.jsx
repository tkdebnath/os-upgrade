import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, RefreshCw, Activity, CheckCircle, XCircle, Clock, ChevronRight, RotateCw, Filter, PlayCircle, StopCircle, MinusCircle, FileText, XOctagon, Calendar } from 'lucide-react';

const Jobs = () => {
    const navigate = useNavigate();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All');
    const [search, setSearch] = useState('');
    const [selectedJobLogs, setSelectedJobLogs] = useState(null);
    const [selectedJobIds, setSelectedJobIds] = useState([]);

    const initiateCancel = async (id) => {
        if (!window.confirm("Are you sure you want to cancel this job?")) return;
        try {
            await axios.post(`/api/core/jobs/${id}/cancel/`);
            fetchJobs(); // Refresh to show status change
        } catch (error) {
            console.error("Failed to cancel job", error);
            alert("Failed to cancel job");
        }
    };

    const toggleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedJobIds(filteredJobs.map(j => j.id));
        } else {
            setSelectedJobIds([]);
        }
    };

    const toggleSelectJob = (id) => {
        if (selectedJobIds.includes(id)) {
            setSelectedJobIds(selectedJobIds.filter(jid => jid !== id));
        } else {
            setSelectedJobIds([...selectedJobIds, id]);
        }
    };

    useEffect(() => {
        fetchJobs();
        const interval = setInterval(fetchJobs, 5000);
        return () => clearInterval(interval);
    }, [search]); // Re-fetch when search changes (debounce could be added for optimization)

    const fetchJobs = async () => {
        try {
            const res = await axios.get('/api/core/jobs/', {
                params: { search: search }
            });
            setJobs(res.data.results || res.data);
            setLoading(false);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    // Derived Status Counts
    const counts = {
        All: jobs.length,
        'In Progress': jobs.filter(j => ['running', 'distributing', 'activating'].includes(j.status)).length,
        'Waiting': jobs.filter(j => j.status === 'scheduled' || j.status === 'pending').length,
        'Cancelled': jobs.filter(j => j.status === 'cancelled').length,
        'Success': jobs.filter(j => j.status === 'success' || j.status === 'distributed').length,
        'Failure': jobs.filter(j => j.status === 'failed').length
    };

    const getStatusIcon = (status) => {
        if (['success', 'distributed'].includes(status)) return <CheckCircle size={14} className="text-green-500 mr-2" />;
        if (['running', 'distributing', 'activating'].includes(status)) return <Activity size={14} className="text-blue-500 mr-2 animate-spin" />;
        if (status === 'failed') return <XCircle size={14} className="text-red-500 mr-2" />;
        if (status === 'cancelled') return <XOctagon size={14} className="text-gray-500 mr-2" />;
        return <Clock size={14} className="text-orange-400 mr-2" />;
    };

    const renderStatus = (status) => {
        return (
            <div className="flex items-center">
                {getStatusIcon(status)}
                <span className="text-gray-700 font-medium text-xs capitalize">{status}</span>
            </div>
        );
    };

    const getStatusText = (job) => {
        if (job.status === 'running') return "Upgrade in progress...";
        if (job.status === 'distributing') return "Copying IOS to flash...";
        if (job.status === 'activating') return `Reloading with ${job.image_filename}...`;
        if (job.status === 'distributed') return "IOS Copy Complete";
        if (job.status === 'success') return "Success";
        if (job.status === 'failed') return "Failed";
        if (job.status === 'cancelled') return "Cancelled";
        if (job.status === 'scheduled' && job.distribution_time) {
            return `Scheduled: ${new Date(job.distribution_time).toLocaleString()}`;
        }
        return "Waiting";
    };

    const filteredJobs = filter === 'All' ? jobs :
        filter === 'In Progress' ? jobs.filter(j => ['running', 'distributing', 'activating'].includes(j.status)) :
            filter === 'Waiting' ? jobs.filter(j => ['scheduled', 'pending'].includes(j.status)) :
                filter === 'Cancelled' ? jobs.filter(j => j.status === 'cancelled') :
                    filter === 'Success' ? jobs.filter(j => ['success', 'distributed'].includes(j.status)) :
                        filter === 'Failure' ? jobs.filter(j => j.status === 'failed') :
                            jobs;

    return (
        <div className="flex h-full bg-white space-x-6">


            {/* Log Modal */}
            {selectedJobLogs && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-3/4 h-3/4 flex flex-col p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Job Logs - {selectedJobLogs.device_hostname}</h3>
                            <button onClick={() => setSelectedJobLogs(null)} className="text-gray-500 hover:text-gray-700">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <pre className="flex-1 bg-gray-100 p-4 rounded overflow-auto font-mono text-xs whitespace-pre-wrap">
                            {selectedJobLogs.log || "No logs available."}
                        </pre>
                    </div>
                </div>
            )}

            {/* Left Sidebar - Facets */}
            <div className="w-64 flex-shrink-0 border-r border-gray-100 pr-4 hidden lg:block">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Summary</h3>

                <div className="space-y-1">
                    <button className="flex items-center justify-between w-full text-left px-2 py-2 bg-gray-50 rounded text-sm font-medium text-gray-700">
                        <span className="flex items-center"><ChevronRight size={14} className="mr-2 text-gray-400" /> Task Names</span>
                        <span className="text-gray-400 text-xs">({jobs.length})</span>
                    </button>
                    <button className="flex items-center justify-between w-full text-left px-2 py-2 hover:bg-gray-50 rounded text-sm text-gray-600">
                        <span className="flex items-center"><ChevronRight size={14} className="mr-2 text-gray-400" /> Image Versions</span>
                        <span className="text-gray-400 text-xs">({new Set(jobs.map(j => j.image_filename)).size})</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0 flex flex-col h-full bg-gray-50/50">
                <div className="p-6 border-b border-gray-200 bg-white">
                    <h1 className="text-xl font-bold text-gray-800 mb-4">IOS Upgrade Jobs</h1>

                    {/* Status Pills */}
                    <div className="flex items-center space-x-2 text-sm overflow-x-auto pb-2">
                        <span className="text-gray-500 font-medium mr-2">Update Status</span>
                        {Object.keys(counts).map(key => (
                            <button
                                key={key}
                                onClick={() => setFilter(key)}
                                className={`px-3 py-1 rounded-full border text-xs font-bold flex items-center transition-colors ${filter === key
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                {key === 'In Progress' && <Activity size={12} className="mr-1" />}
                                {key === 'Success' && <CheckCircle size={12} className="mr-1" />}
                                {key === 'Failure' && <XCircle size={12} className="mr-1" />}
                                {key} <span className={`ml-2 opacity-75`}>({counts[key]})</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Toolbar */}
                <div className="px-6 py-4 flex justify-between items-center bg-white border-b border-gray-200">
                    <div className="text-sm text-gray-500 flex items-center space-x-4">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by Device Name..."
                                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 w-64"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <span className="mx-2 text-gray-300">|</span>

                        {/* Bulk Actions */}
                        {selectedJobIds.length > 0 ? (
                            <button
                                onClick={() => {
                                    /* Since we don't have bulk cancel logic in this component yet (it was in ScheduledJobs), we need to implement it or just rely on row actions. 
                                       Actually, the user asked for bulk cancel in general. I should add it here too if possible, OR just keep it simple.
                                       Let's add a placeholder or simple loop cancel here if needed, but for now just the "Cancel (N)" button.
                                       Wait, the previous edit tried to add it. Let's add it properly.
                                    */
                                    if (confirm(`Cancel ${selectedJobIds.length} jobs?`)) {
                                        Promise.all(selectedJobIds.map(id => axios.post(`/api/core/jobs/${id}/cancel/`)))
                                            .then(() => fetchJobs());
                                        setSelectedJobIds([]);
                                    }
                                }}
                                className="flex items-center px-3 py-2 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200 transition"
                            >
                                <XCircle size={16} className="mr-1.5" /> Cancel ({selectedJobIds.length})
                            </button>
                        ) : (
                            <>
                                <button className="text-blue-600 hover:underline" onClick={fetchJobs}>Refresh</button>
                            </>
                        )}
                    </div>
                    <div className="text-xs text-gray-400 flex items-center">
                        Last detailed update: {new Date().toLocaleString()}
                        <button onClick={fetchJobs}><RefreshCw size={12} className="ml-2 hover:text-blue-600 cursor-pointer" /></button>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-bold sticky top-0 z-10 border-b border-gray-200">
                            <tr>
                                <th className="p-4 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded"
                                        onChange={toggleSelectAll}
                                        checked={jobs.length > 0 && selectedJobIds.length === jobs.length}
                                    />
                                </th>
                                <th className="p-4 w-20">ID</th>
                                <th className="p-4">Device</th>
                                <th className="p-4">Task Name</th>
                                <th className="p-4">Type</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Started At</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="8" className="p-8 text-center text-gray-400">Loading jobs...</td></tr>
                            ) : jobs.length === 0 ? (
                                <tr><td colSpan="8" className="p-8 text-center text-gray-400">No jobs found.</td></tr>
                            ) : (
                                jobs.map(job => (
                                    <tr key={job.id} className="hover:bg-blue-50/50 transition group">
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                className="rounded"
                                                checked={selectedJobIds.includes(job.id)}
                                                onChange={() => toggleSelectJob(job.id)}
                                            />
                                        </td>
                                        <td className="p-4 font-mono text-xs text-gray-500">
                                            <button
                                                onClick={() => navigate(`/jobs/${job.id}`)}
                                                className="text-blue-600 hover:underline font-bold"
                                            >
                                                #{job.id}
                                            </button>
                                        </td>
                                        <td className="p-4 font-medium text-gray-800">{job.device_hostname || job.device}</td>
                                        <td className="p-4 text-gray-600">{job.task_name || 'N/A'}</td>
                                        <td className="p-4 text-gray-500">Upgrade</td>
                                        <td className="p-4">
                                            {renderStatus(job.status)}
                                        </td>
                                        <td className="p-4 text-gray-500 text-xs">
                                            {new Date(job.created_at).toLocaleString()}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition">
                                                {(['running', 'pending', 'scheduled'].includes(job.status)) && (
                                                    <button
                                                        onClick={() => initiateCancel(job.id)}
                                                        className="text-red-500 hover:text-red-700"
                                                        title="Cancel Job"
                                                    >
                                                        <XCircle size={18} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => navigate(`/jobs/${job.id}`)}
                                                    className="text-blue-600 hover:text-blue-800"
                                                    title="View Details"
                                                >
                                                    <ChevronRight size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    {
                        jobs.length === 0 && !loading && (
                            <div className="p-12 text-center text-gray-400">
                                No active or past updates found.
                            </div>
                        )
                    }
                </div >
            </div >
        </div >
    );
};

export default Jobs;
