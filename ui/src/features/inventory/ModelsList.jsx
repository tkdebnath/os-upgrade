import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { Server, CheckCircle, AlertCircle, ArrowRight, Loader, Trash2 } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { useSortableData } from '../../hooks/useSortableData';
import SortableHeader from '../../components/SortableHeader';

const ModelsList = () => {
    const [models, setModels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedModels, setSelectedModels] = useState(new Set());
    const [confirmModalData, setConfirmModalData] = useState(null);

    // Sorting
    const { sortedData: sortedModels, sortConfig, requestSort } = useSortableData(models);

    useEffect(() => {
        fetchModels();
    }, []);

    const fetchModels = async () => {
        try {
            setError(null);
            console.log('[ModelsList] Fetching models from API...');
            const res = await api.get('/api/device-models/');
            console.log('[ModelsList] API Response:', res.data);
            const modelsData = res.data.results || res.data;
            console.log('[ModelsList] Setting models:', modelsData);
            setModels(modelsData);
        } catch (error) {
            console.error("[ModelsList] Failed to fetch models", error);
            setError(error.message || "Failed to load models");
        } finally {
            setLoading(false);
        }
    };

    const toggleSelectModel = (modelId) => {
        const newSelection = new Set(selectedModels);
        if (newSelection.has(modelId)) {
            newSelection.delete(modelId);
        } else {
            newSelection.add(modelId);
        }
        setSelectedModels(newSelection);
    };

    const toggleSelectAll = () => {
        if (selectedModels.size === models.length) {
            setSelectedModels(new Set());
        } else {
            setSelectedModels(new Set(models.map(m => m.id)));
        }
    };

    const handleDeleteSelected = () => {
        const selectedModelsList = models.filter(m => selectedModels.has(m.id));
        const modelsWithDevices = selectedModelsList.filter(m => (m.device_count || 0) > 0);
        
        if (modelsWithDevices.length > 0) {
            setConfirmModalData({
                title: 'Cannot Delete Models',
                message: `${modelsWithDevices.length} selected model(s) have devices connected and cannot be deleted: ${modelsWithDevices.map(m => m.name).join(', ')}. Please remove these from your selection.`,
                confirmText: 'OK',
                onConfirm: () => setConfirmModalData(null),
                showCancel: false
            });
            return;
        }

        setConfirmModalData({
            title: 'Confirm Deletion',
            message: `Are you sure you want to delete ${selectedModels.size} model(s)? This action cannot be undone.`,
            confirmText: 'Delete',
            onConfirm: async () => {
                try {
                    await Promise.all(
                        Array.from(selectedModels).map(modelId => {
                            const model = models.find(m => m.id === modelId);
                            return api.delete(`/api/device-models/${model.name}/`);
                        })
                    );
                    setSelectedModels(new Set());
                    fetchModels();
                } catch (error) {
                    console.error('Failed to delete models', error);
                    alert('Failed to delete some models. Please try again.');
                }
                setConfirmModalData(null);
            },
            onCancel: () => setConfirmModalData(null),
            showCancel: true
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader className="animate-spin text-blue-600" size={32} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Models</h2>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button 
                        onClick={fetchModels}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="pb-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Device Models</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        View all device models and their golden image configurations
                    </p>
                </div>
                {selectedModels.size > 0 && (
                    <button
                        onClick={handleDeleteSelected}
                        className="flex items-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-semibold"
                    >
                        <Trash2 size={16} className="mr-2" />
                        Delete Selected ({selectedModels.size})
                    </button>
                )}
            </div>

            {/* Models Table */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold text-xs uppercase">
                        <tr>
                            <th className="p-4 w-10">
                                <input
                                    type="checkbox"
                                    className="rounded"
                                    checked={models.length > 0 && selectedModels.size === models.length}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <SortableHeader label="Model Name" sortKey="name" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Vendor" sortKey="vendor" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Device Count" sortKey="device_count" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Golden Image Status" sortKey="hasGoldenImage" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Golden Version" sortKey="golden_image_version" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Image File" sortKey="golden_image_file" currentSort={sortConfig} onSort={requestSort} />
                            <SortableHeader label="Image Size" sortKey="golden_image_size" currentSort={sortConfig} onSort={requestSort} />
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {sortedModels.length > 0 ? (
                            sortedModels.map(model => {
                                const hasGoldenImage = model.default_image || model.golden_image_version;
                                const deviceCount = model.device_count || 0;
                                const imageSize = model.golden_image_size 
                                    ? (model.golden_image_size / (1024 * 1024)).toFixed(2) + ' MB'
                                    : model.default_image_details?.size_bytes
                                    ? (model.default_image_details.size_bytes / (1024 * 1024)).toFixed(2) + ' MB'
                                    : 'N/A';

                                return (
                                    <tr key={model.id} className={`transition-colors ${selectedModels.has(model.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                className="rounded"
                                                checked={selectedModels.has(model.id)}
                                                onChange={() => toggleSelectModel(model.id)}
                                            />
                                        </td>
                                        <td className="p-4">
                                            <Link 
                                                to={`/models/${model.name}`}
                                                className="font-semibold text-blue-600 hover:text-blue-800 flex items-center group"
                                            >
                                                <Server size={16} className="mr-2 text-gray-400" />
                                                {model.name}
                                                <ArrowRight size={14} className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </Link>
                                        </td>
                                        <td className="p-4 text-gray-600">
                                            {model.vendor || 'Cisco'}
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                                                {deviceCount} {deviceCount === 1 ? 'device' : 'devices'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {hasGoldenImage ? (
                                                <span className="flex items-center text-green-600 text-xs font-semibold">
                                                    <CheckCircle size={14} className="mr-1" />
                                                    Configured
                                                </span>
                                            ) : (
                                                <span className="flex items-center text-orange-600 text-xs font-semibold">
                                                    <AlertCircle size={14} className="mr-1" />
                                                    Not Set
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-gray-700 font-mono text-xs">
                                            {model.default_image_details?.version || model.golden_image_version || (
                                                <span className="text-gray-400 italic">N/A</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-gray-600 font-mono text-xs truncate max-w-xs" 
                                            title={model.default_image_details?.filename || model.golden_image_file}>
                                            {model.default_image_details?.filename || model.golden_image_file || (
                                                <span className="text-gray-400 italic">No file set</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-gray-500 text-xs">
                                            {imageSize}
                                        </td>
                                        <td className="p-4 text-right">
                                            <Link
                                                to={`/models/${model.name}`}
                                                className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                                            >
                                                View Details →
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="9" className="p-8 text-center text-gray-400 italic">
                                    No device models found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="text-sm text-gray-500 mb-1">Total Models</div>
                    <div className="text-2xl font-bold text-gray-800">{models.length}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="text-sm text-gray-500 mb-1">With Golden Image</div>
                    <div className="text-2xl font-bold text-green-600">
                        {models.filter(m => m.default_image || m.golden_image_version).length}
                    </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="text-sm text-gray-500 mb-1">Not Configured</div>
                    <div className="text-2xl font-bold text-orange-600">
                        {models.filter(m => !m.default_image && !m.golden_image_version).length}
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            {confirmModalData && (
                <ConfirmModal
                    title={confirmModalData.title}
                    message={confirmModalData.message}
                    confirmText={confirmModalData.confirmText}
                    onConfirm={confirmModalData.onConfirm}
                    onCancel={confirmModalData.onCancel || (() => setConfirmModalData(null))}
                    showCancel={confirmModalData.showCancel !== undefined ? confirmModalData.showCancel : true}
                />
            )}
        </div>
    );
};

export default ModelsList;
