import React, { useState, useEffect } from 'react';
import { X, Server, Lock, User, Globe, Activity } from 'lucide-react';
import axios from 'axios';

const AddDeviceModal = ({ onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        hostname: '',
        ip_address: '',
        username: '',
        password: '',
        secret: '',
        platform: 'iosxe',
        family: 'Switch',
        site: 'Global',
        preferred_file_server: ''
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

        // Prepare payload (convert empty string to null if needed, though Django handles empty string for FK if blank=True? No, FK needs null)
        const payload = {
            ...formData,
            preferred_file_server: formData.preferred_file_server || null,
            username: formData.username || null, // Allow fallback
            password: formData.password || null,
            secret: formData.secret || null
        };

        try {
            await axios.post('/api/dcim/devices/', payload);
            onSuccess();
            onClose();
        } catch (err) {
            console.error("Failed to add device", err);
            setError(err.response?.data?.detail || "Failed to add device. Please check your inputs.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center">
                        <Server size={20} className="mr-2 text-blue-600" />
                        Add New Device
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded transition">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded border border-red-100">
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Hostname</label>
                            <input
                                type="text"
                                name="hostname"
                                required
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                placeholder="e.g. C9300-Switch-1"
                                value={formData.hostname}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">IP Address</label>
                            <div className="relative">
                                <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    name="ip_address"
                                    required
                                    className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                    placeholder="192.168.1.10"
                                    value={formData.ip_address}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Username</label>
                                <div className="relative">
                                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        name="username"
                                        className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                        placeholder="Global"
                                        value={formData.username}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Password</label>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="password"
                                        name="password"
                                        className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                        placeholder="Global"
                                        value={formData.password}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Secret</label>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="password"
                                        name="secret"
                                        className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                        placeholder="Global"
                                        value={formData.secret || ''}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Family</label>
                                <select
                                    name="family"
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    value={formData.family}
                                    onChange={handleChange}
                                >
                                    <option value="Switch">Switch</option>
                                    <option value="Router">Router</option>
                                    <option value="AP">Access Point</option>
                                    <option value="WLC">WLC</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Platform</label>
                                <select
                                    name="platform"
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    value={formData.platform}
                                    onChange={handleChange}
                                >
                                    <option value="iosxe">iOS-XE</option>
                                    <option value="iosxr">iOS-XR</option>
                                    <option value="nxos">NX-OS</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Site</label>
                                <input
                                    type="text"
                                    name="site"
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                                    placeholder="Global"
                                    value={formData.site}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Preferred FS (Optional)</label>
                                <select
                                    name="preferred_file_server"
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
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
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold shadow-sm transition disabled:opacity-50 flex items-center"
                            >
                                {loading ? 'Adding...' : 'Add Device'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AddDeviceModal;
