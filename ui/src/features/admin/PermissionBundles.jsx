import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, Plus, Edit2, Trash2, X, Save, Power, PowerOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const PermissionBundles = () => {
    const { user: currentUser } = useAuth();
    const [bundles, setBundles] = useState([]);
    const [contentTypes, setContentTypes] = useState([]);
    const [customActions, setCustomActions] = useState([]);
    const [groups, setGroups] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingBundle, setEditingBundle] = useState(null);

    const [bundleForm, setBundleForm] = useState({
        name: '',
        description: '',
        enabled: true,
        can_view: false,
        can_add: false,
        can_change: false,
        can_delete: false,
        additional_actions: '',
        object_types: [],
        groups: [],
        users: []
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
        fetchBundles();
        fetchContentTypes();
        fetchCustomActions();
        fetchGroups();
        fetchUsers();
    }, []);

    const fetchBundles = async () => {
        try {
            const res = await axios.get('/api/permission-bundles/');
            setBundles(res.data.results || res.data);
        } catch (error) {
            console.error('Failed to fetch bundles:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchContentTypes = async () => {
        try {
            const res = await axios.get('/api/permission-bundles/content_types/');
            setContentTypes(res.data);
        } catch (error) {
            console.error('Failed to fetch content types:', error);
        }
    };

    const fetchCustomActions = async () => {
        try {
            const res = await axios.get('/api/permission-bundles/custom_actions/');
            setCustomActions(res.data);
        } catch (error) {
            console.error('Failed to fetch custom actions:', error);
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

    const fetchUsers = async () => {
        try {
            const res = await axios.get('/api/users/');
            setUsers(res.data.results || res.data);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        }
    };

    const openModal = (bundle = null) => {
        if (bundle) {
            setEditingBundle(bundle);
            setBundleForm({
                name: bundle.name,
                description: bundle.description || '',
                enabled: bundle.enabled,
                can_view: bundle.can_view,
                can_add: bundle.can_add,
                can_change: bundle.can_change,
                can_delete: bundle.can_delete,
                additional_actions: bundle.additional_actions || '',
                object_types: bundle.object_types || [],
                groups: bundle.groups || [],
                users: bundle.users || []
            });
        } else {
            setEditingBundle(null);
            setBundleForm({
                name: '',
                description: '',
                enabled: true,
                can_view: false,
                can_add: false,
                can_change: false,
                can_delete: false,
                additional_actions: '',
                object_types: [],
                groups: [],
                users: []
            });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingBundle) {
                await axios.put(`/api/permission-bundles/${editingBundle.id}/`, bundleForm);
            } else {
                await axios.post('/api/permission-bundles/', bundleForm);
            }
            setShowModal(false);
            fetchBundles();
        } catch (error) {
            alert('Failed to save permission bundle: ' + (error.response?.data?.name?.[0] || error.message));
            console.error(error);
        }
    };

    const toggleEnabled = async (bundle) => {
        try {
            await axios.post(`/api/permission-bundles/${bundle.id}/toggle_enabled/`);
            fetchBundles();
        } catch (error) {
            alert('Failed to toggle permission bundle');
            console.error(error);
        }
    };

    const deleteBundle = async (id) => {
        if (!confirm('Are you sure you want to delete this permission bundle?')) return;
        try {
            await axios.delete(`/api/permission-bundles/${id}/`);
            fetchBundles();
        } catch (error) {
            alert('Failed to delete bundle');
            console.error(error);
        }
    };

    const toggleObjectType = (ctId) => {
        setBundleForm(prev => ({
            ...prev,
            object_types: prev.object_types.includes(ctId)
                ? prev.object_types.filter(id => id !== ctId)
                : [...prev.object_types, ctId]
        }));
    };

    const toggleGroup = (groupId) => {
        setBundleForm(prev => ({
            ...prev,
            groups: prev.groups.includes(groupId)
                ? prev.groups.filter(id => id !== groupId)
                : [...prev.groups, groupId]
        }));
    };

    const toggleUser = (userId) => {
        setBundleForm(prev => ({
            ...prev,
            users: prev.users.includes(userId)
                ? prev.users.filter(id => id !== userId)
                : [...prev.users, userId]
        }));
    };

    if (!currentUser?.is_superuser) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <Shield className="w-12 h-12 text-red-500 mx-auto mb-3" />
                    <h2 className="text-xl font-semibold text-red-800">Access Denied</h2>
                    <p className="text-red-600 mt-2">Only superusers can manage permission bundles.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Shield className="text-purple-600" />
                        Permission Bundles
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">Create comprehensive permissions with multiple actions and object types</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                    <Plus size={20} />
                    Create Bundle
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Object Types</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Groups</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {bundles.map((bundle) => (
                                <tr key={bundle.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-900">{bundle.name}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-600 max-w-xs truncate">{bundle.description || '-'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {bundle.actions?.map(action => (
                                                <span key={action} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                                    {action}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-600">{bundle.object_types?.length || 0} types</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-600">{bundle.group_names?.length || 0} groups</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => toggleEnabled(bundle)}
                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                                bundle.enabled
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-gray-100 text-gray-800'
                                            }`}
                                        >
                                            {bundle.enabled ? <Power size={14} /> : <PowerOff size={14} />}
                                            {bundle.enabled ? 'Enabled' : 'Disabled'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button
                                            onClick={() => openModal(bundle)}
                                            className="text-blue-600 hover:text-blue-800"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => deleteBundle(bundle.id)}
                                            className="text-red-600 hover:text-red-800"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {bundles.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                        No permission bundles yet. Create one to get started!
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                                <Shield className="text-purple-600" />
                                {editingBundle ? 'Edit Permission Bundle' : 'Add Permission Bundle'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* Name & Description */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={bundleForm.name}
                                        onChange={(e) => setBundleForm({ ...bundleForm, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                        placeholder="e.g., Network Operators"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <input
                                        type="text"
                                        value={bundleForm.description}
                                        onChange={(e) => setBundleForm({ ...bundleForm, description: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                        placeholder="Optional description"
                                    />
                                </div>
                            </div>

                            {/* Enabled */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={bundleForm.enabled}
                                    onChange={(e) => setBundleForm({ ...bundleForm, enabled: e.target.checked })}
                                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                <label className="text-sm font-medium text-gray-700">Enabled</label>
                            </div>

                            {/* Actions */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Standard Actions</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { key: 'can_view', label: 'Can view' },
                                        { key: 'can_add', label: 'Can add' },
                                        { key: 'can_change', label: 'Can change' },
                                        { key: 'can_delete', label: 'Can delete' }
                                    ].map(action => (
                                        <label key={action.key} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={bundleForm[action.key]}
                                                onChange={(e) => setBundleForm({ ...bundleForm, [action.key]: e.target.checked })}
                                                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                            />
                                            <span className="text-sm text-gray-700">{action.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Custom Actions */}
                            {customActions.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Custom Actions
                                        <span className="text-xs text-gray-500 ml-2">(Model-specific permissions)</span>
                                    </label>
                                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                                        {customActions.map(action => (
                                            <label key={action.codename} className="flex items-start gap-2 p-2 border bg-white rounded hover:bg-gray-50 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={bundleForm.additional_actions.includes(action.action)}
                                                    onChange={(e) => {
                                                        const actions = bundleForm.additional_actions.split(',').map(a => a.trim()).filter(a => a);
                                                        if (e.target.checked) {
                                                            actions.push(action.action);
                                                        } else {
                                                            const index = actions.indexOf(action.action);
                                                            if (index > -1) actions.splice(index, 1);
                                                        }
                                                        setBundleForm({ ...bundleForm, additional_actions: actions.join(', ') });
                                                    }}
                                                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 mt-1"
                                                />
                                                <div className="flex-1">
                                                    <div className="text-sm font-medium text-gray-900">{action.name}</div>
                                                    <div className="text-xs text-gray-500">{action.content_type_name}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Object Types */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Object types *</label>
                                <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto border rounded-lg p-3">
                                    {contentTypes.map(ct => (
                                        <label key={ct.id} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={bundleForm.object_types.includes(ct.id)}
                                                onChange={() => toggleObjectType(ct.id)}
                                                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                            />
                                            <span className="text-sm text-gray-700">{ct.display_name}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Select the types of objects to which this permission will apply.</p>
                            </div>

                            {/* Assignment */}
                            <div className="border-t pt-4">
                                <h3 className="text-lg font-medium text-gray-900 mb-3">Assignment</h3>
                                
                                {/* Groups */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Groups</label>
                                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                                        {groups.map(group => (
                                            <label key={group.id} className="flex items-center gap-2 p-1 hover:bg-gray-50 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={bundleForm.groups.includes(group.id)}
                                                    onChange={() => toggleGroup(group.id)}
                                                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                                />
                                                <span className="text-sm text-gray-700">{group.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Users */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Users</label>
                                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                                        {users.map(user => (
                                            <label key={user.id} className="flex items-center gap-2 p-1 hover:bg-gray-50 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={bundleForm.users.includes(user.id)}
                                                    onChange={() => toggleUser(user.id)}
                                                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                                />
                                                <span className="text-sm text-gray-700">{user.username}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                                >
                                    <X size={18} className="inline mr-1" />
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                                >
                                    <Save size={18} className="inline mr-1" />
                                    {editingBundle ? 'Update Bundle' : 'Create Bundle'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PermissionBundles;
