import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Server, Globe, Search, Filter, CheckCircle, Database } from 'lucide-react';

const NetBoxWizard = ({ onClose, onImportComplete, onBack }) => {
    const [step, setStep] = useState(1);
    const [config, setConfig] = useState({ url: '', token: '', token_version: 'v1', api_key: '' });

    // ... (rest of imports/state) ...


    const [meta, setMeta] = useState({ sites: [], roles: [], types: [] });
    const [filters, setFilters] = useState({ site: '', role: '', device_type: '', search: '' });
    const [previewDevices, setPreviewDevices] = useState([]);
    const [selectedDevices, setSelectedDevices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [creds, setCreds] = useState({ username: '', password: '' });
    const [error, setError] = useState(null); // Add error state

    const handleConnect = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.post('/api/devices/plugin/netbox/action/', { action: 'connect', config });
            // Fetch metadata immediately after connect for this wizard flow
            const metaRes = await axios.post('/api/devices/plugin/netbox/action/', { action: 'metadata', config });
            setMeta(metaRes.data);
            setStep(2);
        } catch (error) {
            console.error(error);
            setError('Connection Failed: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handlePreview = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.post('/api/devices/plugin/netbox/action/', {
                action: 'preview',
                config,
                filters
            });
            setPreviewDevices(res.data.devices);
            setStep(3);
        } catch (error) {
            console.error(error);
            setError('Preview Failed: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        const toImport = previewDevices.filter(d => selectedDevices.includes(d.name));
        setLoading(true);
        setError(null);
        try {
            const res = await axios.post('/api/devices/plugin/netbox/action/', {
                action: 'import',
                devices: toImport,
                defaults: creds
            });

            const { count, errors } = res.data;
            if (errors && errors.length > 0) {
                // Keep the alert for the final report as it might be long, or move to a results step?
                // User asked for error display "during any step". 
                // A partial success/failure report is better as an alert or a distinct UI state.
                // For now, let's keep the alert for the "Import Report" but ensure "Import Failed" (network/server error) is inline.
                alert(`Imported ${count} devices.\n\n${errors.length} errors occurred:\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? '\n...' : ''}`);
            } else {
                alert(`Successfully imported ${count} devices.`);
            }

            onImportComplete();
            onClose();
        } catch (error) {
            console.error(error);
            setError('Import Failed: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const toggleDevice = (name) => {
        if (selectedDevices.includes(name)) setSelectedDevices(selectedDevices.filter(d => d !== name));
        else setSelectedDevices([...selectedDevices, name]);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center zs-50 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-3/4 max-w-4xl h-5/6 flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center">
                        <Database className="mr-2 text-blue-600" /> NetBox Import Wizard
                    </h2>
                    <div className="flex space-x-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${step >= 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>1. Connect</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${step >= 2 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>2. Filter</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${step >= 3 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>3. Select</span>
                    </div>
                </div>

                <div className="flex-1 p-8 overflow-y-auto">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm flex items-start">
                            <span className="mr-2 font-bold">Error:</span>
                            <span>{error}</span>
                        </div>
                    )}
                    {step === 1 && (
                        <div className="max-w-md mx-auto space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">NetBox URL</label>
                                <input className="w-full mt-1 p-2 border rounded" placeholder="https://netbox.example.com" value={config.url} onChange={e => setConfig({ ...config, url: e.target.value })} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Token Version</label>
                                <div className="flex space-x-4">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="tokenVersion"
                                            value="v1"
                                            checked={config.token_version === 'v1'}
                                            onChange={() => setConfig({ ...config, token_version: 'v1' })}
                                        />
                                        <span className="text-sm">v1 (Token)</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="tokenVersion"
                                            value="v2"
                                            checked={config.token_version === 'v2'}
                                            onChange={() => setConfig({ ...config, token_version: 'v2' })}
                                        />
                                        <span className="text-sm">v2 (Bearer)</span>
                                    </label>
                                </div>
                            </div>

                            {config.token_version === 'v2' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">API Key (e.g. 5TJX...)</label>
                                    <input
                                        className="w-full mt-1 p-2 border rounded font-mono text-sm"
                                        placeholder="nbt_ or key..."
                                        value={config.api_key || ''}
                                        onChange={e => setConfig({ ...config, api_key: e.target.value })}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700">API Token</label>
                                <input className="w-full mt-1 p-2 border rounded" type="password" value={config.token} onChange={e => setConfig({ ...config, token: e.target.value })} />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Site</label>
                                <select className="w-full mt-1 p-2 border rounded" onChange={e => setFilters({ ...filters, site: e.target.value })}>
                                    <option value="">All Sites</option>
                                    {meta.sites.map(s => <option key={s.id} value={s.slug}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Role</label>
                                <select className="w-full mt-1 p-2 border rounded" onChange={e => setFilters({ ...filters, role: e.target.value })}>
                                    <option value="">All Roles</option>
                                    {meta.roles.map(r => <option key={r.id} value={r.slug}>{r.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Device Type</label>
                                <select className="w-full mt-1 p-2 border rounded" onChange={e => setFilters({ ...filters, device_type: e.target.value })}>
                                    <option value="">All Types</option>
                                    {meta.types.map(t => <option key={t.id} value={t.id}>{t.model}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Search</label>
                                <input className="w-full mt-1 p-2 border rounded" placeholder="Search hostname..." onChange={e => setFilters({ ...filters, search: e.target.value })} />
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div>
                            <div className="flex justify-between mb-4">
                                <h3 className="font-bold">Found {previewDevices.length} devices with Primary IP</h3>
                                <div className="space-x-2">
                                    <input className="p-2 border rounded text-sm" placeholder="Default Username" value={creds.username} onChange={e => setCreds({ ...creds, username: e.target.value })} />
                                    <input className="p-2 border rounded text-sm" type="password" placeholder="Default Password" value={creds.password} onChange={e => setCreds({ ...creds, password: e.target.value })} />
                                </div>
                            </div>
                            <div className="border rounded overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 font-bold">
                                        <tr>
                                            <th className="p-3 w-8"><input type="checkbox" onChange={(e) => setSelectedDevices(e.target.checked ? previewDevices.map(d => d.name) : [])} /></th>
                                            <th className="p-3">Hostname</th>
                                            <th className="p-3">IP Address</th>
                                            <th className="p-3">Family</th>
                                            <th className="p-3">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {previewDevices.map((device, idx) => (
                                            <tr key={device.name} className="hover:bg-gray-50">
                                                <td className="p-3"><input type="checkbox" checked={selectedDevices.includes(device.name)} onChange={() => toggleDevice(device.name)} /></td>
                                                <td className="p-3 font-medium">{device.name}</td>
                                                <td className="p-3">{device.ip_address}</td>
                                                <td className="p-3">
                                                    <select
                                                        className="border rounded text-xs p-1 bg-white"
                                                        value={device.family || 'Switch'}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onChange={(e) => {
                                                            const newDevices = [...previewDevices];
                                                            newDevices[idx] = { ...newDevices[idx], family: e.target.value };
                                                            setPreviewDevices(newDevices);
                                                        }}
                                                    >
                                                        <option value="Switch">Switch</option>
                                                        <option value="Router">Router</option>
                                                        <option value="AP">AP</option>
                                                        <option value="WLC">WLC</option>
                                                        <option value="Firewall">Firewall</option>
                                                    </select>
                                                </td>
                                                <td className="p-3 text-gray-500 text-xs">{device.site} / {device.role} / {device.model}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 flex justify-between items-center">
                    <div className="flex items-center">
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">Cancel</button>
                    </div>

                    <div className="flex items-center gap-2">
                        {step === 3 && selectedDevices.length === 0 && (
                            <span className="text-red-500 text-sm animate-pulse mr-2">
                                Please select at least one device
                            </span>
                        )}

                        {step === 1 && onBack && <button onClick={onBack} className="px-4 py-2 border rounded hover:bg-gray-50">Back</button>}
                        {step > 1 && <button onClick={() => setStep(step - 1)} className="px-4 py-2 border rounded hover:bg-gray-50">Back</button>}

                        {step === 1 && <button onClick={handleConnect} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{loading ? 'Connecting...' : 'Next'}</button>}
                        {step === 2 && <button onClick={handlePreview} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{loading ? 'Fetching...' : 'Next'}</button>}

                        {step === 3 && (
                            <button
                                onClick={handleImport}
                                disabled={loading || selectedDevices.length === 0}
                                className={`px-4 py-2 rounded text-white transition-colors ${selectedDevices.length === 0
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-700'
                                    }`}
                            >
                                {loading ? 'Importing...' : 'Import Devices'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NetBoxWizard;
