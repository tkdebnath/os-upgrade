import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Server, AlertCircle, CheckCircle } from 'lucide-react';

const ModelDetail = () => {
    const { id } = useParams(); // id is the model name
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDevices = async () => {
            try {
                const res = await axios.get('/api/devices/');
                const allDevices = res.data.results || res.data;
                // Filter for this model
                const modelDevices = allDevices.filter(d => d.model === id);
                setDevices(modelDevices);
            } catch (error) {
                console.error("Failed to fetch devices", error);
            } finally {
                setLoading(false);
            }
        };
        fetchDevices();
    }, [id]);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading model details...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
                <Link to="/devices" className="text-gray-500 hover:text-blue-600">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{id}</h1>
                    <p className="text-sm text-gray-500">{devices.length} Devices of this model</p>
                </div>
            </div>

            {/* Device List Table (Simplified) */}
            <div className="bg-white rounded border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold text-xs uppercase">
                        <tr>
                            <th className="p-4">Device Name</th>
                            <th className="p-4">IP Address</th>
                            <th className="p-4">Site</th>
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
                                <td className="p-4 text-gray-600">{dev.site || 'Global'}</td>
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
                                <td colSpan="4" className="p-8 text-center text-gray-500">No devices found for this model.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ModelDetail;
