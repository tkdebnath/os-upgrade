import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Globe, Plus, Trash2, Edit2, Save, X, Server } from 'lucide-react';
import ConfirmModal from '../inventory/ConfirmModal';

const RegionSettings = () => {
    const [regions, setRegions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fileServers, setFileServers] = useState([]);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingRegion, setEditingRegion] = useState(null);
    const [formData, setFormData] = useState({ name: '', preferred_file_server: '' });
    const [confirmModalData, setConfirmModalData] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [regRes, fsRes] = await Promise.all([
                axios.get('/api/dcim/regions/'),
                axios.get('/api/images/file-servers/')
            ]);
            setRegions(regRes.data.results || regRes.data);
            setFileServers(fsRes.data.results || fsRes.data);
        } catch (error) {
            console.error("Failed to fetch regions", error);
        } finally {
            setLoading(false);
        }
    };

    const openModal = (region = null) => {
        if (region) {
            setEditingRegion(region);
            setFormData({
                name: region.name,
                preferred_file_server: region.preferred_file_server || ''
            });
        } else {
            setEditingRegion(null);
            setFormData({ name: '', preferred_file_server: '' });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                name: formData.name,
                preferred_file_server: formData.preferred_file_server || null
            };

            if (editingRegion) {
                await axios.patch(`/api/dcim/regions/${editingRegion.id}/`, payload);
            } else {
                await axios.post('/api/dcim/regions/', payload);
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            console.error(error);
            alert("Failed to save region. Name must be unique.");
        }
    };

    const deleteRegion = (id) => {
        setConfirmModalData({
            title: "Delete Region",
            message: "Are you sure? Sites assigned to this region will be unassigned.",
            confirmText: "Delete",
            isDestructive: true,
            onConfirm: async () => {
                try {
                    await axios.delete(`/api/dcim/regions/${id}/`);
                    fetchData();
                } catch (e) {
                    console.error(e);
                    alert("Failed to delete region.");
                } finally {
                    setConfirmModalData(null);
                }
            }
        });
    };

    const getFSName = (id) => {
        const fs = fileServers.find(f => f.id === id);
        return fs ? fs.name : 'Default/Global';
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center text-gray-800">
                    <Globe className="mr-2 h-5 w-5 text-blue-500" /> Regions
                </h2>
                <button
                    onClick={() => openModal()}
                    className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition flex items-center"
                >
                    <Plus size={16} className="mr-1" /> Add Region
                </button>
            </div>

            <div className="space-y-3">
                {loading ? <p className="text-sm text-gray-400">Loading...</p> :
                    regions.length === 0 ? <p className="text-sm text-gray-400 italic">No regions defined.</p> :
                        regions.map(region => (
                            <div key={region.id} className="flex justify-between items-center bg-gray-50 p-4 rounded border border-gray-200 hover:border-blue-300 transition-colors">
                                <div>
                                    <p className="font-bold text-sm text-gray-800">{region.name}</p>
                                    <div className="flex items-center space-x-2 mt-1">
                                        <span className="text-xs text-gray-500 flex items-center">
                                            <Server size={12} className="mr-1" />
                                            Preferred FS: {getFSName(region.preferred_file_server)}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex space-x-2">
                                    <button onClick={() => openModal(region)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-white rounded border border-transparent hover:border-gray-200">
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => deleteRegion(region.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-white rounded border border-transparent hover:border-gray-200">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
            </div>

            {/* Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800">{editingRegion ? 'Edit Region' : 'Add Region'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Region Name</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-blue-500"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Preferred File Server</label>
                                <select
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white"
                                    value={formData.preferred_file_server}
                                    onChange={e => setFormData({ ...formData, preferred_file_server: e.target.value })}
                                >
                                    <option value="">Default / Global</option>
                                    {fileServers.map(fs => (
                                        <option key={fs.id} value={fs.id}>
                                            {fs.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end pt-4 space-x-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded text-sm font-bold shadow-sm flex items-center"
                                >
                                    <Save size={16} className="mr-1" /> Save
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

export default RegionSettings;
