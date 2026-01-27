import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Key, Shield, Eye, Trash2, Server, Plus, Edit2, X, Save } from 'lucide-react';
import ConfirmModal from '../inventory/ConfirmModal';
import GlobalCredentials from './GlobalCredentials';

const Settings = () => {
    // --- API Keys State ---
    const [apiKeys, setApiKeys] = useState([
        { id: 1, prefix: '9A7ds...', created: '2025-10-24 10:00:00', name: 'CI/CD Pipeline' },
    ]);

    // --- File Server State ---
    const [fileServers, setFileServers] = useState([]);
    const [serverLoading, setServerLoading] = useState(false);

    // Modal State for Add/Edit Server
    const [showServerModal, setShowServerModal] = useState(false);
    const [confirmModalData, setConfirmModalData] = useState(null);
    const [editingServer, setEditingServer] = useState(null);
    const [serverForm, setServerForm] = useState({
        name: '',
        protocol: 'https',
        address: '',
        port: 443,
        username: '',
        password: '',
        base_path: '/'
    });

    useEffect(() => {
        fetchFileServers();
    }, []);

    const fetchFileServers = async () => {
        setServerLoading(true);
        try {
            const res = await axios.get('/api/file-servers/');
            setFileServers(res.data.results || res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setServerLoading(false);
        }
    };

    // --- API Key Handlers ---
    const generateKey = () => {
        // Mock
        const newKey = { id: Date.now(), prefix: 'NewK...', created: new Date().toISOString(), name: 'New Key' };
        setApiKeys([...apiKeys, newKey]);
    };

    // --- File Server Handlers ---
    const openServerModal = (server = null) => {
        if (server) {
            setEditingServer(server);
            setServerForm({
                name: server.name,
                protocol: server.protocol,
                address: server.address,
                port: server.port,
                username: server.username || '',
                password: server.password || '', // Usually typically blank on edit
                base_path: server.base_path
            });
        } else {
            setEditingServer(null);
            setServerForm({
                name: '', protocol: 'https', address: '', port: 443, username: '', password: '', base_path: '/'
            });
        }
        setShowServerModal(true);
    };

    const handleServerSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingServer) {
                await axios.put(`/api/file-servers/${editingServer.id}/`, serverForm);
            } else {
                await axios.post('/api/file-servers/', serverForm);
            }
            setShowServerModal(false);
            fetchFileServers();
        } catch (error) {
            alert("Failed to save file server.");
            console.error(error);
        }
    };

    const deleteServer = (id) => {
        setConfirmModalData({
            title: "Delete File Server",
            message: "Are you sure you want to delete this file server? This action cannot be undone.",
            confirmText: "Delete",
            isDestructive: true,
            onConfirm: async () => {
                try {
                    await axios.delete(`/api/file-servers/${id}/`);
                    fetchFileServers();
                } catch (error) {
                    console.error(error);
                    const msg = error.response?.data?.error || "Failed to delete server. It may be in use by images or device models.";
                    alert(msg);
                } finally {
                    setConfirmModalData(null);
                }
            }
        });
    };

    const handleProtocolChange = (e) => {
        const newProtocol = e.target.value;
        let newPort = 22;
        if (newProtocol === 'http') newPort = 80;
        if (newProtocol === 'https') newPort = 443;
        if (newProtocol === 'ftp') newPort = 21;
        setServerForm({ ...serverForm, protocol: newProtocol, port: newPort });
    };

    return (
        <div className="space-y-6 relative">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">System Settings</h1>
                    <p className="text-gray-500">Manage infrastructure, accounts, and access.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">

                {/* File Servers Management */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold flex items-center text-gray-800">
                            <Server className="mr-2 h-5 w-5 text-green-600" /> File Servers
                        </h2>
                        <button
                            onClick={() => openServerModal()}
                            className="text-sm bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 transition flex items-center"
                        >
                            <Plus size={16} className="mr-1" /> Add Server
                        </button>
                    </div>

                    <div className="space-y-3">
                        {serverLoading ? <p className="text-sm text-gray-400">Loading servers...</p> :
                            fileServers.length === 0 ? <p className="text-sm text-gray-400 italic">No file servers configured.</p> :
                                fileServers.map(server => (
                                    <div key={server.id} className="flex justify-between items-center bg-gray-50 p-4 rounded border border-gray-200 hover:border-blue-300 transition-colors">
                                        <div>
                                            <p className="font-bold text-sm text-gray-800">{server.name}</p>
                                            <div className="flex items-center space-x-2 mt-1">
                                                <span className="text-xs font-mono bg-gray-200 px-1.5 py-0.5 rounded text-gray-700 uppercase">{server.protocol}</span>
                                                <span className="text-xs text-gray-500 font-mono">{server.address}:{server.port}</span>
                                                <span className="text-xs text-gray-400">• Path: {server.base_path}</span>
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button onClick={() => openServerModal(server)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-white rounded border border-transparent hover:border-gray-200">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => deleteServer(server.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-white rounded border border-transparent hover:border-gray-200">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                    </div>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* User Profile */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h2 className="text-lg font-semibold mb-4 flex items-center"><Shield className="mr-2 h-5 w-5 text-blue-500" /> User Profile</h2>
                        <div className="space-y-3">
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-gray-500">Username</span>
                                <span className="font-medium">john_doe</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-gray-500">Role</span>
                                <span className="font-medium">Super Admin</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-gray-500">Last Login</span>
                                <span className="font-medium">Just now</span>
                            </div>
                        </div>
                    </div>

                    {/* API Keys */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold flex items-center"><Key className="mr-2 h-5 w-5 text-purple-500" /> API Keys</h2>
                            <button onClick={generateKey} className="text-sm bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 transition">
                                Generate
                            </button>
                        </div>
                        <div className="space-y-3">
                            {apiKeys.map(key => (
                                <div key={key.id} className="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-200">
                                    <div>
                                        <p className="font-medium text-sm">{key.name}</p>
                                        <p className="text-xs font-mono text-gray-500">{key.prefix} • {new Date(key.created).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button className="p-1 text-gray-500 hover:text-red-600"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Global Credentials */}
                    <GlobalCredentials />
                </div>
            </div>

            {/* Modal */}
            {showServerModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800">{editingServer ? 'Edit File Server' : 'Add File Server'}</h3>
                            <button onClick={() => setShowServerModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleServerSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Name</label>
                                <input
                                    required
                                    type="text"
                                    className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                    value={serverForm.name}
                                    onChange={e => setServerForm({ ...serverForm, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Protocol</label>
                                    <select
                                        className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-blue-500"
                                        value={serverForm.protocol}
                                        onChange={handleProtocolChange}
                                    >
                                        <option value="https">HTTPS</option>
                                        <option value="http">HTTP</option>
                                        <option value="scp">SCP</option>
                                        <option value="sftp">SFTP</option>
                                        <option value="ftp">FTP</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Port</label>
                                    <input
                                        type="number"
                                        className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-blue-500"
                                        value={serverForm.port}
                                        onChange={e => setServerForm({ ...serverForm, port: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Address (Hostname/IP)</label>
                                <input
                                    required
                                    type="text"
                                    className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-blue-500 font-mono"
                                    value={serverForm.address}
                                    placeholder="e.g. 10.10.20.5"
                                    onChange={e => setServerForm({ ...serverForm, address: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Base Path</label>
                                <input
                                    type="text"
                                    className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-blue-500 font-mono"
                                    value={serverForm.base_path}
                                    placeholder="/"
                                    onChange={e => setServerForm({ ...serverForm, base_path: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Username</label>
                                    <input
                                        type="text"
                                        className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-blue-500"
                                        value={serverForm.username}
                                        onChange={e => setServerForm({ ...serverForm, username: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Password</label>
                                    <input
                                        type="password"
                                        className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-blue-500"
                                        value={serverForm.password}
                                        onChange={e => setServerForm({ ...serverForm, password: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowServerModal(false)}
                                    className="mr-2 px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded text-sm font-semibold flex items-center"
                                >
                                    <Save size={16} className="mr-1" /> Save Server
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {confirmModalData && (
                <ConfirmModal
                    {...confirmModalData}
                    onCancel={() => setConfirmModalData(null)}
                />
            )}
        </div>
    );
};

export default Settings;
