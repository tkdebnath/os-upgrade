import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, Plus, Edit2, Trash2, X, Save, Users as UsersIcon, Key } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const GroupManagement = () => {
    const { user: currentUser } = useAuth();
    const [groups, setGroups] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [selectedPermissions, setSelectedPermissions] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedActions, setSelectedActions] = useState(['add', 'change', 'delete', 'view']);
    
    const [groupForm, setGroupForm] = useState({
        name: '',
        permissions: []
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
        fetchGroups();
        fetchPermissions();
    }, []);

    const fetchGroups = async () => {
        try {
            const res = await axios.get('/api/users/groups/');
            setGroups(res.data.results || res.data);
        } catch (error) {
            console.error('Failed to fetch groups:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPermissions = async () => {
        try {
            const res = await axios.get('/api/users/permissions/');
            setPermissions(res.data.results || res.data);
        } catch (error) {
            console.error('Failed to fetch permissions:', error);
        }
    };

    const openModal = (group = null) => {
        if (group) {
            setEditingGroup(group);
            setGroupForm({
                name: group.name,
                permissions: group.permissions || []
            });
            setSelectedPermissions(group.permissions || []);
        } else {
            setEditingGroup(null);
            setGroupForm({
                name: '',
                permissions: []
            });
            setSelectedPermissions([]);
        }
        setSearchTerm('');
        setSelectedActions(['add', 'change', 'delete', 'view']);
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                name: groupForm.name,
                permissions: selectedPermissions
            };
            
            if (editingGroup) {
                await axios.put(`/api/users/groups/${editingGroup.id}/`, payload);
            } else {
                await axios.post('/api/users/groups/', payload);
            }
            setShowModal(false);
            fetchGroups();
        } catch (error) {
            alert('Failed to save group: ' + (error.response?.data?.name?.[0] || error.message));
            console.error(error);
        }
    };

    const deleteGroup = async (id) => {
        if (!confirm('Are you sure you want to delete this group? Users in this group will lose these permissions.')) return;
        try {
            await axios.delete(`/api/users/groups/${id}/`);
            fetchGroups();
        } catch (error) {
            alert('Failed to delete group');
            console.error(error);
        }
    };

    const togglePermission = (permId) => {
        setSelectedPermissions(prev => 
            prev.includes(permId) 
                ? prev.filter(id => id !== permId)
                : [...prev, permId]
        );
    };

    const toggleAllPermissions = () => {
        const filteredPerms = filteredPermissions.map(p => p.id);
        const allSelected = filteredPerms.every(id => selectedPermissions.includes(id));
        if (allSelected) {
            setSelectedPermissions(prev => prev.filter(id => !filteredPerms.includes(id)));
        } else {
            setSelectedPermissions(prev => [...new Set([...prev, ...filteredPerms])]);
        }
    };

    const toggleAction = (action) => {
        setSelectedActions(prev =>
            prev.includes(action)
                ? prev.filter(a => a !== action)
                : [...prev, action]
        );
    };

    const selectAllActions = () => {
        setSelectedActions(['add', 'change', 'delete', 'view']);
    };

    const clearAllActions = () => {
        setSelectedActions([]);
    };

    const filteredPermissions = permissions.filter(perm => {
        // Text search filter
        const matchesSearch = searchTerm === '' || 
            perm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            perm.codename.toLowerCase().includes(searchTerm.toLowerCase()) ||
            perm.content_type_name.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Action filter
        const matchesAction = selectedActions.length === 0 || selectedActions.some(action => 
            perm.codename.startsWith(action + '_') || perm.name.toLowerCase().includes(action)
        );
        
        return matchesSearch && matchesAction;
    });;

    // Group permissions by content type
    const groupedPermissions = filteredPermissions.reduce((acc, perm) => {
        const contentType = perm.content_type_name;
        if (!acc[contentType]) {
            acc[contentType] = [];
        }
        acc[contentType].push(perm);
        return acc;
    }, {});

    if (!currentUser?.is_superuser) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <Shield className="mx-auto h-12 w-12 text-red-500 mb-3" />
                    <h2 className="text-xl font-semibold text-red-900">Access Denied</h2>
                    <p className="text-red-700 mt-2">Only superusers can access group management.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                        <Shield className="mr-3 h-8 w-8 text-purple-600" />
                        Group Management
                    </h1>
                    <p className="text-gray-600 mt-1">Manage user groups and their permissions</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center transition"
                >
                    <Plus size={20} className="mr-2" />
                    Add Group
                </button>
            </div>

            {/* Groups Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Group Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Permissions</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan="4" className="px-6 py-4 text-center text-gray-500">Loading...</td></tr>
                        ) : groups.length === 0 ? (
                            <tr><td colSpan="4" className="px-6 py-4 text-center text-gray-500">No groups found</td></tr>
                        ) : (
                            groups.map(group => (
                                <tr key={group.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <Shield className="h-5 w-5 text-purple-500 mr-3" />
                                            <span className="font-medium text-gray-900">{group.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="flex items-center text-sm text-gray-600">
                                            <UsersIcon size={16} className="mr-1" />
                                            {group.user_count || 0} users
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <Key size={16} className="mr-1 text-gray-400" />
                                            <span className="text-sm text-gray-600">
                                                {group.permissions?.length || 0} permissions
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end space-x-2">
                                            <button
                                                onClick={() => openModal(group)}
                                                className="text-indigo-600 hover:text-indigo-900"
                                                title="Edit"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => deleteGroup(group.id)}
                                                className="text-red-600 hover:text-red-900"
                                                title="Delete"
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

            {/* Add/Edit Group Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-900">
                                {editingGroup ? 'Edit Group' : 'Add New Group'}
                            </h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Group Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={groupForm.name}
                                    onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="e.g., Network Administrators"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                                
                                {/* Action Filters */}
                                <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-gray-700">Filter by Actions:</span>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={selectAllActions}
                                                className="text-xs text-purple-600 hover:text-purple-800"
                                            >
                                                All
                                            </button>
                                            <button
                                                type="button"
                                                onClick={clearAllActions}
                                                className="text-xs text-gray-600 hover:text-gray-800"
                                            >
                                                None
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        {[
                                            { key: 'view', label: 'Can View', bgSelected: 'bg-blue-100', borderSelected: 'border-blue-400', textSelected: 'text-blue-800' },
                                            { key: 'add', label: 'Can Add', bgSelected: 'bg-green-100', borderSelected: 'border-green-400', textSelected: 'text-green-800' },
                                            { key: 'change', label: 'Can Change', bgSelected: 'bg-yellow-100', borderSelected: 'border-yellow-400', textSelected: 'text-yellow-800' },
                                            { key: 'delete', label: 'Can Delete', bgSelected: 'bg-red-100', borderSelected: 'border-red-400', textSelected: 'text-red-800' }
                                        ].map(action => (
                                            <label
                                                key={action.key}
                                                className={`flex items-center px-3 py-1.5 rounded-md cursor-pointer transition ${
                                                    selectedActions.includes(action.key)
                                                        ? `${action.bgSelected} ${action.borderSelected} ${action.textSelected} border-2`
                                                        : 'bg-white border-gray-300 text-gray-600 border'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedActions.includes(action.key)}
                                                    onChange={() => toggleAction(action.key)}
                                                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 mr-2"
                                                />
                                                <span className="text-sm font-medium">{action.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Showing {filteredPermissions.length} of {permissions.length} permissions
                                    </p>
                                </div>
                                
                                {/* Dual List Selector */}
                                <div className="grid grid-cols-[1fr_auto_1fr] gap-3">
                                    {/* Available Permissions */}
                                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                                        <div className="bg-gray-100 px-4 py-2 font-medium text-sm text-gray-700 border-b border-gray-300">
                                            Available
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Search available..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full px-3 py-2 border-b border-gray-200 focus:ring-0 focus:border-purple-500 text-sm"
                                        />
                                        <div className="h-80 overflow-y-auto">
                                            {Object.entries(groupedPermissions)
                                                .map(([contentType, perms]) => {
                                                    const availablePerms = perms.filter(p => !selectedPermissions.includes(p.id));
                                                    if (availablePerms.length === 0) return null;
                                                    return (
                                                        <div key={contentType} className="border-b border-gray-200 last:border-b-0">
                                                            <div className="bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600 sticky top-0">
                                                                {contentType}
                                                            </div>
                                                            <div className="divide-y divide-gray-100">
                                                                {availablePerms.map(perm => (
                                                                    <div 
                                                                        key={perm.id} 
                                                                        onClick={() => togglePermission(perm.id)}
                                                                        className="px-3 py-2 hover:bg-purple-50 cursor-pointer text-sm text-gray-700"
                                                                    >
                                                                        {perm.name}
                                                                        <div className="text-xs text-gray-400 mt-0.5">{perm.codename}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                                .filter(Boolean)
                                            }
                                            {Object.values(groupedPermissions).every(perms => 
                                                perms.every(p => selectedPermissions.includes(p.id))
                                            ) && (
                                                <div className="p-4 text-center text-sm text-gray-400">
                                                    All permissions selected
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Add/Remove Buttons */}
                                    <div className="flex flex-col justify-center space-y-2">
                                        <button
                                            type="button"
                                            onClick={toggleAllPermissions}
                                            className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs font-medium"
                                            title={filteredPermissions.every(p => selectedPermissions.includes(p.id)) ? 'Remove All Visible' : 'Add All Visible'}
                                        >
                                            {filteredPermissions.every(p => selectedPermissions.includes(p.id)) ? '<<' : '>>'}
                                        </button>
                                        <div className="text-xs text-gray-500 text-center px-2">
                                            Click items to move
                                        </div>
                                    </div>

                                    {/* Selected Permissions */}
                                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                                        <div className="bg-green-100 px-4 py-2 font-medium text-sm text-gray-700 border-b border-gray-300 flex justify-between items-center">
                                            <span>Selected</span>
                                            <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
                                                {selectedPermissions.length}
                                            </span>
                                        </div>
                                        <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 text-xs text-gray-600">
                                            Click to remove
                                        </div>
                                        <div className="h-80 overflow-y-auto">
                                            {(() => {
                                                const selectedPermsGrouped = permissions
                                                    .filter(p => selectedPermissions.includes(p.id))
                                                    .reduce((acc, perm) => {
                                                        const contentType = perm.content_type_name;
                                                        if (!acc[contentType]) acc[contentType] = [];
                                                        acc[contentType].push(perm);
                                                        return acc;
                                                    }, {});
                                                
                                                return Object.entries(selectedPermsGrouped).map(([contentType, perms]) => (
                                                    <div key={contentType} className="border-b border-gray-200 last:border-b-0">
                                                        <div className="bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600 sticky top-0">
                                                            {contentType}
                                                        </div>
                                                        <div className="divide-y divide-gray-100">
                                                            {perms.map(perm => (
                                                                <div 
                                                                    key={perm.id}
                                                                    onClick={() => togglePermission(perm.id)}
                                                                    className="px-3 py-2 hover:bg-red-50 cursor-pointer text-sm text-gray-700"
                                                                >
                                                                    {perm.name}
                                                                    <div className="text-xs text-gray-400 mt-0.5">{perm.codename}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ));
                                            })()}
                                            {selectedPermissions.length === 0 && (
                                                <div className="p-4 text-center text-sm text-gray-400">
                                                    No permissions selected
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
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
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                                >
                                    <Save size={18} className="inline mr-2" />
                                    {editingGroup ? 'Update' : 'Create'} Group
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupManagement;
