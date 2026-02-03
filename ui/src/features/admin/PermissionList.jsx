import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Key, Search, Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const PermissionList = () => {
    const { user } = useAuth();
    const [permissions, setPermissions] = useState([]);
    const [contentTypes, setContentTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingPermission, setEditingPermission] = useState(null);
    const [permissionForm, setPermissionForm] = useState({
        name: '',
        codename: '',
        content_type: ''
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
        fetchPermissions();
        fetchContentTypes();
    }, []);

    const fetchPermissions = async () => {
        try {
            const res = await axios.get('/api/users/permissions/');
            setPermissions(res.data.results || res.data);
        } catch (error) {
            console.error('Failed to fetch permissions:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchContentTypes = async () => {
        try {
            const res = await axios.get('/api/users/permissions/content_types/');
            setContentTypes(res.data);
        } catch (error) {
            console.error('Failed to fetch content types:', error);
        }
    };

    const openModal = (permission = null) => {
        if (permission) {
            setEditingPermission(permission);
            setPermissionForm({
                name: permission.name,
                codename: permission.codename,
                content_type: permission.content_type
            });
        } else {
            setEditingPermission(null);
            setPermissionForm({
                name: '',
                codename: '',
                content_type: contentTypes[0]?.id || ''
            });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingPermission) {
                await axios.put(`/api/users/permissions/${editingPermission.id}/`, permissionForm);
            } else {
                await axios.post('/api/users/permissions/', permissionForm);
            }
            setShowModal(false);
            fetchPermissions();
        } catch (error) {
            const errorMsg = error.response?.data?.codename?.[0] || 
                           error.response?.data?.non_field_errors?.[0] ||
                           error.message;
            alert('Failed to save permission: ' + errorMsg);
            console.error(error);
        }
    };

    const deletePermission = async (id) => {
        if (!confirm('Are you sure you want to delete this permission? This may affect groups and users that have this permission.')) return;
        try {
            await axios.delete(`/api/users/permissions/${id}/`);
            fetchPermissions();
        } catch (error) {
            alert('Failed to delete permission. It may be in use by groups.');
            console.error(error);
        }
    };

    const generateCodename = (name) => {
        // Auto-generate codename from name
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    };

    const filteredPermissions = permissions.filter(perm =>
        searchTerm === '' || 
        perm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        perm.codename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        perm.content_type_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Group by content type
    const groupedPermissions = filteredPermissions.reduce((acc, perm) => {
        const contentType = perm.content_type_name;
        if (!acc[contentType]) {
            acc[contentType] = [];
        }
        acc[contentType].push(perm);
        return acc;
    }, {});

    if (!user?.is_superuser) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <Key className="mx-auto h-12 w-12 text-red-500 mb-3" />
                    <h2 className="text-xl font-semibold text-red-900">Access Denied</h2>
                    <p className="text-red-700 mt-2">Only superusers can view permissions.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                        <Key className="mr-3 h-8 w-8 text-green-600" />
                        Permission Management
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Create custom permissions and browse all available permissions
                    </p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center transition"
                >
                    <Plus size={20} className="mr-2" />
                    Create Permission
                </button>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Django automatically creates permissions for each model (add, change, delete, view). 
                    Create custom permissions here for special actions like "can_upgrade_device" or "can_export_data".
                </p>
            </div>

            {/* Search */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search permissions by name, codename, or content type..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>
                <p className="text-sm text-gray-500 mt-2">
                    Found {filteredPermissions.length} of {permissions.length} permissions
                </p>
            </div>

            {/* Permissions List */}
            {loading ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                    <p className="text-gray-500">Loading permissions...</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {Object.entries(groupedPermissions).map(([contentType, perms]) => (
                        <div key={contentType} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-3">
                                <h2 className="text-lg font-semibold text-white flex items-center">
                                    <Key className="mr-2 h-5 w-5" />
                                    {contentType}
                                </h2>
                                <p className="text-green-100 text-sm">{perms.length} permissions</p>
                            </div>
                            <div className="divide-y divide-gray-200">
                                {perms.map(perm => (
                                    <div key={perm.id} className="px-6 py-4 hover:bg-gray-50 transition flex justify-between items-center">
                                        <div className="flex-1">
                                            <h3 className="font-medium text-gray-900">{perm.name}</h3>
                                            <div className="flex items-center mt-1 space-x-2">
                                                <code className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded font-mono">
                                                    {perm.codename}
                                                </code>
                                                <span className="text-xs text-gray-500">ID: {perm.id}</span>
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => openModal(perm)}
                                                className="text-indigo-600 hover:text-indigo-900"
                                                title="Edit"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => deletePermission(perm.id)}
                                                className="text-red-600 hover:text-red-900"
                                                title="Delete"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {filteredPermissions.length === 0 && !loading && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                    <Key className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    <p className="text-gray-500">No permissions found matching your search.</p>
                </div>
            )}

            {/* Add/Edit Permission Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-900">
                                {editingPermission ? 'Edit Permission' : 'Create Custom Permission'}
                            </h2>
                            <p className="text-sm text-gray-600 mt-1">
                                {editingPermission 
                                    ? 'Modify permission details. Be careful as this affects all groups using this permission.'
                                    : 'Create a custom permission for specific actions or features.'
                                }
                            </p>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Permission Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={permissionForm.name}
                                    onChange={(e) => {
                                        const name = e.target.value;
                                        setPermissionForm({ 
                                            ...permissionForm, 
                                            name,
                                            // Auto-generate codename if creating new
                                            codename: editingPermission ? permissionForm.codename : generateCodename(name)
                                        });
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    placeholder="e.g., Can upgrade network devices"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Human-readable name describing what this permission allows
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Codename *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={permissionForm.codename}
                                    onChange={(e) => setPermissionForm({ 
                                        ...permissionForm, 
                                        codename: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')
                                    })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono"
                                    placeholder="e.g., can_upgrade_device"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Unique identifier (lowercase, numbers, and underscores only)
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Content Type *
                                </label>
                                <select
                                    required
                                    value={permissionForm.content_type}
                                    onChange={(e) => setPermissionForm({ ...permissionForm, content_type: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    disabled={editingPermission}
                                >
                                    <option value="">Select a content type...</option>
                                    {contentTypes.map(ct => (
                                        <option key={ct.id} value={ct.id}>
                                            {ct.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    The model this permission applies to (cannot be changed after creation)
                                </p>
                            </div>

                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                <p className="text-xs text-yellow-800">
                                    <strong>Example:</strong> To control who can upgrade devices, create:
                                    <br />• Name: "Can upgrade network devices"
                                    <br />• Codename: "can_upgrade_device"
                                    <br />• Content Type: "devices | device"
                                </p>
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
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                >
                                    <Save size={18} className="inline mr-2" />
                                    {editingPermission ? 'Update' : 'Create'} Permission
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PermissionList;
