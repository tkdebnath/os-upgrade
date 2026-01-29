import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Map, Edit2, Search, CheckSquare, Square } from 'lucide-react';
import { useSortableData } from '../../hooks/useSortableData';
import SortableHeader from '../../components/SortableHeader';
import { useAuth } from '../../context/AuthContext';

const SitesList = () => {
    const { user } = useAuth();
    const can = (perm) => {
        if (!user) return false;
        return user.is_superuser || (user.permissions && user.permissions.includes(perm));
    };
    
    const [sites, setSites] = useState([]);
    const [regions, setRegions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSites, setSelectedSites] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Bulk Edit State
    const [showBulkEdit, setShowBulkEdit] = useState(false);
    const [selectedRegion, setSelectedRegion] = useState(''); // ID

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [sitesRes, regionsRes] = await Promise.all([
                axios.get('/api/dcim/sites/'),
                axios.get('/api/dcim/regions/')
            ]);
            setSites(sitesRes.data.results || sitesRes.data);
            setRegions(regionsRes.data.results || regionsRes.data);
        } catch (error) {
            console.error("Failed to fetch sites", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (id) => {
        if (selectedSites.includes(id)) {
            setSelectedSites(selectedSites.filter(s => s !== id));
        } else {
            setSelectedSites([...selectedSites, id]);
        }
    };

    const toggleSelectAll = () => {
        if (selectedSites.length === filteredSites.length) {
            setSelectedSites([]); // Deselect all
        } else {
            setSelectedSites(filteredSites.map(s => s.id));
        }
    };

    const handleBulkUpdate = async () => {
        if (!selectedRegion) return;

        try {
            const promises = selectedSites.map(siteId =>
                axios.patch(`/api/dcim/sites/${siteId}/`, { region: selectedRegion })
            );
            await Promise.all(promises);

            fetchData();
            setShowBulkEdit(false);
            setSelectedSites([]);
            setSelectedRegion('');
        } catch (error) {
            alert("Failed to update regions.");
            console.error(error);
        }
    };

    const preFilteredSites = sites.filter(site =>
        site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (site.region_details?.name || 'Unassigned').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const { items: filteredSites, requestSort, sortConfig } = useSortableData(preFilteredSites);

    const getRegionName = (id) => {
        const reg = regions.find(r => r.id === id);
        return reg ? reg.name : 'Unassigned';
    };

    if (loading) return <div className="p-8 text-gray-500">Loading sites...</div>;

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <Map className="mr-3 text-blue-600" /> Sites
                    </h1>
                    <p className="text-gray-500 text-sm">Manage sites and their region assignments.</p>
                </div>
                <div className="flex space-x-2">
                    {selectedSites.length > 0 && can('devices.change_site') && (
                        <button
                            onClick={() => setShowBulkEdit(true)}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition"
                        >
                            <Edit2 size={16} className="mr-2" />
                            Assign Region ({selectedSites.length})
                        </button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center space-x-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search sites or regions..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase font-semibold">
                        <tr>
                            <th className="p-4 w-12">
                                <button onClick={toggleSelectAll} className="text-gray-500 hover:text-blue-600">
                                    {filteredSites.length > 0 && selectedSites.length === filteredSites.length ?
                                        <CheckSquare size={20} className="text-blue-600" /> :
                                        <Square size={20} />
                                    }
                                </button>
                            </th>
                            <SortableHeader label="Site Name" sortKey="name" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Region" sortKey="region_details.name" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Devices" sortKey="device_count" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Site ID" sortKey="id" currentSort={sortConfig} onSort={requestSort} />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredSites.length === 0 ? (
                            <tr><td colSpan="5" className="p-8 text-center text-gray-500 italic">No sites found.</td></tr>
                        ) : (
                            filteredSites.map(site => (
                                <tr key={site.id} className={`hover:bg-blue-50 transition ${selectedSites.includes(site.id) ? 'bg-blue-50' : ''}`}>
                                    <td className="p-4">
                                        <button onClick={() => toggleSelect(site.id)} className="text-gray-400 hover:text-blue-600">
                                            {selectedSites.includes(site.id) ?
                                                <CheckSquare size={20} className="text-blue-600" /> :
                                                <Square size={20} />
                                            }
                                        </button>
                                    </td>
                                    <td className="p-4 font-medium text-gray-800">
                                        <Link to={`/sites/${site.id}`} className="hover:text-blue-600 hover:underline">
                                            {site.name}
                                        </Link>
                                    </td>
                                    <td className="p-4">
                                        {site.region ? (
                                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-semibold">
                                                {getRegionName(site.region)}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 italic">Unassigned</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-mono">
                                            {site.device_count || 0}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-400 font-mono text-xs">{site.id}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Bulk Edit Modal */}
            {showBulkEdit && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95">
                        <h3 className="text-lg font-bold mb-4">Assign Region</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Assigning <span className="font-bold text-gray-800">{selectedSites.length}</span> sites to a new region.
                        </p>

                        <div className="mb-6">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Select Region</label>
                            <select
                                className="w-full border rounded p-2 text-sm bg-white"
                                value={selectedRegion}
                                onChange={e => setSelectedRegion(e.target.value)}
                            >
                                <option value="">Select a region...</option>
                                {regions.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setShowBulkEdit(false)} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                            <button
                                onClick={handleBulkUpdate}
                                disabled={!selectedRegion}
                                className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SitesList;
