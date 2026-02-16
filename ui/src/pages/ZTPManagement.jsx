import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Zap, Play, Pause, X, Search, RefreshCw, Trash2, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ZTPManagement = () => {
    const navigate = useNavigate();
    const { user, can } = useAuth();
    const [workflows, setWorkflows] = useState([]);
    const [availableWorkflows, setAvailableWorkflows] = useState([]);
    const [validationChecks, setValidationChecks] = useState([]);
    const [images, setImages] = useState([]);
    const [sites, setSites] = useState([]);
    const [models, setModels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Token Modal State
    const [tokenData, setTokenData] = useState(null);


    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        workflow: '',
        target_site: '',
        device_family_filter: '',
        platform_filter: '',
        model_filter: '',
        precheck_validations: [],
        postcheck_validations: []
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [ztpRes, wfRes, sitesRes, modelsRes, checksRes] = await Promise.all([
                axios.get('/api/core/ztp-workflows/'),
                axios.get('/api/core/workflows/'),
                axios.get('/api/dcim/sites/'),
                axios.get('/api/dcim/device-models/'),
                axios.get('/api/core/checks/')
            ]);

            console.log('Workflows API response:', wfRes.data);
            const workflows = wfRes.data.results || wfRes.data;
            console.log('Available workflows:', workflows);

            setWorkflows(ztpRes.data.results || ztpRes.data);
            setAvailableWorkflows(workflows);
            setSites(sitesRes.data.results || sitesRes.data);
            setModels(modelsRes.data.results || modelsRes.data);
            setValidationChecks(checksRes.data.results || checksRes.data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/core/ztp-workflows/', formData);
            setShowCreateModal(false);
            fetchData();
            setFormData({
                name: '',
                description: '',
                workflow: '',
                target_site: '',
                device_family_filter: '',
                platform_filter: '',
                model_filter: '',
                precheck_validations: [],
                postcheck_validations: []
            });
        } catch (error) {
            console.error('Error creating ZTP workflow:', error);
            alert('Failed to create ZTP workflow');
        }
    };

    const handleDiscover = async (id) => {
        try {
            const res = await axios.get(`/api/core/ztp-workflows/${id}/stats/`);
            // Security: Mask the token in state to prevent exposure via React DevTools
            const secureData = { ...res.data, webhook_token: '********************************' };
            setTokenData(secureData);
        } catch (error) {
            console.error('Error getting stats:', error);
            alert('Failed to get workflow stats');
        }
    };

    const handleStart = async (id) => {
        const workflow = workflows.find(w => w.id === id);
        if (!confirm(`Toggle workflow status?\nCurrent: ${workflow.status}`)) return;
        try {
            await axios.post(`/api/core/ztp-workflows/${id}/toggle_status/`);
            fetchData();
        } catch (error) {
            console.error('Error toggling status:', error);
            alert('Failed to toggle workflow status');
        }
    };

    const handleCancel = async (id) => {
        // Archive workflow
        if (!confirm('Archive this ZTP workflow?')) return;
        try {
            await axios.patch(`/api/core/ztp-workflows/${id}/`, { status: 'archived' });
            fetchData();
        } catch (error) {
            console.error('Error archiving workflow:', error);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this ZTP workflow? This cannot be undone.')) return;
        try {
            await axios.delete(`/api/core/ztp-workflows/${id}/`);
            fetchData();
        } catch (error) {
            console.error('Error deleting workflow:', error);
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            'active': 'bg-green-100 text-green-700 ring-green-200',
            'paused': 'bg-amber-100 text-amber-700 ring-amber-200',
            'completed': 'bg-blue-100 text-blue-700 ring-blue-200',
            'archived': 'bg-gray-100 text-gray-500 ring-gray-200'
        };
        return colors[status] || 'bg-gray-100 text-gray-600 ring-gray-200';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading ZTP workflows...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Zap className="text-blue-600" /> Zero Touch Provisioning
                    </h1>
                    <p className="text-gray-600 mt-1">Auto-discover devices, check IOS compliance, and upgrade to golden image</p>
                </div>
                {(can('core.can_manage_ztp') || user?.is_superuser) && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-semibold"
                    >
                        <Plus size={20} /> Create ZTP Endpoint
                    </button>
                )}
            </div>

            {/* Workflows Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-bold tracking-wider border-b border-gray-100">
                            <tr>
                                <th className="p-4">Workflow Name</th>
                                <th className="p-4">IOS Upgrade Workflow</th>
                                <th className="p-4">Site</th>
                                <th className="p-4">Devices Hit</th>
                                <th className="p-4">Success Rate</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {workflows.map(wf => {
                                const successRate = wf.total_devices > 0 ? Math.round((wf.completed_devices / wf.total_devices) * 100) : 0;
                                return (
                                    <tr key={wf.id} className="hover:bg-gray-50">
                                        <td className="p-4">
                                            <div className="font-medium text-gray-800">{wf.name}</div>
                                            {wf.description && <div className="text-xs text-gray-500 mt-1">{wf.description}</div>}
                                        </td>
                                        <td className="p-4 text-gray-600">{wf.workflow_name || 'Not set'}</td>
                                        <td className="p-4 text-xs text-gray-600">
                                            {wf.target_site_name && <div>Site: {wf.target_site_name}</div>}
                                            {wf.device_family_filter && <div>Family: {wf.device_family_filter}</div>}
                                            {wf.platform_filter && <div>Platform: {wf.platform_filter}</div>}
                                            {wf.model_name && <div>Model: {wf.model_name}</div>}
                                            {!wf.target_site_name && !wf.device_family_filter && !wf.platform_filter && !wf.model_name &&
                                                <span className="text-gray-400">No filters</span>
                                            }
                                        </td>
                                        <td className="p-4">
                                            <div className="font-semibold text-gray-700">{wf.total_devices || 0}</div>
                                            <div className="text-xs text-gray-500">
                                                ✓ {wf.completed_devices} • ✗ {wf.failed_devices} • ⊗ {wf.skipped_devices || 0}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden min-w-[80px]">
                                                    <div
                                                        className={`h-full transition-all duration-300 ${successRate > 80 ? 'bg-green-600' : successRate > 50 ? 'bg-blue-600' : 'bg-amber-600'}`}
                                                        style={{ width: `${successRate}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-600 font-medium w-10 text-right">{successRate}%</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ring-1 ${getStatusColor(wf.status)}`}>
                                                {wf.status}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleDiscover(wf.id)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                    title="View Webhook Info"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleStart(wf.id)}
                                                    className={`p-2 rounded-lg transition ${wf.status === 'active' ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}`}
                                                    title={wf.status === 'active' ? 'Pause' : 'Activate'}
                                                >
                                                    {wf.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                                                </button>
                                                <button
                                                    onClick={() => handleCancel(wf.id)}
                                                    className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition"
                                                    title="Archive"
                                                >
                                                    <X size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(wf.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {workflows.length === 0 && (
                                <tr>
                                    <td colSpan="8" className="p-8 text-center text-gray-400">
                                        <Zap className="mx-auto mb-2 text-gray-300" size={48} />
                                        <p className="text-lg">No ZTP workflows yet</p>
                                        <p className="text-sm mt-1">Create your first workflow to get started</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <Zap className="text-blue-600" /> Create ZTP Endpoint
                            </h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                <p className="text-sm text-blue-900">
                                    <strong>How it works:</strong> Devices will call the ZTP endpoint with their credentials.
                                    Device calls webhook with credentials → SWIM checks IOS version → Auto-upgrades if not running golden image
                                    using the model's golden image.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Endpoint Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="e.g., Campus Auto-Provisioning"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    rows="2"
                                    placeholder="Optional description"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">IOS Upgrade Workflow *</label>
                                <select
                                    required
                                    value={formData.workflow}
                                    onChange={(e) => setFormData({ ...formData, workflow: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Select workflow...</option>
                                    {availableWorkflows.map(wf => (
                                        <option key={wf.id} value={wf.id}>{wf.name}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">All devices calling this endpoint get upgraded using these steps</p>
                            </div>

                            <div className="border-t border-gray-200 pt-4">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">Validation Checks (Optional)</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-2">Pre-Checks</label>
                                        <select
                                            multiple
                                            value={formData.precheck_validations}
                                            onChange={(e) => setFormData({ ...formData, precheck_validations: Array.from(e.target.selectedOptions, opt => opt.value) })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32"
                                        >
                                            {validationChecks.filter(c => c.check_type === 'pre' || c.check_type === 'both').map(check => (
                                                <option key={check.id} value={check.id}>{check.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm text-gray-600 mb-2">Post-Checks</label>
                                        <select
                                            multiple
                                            value={formData.postcheck_validations}
                                            onChange={(e) => setFormData({ ...formData, postcheck_validations: Array.from(e.target.selectedOptions, opt => opt.value) })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32"
                                        >
                                            {validationChecks.filter(c => c.check_type === 'post' || c.check_type === 'both').map(check => (
                                                <option key={check.id} value={check.id}>{check.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-gray-200 pt-4">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">Optional Filters</h3>
                                <p className="text-xs text-gray-500 mb-3">Restrict which devices can use this endpoint</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-2">Site</label>
                                        <select
                                            value={formData.target_site}
                                            onChange={(e) => setFormData({ ...formData, target_site: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            <option value="">All sites</option>
                                            {sites.map(site => (
                                                <option key={site.id} value={site.id}>{site.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm text-gray-600 mb-2">Device Family</label>
                                        <select
                                            value={formData.device_family_filter}
                                            onChange={(e) => setFormData({ ...formData, device_family_filter: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            <option value="">All families</option>
                                            <option value="Switch">Switch</option>
                                            <option value="Router">Router</option>
                                            <option value="AP">AP</option>
                                            <option value="WLC">WLC</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm text-gray-600 mb-2">Platform</label>
                                        <input
                                            type="text"
                                            value={formData.platform_filter}
                                            onChange={(e) => setFormData({ ...formData, platform_filter: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="e.g., iosxe"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm text-gray-600 mb-2">Model</label>
                                        <select
                                            value={formData.model_filter}
                                            onChange={(e) => setFormData({ ...formData, model_filter: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            <option value="">All models</option>
                                            {models.map(model => (
                                                <option key={model.id} value={model.id}>{model.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
                                >
                                    Create Endpoint
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Token Info Modal */}
            {tokenData && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">Webhook Connection Info</h2>
                            <button onClick={() => setTokenData(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Webhook URL</label>
                                <div className="bg-gray-50 p-3 rounded border border-gray-200 font-mono text-sm break-all text-gray-700 select-all">
                                    {tokenData.webhook_url}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Webhook Token</label>
                                <div className="flex items-center gap-2">
                                    <div className="bg-gray-50 p-3 rounded border border-gray-200 font-mono text-sm break-all text-gray-700 flex-1">
                                        ********************************
                                    </div>
                                </div>
                            </div>
                            <div className="pt-2 text-xs text-gray-500">
                                Devices provisioned: <strong>{tokenData.total_devices}</strong>
                            </div>

                            {/* Device List Table */}
                            {tokenData.devices && tokenData.devices.length > 0 && (
                                <div className="mt-4">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Recent Provisioning Attempts</h3>
                                    <div className="border border-gray-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                                                <tr>
                                                    <th className="p-2">Device</th>
                                                    <th className="p-2">IP</th>
                                                    <th className="p-2">Status</th>
                                                    <th className="p-2">Message</th>
                                                    <th className="p-2">Time</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {tokenData.devices.map((device) => (
                                                    <tr key={device.job_id} className="hover:bg-gray-50">
                                                        <td className="p-2 font-medium">
                                                            <a href={`/jobs/${device.job_id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                                                {device.hostname}
                                                            </a>
                                                        </td>
                                                        <td className="p-2 text-gray-600">{device.ip_address}</td>
                                                        <td className="p-2">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${device.status === 'success' ? 'bg-green-100 text-green-700' :
                                                                device.status === 'failed' ? 'bg-red-100 text-red-700' :
                                                                    'bg-blue-100 text-blue-700'
                                                                }`}>
                                                                {device.status}
                                                            </span>
                                                        </td>
                                                        <td className="p-2 text-gray-500 truncate max-w-[150px]" title={device.message}>
                                                            {device.message}
                                                        </td>
                                                        <td className="p-2 text-gray-400">
                                                            {new Date(device.timestamp).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-200 flex justify-end">
                            <button onClick={() => setTokenData(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 font-medium">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ZTPManagement;
