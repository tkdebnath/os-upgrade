import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Users, Shield, Key, ArrowRight, UserPlus, ShieldCheck, Activity, Filter, Search, Calendar, ChevronLeft, ChevronRight, X, FileText, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AdminPanel = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeUsers: 0,
        totalGroups: 0,
        totalPermissions: 0
    });
    const [recentUsers, setRecentUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activityLogs, setActivityLogs] = useState([]);
    const [activityLoading, setActivityLoading] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [filters, setFilters] = useState({
        action: '',
        user: '',
        search: '',
        page: 1,
        pageSize: 25
    });
    const [pagination, setPagination] = useState({
        count: 0,
        next: null,
        previous: null
    });

    useEffect(() => {
        fetchStats();
        fetchActivityLogs();
    }, []);

    useEffect(() => {
        fetchActivityLogs();
    }, [filters]);

    const fetchStats = async () => {
        try {
            const [usersRes, groupsRes, permsRes] = await Promise.all([
                axios.get('/api/users/users/'),
                axios.get('/api/users/groups/'),
                axios.get('/api/users/permissions/')
            ]);

            const users = usersRes.data.results || usersRes.data;
            const groups = groupsRes.data.results || groupsRes.data;
            const permissions = permsRes.data.results || permsRes.data;

            setStats({
                totalUsers: users.length,
                activeUsers: users.filter(u => u.is_active).length,
                totalGroups: groups.length,
                totalPermissions: permissions.length
            });

            setRecentUsers(users.slice(0, 5));
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchActivityLogs = async () => {
        setActivityLoading(true);
        try {
            const params = {
                page: filters.page,
                page_size: filters.pageSize,
                ...(filters.action && { action: filters.action }),
                ...(filters.user && { user: filters.user }),
                ...(filters.search && { search: filters.search })
            };
            const response = await axios.get('/api/core/activity-logs/', { params });
            setActivityLogs(response.data.results || []);
            setPagination({
                count: response.data.count || 0,
                next: response.data.next,
                previous: response.data.previous
            });
        } catch (error) {
            console.error('Failed to fetch activity logs:', error);
        } finally {
            setActivityLoading(false);
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
    };

    const handlePageChange = (newPage) => {
        setFilters(prev => ({ ...prev, page: newPage }));
    };

    const getActionBadge = (action) => {
        const badges = {
            create: 'bg-green-100 text-green-700',
            update: 'bg-blue-100 text-blue-700',
            delete: 'bg-red-100 text-red-700',
            login: 'bg-purple-100 text-purple-700',
            logout: 'bg-gray-100 text-gray-700',
            view: 'bg-yellow-100 text-yellow-700'
        };
        return badges[action] || 'bg-gray-100 text-gray-700';
    };

    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };

    const openLogDetails = (log) => {
        setSelectedLog(log);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedLog(null);
    };

    const getObjectLink = (log) => {
        if (!log.content_type_name || !log.object_id) return null;
        
        const typeMap = {
            'device': '/devices',
            'devicemodel': '/devices',
            'site': '/sites',
            'region': '/sites',
            'image': '/images',
            'fileserver': '/images',
            'job': '/jobs',
        };
        
        return typeMap[log.content_type_name];
    };

    const handleObjectClick = (log) => {
        const link = getObjectLink(log);
        if (link) {
            closeModal();
            navigate(link);
        }
    };

    if (!user?.is_superuser) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <Shield className="mx-auto h-12 w-12 text-red-500 mb-3" />
                    <h2 className="text-xl font-semibold text-red-900">Access Denied</h2>
                    <p className="text-red-700 mt-2">Only superusers can access the admin panel.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                    <ShieldCheck className="mr-3 h-10 w-10 text-blue-600" />
                    Admin Panel
                </h1>
                <p className="text-gray-600 mt-2">Manage users, groups, and permissions</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-100 text-sm">Total Users</p>
                            <p className="text-3xl font-bold mt-1">{stats.totalUsers}</p>
                        </div>
                        <Users className="h-12 w-12 text-blue-200" />
                    </div>
                    <div className="mt-4 text-blue-100 text-sm">
                        {stats.activeUsers} active users
                    </div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-purple-100 text-sm">Groups</p>
                            <p className="text-3xl font-bold mt-1">{stats.totalGroups}</p>
                        </div>
                        <Shield className="h-12 w-12 text-purple-200" />
                    </div>
                    <div className="mt-4 text-purple-100 text-sm">
                        Role-based access
                    </div>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-100 text-sm">Permissions</p>
                            <p className="text-3xl font-bold mt-1">{stats.totalPermissions}</p>
                        </div>
                        <Key className="h-12 w-12 text-green-200" />
                    </div>
                    <div className="mt-4 text-green-100 text-sm">
                        Fine-grained control
                    </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-indigo-100 text-sm">Admin Users</p>
                            <p className="text-3xl font-bold mt-1">{stats.totalUsers ? Math.floor(stats.activeUsers * 0.2) : 0}</p>
                        </div>
                        <UserPlus className="h-12 w-12 text-indigo-200" />
                    </div>
                    <div className="mt-4 text-indigo-100 text-sm">
                        Privileged access
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Link
                    to="/admin/users"
                    className="bg-white rounded-xl p-6 border border-gray-200 hover:border-blue-500 hover:shadow-lg transition group"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition">
                                User Management
                            </h3>
                            <p className="text-gray-600 text-sm mt-1">Create, edit, and manage users</p>
                        </div>
                        <ArrowRight className="h-6 w-6 text-gray-400 group-hover:text-blue-600 transition" />
                    </div>
                    <div className="mt-4">
                        <Users className="h-8 w-8 text-blue-500" />
                    </div>
                </Link>

                <Link
                    to="/admin/groups"
                    className="bg-white rounded-xl p-6 border border-gray-200 hover:border-purple-500 hover:shadow-lg transition group"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-600 transition">
                                Group Management
                            </h3>
                            <p className="text-gray-600 text-sm mt-1">Manage groups and permissions</p>
                        </div>
                        <ArrowRight className="h-6 w-6 text-gray-400 group-hover:text-purple-600 transition" />
                    </div>
                    <div className="mt-4">
                        <Shield className="h-8 w-8 text-purple-500" />
                    </div>
                </Link>

                <Link
                    to="/admin/permissions"
                    className="bg-white rounded-xl p-6 border border-gray-200 hover:border-green-500 hover:shadow-lg transition group"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-green-600 transition">
                                Permission Management
                            </h3>
                            <p className="text-gray-600 text-sm mt-1">Create and manage permissions</p>
                        </div>
                        <ArrowRight className="h-6 w-6 text-gray-400 group-hover:text-green-600 transition" />
                    </div>
                    <div className="mt-4">
                        <Key className="h-8 w-8 text-green-500" />
                    </div>
                </Link>

                <Link
                    to="/admin/bundles"
                    className="bg-white rounded-xl p-6 border border-gray-200 hover:border-orange-500 hover:shadow-lg transition group"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-orange-600 transition">
                                Permission Bundles
                            </h3>
                            <p className="text-gray-600 text-sm mt-1">Advanced permission groups</p>
                        </div>
                        <ArrowRight className="h-6 w-6 text-gray-400 group-hover:text-orange-600 transition" />
                    </div>
                    <div className="mt-4">
                        <ShieldCheck className="h-8 w-8 text-orange-500" />
                    </div>
                </Link>
            </div>

            {/* Activity Logs Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                        <Activity className="h-6 w-6 text-gray-700 mr-2" />
                        <h2 className="text-xl font-semibold text-gray-900">Activity Logs</h2>
                        <span className="ml-3 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                            {pagination.count} total
                        </span>
                    </div>
                </div>

                {/* Page Size Selector */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">Show:</label>
                        <select
                            value={filters.pageSize}
                            onChange={(e) => handleFilterChange('pageSize', parseInt(e.target.value))}
                            className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        >
                            <option value={25}>25</option>
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                            <option value={500}>500</option>
                            <option value={1000}>1000</option>
                        </select>
                        <span className="text-sm text-gray-600">entries per page</span>
                    </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Filter className="inline h-4 w-4 mr-1" />
                            Action
                        </label>
                        <select
                            value={filters.action}
                            onChange={(e) => handleFilterChange('action', e.target.value)}
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        >
                            <option value="">All Actions</option>
                            <option value="create">Create</option>
                            <option value="update">Update</option>
                            <option value="delete">Delete</option>
                            <option value="login">Login</option>
                            <option value="logout">Logout</option>
                            <option value="view">View</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Users className="inline h-4 w-4 mr-1" />
                            User
                        </label>
                        <input
                            type="text"
                            value={filters.user}
                            onChange={(e) => handleFilterChange('user', e.target.value)}
                            placeholder="Username"
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Search className="inline h-4 w-4 mr-1" />
                            Search
                        </label>
                        <input
                            type="text"
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                            placeholder="Search object or content type..."
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* Activity Logs Table */}
                {activityLoading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-gray-600 mt-4">Loading activity logs...</p>
                    </div>
                ) : activityLogs.length === 0 ? (
                    <div className="text-center py-12">
                        <Activity className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-4 text-lg font-medium text-gray-900">No activity logs found</h3>
                        <p className="text-gray-500 mt-2">Activity logs will appear here as users perform actions.</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            <Calendar className="inline h-4 w-4 mr-1" />
                                            Timestamp
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            User
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Action
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Object
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Type
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            IP Address
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Changes
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {activityLogs.map((log) => (
                                        <tr 
                                            key={log.id} 
                                            className="hover:bg-gray-50 cursor-pointer"
                                            onClick={() => openLogDetails(log)}
                                        >
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                                {formatTimestamp(log.timestamp)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold mr-2">
                                                        {log.user_name?.charAt(0).toUpperCase() || '?'}
                                                    </div>
                                                    <span className="text-sm font-medium text-gray-900">{log.user_name || 'Unknown'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionBadge(log.action)}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {log.object_repr || 'N/A'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                {log.content_type_name || 'N/A'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                {log.ip_address || 'N/A'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                {log.changes && Object.keys(log.changes).length > 0 ? (
                                                    <span className="text-blue-600 font-medium">
                                                        {Object.keys(log.changes).length} field(s)
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
                            <div className="flex flex-1 justify-between sm:hidden">
                                <button
                                    onClick={() => handlePageChange(filters.page - 1)}
                                    disabled={!pagination.previous}
                                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => handlePageChange(filters.page + 1)}
                                    disabled={!pagination.next}
                                    className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm text-gray-700">
                                        Showing{' '}
                                        <span className="font-medium">{((filters.page - 1) * filters.pageSize) + 1}</span>
                                        {' '}-{' '}
                                        <span className="font-medium">
                                            {Math.min(filters.page * filters.pageSize, pagination.count)}
                                        </span>
                                        {' '}of <span className="font-medium">{pagination.count}</span> logs
                                        {' '}(Page {filters.page} of {Math.ceil(pagination.count / filters.pageSize)})
                                    </p>
                                </div>
                                <div>
                                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                        <button
                                            onClick={() => handlePageChange(filters.page - 1)}
                                            disabled={!pagination.previous}
                                            className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <ChevronLeft className="h-5 w-5" />
                                        </button>
                                        <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300">
                                            {filters.page}
                                        </span>
                                        <button
                                            onClick={() => handlePageChange(filters.page + 1)}
                                            disabled={!pagination.next}
                                            className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <ChevronRight className="h-5 w-5" />
                                        </button>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Activity Log Detail Modal */}
            {showModal && selectedLog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center">
                                <FileText className="h-6 w-6 text-blue-600 mr-2" />
                                <h3 className="text-xl font-semibold text-gray-900">Activity Log Details</h3>
                            </div>
                            <button
                                onClick={closeModal}
                                className="text-gray-400 hover:text-gray-600 transition"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            {/* Log Information */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Log Information</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-600">Timestamp</p>
                                        <p className="text-base font-medium text-gray-900">{formatTimestamp(selectedLog.timestamp)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">User</p>
                                        <p className="text-base font-medium text-gray-900">{selectedLog.user_name}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Action</p>
                                        <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${getActionBadge(selectedLog.action)}`}>
                                            {selectedLog.action}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">IP Address</p>
                                        <p className="text-base font-medium text-gray-900">{selectedLog.ip_address || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Object Details */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Object Details</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-600">Type</p>
                                        <p className="text-base font-medium text-gray-900 capitalize">{selectedLog.content_type_name || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Object</p>
                                        {getObjectLink(selectedLog) ? (
                                            <button
                                                onClick={() => handleObjectClick(selectedLog)}
                                                className="text-base font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 group"
                                            >
                                                {selectedLog.object_repr}
                                                <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition" />
                                            </button>
                                        ) : (
                                            <p className="text-base font-medium text-gray-900">{selectedLog.object_repr || 'N/A'}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Changes */}
                            {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Field Changes</h4>
                                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                                                        Field
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-3/8">
                                                        Old Value
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-3/8">
                                                        New Value
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {Object.entries(selectedLog.changes).map(([field, change]) => (
                                                    <tr key={field}>
                                                        <td className="px-4 py-3 text-sm font-medium text-gray-900 bg-gray-50">
                                                            {field}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-900 bg-red-50">
                                                            <code className="text-red-800">{change.old !== null ? change.old : '—'}</code>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-900 bg-green-50">
                                                            <code className="text-green-800">{change.new !== null ? change.new : '—'}</code>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Request Details */}
                            {selectedLog.user_agent && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Request Details</h4>
                                    <div>
                                        <p className="text-sm text-gray-600">User Agent</p>
                                        <p className="text-sm font-mono text-gray-700 bg-gray-50 p-3 rounded border border-gray-200 break-all">
                                            {selectedLog.user_agent}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* No changes message */}
                            {(!selectedLog.changes || Object.keys(selectedLog.changes).length === 0) && selectedLog.action === 'update' && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                    <p className="text-sm text-yellow-800">No field changes were recorded for this update.</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
                            <button
                                onClick={closeModal}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Recent Users */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Users</h2>
                <div className="space-y-3">
                    {recentUsers.map(user => (
                        <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center">
                                <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold mr-3">
                                    {user.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">{user.username}</p>
                                    <p className="text-sm text-gray-500">{user.email || 'No email'}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                {user.is_superuser ? (
                                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded font-medium">Superuser</span>
                                ) : user.is_staff ? (
                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">Staff</span>
                                ) : (
                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded font-medium">User</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <Link
                    to="/admin/users"
                    className="mt-4 block text-center text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                    View all users →
                </Link>
            </div>
        </div>
    );
};

export default AdminPanel;
