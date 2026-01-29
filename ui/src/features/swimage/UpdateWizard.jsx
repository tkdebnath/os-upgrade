import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, CheckCircle, Clock, Shield, AlertTriangle, ArrowRight, ArrowLeft, Layers } from 'lucide-react';

const ImageUpdateWizard = ({ selectedDevices, onClose, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [checks, setChecks] = useState([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [selectedCheckIds, setSelectedCheckIds] = useState([]);
    const [distributionTime, setDistributionTime] = useState('now');
    const [distributionDate, setDistributionDate] = useState('');
    const [activationTime, setActivationTime] = useState('after_dist');
    const [activationDate, setActivationDate] = useState('');
    const [cleanupFlash, setCleanupFlash] = useState(false);
    const [executionMode, setExecutionMode] = useState('parallel'); // parallel, sequential

    // File Server State
    const [fileServers, setFileServers] = useState([]);
    const [selectedFileServer, setSelectedFileServer] = useState('');

    useEffect(() => {
        fetchChecks();
        fetchFileServers();
    }, []);

    const fetchChecks = async () => {
        try {
            const res = await axios.get('/api/core/checks/');
            setChecks(res.data.results || res.data);
            // Default select all
            setSelectedCheckIds((res.data.results || res.data).map(c => c.id));
        } catch (error) {
            console.error("Failed to fetch checks", error);
        }
    };

    const fetchFileServers = async () => {
        try {
            const res = await axios.get('/api/images/file-servers/');
            setFileServers(res.data.results || res.data);
        } catch (error) {
            console.error("Failed to fetch file servers", error);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // In a real app, we'd batch create jobs or create a parent 'Workflow' object
            // Here we iterate and create a job for each device
            const promises = selectedDevices.map(device => {
                return axios.post('/api/core/jobs/', {
                    device: device.id,
                    image: null, // Should pick golden image automatically in backend logic or passed here
                    selected_checks: selectedCheckIds,
                    distribution_time: distributionTime === 'later' ? distributionDate : null,
                    activation_time: activationTime === 'later' ? activationDate : null,
                    activate_after_distribute: activationTime === 'after_dist',
                    cleanup_flash: cleanupFlash,
                    file_server_id: selectedFileServer || null
                });
            });

            await Promise.all(promises);
            onSuccess();
        } catch (error) {
            console.error("Failed to submit jobs", error);
            alert("Failed to submit update workflow.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[600px] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-blue-600 rounded-t-lg">
                    <h2 className="text-xl font-bold text-white">Image Update Wizard</h2>
                    <button onClick={onClose} className="text-blue-100 hover:text-white"><X size={24} /></button>
                </div>

                {/* Stepper */}
                <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex space-x-4">
                    <div className={`flex items-center ${step >= 1 ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
                        Readiness Checks
                    </div>
                    <div className="flex-1 h-px bg-gray-300 my-auto"></div>
                    <div className={`flex items-center ${step >= 2 ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
                        Scheduling
                    </div>
                    <div className="flex-1 h-px bg-gray-300 my-auto"></div>
                    <div className={`flex items-center ${step >= 3 ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>3</div>
                        Summary
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 1 && (
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><Shield className="mr-2 text-blue-500" /> Select Checks</h3>
                            <p className="text-gray-500 mb-6">Select the pre-checks and post-checks to run for this update workflow.</p>

                            <div className="space-y-3">
                                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-gray-700">System Checks (Default)</h4>
                                        <p className="text-sm text-gray-500">Flash, Config Register, Startup Config, Boot Media, TLS, ISSU</p>
                                    </div>
                                    <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-bold">Always On</span>
                                </div>

                                {checks.map(check => (
                                    <label key={check.id} className="p-4 border border-gray-200 rounded-lg flex items-center justify-between hover:bg-blue-50 cursor-pointer transition">
                                        <div>
                                            <h4 className="font-bold text-gray-700">{check.name}</h4>
                                            <p className="text-sm text-gray-500">{check.description || 'Custom readiness check'}</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={selectedCheckIds.includes(check.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedCheckIds([...selectedCheckIds, check.id]);
                                                else setSelectedCheckIds(selectedCheckIds.filter(id => id !== check.id));
                                            }}
                                            className="w-5 h-5 text-blue-600 rounded"
                                        />
                                    </label>
                                ))}
                                {checks.length === 0 && <p className="text-gray-400 italic">No custom checks available.</p>}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><Clock className="mr-2 text-blue-500" /> Schedule Update</h3>

                            <div className="grid grid-cols-2 gap-8">
                                {/* Distribution */}
                                <div>
                                    <h4 className="font-bold text-gray-700 mb-4 pb-2 border-b border-gray-200">Software Distribution</h4>
                                    <div className="space-y-4">
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Source File Server</label>
                                            <select
                                                className="w-full border border-gray-300 rounded p-2 text-sm"
                                                value={selectedFileServer}
                                                onChange={(e) => setSelectedFileServer(e.target.value)}
                                            >
                                                <option value="">Default (Local SWIM Server)</option>
                                                {fileServers.map(fs => (
                                                    <option key={fs.id} value={fs.id}>{fs.name} ({fs.address})</option>
                                                ))}
                                            </select>
                                            <p className="text-xs text-gray-500 mt-1">Select a regional server for faster distribution.</p>
                                        </div>

                                        <label className="flex items-center space-x-2">
                                            <input type="radio" name="dist" checked={distributionTime === 'now'} onChange={() => setDistributionTime('now')} className="text-blue-600" />
                                            <span>Now</span>
                                        </label>
                                        <label className="flex items-center space-x-2">
                                            <input type="radio" name="dist" checked={distributionTime === 'later'} onChange={() => setDistributionTime('later')} className="text-blue-600" />
                                            <span>Later</span>
                                        </label>
                                        <input
                                            type="datetime-local"
                                            disabled={distributionTime !== 'later'}
                                            className="w-full border border-gray-300 rounded p-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                                            value={distributionDate}
                                            onChange={e => setDistributionDate(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Activation */}
                                <div>
                                    <h4 className="font-bold text-gray-700 mb-4 pb-2 border-b border-gray-200">Software Activation</h4>
                                    <div className="space-y-4">
                                        <label className="flex items-center space-x-2">
                                            <input type="radio" name="act" checked={activationTime === 'after_dist'} onChange={() => setActivationTime('after_dist')} className="text-blue-600" />
                                            <span>Immediately after Distribution</span>
                                        </label>
                                        <label className="flex items-center space-x-2">
                                            <input type="radio" name="act" checked={activationTime === 'later'} onChange={() => setActivationTime('later')} className="text-blue-600" />
                                            <span>Later</span>
                                        </label>
                                        <input
                                            type="datetime-local"
                                            disabled={activationTime !== 'later'}
                                            className="w-full border border-gray-300 rounded p-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                                            value={activationDate}
                                            onChange={e => setActivationDate(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                <h4 className="font-bold text-gray-700 mb-2 flex items-center"><AlertTriangle size={16} className="text-orange-500 mr-2" /> Flash Cleanup</h4>
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input type="checkbox" checked={cleanupFlash} onChange={e => setCleanupFlash(e.target.checked)} className="text-blue-600 rounded" />
                                    <span className="text-sm text-gray-700">Initiate Flash Cleanup after successful activation (Removes old images)</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><CheckCircle className="mr-2 text-blue-500" /> Review & Submit</h3>

                            <div className="bg-gray-50 p-6 rounded-lg space-y-4">
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-gray-500">Selected Devices</span>
                                    <span className="font-bold text-gray-800">{selectedDevices.length} Devices</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-gray-500">Custom Checks</span>
                                    <span className="font-bold text-gray-800">{selectedCheckIds.length} Checks Selected</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-gray-500">Distribution</span>
                                    <span className="font-bold text-blue-600">{distributionTime === 'now' ? 'Immediate' : distributionDate || 'Pending Date'}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-gray-500">Activation</span>
                                    <span className="font-bold text-blue-600">{activationTime === 'after_dist' ? 'Auto-Activate' : activationDate || 'Pending Date'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Flash Cleanup</span>
                                    <span className={`font-bold ${cleanupFlash ? 'text-orange-600' : 'text-gray-400'}`}>{cleanupFlash ? 'Enabled' : 'Disabled'}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between rounded-b-lg">
                    {step > 1 ? (
                        <button onClick={() => setStep(step - 1)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg bg-white hover:bg-gray-50 font-medium flex items-center">
                            <ArrowLeft size={16} className="mr-2" /> Back
                        </button>
                    ) : <div></div>}

                    {step < 3 ? (
                        <button onClick={() => setStep(step + 1)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center shadow-sm">
                            Next <ArrowRight size={16} className="ml-2" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className={`px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center shadow-sm ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {loading ? 'Submitting...' : 'Submit Update'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImageUpdateWizard;
