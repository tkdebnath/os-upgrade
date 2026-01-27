import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, RefreshCw, Calendar, Clock, CheckCircle, List, ArrowRight, PlayCircle, StopCircle, Trash2 } from 'lucide-react';
import ConfirmModal from '../inventory/ConfirmModal';

const ScheduledJobs = () => {
    const navigate = useNavigate();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedJobIds, setSelectedJobIds] = useState([]);
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [newScheduleTime, setNewScheduleTime] = useState('');

    // Cancellation State
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [jobIdToCancel, setJobIdToCancel] = useState(null); // If null, means bulk cancel of selectedJobIds

    useEffect(() => {
        fetchScheduledJobs();
        const interval = setInterval(fetchScheduledJobs, 10000);
        return () => clearInterval(interval);
    }, [search]);

    const fetchScheduledJobs = async () => {
        try {
            const res = await axios.get('/api/jobs/', {
                params: {
                    status: 'scheduled',
                    search: search
                }
            });
            // Strictly filter: must be status 'scheduled' AND have a valid distribution_time
            const allJobs = res.data.results || res.data;
            const validScheduledJobs = allJobs.filter(j => j.status === 'scheduled' && j.distribution_time);
            setJobs(validScheduledJobs);
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch scheduled jobs", error);
            setLoading(false);
        }
    };

    const initiateCancel = (id = null) => {
        setJobIdToCancel(id);
        setShowCancelModal(true);
    };

    const handleConfirmCancel = async () => {
        try {
            if (jobIdToCancel) {
                // Single Cancel
                await axios.post(`/api/jobs/${jobIdToCancel}/cancel/`);
            } else {
                // Bulk Cancel using same endpoint iteration, or simpler logic.
                // Since we don't have a specific bulk cancel endpoint yet (except maybe abusing bulk_reschedule with status?),
                // let's iterate for now or use the job cancel endpoint loop.
                // BETTER: Use Promise.all
                const promises = selectedJobIds.map(id => axios.post(`/api/jobs/${id}/cancel/`));
                await Promise.all(promises);
                setSelectedJobIds([]);
            }
            fetchScheduledJobs();
            setShowCancelModal(false);
        } catch (error) {
            console.error(error);
            alert("Failed to cancel job(s)");
            setShowCancelModal(false);
        }
    };

    const handleReschedule = async () => {
        if (!newScheduleTime) return alert("Please select a time");
        try {
            await axios.post('/api/jobs/bulk_reschedule/', {
                ids: selectedJobIds,
                distribution_time: newScheduleTime
            });
            setShowRescheduleModal(false);
            setSelectedJobIds([]);
            fetchScheduledJobs();
            alert("Jobs Rescheduled Successfully");
        } catch (error) {
            console.error("Reschedule failed", error);
            alert("Failed to reschedule jobs");
        }
    };

    const toggleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedJobIds(jobs.map(j => j.id));
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

    return (
        <div className="flex h-full bg-white space-x-6">

            {/* Cancel Confirmation Modal */}
            {showCancelModal && (
                <ConfirmModal
                    title={jobIdToCancel ? "Cancel Job" : "Bulk Cancel Jobs"}
                    message={jobIdToCancel
                        ? "Are you sure you want to cancel this scheduled job? It will be removed from the schedule."
                        : `Are you sure you want to cancel these ${selectedJobIds.length} scheduled jobs?`}
                    confirmText="Yes, Cancel"
                    isDestructive={true}
                    onConfirm={handleConfirmCancel}
                    onCancel={() => setShowCancelModal(false)}
                />
            )}

            {/* Reschedule Modal */}
            {showRescheduleModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-96 p-6">
                        <h3 className="text-lg font-bold mb-4">Reschedule Jobs</h3>
                        <p className="text-sm text-gray-500 mb-4">Select a new start time for {selectedJobIds.length} job(s).</p>
                        <input
                            type="datetime-local"
                            className="w-full border rounded p-2 mb-4"
                            onChange={(e) => setNewScheduleTime(e.target.value)}
                        />
                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setShowRescheduleModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                            <button onClick={handleReschedule} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 min-w-0">
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold text-gray-800 flex items-center">
                            <Calendar className="mr-2 text-blue-600" /> Scheduled Operations
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Manage, monitor, and reschedule upcoming maintenance tasks.</p>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex justify-between items-center mb-4 bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search tasks..."
                                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:ring-2 focus:ring-blue-500"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        {selectedJobIds.length > 0 && (
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => setShowRescheduleModal(true)}
                                    className="flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded hover:bg-blue-200 transition"
                                >
                                    <Clock size={14} className="mr-1.5" /> Reschedule ({selectedJobIds.length})
                                </button>
                                <button
                                    onClick={() => initiateCancel(null)}
                                    className="flex items-center px-3 py-1.5 bg-red-100 text-red-700 text-sm font-medium rounded hover:bg-red-200 transition"
                                >
                                    <Trash2 size={14} className="mr-1.5" /> Cancel ({selectedJobIds.length})
                                </button>
                            </div>
                        )}
                    </div>

                    <button onClick={fetchScheduledJobs} className="p-2 hover:bg-white rounded-full transition text-gray-500 hover:text-blue-600">
                        <RefreshCw size={16} />
                    </button>
                </div>

                {/* Table */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-bold text-xs">
                            <tr>
                                <th className="py-3 px-4 w-8">
                                    <input
                                        type="checkbox"
                                        className="rounded"
                                        checked={jobs.length > 0 && selectedJobIds.length === jobs.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="py-3 px-4">Job ID</th>
                                <th className="py-3 px-4">Scheduled Time</th>
                                <th className="py-3 px-4">Task Name</th>
                                <th className="py-3 px-4">Device</th>
                                <th className="py-3 px-4">Created By</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {jobs.map(job => (
                                <tr key={job.id} className={`hover:bg-blue-50/50 transition ${selectedJobIds.includes(job.id) ? 'bg-blue-50' : ''}`}>
                                    <td className="py-4 px-4">
                                        <input
                                            type="checkbox"
                                            className="rounded"
                                            checked={selectedJobIds.includes(job.id)}
                                            onChange={() => toggleSelectJob(job.id)}
                                        />
                                    </td>
                                    <td className="py-4 px-4 text-gray-800 font-mono text-xs">
                                        <span
                                            onClick={() => navigate(`/jobs/${job.id}`)}
                                            className="cursor-pointer hover:text-blue-600 hover:underline"
                                            title="View Job Details"
                                        >
                                            #{job.id}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 text-blue-600 font-mono">
                                        {job.distribution_time ? new Date(job.distribution_time).toLocaleString() : 'Not Scheduled'}
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-xs font-semibold text-gray-600">
                                            {job.task_name || 'Upgrade-Task'}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="font-medium text-gray-800">{job.device_hostname}</div>
                                        <div className="text-xs text-gray-400">ID: {job.device}</div>
                                    </td>
                                    <td className="py-4 px-4 text-gray-500 italic">User</td>
                                    <td className="py-4 px-4 text-right">
                                        <div className="flex justify-end items-center space-x-3">
                                            <button
                                                onClick={() => navigate(`/jobs/${job.id}`)}
                                                className="text-blue-600 hover:text-blue-800 text-xs font-bold hover:underline"
                                            >
                                                View
                                            </button>
                                            <button
                                                onClick={() => initiateCancel(job.id)}
                                                className="text-red-500 hover:text-red-700 text-xs font-bold hover:underline"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {jobs.length === 0 && !loading && (
                        <div className="p-12 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                                <Calendar size={32} className="text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">No Scheduled Jobs</h3>
                            <p className="text-gray-500 mt-1">There are no upcoming tasks scheduled at this time.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScheduledJobs;
