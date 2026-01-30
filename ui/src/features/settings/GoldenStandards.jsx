import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, AlertCircle, CheckCircle, ArrowLeft, RefreshCw, Folder, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import ConfirmModal from '../inventory/ConfirmModal';

const GoldenStandards = () => {
    const [models, setModels] = useState([]);
    const [fileServers, setFileServers] = useState([]);
    const [scannedImages, setScannedImages] = useState({}); // { modelId: [files] }
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(null); // id of model being saved
    const [scanning, setScanning] = useState(null); // id of model being scanned
    const [cleaning, setCleaning] = useState(false);
    const [confirmModalData, setConfirmModalData] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [modelsRes, serversRes] = await Promise.all([
                axios.get('/api/dcim/device-models/'),
                axios.get('/api/images/file-servers/')
            ]);
            setModels(modelsRes.data.results || modelsRes.data);
            setFileServers(serversRes.data.results || serversRes.data);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCleanup = async () => {
        setConfirmModalData({
            title: "Cleanup Unused Models",
            message: "Are you sure you want to delete all device models that are not assigned to any device?",
            confirmText: "Delete",
            isDestructive: true,
            onConfirm: async () => {
                setConfirmModalData(null);
                setCleaning(true);
                try {
                    const res = await axios.delete('/api/dcim/device-models/cleanup_unused/');
                    if (res.data.status === 'success') {
                        // alert(res.data.message); // Optional: Use toast or let UI refresh show it
                        fetchData(); // Refresh list
                    } else {
                        alert(res.data.message);
                    }
                } catch (error) {
                    console.error(error);
                    alert("Cleanup failed.");
                } finally {
                    setCleaning(false);
                }
            },
            onCancel: () => setConfirmModalData(null)
        });
    };

    const handleScan = async (model) => {
        if (!model.golden_image_path || !model.default_file_server) {
            alert("Please configure File Server and Image Path first.");
            return;
        }
        setScanning(model.id);
        try {
            const res = await axios.get(`/api/dcim/device-models/${model.name}/scan_images/`, {
                params: {
                    path: model.golden_image_path,
                    server: model.default_file_server
                }
            });
            setScannedImages(prev => ({ ...prev, [model.id]: res.data.files }));
        } catch (error) {
            console.error("Scan failed", error);
            alert("Scan failed: " + (error.response?.data?.error || error.message));
        } finally {
            setScanning(null);
        }
    };

    const handleUpdate = async (model) => {
        // Validation
        if (!model.golden_image_size || !model.golden_image_md5) {
            setConfirmModalData({
                title: "Validation Error",
                message: "Size (Bytes) and MD5 Hash are mandatory fields. Please enter them before saving.",
                confirmText: "OK",
                showCancel: false,
                onConfirm: () => setConfirmModalData(null),
                onCancel: () => setConfirmModalData(null)
            });
            return;
        }

        setSaving(model.id);
        try {
            await axios.patch(`/api/dcim/device-models/${model.name}/`, {
                golden_image_version: model.golden_image_version,
                golden_image_file: model.golden_image_file,
                golden_image_path: model.golden_image_path,
                default_file_server: model.default_file_server,
                golden_image_size: model.golden_image_size,
                golden_image_md5: model.golden_image_md5
            });

            setConfirmModalData({
                title: "Success",
                message: "Standard saved successfully.",
                confirmText: "OK",
                showCancel: false,
                onConfirm: () => setConfirmModalData(null),
                onCancel: () => setConfirmModalData(null)
            });
        } catch (error) {
            console.error(error);
            setConfirmModalData({
                title: "Error",
                message: "Failed to save standard: " + (error.response?.data?.error || error.message),
                confirmText: "OK",
                showCancel: false,
                onConfirm: () => setConfirmModalData(null),
                onCancel: () => setConfirmModalData(null)
            });
        } finally {
            setSaving(null);
        }
    };

    const handleImageSelect = (modelId, imageFilename) => {
        const fileList = scannedImages[modelId] || [];
        const selectedFile = fileList.find(f => f.filename === imageFilename);

        if (selectedFile) {
            setModels(models.map(m => m.id === modelId ? {
                ...m,
                golden_image_file: selectedFile.filename,
                golden_image_version: selectedFile.version,
                golden_image_size: selectedFile.size,
                golden_image_md5: selectedFile.md5
            } : m));
        } else if (!imageFilename) {
            setModels(models.map(m => m.id === modelId ? {
                ...m,
                golden_image_file: '',
                golden_image_version: '',
                golden_image_size: '',
                golden_image_md5: ''
            } : m));
        }
    };

    const handleChange = (id, field, value) => {
        setModels(models.map(m => m.id === id ? { ...m, [field]: value } : m));
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading standards...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                <div className="flex items-center space-x-4">
                    <Link to="/devices" className="text-gray-500 hover:text-blue-600">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Golden IOS Standards</h1>
                        <p className="text-sm text-gray-500">Set target IOS versions and image files for each switch/router model.</p>
                    </div>
                </div>
                <div>
                    <button
                        onClick={handleCleanup}
                        disabled={cleaning}
                        className="flex items-center px-4 py-2 bg-white border border-red-200 text-red-600 rounded hover:bg-red-50 text-sm font-semibold transition"
                    >
                        {cleaning ? 'Cleaning...' : <><Trash2 size={16} className="mr-2" /> Cleanup Unused Models</>}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold text-xs uppercase">
                        <tr>
                            <th className="p-4 w-48">Model Info</th>
                            <th className="p-4 w-64">Image Source Config</th>
                            <th className="p-4 w-64">Scanned Images</th>
                            <th className="p-4 w-32">Version</th>
                            <th className="p-4 w-32">Size (Bytes)</th>
                            <th className="p-4 w-48">MD5 / Filename</th>
                            <th className="p-4 w-24">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {models.map(model => (
                            <tr key={model.id} className="hover:bg-gray-50 align-top">
                                <td className="p-4 font-semibold text-gray-800">
                                    {model.name}
                                    <div className="text-xs text-gray-500 font-normal mt-1">{model.vendor}</div>
                                </td>

                                {/* Source Configuration */}
                                <td className="p-4 space-y-2">
                                    <select
                                        className="w-full border border-gray-300 rounded text-xs py-1 px-2 focus:ring-1 focus:ring-blue-500"
                                        value={model.default_file_server || ''}
                                        onChange={(e) => handleChange(model.id, 'default_file_server', e.target.value)}
                                    >
                                        <option value="">Select File Server...</option>
                                        {fileServers.map(fs => (
                                            <option key={fs.id} value={fs.id}>{fs.name}</option>
                                        ))}
                                    </select>
                                    <div className="flex space-x-1">
                                        <input
                                            type="text"
                                            className="border border-gray-300 rounded px-2 py-1 w-full focus:ring-1 focus:ring-blue-500 outline-none text-xs font-mono"
                                            placeholder="/path/to/images/"
                                            value={model.golden_image_path || ''}
                                            onChange={(e) => handleChange(model.id, 'golden_image_path', e.target.value)}
                                        />
                                        <button
                                            onClick={() => handleScan(model)}
                                            disabled={scanning === model.id}
                                            className="bg-gray-100 hover:bg-gray-200 text-gray-600 rounded p-1"
                                            title="Scan Path"
                                        >
                                            <RefreshCw size={14} className={scanning === model.id ? 'animate-spin' : ''} />
                                        </button>
                                    </div>
                                </td>

                                {/* Scanned Dropdown */}
                                <td className="p-4">
                                    <select
                                        className="border border-gray-300 rounded px-2 py-1 w-full focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                                        value={model.golden_image_file || ''}
                                        onChange={(e) => handleImageSelect(model.id, e.target.value)}
                                        disabled={!scannedImages[model.id] && !model.golden_image_file}
                                    >
                                        <option value="">{scannedImages[model.id] ? '-- Select Scanned Image --' : '-- Scan to List Images --'}</option>
                                        {(scannedImages[model.id] || (model.golden_image_file ? [{ filename: model.golden_image_file, version: model.golden_image_version }] : [])).map(img => (
                                            <option key={img.filename} value={img.filename}>
                                                {img.filename} (v{img.version})
                                            </option>
                                        ))}
                                    </select>
                                    {scannedImages[model.id] && (
                                        <div className="text-[10px] text-green-600 mt-1 flex items-center">
                                            <CheckCircle size={10} className="mr-1" /> Only showing valid images for this model
                                        </div>
                                    )}
                                </td>

                                <td className="p-4">
                                    <input
                                        type="text"
                                        className="border-transparent bg-transparent w-full text-sm focus:outline-none"
                                        value={model.golden_image_version || ''}
                                        onChange={(e) => handleChange(model.id, 'golden_image_version', e.target.value)}
                                        placeholder="ver"
                                    />
                                </td>
                                <td className="p-4">
                                    <input
                                        type="text"
                                        className="border border-gray-200 rounded px-1 w-full text-xs font-mono focus:outline-none focus:border-blue-500"
                                        value={model.golden_image_size || ''}
                                        onChange={(e) => handleChange(model.id, 'golden_image_size', e.target.value)}
                                        placeholder="Bytes"
                                    />
                                </td>
                                <td className="p-4 text-gray-500 text-xs font-mono break-all space-y-1">
                                    <div className="font-semibold text-gray-800">{model.golden_image_file || '-'}</div>
                                    <input
                                        type="text"
                                        className="border border-gray-200 rounded px-1 w-full text-[10px] font-mono focus:outline-none focus:border-blue-500 placeholder-gray-300"
                                        value={model.golden_image_md5 || ''}
                                        onChange={(e) => handleChange(model.id, 'golden_image_md5', e.target.value)}
                                        placeholder="MD5 Hash"
                                    />
                                </td>
                                <td className="p-4">
                                    <button
                                        onClick={() => handleUpdate(model)}
                                        disabled={saving === model.id}
                                        className={`flex items-center px-3 py-1 rounded text-xs font-semibold ${saving === model.id ? 'bg-gray-100 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                    >
                                        {saving === model.id ? 'Saving...' : <><Save size={14} className="mr-1" /> Save</>}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {
                confirmModalData && (
                    <ConfirmModal
                        title={confirmModalData.title}
                        message={confirmModalData.message}
                        confirmText={confirmModalData.confirmText}
                        isDestructive={confirmModalData.isDestructive}
                        onConfirm={confirmModalData.onConfirm}
                        onCancel={() => setConfirmModalData(null)}
                    />
                )
            }
        </div>
    );
};

export default GoldenStandards;
