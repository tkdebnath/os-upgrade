import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Plus, Edit2, Trash2, Key, Shield, X, Save, Lock, Unlock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const UserManagement = () => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ userId: null, password: '', confirmPassword: '' });
    
    const [userForm, setUserForm] = useState({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        password: '',
        groups: [],
        is_active: true,
        is_staff: false,
        is_superuser: false
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
    axios.defaults.baseURL = 'http://localhost:8000';
    axios.defaults.withCredentials = true;
    axios.defaults.headers.common['X-CSRFToken'] = getCsrfToken();

    useEffect(() => {
        fetchUsers();
        fetchGroups();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await axios.get('/api/users/');
            setUsers(res.data.results || res.data);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchGroups = async () => {
        try {
            const res = await axios.get('/api/groups/');
            setGroups(res.data.results || res.data);
        } catch (error) {
            console.error('Failed to fetch groups:', error);
        }
    };

    const openModal = (user = null) => {
        if (user) {
            setEditingUser(user);
            setUserForm({
                username: user.username,
                email: user.email,
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                password: '',
                groups: user.groups || [],
                is_active: user.is_active,
                is_staff: user.is_staff,
                is_superuser: user.is_superuser
            });
        } else {
            setEditingUser(null);
            setUserForm({
                username: '',
                email: '',
                first_name: '',
                last_name: '',
                password: '',
                groups: [],
                is_active: true,
                is_staff: false,
                is_superuser: false
            });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...userForm };
            
            // Don't send password if editing and password is empty
            if (editingUser && !payload.password) {
                delete payload.password;
            }
            
            if (editingUser) {
                await axios.put(`/api/users/${editingUser.id}/`, payload);
            } else {
                if (!payload.password) {
                    alert('Password is required for new users');
                    return;
                }
                await axios.post('/api/users/', payload);
            }
            setShowModal(false);
            fetchUsers();
        } catch (error) {
            alert('Failed to save user: ' + (error.response?.data?.username?.[0] || error.message));
            console.error(error);
        }
    };

    const deleteUser = async (id) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            await axios.delete(`/api/users/${id}/`);
            fetchUsers();
        } catch (error) {
            alert('Failed to delete user');
            console.error(error);
        }
    };

    const toggleActive = async (userId) => {
        try {
            await axios.post(`/api/users/${userId}/toggle_active/`);
            fetchUsers();
        } catch (error) {
            alert('Failed to toggle user status');
            console.error(error);
        }
    };

    const openPasswordModal = (userId) => {
        setPasswordForm({ userId, password: '', confirmPassword: '' });
        setShowPasswordModal(true);
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (passwordForm.password !== passwordForm.confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        try {
            await axios.post(`/api/users/${passwordForm.userId}/set_password/`, {
                password: passwordForm.password
            });
            setShowPasswordModal(false);
            alert('Password updated successfully');
        } catch (error) {
            alert('Failed to update password');
            console.error(error);
        }
    };

    if (!currentUser?.is_superuser) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <Shield className="mx-auto h-12 w-12 text-red-500 mb-3" />
                    <h2 className="text-xl font-semibold text-red-900">Access Denied</h2>
                    <p className="text-red-700 mt-2">Only superusers can access user management.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                        <Users className="mr-3 h-8 w-8 text-blue-600" />
                        User Management
                    </h1>
                    <p className="text-gray-600 mt-1">Manage system users and their permissions</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center transition"
                >
                    <Plus size={20} className="mr-2" />
                    Add User
                </button>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Groups</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan="7" className="px-6 py-4 text-center text-gray-500">Loading...</td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan="7" className="px-6 py-4 text-center text-gray-500">No users found</td></tr>
                        ) : (
                            users.map(user => (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold mr-3">
                                                {user.username.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-medium text-gray-900">{user.username}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{user.email || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-wrap gap-1">
                                            {user.group_names?.length > 0 ? (
                                                user.group_names.map(group => (
                                                    <span key={group} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                                                        {group}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-gray-400 text-xs">No groups</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {user.is_superuser ? (
                                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded font-medium">Superuser</span>
                                        ) : user.is_staff ? (
                                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">Staff</span>
                                        ) : (
                                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded font-medium">User</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {user.is_active ? (
                                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium flex items-center w-fit">
                                                <Unlock size={12} className="mr-1" /> Active
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded font-medium flex items-center w-fit">
                                                <Lock size={12} className="mr-1" /> Inactive
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {new Date(user.date_joined).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end space-x-2">
                                            <button
                                                onClick={() => openPasswordModal(user.id)}
                                                className="text-blue-600 hover:text-blue-900"
                                                title="Change Password"
                                            >
                                                <Key size={18} />
                                            </button>
                                            <button
                                                onClick={() => toggleActive(user.id)}
                                                className="text-yellow-600 hover:text-yellow-900"
                                                title={user.is_active ? 'Deactivate' : 'Activate'}
                                            >
                                                {user.is_active ? <Lock size={18} /> : <Unlock size={18} />}
                                            </button>
                                            <button
                                                onClick={() => openModal(user)}
                                                className="text-indigo-600 hover:text-indigo-900"
                                                title="Edit"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => deleteUser(user.id)}
                                                className="text-red-600 hover:text-red-900"
                                                title="Delete"
                                                disabled={user.id === currentUser.id}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit User Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-900">
                                {editingUser ? 'Edit User' : 'Add New User'}
                            </h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                                    <input
                                        type="text"
                                        required
                                        value={userForm.username}
                                        onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        disabled={editingUser}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={userForm.email}
                                        onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                    <input
                                        type="text"
                                        value={userForm.first_name}
                                        onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                    <input
                                        type="text"
                                        value={userForm.last_name}
                                        onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Password {!editingUser && '*'}
                                </label>
                                <input
                                    type="password"
                                    value={userForm.password}
                                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder={editingUser ? 'Leave blank to keep current password' : 'Enter password'}
                                    required={!editingUser}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Groups</label>
                                <select
                                    multiple
                                    value={userForm.groups}
                                    onChange={(e) => setUserForm({ ...userForm, groups: Array.from(e.target.selectedOptions, option => parseInt(option.value)) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    size="4"
                                >
                                    {groups.map(group => (
                                        <option key={group.id} value={group.id}>{group.name}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple groups</p>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={userForm.is_active}
                                        onChange={(e) => setUserForm({ ...userForm, is_active: e.target.checked })}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Active</span>
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={userForm.is_staff}
                                        onChange={(e) => setUserForm({ ...userForm, is_staff: e.target.checked })}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Staff Status (Can access admin panel)</span>
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={userForm.is_superuser}
                                        onChange={(e) => setUserForm({ ...userForm, is_superuser: e.target.checked })}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Superuser Status (Full permissions)</span>
                                </label>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                                >
                                    <X size={18} className="inline mr-2" />
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    <Save size={18} className="inline mr-2" />
                                    {editingUser ? 'Update' : 'Create'} User
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Password Change Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
                        <div className="p-6 border-b border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-900">Change Password</h2>
                        </div>
                        <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={passwordForm.password}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                                <input
                                    type="password"
                                    required
                                    value={passwordForm.confirmPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowPasswordModal(false)}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Update Password
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
