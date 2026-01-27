import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Globe, Plus, Server, Edit2, Trash2, Map, Layout, AlertCircle } from 'lucide-react';
import EditSiteModal from './EditSiteModal';
import ConfirmModal from '../inventory/ConfirmModal';

// Simple Region Modal (Internal or reuse RegionSettings logic?)
// Let's keep it self-contained for now or import shared?
// To avoid duplication, I'll inline a simple Region Modal here or create `EditRegionModal.jsx`.
// I'll inline it for speed as it's small.

const SiteManagement = () => {
    const [regions, setRegions] = useState([]);
    const [sites, setSites] = useState([]);
    const [fileServers, setFileServers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [showRegionModal, setShowRegionModal] = useState(false);
    const [editingRegion, setEditingRegion] = useState(null);
    const [regionForm, setRegionForm] = useState({ name: '', preferred_file_server: '' });

    const [showSiteModal, setShowSiteModal] = useState(false);
    const [editingSiteName, setEditingSiteName] = useState(null);

    const [confirmModalData, setConfirmModalData] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [regRes, sitesRes, fsRes] = await Promise.all([
                axios.get('/api/regions/'),
                axios.get('/api/sites/'),
                axios.get('/api/file-servers/')
            ]);
            setRegions(regRes.data.results || regRes.data);
            setSites(sitesRes.data.results || sitesRes.data);
            setFileServers(fsRes.data.results || fsRes.data);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    const getFSName = (id) => {
        if (!id) return null;
        const fs = fileServers.find(f => f.id === id);
        return fs ? fs.name : 'Unknown';
    };

    // --- Region Logic ---
    const openRegionModal = (region = null) => {
        if (region) {
            setEditingRegion(region);
            setRegionForm({ name: region.name, preferred_file_server: region.preferred_file_server || '' });
        } else {
            setEditingRegion(null);
            setRegionForm({ name: '', preferred_file_server: '' });
        }
        setShowRegionModal(true);
    };

    const handleRegionSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                name: regionForm.name,
                preferred_file_server: regionForm.preferred_file_server || null
            };
            if (editingRegion) {
                await axios.patch(`/api/regions/${editingRegion.id}/`, payload);
            } else {
                await axios.post('/api/regions/', payload);
            }
            setShowRegionModal(false);
            fetchData();
        } catch (e) {
            alert("Failed to save region.");
        }
    };

    const deleteRegion = (id) => {
        setConfirmModalData({
            title: "Delete Region",
            message: "Are you sure? Sites in this region will become unassigned.",
            confirmText: "Delete",
            isDestructive: true,
            onConfirm: async () => {
                await axios.delete(`/api/regions/${id}/`);
                fetchData();
                setConfirmModalData(null);
            }
        });
    };

    // --- Site Logic ---
    const openSiteModal = (siteName) => {
        setEditingSiteName(siteName);
        setShowSiteModal(true);
    };

    // Group Sites
    const unassignedSites = sites.filter(s => !s.region);
    const sitesByRegion = {};
    regions.forEach(r => {
        sitesByRegion[r.id] = sites.filter(s => s.region === r.id);
    });

    if (loading) return <div className="p-8 text-gray-500">Loading hierarchy...</div>;

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <Map className="mr-3 text-blue-600" /> Site Hierarchy
                    </h1>
                    <p className="text-gray-500 text-sm">Organize sites into regions and manage file server preferences.</p>
                </div>
                <button
                    onClick={() => openRegionModal()}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition"
                >
                    <Plus size={18} className="mr-2" /> Add Region
                </button>
            </div>

            {/* Regions Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {regions.map(region => (
                    <div key={region.id} className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
                        {/* Region Header */}
                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-start rounded-t-lg">
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg flex items-center">
                                    <Globe size={18} className="mr-2 text-blue-500" />
                                    {region.name}
                                </h3>
                                <div className="mt-1 text-xs text-gray-500 flex items-center">
                                    <Server size={12} className="mr-1" />
                                    Preferred FS: <span className="font-medium text-gray-700 ml-1">{getFSName(region.preferred_file_server) || 'Global Default'}</span>
                                </div>
                            </div>
                            <div className="flex space-x-1">
                                <button onClick={() => openRegionModal(region)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-white">
                                    <Edit2 size={16} />
                                </button>
                                <button onClick={() => deleteRegion(region.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-white">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Sites List */}
                        <div className="p-4 flex-1">
                            {sitesByRegion[region.id]?.length === 0 ? (
                                <p className="text-sm text-gray-400 italic text-center py-4">No sites in this region.</p>
                            ) : (
                                <div className="space-y-2">
                                    {sitesByRegion[region.id]?.map(site => (
                                        <div key={site.id} className="flex justify-between items-center p-2.5 bg-white border border-gray-100 rounded hover:border-blue-300 transition group">
                                            <div>
                                                <p className="font-medium text-gray-800 text-sm">{site.name}</p>
                                                {site.preferred_file_server && (
                                                    <p className="text-xs text-blue-600 flex items-center mt-0.5">
                                                        <Server size={10} className="mr-1" />
                                                        {getFSName(site.preferred_file_server)}
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => openSiteModal(site.name)}
                                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Unassigned Sites */}
            <div className="mt-8">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <AlertCircle className="mr-2 text-gray-400" /> Unassigned Sites
                </h3>
                {unassignedSites.length === 0 ? (
                    <p className="text-gray-500 italic">All sites are assigned to regions.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {unassignedSites.map(site => (
                            <div key={site.id} className="bg-white p-3 rounded border border-gray-200 flex justify-between items-center shadow-sm">
                                <div>
                                    <p className="font-medium text-gray-800">{site.name}</p>
                                    <p className="text-xs text-gray-500">Global Region</p>
                                    {site.preferred_file_server && (
                                        <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded mt-1 inline-block">
                                            {getFSName(site.preferred_file_server)}
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => openSiteModal(site.name)}
                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-50 rounded"
                                >
                                    <Edit2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Region Modal */}
            {showRegionModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95">
                        <h3 className="text-lg font-bold mb-4">{editingRegion ? 'Edit Region' : 'Add Region'}</h3>
                        <form onSubmit={handleRegionSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase">Name</label>
                                <input
                                    className="w-full border rounded p-2 text-sm mt-1"
                                    value={regionForm.name}
                                    onChange={e => setRegionForm({ ...regionForm, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase">Preferred File Server</label>
                                <select
                                    className="w-full border rounded p-2 text-sm mt-1 bg-white"
                                    value={regionForm.preferred_file_server}
                                    onChange={e => setRegionForm({ ...regionForm, preferred_file_server: e.target.value })}
                                >
                                    <option value="">Default / Global</option>
                                    {fileServers.map(fs => (
                                        <option key={fs.id} value={fs.id}>{fs.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end space-x-2 pt-4">
                                <button type="button" onClick={() => setShowRegionModal(false)} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                                <button type="submit" className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Site Modal (Reusing EditSiteModal but allowing Region edit) */}
            {showSiteModal && (
                <EditSiteModal
                    siteName={editingSiteName}
                    onClose={() => setShowSiteModal(false)}
                    onSuccess={fetchData}
                />
            )}

            {confirmModalData && <ConfirmModal {...confirmModalData} onCancel={() => setConfirmModalData(null)} />}
        </div>
    );
};

export default SiteManagement;
