import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Server, CheckCircle, Globe, Plus, Trash2, Edit } from 'lucide-react';

const ImageRepo = () => {
    const [fileServers, setFileServers] = useState([]);
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [fsRes, imgRes] = await Promise.all([
                axios.get('/api/images/file-servers/'),
                axios.get('/api/images/images/')
            ]);
            setFileServers(fsRes.data.results || fsRes.data);
            setImages(imgRes.data.results || imgRes.data);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSetDefault = async (id) => {
        try {
            // Optimistic Update
            const updatedServers = fileServers.map(fs => ({
                ...fs,
                is_global_default: fs.id === id
            }));
            setFileServers(updatedServers);

            // In a real app we might need a specific endpoint to "set default" which handles the exclusion of others,
            // or we iterate and update. Backend logic for "single default" might be needed.
            // For now, let's assume we patch the target to True. 
            // Ideally the backend ensures only one is True.
            // Let's iterate and patch relevant ones or just patch the new Default.

            // NOTE: Simplest way: First patch all to false (inefficient) or assume backend handles it?
            // Let's assume we need to patch the new one to True, and the backend might not auto-unset others unless we added that logic.
            // I didn't add logic to auto-unset others in models.save(). So I should do it here or backend view.

            // Let's do it simply: 
            // 1. Unset current default
            const currentDefault = fileServers.find(fs => fs.is_global_default);
            if (currentDefault && currentDefault.id !== id) {
                await axios.patch(`/api/images/file-servers/${currentDefault.id}/`, { is_global_default: false });
            }
            // 2. Set new default
            await axios.patch(`/api/images/file-servers/${id}/`, { is_global_default: true });

            fetchData(); // Refresh to be sure
        } catch (error) {
            console.error("Failed to set default", error);
            alert("Failed to set global default");
            fetchData(); // Revert
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">IOS Image Repository</h1>

            {/* File Servers Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold flex items-center">
                        <Server className="mr-2 text-blue-600" /> File Servers
                    </h2>
                    {/* Add Server button removed as per user request (managed in System Settings) */}
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {fileServers.map(fs => (
                        <div key={fs.id} className={`border rounded-lg p-4 relative ${fs.is_global_default ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                            {fs.is_global_default && (
                                <div className="absolute top-2 right-2 flex items-center text-green-700 text-xs font-bold bg-white px-2 py-1 rounded-full border border-green-200">
                                    <Globe size={12} className="mr-1" /> Global Default
                                </div>
                            )}

                            <h3 className="font-bold text-gray-800">{fs.name}</h3>
                            <p className="text-sm text-gray-500 mt-1 font-mono">{fs.protocol}://{fs.address}</p>
                            <p className="text-xs text-gray-400 mt-1">{fs.city || 'No Region Identified'}</p>

                            <div className="mt-4 flex space-x-2">
                                {!fs.is_global_default && (
                                    <button
                                        onClick={() => handleSetDefault(fs.id)}
                                        className="text-xs text-blue-600 hover:underline"
                                    >
                                        Set as Global Default
                                    </button>
                                )}
                                <button className="text-xs text-gray-500 hover:text-gray-700">Edit</button>
                            </div>
                        </div>
                    ))}

                    {fileServers.length === 0 && !loading && (
                        <p className="text-gray-500 text-sm italic col-span-3">No file servers configured.</p>
                    )}
                </div>
            </div>

            {/* Images Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold flex items-center">
                        <HardDriveIcon /> Software Images
                    </h2>
                    <button className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200 flex items-center">
                        Upload Image
                    </button>
                </div>
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 font-bold border-b">
                        <tr>
                            <th className="py-2 px-3">Filename</th>
                            <th className="py-2 px-3">Version</th>
                            <th className="py-2 px-3">Size</th>
                            <th className="py-2 px-3">File Server</th>
                            <th className="py-2 px-3">Remote Path</th>
                        </tr>
                    </thead>
                    <tbody>
                        {images.map(img => (
                            <tr key={img.id} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="py-2 px-3 font-mono text-xs">{img.filename}</td>
                                <td className="py-2 px-3">{img.version}</td>
                                <td className="py-2 px-3 text-gray-500">{(img.size_bytes / 1024 / 1024).toFixed(1)} MB</td>
                                <td className="py-2 px-3 text-gray-500">
                                    {img.file_server ? (
                                        <span className="flex items-center">
                                            <Server size={12} className="mr-1 text-blue-500" />
                                            {fileServers.find(fs => fs.id === img.file_server)?.name || 'Remote Server'}
                                        </span>
                                    ) : img.is_remote ? (
                                        <span className="flex items-center text-orange-500">
                                            <Server size={12} className="mr-1" />
                                            Remote (No Server Assigned)
                                        </span>
                                    ) : (
                                        <span className="flex items-center text-gray-400">
                                            <Server size={12} className="mr-1" />
                                            Not Configured
                                        </span>
                                    )}
                                </td>
                                <td className="py-2 px-3 font-mono text-xs text-gray-500">
                                    {img.remote_path || <span className="text-gray-400 italic">-</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const HardDriveIcon = (props) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mr-2 text-purple-600"
        {...props}
    >
        <line x1="22" y1="12" x2="2" y2="12"></line>
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
        <line x1="6" y1="16" x2="6.01" y2="16"></line>
        <line x1="10" y1="16" x2="10.01" y2="16"></line>
    </svg>
);

export default ImageRepo;
