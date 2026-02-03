import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Lock, User, Save } from 'lucide-react';

const GlobalCredentials = () => {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        secret: ''
    });
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await axios.get('/api/dcim/global-credentials/');
            // Don't populate password fields with fetched data (backend returns write_only)
            // Keep password fields empty and use placeholders
            setFormData({
                username: res.data.username || '',
                password: '', // Never populate from API
                secret: ''    // Never populate from API
            });
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(null);
        
        // Only send fields that have values (to avoid overwriting with empty strings)
        const payload = { username: formData.username };
        if (formData.password) payload.password = formData.password;
        if (formData.secret) payload.secret = formData.secret;
        
        try {
            await axios.post('/api/dcim/global-credentials/', payload);
            setMessage({ type: 'success', text: 'Global credentials updated successfully.' });
            // Clear password fields after successful update
            setFormData({ ...formData, password: '', secret: '' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update credentials.' });
        }
    };

    if (loading) return <div className="text-gray-400 text-sm">Loading credentials...</div>;

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-800">
                <Lock className="mr-2 h-5 w-5 text-orange-500" /> Global Device Credentials
            </h2>
            <p className="text-sm text-gray-500 mb-4">
                These credentials will be used as a fallback for devices that do not have specific credentials configured.
            </p>

            {message && (
                <div className={`mb-4 p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Username</label>
                    <div className="relative">
                        <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            required
                            className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                            value={formData.username}
                            onChange={e => setFormData({ ...formData, username: e.target.value })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password</label>
                        <div className="relative">
                            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="password"
                                placeholder="Enter new password to change"
                                className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Leave empty to keep current password</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Enable Secret</label>
                        <div className="relative">
                            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="password"
                                placeholder="Enter new secret to change"
                                className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                value={formData.secret || ''}
                                onChange={e => setFormData({ ...formData, secret: e.target.value })}
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Leave empty to keep current secret</p>
                    </div>
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        className="px-4 py-2 bg-orange-600 text-white text-sm font-bold rounded shadow-sm hover:bg-orange-700 flex items-center"
                    >
                        <Save size={16} className="mr-2" /> Save Credentials
                    </button>
                </div>
            </form>
        </div>
    );
};

export default GlobalCredentials;
