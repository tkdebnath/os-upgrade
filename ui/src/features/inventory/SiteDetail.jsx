import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Server, AlertCircle, CheckCircle, Edit, Globe } from 'lucide-react';
import EditSiteModal from './EditSiteModal';

const SiteDetail = () => {
    const { id } = useParams(); // id is the site name
    const [devices, setDevices] = useState([]);
    const [siteObj, setSiteObj] = useState(null);
    const [fileServers, setFileServers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);

    const fetchData = async () => {
        try {
            // Parallel fetch: Devices, Sites (to find this site object), FileServers (for name resolution)
            const [devRes, sitesRes, fsRes] = await Promise.all([
                axios.get('/api/devices/'),
                axios.get('/api/sites/'),
                axios.get('/api/file-servers/')
            ]);

            // Devices
            const allDevices = devRes.data.results || devRes.data;
            const siteDevices = allDevices.filter(d => (d.site || 'Global') === id);
            setDevices(siteDevices);

            // Site Object
            const allSites = sitesRes.data.results || sitesRes.data;
            const foundSite = allSites.find(s => s.name === id);
            setSiteObj(foundSite || { name: id, preferred_file_server: null }); // Fallback if not found (e.g. Global/Virtual)

            // File Servers
            setFileServers(fsRes.data.results || fsRes.data);

        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading site details...</div>;

    const reachableCount = devices.filter(d => d.reachability !== 'Unreachable').length;

    const getFSName = (fsId) => {
        if (!fsId) return 'Default (Global)';
        const fs = fileServers.find(f => f.id === fsId);
        return fs ? fs.name : 'Unknown';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
                <Link to="/devices" className="text-gray-500 hover:text-blue-600">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <Globe className="mr-2 text-blue-600" size={24} />
                        {id} Site
                    </h1>
                    <div className="flex items-center text-sm text-gray-500 space-x-4 mt-1">
                        <span>{devices.length} Devices • {reachableCount} Reachable</span>
                        {/* Preferred FS Display */}
                        {siteObj && siteObj.id && (
                            <span className="flex items-center bg-blue-50 text-blue-800 px-2 py-0.5 rounded text-xs font-semibold border border-blue-100">
                                Preferred FS: {getFSName(siteObj.preferred_file_server)}
                            </span>
                        )}
                    </div>
                </div>
                <div className="ml-auto">
                    {siteObj && siteObj.id && (
                        <button
                            onClick={() => setShowEditModal(true)}
                            className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-semibold text-gray-700 transition"
                        >
                            <Edit size={14} className="mr-2" /> Edit Site
                        </button>
                    )}
                </div>
            </div>

            {/* Device List Table (Simplified) */}
            <div className="bg-white rounded border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold text-xs uppercase">
                        <tr>
                            <th className="p-4">Device Name</th>
                            <th className="p-4">IP Address</th>
                            <th className="p-4">Model</th>
                            <th className="p-4">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {devices.map(dev => (
                            <tr key={dev.id} className="hover:bg-blue-50/50 transition">
                                <td className="p-4 font-semibold text-blue-600">
                                    <Link to={`/devices/${dev.id}`} className="hover:underline flex items-center">
                                        <Server size={16} className="mr-2 text-gray-400" />
                                        {dev.hostname}
                                    </Link>
                                </td>
                                <td className="p-4 text-gray-600 font-mono text-xs">{dev.ip_address}</td>
                                <td className="p-4 text-gray-600">{dev.model}</td>
                                <td className="p-4">
                                    <div className={`flex items-center text-xs font-medium ${dev.reachability === 'Unreachable' ? 'text-red-500' : 'text-green-600'}`}>
                                        {dev.reachability === 'Unreachable' ? <AlertCircle size={14} className="mr-1" /> : <CheckCircle size={14} className="mr-1" />}
                                        {dev.reachability === 'Unreachable' ? 'Unreachable' : 'Reachable'}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {devices.length === 0 && (
                            <tr>
                                <td colSpan="4" className="p-8 text-center text-gray-500">No devices found in this site.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showEditModal && (
                <EditSiteModal
                    siteName={id}
                    onClose={() => setShowEditModal(false)}
                    onSuccess={fetchData}
                />
            )}
        </div>
    );
};

export default SiteDetail;
