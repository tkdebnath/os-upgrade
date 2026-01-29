import React, { useState, useEffect } from 'react';
import { X, Server, Lock, User, Globe, Save } from 'lucide-react';
import axios from 'axios';

const EditDeviceModal = ({ device, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        hostname: device.hostname,
        ip_address: device.ip_address,
        username: device.username,
        password: '', // Don't show existing password, only allow update
        platform: device.platform,
        family: device.family,
        site: device.site || '',
        preferred_file_server: device.preferred_file_server || ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [fileServers, setFileServers] = useState([]);

    useEffect(() => {
        const fetchFileServers = async () => {
            try {
                const res = await axios.get('/api/images/file-servers/');
                setFileServers(res.data.results || res.data);
            } catch (e) {
                console.error("Failed to load file servers", e);
            }
        };
        fetchFileServers();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const payload = { ...formData };
        if (!payload.password) delete payload.password; // Only update if provided

        // Handle nulls
        if (!payload.site) payload.site = null;
        if (!payload.preferred_file_server) payload.preferred_file_server = null;

        try {
            await axios.patch(`/api/dcim/devices/${device.id}/`, payload);
            onSuccess();
            onClose();
        } catch (err) {
            console.error("Failed to update device", err);
            setError(err.response?.data?.detail || "Failed to update device.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center">
                        <Server size={20} className="mr-2 text-blue-600" />
                        Edit Device: {device.hostname}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded transition">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded border border-red-100">
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Hostname & IP */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Hostname</label>
                                <input
                                    type="text"
                                    name="hostname"
                                    required
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                    value={formData.hostname}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">IP Address</label>
                                <input
                                    type="text"
                                    name="ip_address"
                                    required
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                    value={formData.ip_address}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        {/* Credentials */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Username</label>
                                <input
                                    type="text"
                                    name="username"
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                    value={formData.username || ''}
                                    onChange={handleChange}
                                    placeholder="Global Defaults"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Password</label>
                                <input
                                    type="password"
                                    name="password"
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                    placeholder="Leave blank to keep"
                                    value={formData.password}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        {/* Family & Platform */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Family</label>
                                <select
                                    name="family"
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white"
                                    value={formData.family || 'Switch'}
                                    onChange={handleChange}
                                >
                                    <option value="Switch">Switch</option>
                                    <option value="Router">Router</option>
                                    <option value="AP">Access Point</option>
                                    <option value="WLC">WLC</option>
                                    <option value="Firewall">Firewall</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Platform</label>
                                <select
                                    name="platform"
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white"
                                    value={formData.platform}
                                    onChange={handleChange}
                                >
                                    <option value="iosxe">iOS-XE</option>
                                    <option value="iosxr">iOS-XR</option>
                                    <option value="nxos">NX-OS</option>
                                </select>
                            </div>
                        </div>

                        {/* Site & File Server */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Site</label>
                                <input
                                    type="text"
                                    name="site"
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                    placeholder="Global"
                                    value={formData.site}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Preferred FS</label>
                                <select
                                    name="preferred_file_server"
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white"
                                    value={formData.preferred_file_server}
                                    onChange={handleChange}
                                >
                                    <option value="">Default / None</option>
                                    {fileServers.map(fs => (
                                        <option key={fs.id} value={fs.id}>
                                            {fs.name} {fs.city ? `(${fs.city})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold shadow-sm transition flex items-center"
                            >
                                <Save size={16} className="mr-2" />
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EditDeviceModal;
