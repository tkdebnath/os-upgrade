import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, Calendar, User, Search, FileText } from 'lucide-react';

const Reports = () => {
    const [jobs, setJobs] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedUser, setSelectedUser] = useState('');

    useEffect(() => {
        fetchUsers();
        fetchReports(); // Initial fetch
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await axios.get('/api/users/');
            setUsers(res.data.results || res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchReports = async () => {
        setLoading(true);
        try {
            const params = {};
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;
            if (selectedUser) params.user_id = selectedUser;

            const res = await axios.get('/api/reports/', { params });
            setJobs(res.data.results || res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        // Simple client-side CSV export
        const csvContent = [
            ['Job ID', 'Device', 'Status', 'Date', 'User'],
            ...jobs.map(job => [job.id, job.device_hostname, job.status, job.created_at, job.created_by || 'System'])
        ].map(e => e.join(",")).join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `swim_report_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">Audit Reports</h1>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-end space-x-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Start Date</label>
                    <div className="relative">
                        <Calendar size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">End Date</label>
                    <div className="relative">
                        <Calendar size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">User</label>
                    <div className="relative">
                        <User size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <select
                            value={selectedUser}
                            onChange={e => setSelectedUser(e.target.value)}
                            className="pl-10 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            <option value="">All Users</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex-1"></div>
                <button onClick={fetchReports} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center">
                    <Search size={16} className="mr-2" /> Generate Report
                </button>
                <button onClick={handleExport} disabled={jobs.length === 0} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium flex items-center disabled:opacity-50">
                    <Download size={16} className="mr-2" /> Export CSV
                </button>
            </div>

            {/* Results Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-bold tracking-wider">
                        <tr>
                            <th className="p-4">Job ID</th>
                            <th className="p-4">Device</th>
                            <th className="p-4">Action Type</th>
                            <th className="p-4">User</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Timestamp</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {jobs.map(job => (
                            <tr key={job.id} className="hover:bg-gray-50">
                                <td className="p-4 font-mono text-gray-500">#{job.id}</td>
                                <td className="p-4 font-bold text-gray-800">{job.device_hostname}</td>
                                <td className="p-4">Image Update</td>
                                <td className="p-4 flex items-center">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold mr-2">
                                        {(job.created_by || 'Sys')[0].toUpperCase()}
                                    </div>
                                    {job.created_by || 'System'}
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${job.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {job.status}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-500">{new Date(job.created_at).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {jobs.length === 0 && !loading && (
                    <div className="p-8 text-center text-gray-400">
                        No records found matching filters.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Reports;
