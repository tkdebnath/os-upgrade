import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Server, AlertCircle, CheckCircle, Upload, Trash, Star, HardDrive, Plus, X, Edit2 } from 'lucide-react';

const ModelDetail = () => {
    const { id } = useParams(); // id is the model name
    const [model, setModel] = useState(null);
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('images'); // 'images' or 'devices'

    // Scan Settings State
    const [scanPath, setScanPath] = useState('');
    const [isEditingPath, setIsEditingPath] = useState(false);

    // Add Image Form State
    const [showAddForm, setShowAddForm] = useState(false);
    const [newImage, setNewImage] = useState({
        version: '',
        filename: '',
        size_bytes: '',
        md5_checksum: ''
    });

    // Edit Image State
    const [editingImage, setEditingImage] = useState(null);
    const [editForm, setEditForm] = useState({
        version: '',
        filename: '',
        size_bytes: '',
        md5_checksum: ''
    });

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            const [modelRes, devRes] = await Promise.all([
                axios.get(`/api/device-models/${id}/`).catch(e => null), // Graceful fail if not exist yet
                axios.get('/api/devices/')
            ]);

            if (modelRes && modelRes.data) {
                setModel(modelRes.data);
                setScanPath(modelRes.data.golden_image_path || '');
            }

            const allDevices = devRes.data.results || devRes.data;
            const modelDevices = allDevices.filter(d => d.model === id);
            setDevices(modelDevices);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddImage = async (e) => {
        e.preventDefault();
        try {
            // 1. Create Image
            const imgPayload = {
                version: newImage.version,
                filename: newImage.filename,
                size_bytes: parseInt(newImage.size_bytes),
                md5_checksum: newImage.md5_checksum,
                // uploaded_at is auto
            };
            const imgRes = await axios.post('/api/images/', imgPayload);
            const imageId = imgRes.data.id;

            // 2. Link to Model
            if (model) {
                await axios.patch(`/api/device-models/${model.name}/`, {
                    supported_images: [...(model.supported_images || []), imageId]
                });
            }

            setShowAddForm(false);
            setNewImage({ version: '', filename: '', size_bytes: '', md5_checksum: '' });
            fetchData();
            alert("Image added successfully");
        } catch (error) {
            console.error(error);
            alert("Failed to add image. Ensure filename is unique.");
        }
    };

    const handleSetDefault = async (imageId) => {
        if (!model) return;
        try {
            await axios.patch(`/api/device-models/${model.name}/`, {
                default_image: imageId
            });
            fetchData();
        } catch (error) {
            console.error(error);
            alert("Failed to set default image.");
        }
    };

    const handleRemoveSupported = async (imageId) => {
        if (!model) return;
        if (!confirm("Are you sure you want to remove this image from supported list?")) return;
        try {
            const newSupported = model.supported_images.filter(id => id !== imageId);
            await axios.patch(`/api/device-models/${model.name}/`, {
                supported_images: newSupported
            });
            fetchData();
        } catch (error) {
            console.error(error);
            alert("Failed to remove image.");
        }
    };

    const handleUpdateImage = async (e) => {
        e.preventDefault();
        try {
            await axios.patch(`/api/images/${editingImage}/`, {
                version: editForm.version,
                filename: editForm.filename,
                size_bytes: parseInt(editForm.size_bytes),
                md5_checksum: editForm.md5_checksum
            });
            setEditingImage(null);
            fetchData();
            alert("Image updated successfully");
        } catch (error) {
            console.error(error);
            alert("Failed to update image. Ensure filename is unique.");
        }
    };

    const startEditImage = (img) => {
        setEditingImage(img.id);
        setEditForm({
            version: img.version,
            filename: img.filename,
            size_bytes: img.size_bytes,
            md5_checksum: img.md5_checksum || ''
        });
    };

    const handleUpdatePath = async () => {
        if (!model) return;
        try {
            await axios.patch(`/api/device-models/${model.name}/`, {
                golden_image_path: scanPath
            });
            setIsEditingPath(false);
            fetchData();
        } catch (error) {
            console.error("Failed to update path", error);
            alert("Failed to update image path.");
        }
    };

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
                    <p className="text-sm text-gray-500 flex items-center space-x-4">
                        <span className="flex items-center"><Server size={14} className="mr-1" /> {model?.vendor || 'Cisco'}</span>
                        <span className="flex items-center"><HardDrive size={14} className="mr-1" /> {devices.length} Devices</span>
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-4 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('images')}
                    className={`pb-2 px-1 text-sm font-medium ${activeTab === 'images' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Software Images
                </button>
                <button
                    onClick={() => setActiveTab('devices')}
                    className={`pb-2 px-1 text-sm font-medium ${activeTab === 'devices' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Associated Devices
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'images' && (
                <div className="space-y-6">
                    {/* Scan Settings */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xs font-bold text-gray-500 uppercase">Image Scan Settings</h3>
                            {!isEditingPath ? (
                                <button onClick={() => setIsEditingPath(true)} className="text-blue-600 text-xs font-semibold hover:underline">Edit</button>
                            ) : (
                                <div className="flex space-x-2">
                                    <button onClick={handleUpdatePath} className="text-green-600 text-xs font-bold hover:underline">Save</button>
                                    <button onClick={() => { setIsEditingPath(false); setScanPath(model?.golden_image_path || ''); }} className="text-gray-500 text-xs font-semibold hover:underline">Cancel</button>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-700">Scan Path:</span>
                            {isEditingPath ? (
                                <input
                                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm font-mono"
                                    value={scanPath}
                                    onChange={e => setScanPath(e.target.value)}
                                    placeholder="/Cisco/C9300/"
                                />
                            ) : (
                                <span className="font-mono text-sm text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">{model?.golden_image_path || 'Not Configured'}</span>
                            )}
                        </div>
                    </div>

                    {/* Golden Image Card */}
                    <div className="bg-gradient-to-r from-blue-50 to-white p-6 rounded-lg border border-blue-100 shadow-sm">
                        <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center">
                            <Star className="mr-2 text-yellow-500 fill-current" size={18} /> Official Golden Image
                        </h3>
                        {model?.default_image_details ? (
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-lg font-bold text-gray-800">{model.default_image_details.version}</div>
                                    <div className="text-sm text-gray-600 font-mono mt-1">{model.default_image_details.filename}</div>
                                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                        <span>Size: {(model.default_image_details.size_bytes / (1024 * 1024)).toFixed(2)} MB</span>
                                        <span className="font-mono">MD5: {model.default_image_details.md5_checksum}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleSetDefault(null)}
                                    className="px-3 py-1 bg-white border border-red-200 text-red-600 rounded text-xs hover:bg-red-50"
                                >
                                    Unset Default
                                </button>
                            </div>
                        ) : model?.golden_image_file ? (
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-lg font-bold text-gray-800">{model.golden_image_version || 'Unknown Ver'} <span className="text-xs font-normal text-gray-500 ml-2">(Legacy Config)</span></div>
                                    <div className="text-sm text-gray-600 font-mono mt-1">{model.golden_image_file}</div>
                                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                        {model.golden_image_size && <span>Size: {(model.golden_image_size / (1024 * 1024)).toFixed(2)} MB</span>}
                                        {model.golden_image_md5 && <span className="font-mono">MD5: {model.golden_image_md5}</span>}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500 italic">No Golden Image assigned. Identify a supported image below to set as default.</div>
                        )}
                    </div>

                    {/* Supported Images List */}
                    <div className="bg-white rounded border border-gray-200 shadow-sm">
                        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-700">Supported Images</h3>
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700"
                            >
                                <Plus size={14} className="mr-1" /> Add New Image
                            </button>
                        </div>

                        {/* Inline Add Form */}
                        {showAddForm && (
                            <form onSubmit={handleAddImage} className="p-4 bg-blue-50 border-b border-blue-100">
                                <div className="grid grid-cols-5 gap-4 items-end">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">Version</label>
                                        <input
                                            required
                                            className="w-full border rounded p-1.5 text-sm"
                                            placeholder="17.9.4a"
                                            value={newImage.version}
                                            onChange={e => setNewImage({ ...newImage, version: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-gray-600 mb-1">Filename</label>
                                        <input
                                            required
                                            className="w-full border rounded p-1.5 text-sm"
                                            placeholder="cat9k_iosxe.17.09.04a.SPA.bin"
                                            value={newImage.filename}
                                            onChange={e => setNewImage({ ...newImage, filename: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">Size (Bytes)</label>
                                        <input
                                            required
                                            type="number"
                                            className="w-full border rounded p-1.5 text-sm"
                                            placeholder="1024000"
                                            value={newImage.size_bytes}
                                            onChange={e => setNewImage({ ...newImage, size_bytes: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex space-x-2">
                                        <button type="submit" className="flex-1 bg-green-600 text-white rounded p-1.5 text-xs font-bold hover:bg-green-700">Save</button>
                                        <button type="button" onClick={() => setShowAddForm(false)} className="bg-gray-200 text-gray-600 rounded p-1.5 hover:bg-gray-300">
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <label className="block text-xs font-bold text-gray-600 mb-1">MD5 Checksum</label>
                                    <input
                                        required
                                        className="w-full border rounded p-1.5 text-sm font-mono"
                                        placeholder="a1s2d3f4..."
                                        value={newImage.md5_checksum}
                                        onChange={e => setNewImage({ ...newImage, md5_checksum: e.target.value })}
                                    />
                                </div>
                            </form>
                        )}

                        <table className="w-full text-left text-sm">
                            <thead className="bg-white border-b border-gray-200 text-gray-500 font-bold text-xs uppercase">
                                <tr>
                                    <th className="p-3">Version</th>
                                    <th className="p-3">Filename</th>
                                    <th className="p-3">Size</th>
                                    <th className="p-3">MD5 Checksum</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {model?.supported_images_details?.length > 0 ? (
                                    model.supported_images_details.map(img => (
                                        <React.Fragment key={img.id}>
                                            {editingImage === img.id ? (
                                                <tr className="bg-blue-50">
                                                    <td colSpan="5" className="p-4">
                                                        <form onSubmit={handleUpdateImage} className="space-y-3">
                                                            <div className="grid grid-cols-4 gap-4">
                                                                <div>
                                                                    <label className="block text-xs font-bold text-gray-600 mb-1">Version</label>
                                                                    <input
                                                                        required
                                                                        className="w-full border rounded p-1.5 text-sm"
                                                                        value={editForm.version}
                                                                        onChange={e => setEditForm({ ...editForm, version: e.target.value })}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-bold text-gray-600 mb-1">Filename</label>
                                                                    <input
                                                                        required
                                                                        className="w-full border rounded p-1.5 text-sm"
                                                                        value={editForm.filename}
                                                                        onChange={e => setEditForm({ ...editForm, filename: e.target.value })}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-bold text-gray-600 mb-1">Size (Bytes)</label>
                                                                    <input
                                                                        required
                                                                        type="number"
                                                                        className="w-full border rounded p-1.5 text-sm"
                                                                        value={editForm.size_bytes}
                                                                        onChange={e => setEditForm({ ...editForm, size_bytes: e.target.value })}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-bold text-gray-600 mb-1">MD5 Checksum</label>
                                                                    <input
                                                                        className="w-full border rounded p-1.5 text-sm font-mono"
                                                                        value={editForm.md5_checksum}
                                                                        onChange={e => setEditForm({ ...editForm, md5_checksum: e.target.value })}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex space-x-2">
                                                                <button type="submit" className="px-4 py-1.5 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700">
                                                                    Save Changes
                                                                </button>
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => setEditingImage(null)}
                                                                    className="px-4 py-1.5 bg-gray-200 text-gray-600 rounded text-xs font-bold hover:bg-gray-300"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </form>
                                                    </td>
                                                </tr>
                                            ) : (
                                                <tr className="hover:bg-gray-50">
                                                    <td className="p-3 font-medium text-gray-800">
                                                        {img.version}
                                                        {model.default_image === img.id && (
                                                            <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full font-bold">Default</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-gray-600 font-mono text-xs">{img.filename}</td>
                                                    <td className="p-3 text-gray-500">{img.size_bytes > 0 ? (img.size_bytes / (1024 * 1024)).toFixed(2) + ' MB' : 'N/A'}</td>
                                                    <td className="p-3 text-gray-400 font-mono text-xs truncate max-w-xs" title={img.md5_checksum}>{img.md5_checksum || 'N/A'}</td>
                                                    <td className="p-3 text-right flex justify-end space-x-2">
                                                        <button
                                                            onClick={() => startEditImage(img)}
                                                            className="text-blue-600 hover:text-blue-700"
                                                            title="Edit Image"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        {model.default_image !== img.id && (
                                                            <button
                                                                onClick={() => handleSetDefault(img.id)}
                                                                className="text-yellow-600 hover:text-yellow-700 text-xs font-semibold flex items-center"
                                                                title="Set as Default (Golden)"
                                                            >
                                                                <Star size={14} className="mr-1" /> Make Golden
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleRemoveSupported(img.id)}
                                                            className="text-red-400 hover:text-red-600"
                                                            title="Remove"
                                                        >
                                                            <Trash size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="p-8 text-center text-gray-400 italic">No supported images added yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'devices' && (
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
            )}
        </div>
    );
};

export default ModelDetail;
