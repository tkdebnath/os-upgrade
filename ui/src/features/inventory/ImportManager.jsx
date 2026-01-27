import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, Database, FileText, X, ChevronRight } from 'lucide-react';
import NetBoxWizard from './NetBoxWizard';

const ImportManager = ({ onImportSuccess }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState('select'); // 'select', 'csv', 'plugin'
    const [pluginId, setPluginId] = useState(null);
    const [plugins, setPlugins] = useState([]);

    // CSV State
    const [csvFile, setCsvFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);

    useEffect(() => {
        fetchPlugins();
    }, []);

    const fetchPlugins = async () => {
        try {
            const res = await axios.get('/api/devices/list_plugins/');
            setPlugins(res.data);
        } catch (error) {
            console.error("Failed to fetch plugins", error);
        }
    };

    const handlePluginSelect = (id) => {
        setPluginId(id);
        setStep('plugin');
    };

    const close = () => {
        setIsOpen(false);
        setStep('select');
        setPluginId(null);
        setCsvFile(null);
        setImportResult(null);
    };

    const handleCsvUpload = async () => {
        if (!csvFile) return;
        setImporting(true);
        const formData = new FormData();
        formData.append('file', csvFile);

        try {
            const res = await axios.post('/api/devices/import_csv/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setImportResult(res.data);
            if (onImportSuccess) onImportSuccess();
            setTimeout(() => {
                close();
            }, 2000);
        } catch (error) {
            console.error(error);
            setImportResult({ error: "Import failed. Check CSV format." });
        } finally {
            setImporting(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="text-blue-600 text-sm font-semibold hover:underline flex items-center bg-blue-50 px-3 py-2 rounded border border-blue-200"
            >
                <Upload size={16} className="mr-2" /> Import Devices
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden">
                        {/* Header */}
                        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
                            <h2 className="text-lg font-bold text-gray-800">
                                {step === 'select' && "Import Inventory"}
                                {step === 'csv' && "Import from CSV"}
                                {step === 'plugin' && `Import from ${plugins.find(p => p.id === pluginId)?.name || 'Source'}`}
                            </h2>
                            <button onClick={close} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6">

                            {/* Step 1: Selection */}
                            {step === 'select' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* CSV Option */}
                                    <div
                                        onClick={() => setStep('csv')}
                                        className="border border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all group"
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="bg-green-100 p-3 rounded-full text-green-600">
                                                <FileText size={24} />
                                            </div>
                                            <ChevronRight className="text-gray-300 group-hover:text-blue-500" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 mb-1">CSV File</h3>
                                        <p className="text-sm text-gray-500">Upload a spreadsheet containing device details (IP, Hostname, Credentials).</p>
                                    </div>

                                    {/* Dynamic Plugins */}
                                    {plugins.map(plugin => (
                                        <div
                                            key={plugin.id}
                                            onClick={() => handlePluginSelect(plugin.id)}
                                            className="border border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all group"
                                        >
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="bg-purple-100 p-3 rounded-full text-purple-600">
                                                    <Database size={24} />
                                                </div>
                                                <ChevronRight className="text-gray-300 group-hover:text-blue-500" />
                                            </div>
                                            <h3 className="font-bold text-gray-800 mb-1">{plugin.name}</h3>
                                            <p className="text-sm text-gray-500">Connect to {plugin.name} API to discover and import devices automatically.</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Step 2: CSV Import */}
                            {step === 'csv' && (
                                <div className="space-y-6">
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center hover:bg-gray-50 transition-colors">
                                        <input
                                            type="file"
                                            accept=".csv"
                                            onChange={(e) => setCsvFile(e.target.files[0])}
                                            className="hidden"
                                            id="csv-upload"
                                        />
                                        <label htmlFor="csv-upload" className="cursor-pointer block">
                                            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                                            <span className="text-gray-600 font-medium">Click to upload CSV</span>
                                            <p className="text-xs text-gray-400 mt-1">Required columns: hostname, ip_address</p>
                                        </label>
                                    </div>

                                    {csvFile && (
                                        <div className="flex items-center bg-blue-50 text-blue-800 px-4 py-2 rounded text-sm">
                                            <FileText size={16} className="mr-2" />
                                            {csvFile.name}
                                        </div>
                                    )}

                                    {importResult && (
                                        <div className={`p-4 rounded text-sm ${importResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                            {importResult.error || `Successfully imported ${importResult.count} devices!`}
                                            {importResult.errors && importResult.errors.length > 0 && (
                                                <ul className="mt-2 text-xs list-disc pl-4 space-y-1 text-red-600">
                                                    {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                                                </ul>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex justify-end space-x-3 mt-4">
                                        <button onClick={() => setStep('select')} className="text-gray-600 px-4 py-2 hover:bg-gray-100 rounded">Back</button>
                                        <button
                                            onClick={handleCsvUpload}
                                            disabled={!csvFile || importing}
                                            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {importing ? 'Importing...' : 'Upload & Import'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Plugin Wizard */}
                            {step === 'plugin' && pluginId === 'netbox' && (
                                <NetBoxWizard
                                    onImportComplete={() => {
                                        if (onImportSuccess) onImportSuccess();
                                        close();
                                    }}
                                    onClose={close}
                                    onBack={() => setStep('select')}
                                />
                            )}

                            {/* Fallback for unknown plugins */}
                            {step === 'plugin' && pluginId !== 'netbox' && (
                                <div className="text-center py-10">
                                    <p className="text-gray-500">Wizard for {pluginId} is not yet implemented in UI.</p>
                                    <button onClick={() => setStep('select')} className="mt-4 text-blue-600 hover:underline">Go Back</button>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ImportManager;
