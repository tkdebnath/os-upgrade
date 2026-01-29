import React, { useState, useEffect } from 'react';
import { X, Globe, Save, } from 'lucide-react';
import axios from 'axios';

const EditSiteModal = ({ siteName, onClose, onSuccess }) => {
    // We need to fetch the Site Object by Name first, because our Route uses Name
    // BUT, ideally we should have the Site ID. 
    // If the previous page doesn't have ID, we need to find it.

    // Proposal: 
    // 1. Fetch site by name filtering? `/api/sites/?name=siteName` if FilterSet exists.
    // 2. Or just GET `/api/sites/` and find it. sites list shouldn't be huge for now.

    const [siteObj, setSiteObj] = useState(null);
    const [loading, setLoading] = useState(true);
    const [preferredFileServer, setPreferredFileServer] = useState('');
    const [regionId, setRegionId] = useState('');
    const [fileServers, setFileServers] = useState([]);
    const [regions, setRegions] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        const init = async () => {
            try {
                const [sitesRes, fsRes, regRes] = await Promise.all([
                    axios.get('/api/dcim/sites/'),
                    axios.get('/api/images/file-servers/'),
                    axios.get('/api/dcim/regions/')
                ]);

                const allSites = sitesRes.data.results || sitesRes.data;
                const found = allSites.find(s => s.name === siteName);

                if (found) {
                    setSiteObj(found);
                    setPreferredFileServer(found.preferred_file_server || '');
                    setRegionId(found.region || '');
                } else {
                    setError("Site not found in database.");
                }

                setFileServers(fsRes.data.results || fsRes.data);
                setRegions(regRes.data.results || regRes.data);
            } catch (e) {
                console.error(e);
                setError("Failed to load site data.");
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [siteName]);

    const handleSave = async () => {
        if (!siteObj) return;
        setLoading(true);
        try {
            await axios.patch(`/api/dcim/sites/${siteObj.id}/`, {
                preferred_file_server: preferredFileServer || null,
                region: regionId || null
            });
            onSuccess();
            onClose();
        } catch (e) {
            console.error(e);
            setError("Failed to update site.");
            setLoading(false);
        }
    };

    if (loading && !siteObj && !error) return null; // loading state

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center">
                        <Globe size={20} className="mr-2 text-blue-600" />
                        Edit Site: {siteName}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded transition">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    {error ? (
                        <div className="text-red-600 text-sm mb-4">{error}</div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Preferred File Server</label>
                                <select
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white"
                                    value={preferredFileServer}
                                    onChange={(e) => setPreferredFileServer(e.target.value)}
                                >
                                    <option value="">Default / Global</option>
                                    {fileServers.map(fs => (
                                        <option key={fs.id} value={fs.id}>
                                            {fs.name} {fs.city ? `(${fs.city})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-400 mt-1">
                                    Devices in this site will use this server unless they have a specific override.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Region</label>
                                <select
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white"
                                    value={regionId}
                                    onChange={(e) => setRegionId(e.target.value)}
                                >
                                    <option value="">None (Global)</option>
                                    {regions.map(r => (
                                        <option key={r.id} value={r.id}>
                                            {r.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="pt-4 flex justify-end space-x-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading || !!error}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold shadow-sm transition flex items-center disabled:opacity-50"
                        >
                            <Save size={16} className="mr-2" />
                            Saving...
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditSiteModal;
