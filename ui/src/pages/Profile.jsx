import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Mail, Lock, Shield, Users, Calendar, Save, X, Eye, EyeOff, Key, Trash2, Plus, Copy, AlertCircle, Check, Edit, Activity, FileText, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
    const { user: currentUser, checkAuth } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [userDetails, setUserDetails] = useState(null);
    const [apiKeys, setApiKeys] = useState([]);
    const [activityLogs, setActivityLogs] = useState([]);
    const [selectedLog, setSelectedLog] = useState(null);
    const [showLogModal, setShowLogModal] = useState(false);
    const [showTokenModal, setShowTokenModal] = useState(false);
    const [newTokenData, setNewTokenData] = useState(null);
    const [tokenForm, setTokenForm] = useState({
        description: '',
        write_enabled: true,
        expires: '',
        allowed_ips: ''
    });

    const [profileForm, setProfileForm] = useState({
        first_name: '',
        last_name: '',
        email: ''
    });

    const [passwordForm, setPasswordForm] = useState({
        current_password: '',
        new_password: '',
        confirm_password: ''
    });

    const getCsrfToken = () => {
        const name = 'csrftoken';
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    };

    // Configure axios defaults
    axios.defaults.baseURL = window.location.origin;
    axios.defaults.withCredentials = true;
    axios.defaults.headers.common['X-CSRFToken'] = getCsrfToken();

    useEffect(() => {
        fetchUserDetails();
        fetchApiTokens();
        fetchActivityLogs();
    }, []);

    const fetchUserDetails = async () => {
        try {
            const res = await axios.get(`/api/users/users/${currentUser.id}/`);
            setUserDetails(res.data);
            setProfileForm({
                first_name: res.data.first_name || '',
                last_name: res.data.last_name || '',
                email: res.data.email || ''
            });
        } catch (error) {
            console.error('Failed to fetch user details:', error);
        }
    };

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            await axios.patch(`/api/users/users/${currentUser.id}/`, profileForm);
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            await checkAuth(); // Refresh user data
            fetchUserDetails();
        } catch (error) {
            setMessage({ 
                type: 'error', 
                text: error.response?.data?.email?.[0] || 'Failed to update profile' 
            });
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        if (passwordForm.new_password !== passwordForm.confirm_password) {
            setMessage({ type: 'error', text: 'New passwords do not match!' });
            setLoading(false);
            return;
        }

        if (passwordForm.new_password.length < 8) {
            setMessage({ type: 'error', text: 'Password must be at least 8 characters long' });
            setLoading(false);
            return;
        }

        try {
            await axios.post(`/api/users/users/${currentUser.id}/set_password/`, {
                password: passwordForm.new_password
            });
            setMessage({ type: 'success', text: 'Password changed successfully!' });
            setPasswordForm({
                current_password: '',
                new_password: '',
                confirm_password: ''
            });
        } catch (error) {
            setMessage({ 
                type: 'error', 
                text: error.response?.data?.error || 'Failed to change password' 
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchApiTokens = async () => {
        try {
            const response = await axios.get('/api/users/tokens/');
            // Handle paginated response from Django REST Framework
            setApiKeys(response.data.results || response.data);
        } catch (error) {
            console.error('Error fetching API tokens:', error);
        }
    };

    const fetchActivityLogs = async () => {
        try {
            const response = await axios.get('/api/core/activity-logs/my_logs/');
            setActivityLogs(response.data);
        } catch (error) {
            console.error('Error fetching activity logs:', error);
        }
    };

    const openLogDetails = (log) => {
        setSelectedLog(log);
        setShowLogModal(true);
    };

    const closeLogModal = () => {
        setShowLogModal(false);
        setSelectedLog(null);
    };

    const getActionBadge = (action) => {
        const badges = {
            create: 'bg-green-100 text-green-800',
            update: 'bg-blue-100 text-blue-800',
            delete: 'bg-red-100 text-red-800',
            login: 'bg-purple-100 text-purple-800',
            logout: 'bg-gray-100 text-gray-800',
            view: 'bg-yellow-100 text-yellow-800'
        };
        return badges[action] || 'bg-gray-100 text-gray-800';
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
            closeLogModal();
            navigate(link);
        }
    };

    const generateKey = async () => {
        try {
            // Format payload and clean empty values
            const payload = { ...tokenForm };
            
            // Remove or convert empty expires to null
            if (!payload.expires || payload.expires === '') {
                delete payload.expires;
            } else {
                payload.expires = new Date(payload.expires).toISOString();
            }
            
            // Remove empty allowed_ips or keep as string
            if (!payload.allowed_ips || payload.allowed_ips.trim() === '') {
                payload.allowed_ips = '';
            }
            
            const response = await axios.post('/api/users/tokens/', payload);
            setNewTokenData(response.data);
            setShowTokenModal(true);
            setTokenForm({
                description: '',
                write_enabled: true,
                expires: '',
                allowed_ips: ''
            });
            fetchApiTokens();
        } catch (error) {
            console.error('Error generating token:', error);
            setMessage({ type: 'error', text: 'Failed to generate token' });
        }
    };

    const deleteKey = async (id) => {
        if (confirm('Are you sure you want to delete this API token?')) {
            try {
                await axios.delete(`/api/users/tokens/${id}/`);
                fetchApiTokens();
            } catch (error) {
                console.error('Error deleting token:', error);
            }
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('Token copied to clipboard!');
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleString();
    };

    if (!userDetails) {
        return (
            <div className="flex justify-center items-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <User size={40} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">
                            {userDetails.first_name && userDetails.last_name 
                                ? `${userDetails.first_name} ${userDetails.last_name}`
                                : userDetails.username}
                        </h1>
                        <p className="text-blue-100 text-sm mt-1">@{userDetails.username}</p>
                        <div className="flex gap-2 mt-2">
                            {userDetails.is_superuser && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-400 text-yellow-900">
                                    <Shield size={12} className="mr-1" />
                                    Superuser
                                </span>
                            )}
                            {userDetails.is_staff && !userDetails.is_superuser && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-400 text-green-900">
                                    <Shield size={12} className="mr-1" />
                                    Staff
                                </span>
                            )}
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                userDetails.is_active ? 'bg-green-400 text-green-900' : 'bg-red-400 text-red-900'
                            }`}>
                                {userDetails.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Message Display */}
            {message.text && (
                <div className={`rounded-lg p-4 ${
                    message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                    <p className="text-sm font-medium">{message.text}</p>
                </div>
            )}

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow">
                <div className="border-b border-gray-200">
                    <nav className="flex -mb-px">
                        {[
                            { id: 'profile', label: 'Profile Information', icon: User },
                            { id: 'security', label: 'Security', icon: Lock },
                            ...(currentUser?.is_superuser ? [{ id: 'apikeys', label: 'API Keys', icon: Key }] : []),
                            { id: 'activity', label: 'Activity Log', icon: Activity },
                            { id: 'groups', label: 'Groups & Permissions', icon: Shield }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition ${
                                    activeTab === tab.id
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                <tab.icon size={18} />
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="p-6">
                    {/* Profile Information Tab */}
                    {activeTab === 'profile' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900 mb-4">Personal Information</h2>
                                <form onSubmit={handleProfileSubmit} className="space-y-4 max-w-2xl">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                First Name
                                            </label>
                                            <input
                                                type="text"
                                                value={profileForm.first_name}
                                                onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                placeholder="John"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Last Name
                                            </label>
                                            <input
                                                type="text"
                                                value={profileForm.last_name}
                                                onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                placeholder="Doe"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            <Mail size={16} className="inline mr-1" />
                                            Email Address
                                        </label>
                                        <input
                                            type="email"
                                            value={profileForm.email}
                                            onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="john.doe@example.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Username
                                        </label>
                                        <input
                                            type="text"
                                            value={userDetails.username}
                                            disabled
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Username cannot be changed</p>
                                    </div>

                                    <div className="flex items-center gap-3 pt-4">
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            <Save size={18} />
                                            {loading ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Account Info */}
                            <div className="border-t pt-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
                                <div className="grid grid-cols-2 gap-4 max-w-2xl">
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        <div className="text-sm text-gray-600 mb-1">Member Since</div>
                                        <div className="flex items-center gap-2 text-gray-900 font-medium">
                                            <Calendar size={16} />
                                            {formatDate(userDetails.date_joined)}
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        <div className="text-sm text-gray-600 mb-1">Last Login</div>
                                        <div className="flex items-center gap-2 text-gray-900 font-medium">
                                            <Calendar size={16} />
                                            {formatDate(userDetails.last_login)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Security Tab */}
                    {activeTab === 'security' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900 mb-4">Change Password</h2>
                                <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-2xl">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            New Password *
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showNewPassword ? 'text' : 'password'}
                                                required
                                                value={passwordForm.new_password}
                                                onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                                                placeholder="Enter new password"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                                            >
                                                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Confirm New Password *
                                        </label>
                                        <input
                                            type="password"
                                            required
                                            value={passwordForm.confirm_password}
                                            onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Confirm new password"
                                        />
                                    </div>

                                    <div className="flex items-center gap-3 pt-4">
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            <Lock size={18} />
                                            {loading ? 'Changing...' : 'Change Password'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })}
                                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                        >
                                            <X size={18} />
                                            Clear
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* API Keys Tab */}
                    {activeTab === 'apikeys' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-900">My API Tokens</h2>
                                </div>
                                <button 
                                    onClick={() => setShowTokenModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                                >
                                    <Plus size={18} />
                                    Add a Token
                                </button>
                            </div>

                            {/* Tokens Table */}
                            {apiKeys.length > 0 ? (
                                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 border-b border-gray-200">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">ID</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Key</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Description</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Write Enabled</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Created</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Expires</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Last Used</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Allowed IPs</th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {apiKeys.map(token => (
                                                    <tr key={token.id} className="hover:bg-gray-50">
                                                        <td className="px-4 py-3 text-sm text-gray-900">{token.id}</td>
                                                        <td className="px-4 py-3 text-sm font-mono text-gray-900">{token.key_preview}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-900">{token.description || '—'}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            {token.write_enabled ? (
                                                                <Check size={18} className="text-green-600 mx-auto" />
                                                            ) : (
                                                                <X size={18} className="text-red-600 mx-auto" />
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-900">
                                                            {new Date(token.created).toLocaleString('en-US', {
                                                                year: 'numeric',
                                                                month: '2-digit',
                                                                day: '2-digit',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-900">
                                                            {token.expires ? new Date(token.expires).toLocaleString('en-US', {
                                                                year: 'numeric',
                                                                month: '2-digit',
                                                                day: '2-digit',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            }) : '—'}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-900">
                                                            {token.last_used ? new Date(token.last_used).toLocaleString('en-US', {
                                                                year: 'numeric',
                                                                month: '2-digit',
                                                                day: '2-digit',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            }) : '—'}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-900">{token.allowed_ips || '—'}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button className="p-2 text-yellow-600 hover:bg-yellow-50 rounded" title="Edit">
                                                                    <Edit size={16} />
                                                                </button>
                                                                <button 
                                                                    onClick={() => deleteKey(token.id)}
                                                                    className="p-2 text-red-600 hover:bg-red-50 rounded" 
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                                        <div className="text-sm text-gray-700">
                                            Showing {apiKeys.length} of {apiKeys.length}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                    <Key size={48} className="mx-auto text-gray-400 mb-3" />
                                    <p className="text-gray-600 font-medium">No API Tokens</p>
                                    <p className="text-sm text-gray-500 mt-1">Click "Add a Token" to create your first token</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Token Creation Modal */}
                    {showTokenModal && !newTokenData && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900">Add a new token</h3>
                                    <button onClick={() => setShowTokenModal(false)} className="text-gray-400 hover:text-gray-600">
                                        <X size={20} />
                                    </button>
                                </div>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Description
                                        </label>
                                        <input
                                            type="text"
                                            value={tokenForm.description}
                                            onChange={(e) => setTokenForm({ ...tokenForm, description: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                            placeholder="e.g., CI/CD Pipeline, Mobile App"
                                        />
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="write_enabled"
                                            checked={tokenForm.write_enabled}
                                            onChange={(e) => setTokenForm({ ...tokenForm, write_enabled: e.target.checked })}
                                            className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                                        />
                                        <label htmlFor="write_enabled" className="text-sm font-medium text-gray-700">
                                            Write enabled
                                        </label>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Expires (optional)
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={tokenForm.expires}
                                            onChange={(e) => setTokenForm({ ...tokenForm, expires: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Allowed IPs (optional)
                                        </label>
                                        <textarea
                                            value={tokenForm.allowed_ips}
                                            onChange={(e) => setTokenForm({ ...tokenForm, allowed_ips: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                            rows="3"
                                            placeholder="192.168.1.100&#10;10.0.0.0/24"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">One IP address or network per line. Leave blank to allow all IPs.</p>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-4 border-t">
                                        <button 
                                            onClick={() => setShowTokenModal(false)}
                                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            onClick={generateKey}
                                            disabled={loading}
                                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                                        >
                                            <Plus size={18} />
                                            {loading ? 'Creating...' : 'Create Token'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Token Display Modal */}
                    {showTokenModal && newTokenData && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                        <Key size={20} className="text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">Token Created Successfully!</h3>
                                        <p className="text-sm text-gray-600">Copy your token now - you won't be able to see it again</p>
                                    </div>
                                </div>

                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle size={18} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                                        <p className="text-sm text-yellow-800">
                                            <strong>Important:</strong> Make sure to copy your token now. You won't be able to see it again!
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                        <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded">{newTokenData.description || 'No description'}</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Token</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={newTokenData.key}
                                                readOnly
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                                            />
                                            <button
                                                onClick={() => copyToClipboard(newTokenData.key)}
                                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                                            >
                                                <Copy size={16} />
                                                Copy
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        onClick={() => {
                                            setShowTokenModal(false);
                                            setNewTokenData(null);
                                        }}
                                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Activity Log Tab */}
                    {activeTab === 'activity' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900">Activity Log</h2>
                                <p className="text-sm text-gray-600 mt-1">Your recent activities and actions</p>
                            </div>

                            {activityLogs.length > 0 ? (
                                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 border-b border-gray-200">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Timestamp</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Action</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Object</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Type</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">IP Address</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {activityLogs.map(log => (
                                                    <tr 
                                                        key={log.id} 
                                                        className="hover:bg-gray-50 cursor-pointer"
                                                        onClick={() => openLogDetails(log)}
                                                    >
                                                        <td className="px-4 py-3 text-sm text-gray-900">
                                                            {new Date(log.timestamp).toLocaleString('en-US', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                                second: '2-digit'
                                                            })}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getActionBadge(log.action)}`}>
                                                                {log.action.charAt(0).toUpperCase() + log.action.slice(1)}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-900">{log.object_repr || '—'}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-900 capitalize">{log.content_type_name || '—'}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-600 font-mono">{log.ip_address || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                                        <div className="text-sm text-gray-700">
                                            Showing {activityLogs.length} recent activities
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                    <Activity size={48} className="mx-auto text-gray-400 mb-3" />
                                    <p className="text-gray-600 font-medium">No Activity Yet</p>
                                    <p className="text-sm text-gray-500 mt-1">Your activities will appear here</p>
                                </div>
                            )}

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <Shield size={20} className="text-blue-600 mt-1 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm text-blue-900 font-medium">Activity Tracking</p>
                                        <p className="text-xs text-blue-700 mt-1">
                                            All your actions are logged for security and audit purposes. This includes logins, data modifications, and system interactions.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Activity Log Detail Modal */}
                            {showLogModal && selectedLog && (
                                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                                            <div className="flex items-center">
                                                <FileText className="h-6 w-6 text-blue-600 mr-2" />
                                                <h3 className="text-xl font-semibold text-gray-900">Activity Log Details</h3>
                                            </div>
                                            <button
                                                onClick={closeLogModal}
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
                                                        <p className="text-base font-medium text-gray-900">
                                                            {new Date(selectedLog.timestamp).toLocaleString('en-US', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                                second: '2-digit'
                                                            })}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-gray-600">Action</p>
                                                        <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${getActionBadge(selectedLog.action)}`}>
                                                            {selectedLog.action}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-gray-600">IP Address</p>
                                                        <p className="text-base font-medium text-gray-900 font-mono">{selectedLog.ip_address || 'N/A'}</p>
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
                                                onClick={closeLogModal}
                                                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                                            >
                                                Close
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Groups & Permissions Tab */}
                    {activeTab === 'groups' && (
                        <div className="space-y-6">
                            {/* Groups */}
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Groups</h2>
                                {userDetails.group_names && userDetails.group_names.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-3 max-w-2xl">
                                        {userDetails.group_names.map((group, index) => (
                                            <div key={index} className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                                <Users size={18} className="text-purple-600" />
                                                <span className="text-sm font-medium text-purple-900">{group}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-gray-500 bg-gray-50 p-4 rounded-lg">
                                        You are not a member of any groups
                                    </div>
                                )}
                            </div>

                            {/* Permissions Info */}
                            <div className="border-t pt-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Permission Summary</h3>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl">
                                    <div className="flex items-start gap-3">
                                        <Shield size={20} className="text-blue-600 mt-1" />
                                        <div>
                                            <p className="text-sm text-blue-900 font-medium">
                                                Your permissions are inherited from your assigned groups
                                            </p>
                                            <p className="text-xs text-blue-700 mt-1">
                                                Contact your administrator to modify group memberships and permissions
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Profile;
