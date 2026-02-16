import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Shield, AlertTriangle, CheckCircle, Server, Loader } from 'lucide-react';

const SupportedModels = () => {
    const [supportedModels, setSupportedModels] = useState([]);
    const [unsupportedDevices, setUnsupportedDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setError(null);
            const [modelsRes, complianceRes] = await Promise.all([
                api.get('/api/core/dashboard/supported_models/'),
                api.get('/api/core/dashboard/device_compliance/')
            ]);
            
            setSupportedModels(modelsRes.data.supported_models || []);
            setUnsupportedDevices(complianceRes.data.unsupported_devices || []);
        } catch (err) {
            console.error('Failed to fetch data', err);
            setError('Failed to load supported models data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-800">
                <AlertTriangle className="h-5 w-5 inline mr-2" />
                {error}
            </div>
        );
    }

    // Group models by category
    const catalystModels = supportedModels.filter(m => m.toLowerCase().includes('catalyst') || m.startsWith('C'));
    const nexusModels = supportedModels.filter(m => m.toLowerCase().includes('nexus') || m.startsWith('N'));
    const asrModels = supportedModels.filter(m => m.toLowerCase().includes('asr'));

    const ModelCard = ({ title, models, icon: Icon }) => (
        <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center">
                <Icon className="h-5 w-5 text-blue-600 mr-2" />
                <h3 className="font-semibold text-gray-700">{title}</h3>
                <span className="ml-auto bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                    {models.length}
                </span>
            </div>
            <div className="p-4">
                {models.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {models.map(model => (
                            <span
                                key={model}
                                className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-green-50 text-green-700 border border-green-200"
                            >
                                <CheckCircle className="h-4 w-4 mr-1.5" />
                                {model}
                            </span>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-sm">No models in this category</p>
                )}
            </div>
        </div>
    );

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <Shield className="h-8 w-8 text-blue-600 mr-3" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Supported Device Models</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Only these models can have upgrade jobs created or executed
                        </p>
                    </div>
                </div>
                <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                    <span className="text-2xl font-bold text-blue-700">{supportedModels.length}</span>
                    <span className="text-sm text-blue-600 ml-2">Total Supported</span>
                </div>
            </div>

            {/* Unsupported Devices Alert */}
            {unsupportedDevices.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                        <AlertTriangle className="h-6 w-6 text-red-600 mr-2" />
                        <h2 className="text-lg font-semibold text-red-800">
                            Unsupported Devices ({unsupportedDevices.length})
                        </h2>
                    </div>
                    <p className="text-sm text-red-700 mb-4">
                        The following devices have models that are not in the supported list and cannot have upgrade jobs created:
                    </p>
                    <div className="bg-white rounded-md border border-red-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-red-200">
                            <thead className="bg-red-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-red-700 uppercase">Hostname</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-red-700 uppercase">Model</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-red-200">
                                {unsupportedDevices.map((device) => (
                                    <tr key={device.id} className="hover:bg-red-50">
                                        <td className="px-4 py-2 text-sm text-gray-900">{device.hostname}</td>
                                        <td className="px-4 py-2 text-sm text-gray-600">{device.model__name || 'Unknown'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Supported Models by Category */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ModelCard 
                    title="Catalyst Switches" 
                    models={catalystModels} 
                    icon={Server}
                />
                <ModelCard 
                    title="Nexus Switches" 
                    models={nexusModels} 
                    icon={Server}
                />
                <ModelCard 
                    title="ASR Routers" 
                    models={asrModels} 
                    icon={Server}
                />
            </div>

            {/* All Models List */}
            <div className="bg-white rounded-lg shadow border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-semibold text-gray-700">All Supported Models</h3>
                </div>
                <div className="p-4">
                    <div className="flex flex-wrap gap-2">
                        {supportedModels.map(model => (
                            <span
                                key={model}
                                className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 border border-gray-300"
                            >
                                {model}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                    <strong>Note:</strong> The supported device models list is configured in 
                    <code className="mx-1 px-1 py-0.5 bg-blue-100 rounded">env/supported_models.env</code> 
                    file. Only devices with models in this list can have upgrade jobs created or executed.
                </p>
            </div>
        </div>
    );
};

export default SupportedModels;
