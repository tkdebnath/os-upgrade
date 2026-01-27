import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, AlertTriangle, ArrowRight, ArrowLeft, Loader, Server, HardDrive, Plus, ChevronDown, ChevronRight, FileCheck, XCircle, RefreshCw, Trash2, ChevronUp } from 'lucide-react';

const UpgradeWizard = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [selectedDevices, setSelectedDevices] = useState(location.state?.selectedDevices || []); // List of IDs if passed, or we fetch details
    const [deviceDetails, setDeviceDetails] = useState([]);
    const [loading, setLoading] = useState(true);

    // Step 2 State
    const [readinessResults, setReadinessResults] = useState([]);
    const [checking, setChecking] = useState(false);

    // Step 3 State
    const [distributing, setDistributing] = useState(false);
    const [latestJobs, setLatestJobs] = useState({}); // { deviceId: jobId }
    const [selectedForNextStep, setSelectedForNextStep] = useState([]); // IDs to proceed

    // Step 4 State
    const [availableChecks, setAvailableChecks] = useState([]);
    const [checksConfig, setChecksConfig] = useState({}); // { checkId: { pre: true, post: true } }

    // Step 5 State
    const [activating, setActivating] = useState(false);
    const [availableWorkflows, setAvailableWorkflows] = useState([]);
    const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
    // Step 5 Configuration
    const [scheduleMode, setScheduleMode] = useState(false);
    const [scheduleTime, setScheduleTime] = useState('');
    const [sequentialIds, setSequentialIds] = useState([]);
    const [parallelIds, setParallelIds] = useState([]);

    useEffect(() => {
        if (!selectedDevices || selectedDevices.length === 0) {
            alert("No devices selected for upgrade.");
            navigate('/devices');
            return;
        }
        fetchDeviceDetails();
        fetchChecks();
        fetchWorkflows();
    }, []);

    const fetchWorkflows = async () => {
        try {
            const res = await axios.get('/api/workflows/');
            const data = res.data.results || res.data;
            setAvailableWorkflows(data);
            const def = data.find(w => w.is_default);
            if (def) setSelectedWorkflowId(def.id);
            else if (data.length > 0) setSelectedWorkflowId(data[0].id);
        } catch (e) { console.error(e); }
    };

    // Auto-select all for next step initially
    useEffect(() => {
        if (deviceDetails.length > 0) {
            setSelectedForNextStep(deviceDetails.map(d => d.id));
        }
    }, [deviceDetails]);

    const fetchChecks = async () => {
        try {
            const res = await axios.get('/api/checks/');
            setAvailableChecks(res.data.results || res.data);
            // Default config: Enable all pre/post for standard checks
            const initialConfig = {};
            (res.data.results || res.data).forEach(c => {
                initialConfig[c.id] = { pre: true, post: true };
            });
            setChecksConfig(initialConfig);
        } catch (error) {
            console.error("Failed to fetch checks", error);
        }
    };

    const fetchDeviceDetails = async () => {
        try {
            // In a real app we might pass full objects, but let's re-fetch to be safe
            // Or use a filtered list endpoint. For now, we will mock or filter locally if we had full list context.
            // Let's assume we can fetch by IDs or just fetch all and filter (inefficient but works for Prototype)
            const res = await axios.get('/api/devices/');
            const allDevs = res.data.results || res.data;
            const targetDevs = allDevs.filter(d => selectedDevices.includes(d.id));
            setDeviceDetails(targetDevs);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const runChecks = async () => {
        setChecking(true);
        try {
            const res = await axios.post('/api/devices/check_readiness/', { ids: selectedDevices });
            setReadinessResults(res.data);
        } catch (error) {
            console.error("Check failed", error);
            alert("Failed to run readiness checks.");
        } finally {
            setChecking(false);
        }
    };

    const startDistribution = async (idsToRun = null) => {
        // If idsToRun provided, it's a retry or partial run. Otherwise all.
        const targetIds = idsToRun || selectedDevices;

        if (!idsToRun) setDistributing(true); // Only set main loading state for initial run

        try {
            const res = await axios.post('/api/devices/distribute_image/', { ids: targetIds });

            // Update mapping of device -> latest job
            // We need to match returned job_ids to devices. 
            // The API returns { job_ids: [...] } in order of input 'ids'.
            // WE ASSUME ORDER IS PRESERVED for this prototype.
            const newJobs = res.data.job_ids;

            setLatestJobs(prev => {
                const updated = { ...prev };
                targetIds.forEach((devId, idx) => {
                    if (newJobs[idx]) updated[devId] = newJobs[idx];
                });
                return updated;
            });

        } catch (error) {
            console.error("Distribution failed", error);
            alert("Failed to start distribution.");
            setDistributing(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading wizard...</div>;

    const allReady = readinessResults.length > 0 && readinessResults.every(r => r.status === 'Ready');

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8">
            {/* Wizard Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-800">Software Image Upgrade</h1>
                <div className="flex items-center space-x-4 mt-4 text-sm">
                    <div className={`flex items-center ${step >= 1 ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center border mr-2 ${step >= 1 ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300'}`}>1</span>
                        Select Devices
                    </div>
                    <div className="w-8 h-px bg-gray-300"></div>
                    <div className={`flex items-center ${step >= 2 ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center border mr-2 ${step >= 2 ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300'}`}>2</span>
                        Readiness Checks
                    </div>
                    <div className="w-8 h-px bg-gray-300"></div>
                    <div className={`flex items-center ${step >= 3 ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center border mr-2 ${step >= 3 ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300'}`}>3</span>
                        Distribution
                    </div>
                    <div className="w-8 h-px bg-gray-300"></div>
                    <div className={`flex items-center ${step >= 4 ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center border mr-2 ${step >= 4 ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300'}`}>4</span>
                        Activation Checks
                    </div>
                    <div className="w-8 h-px bg-gray-300"></div>
                    <div className={`flex items-center ${step >= 5 ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center border mr-2 ${step >= 5 ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300'}`}>5</span>
                        Execution
                    </div>
                </div>
            </div>

            {/* Step 1: Review Selection */}
            {step === 1 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h2 className="font-semibold text-gray-700">Review Selection ({deviceDetails.length} devices)</h2>
                    </div>
                    <table className="w-full text-left text-sm">
                        <thead className="text-xs text-gray-500 font-bold uppercase border-b">
                            <tr>
                                <th className="p-4">Device Name</th>
                                <th className="p-4">IP Address</th>
                                <th className="p-4">Family</th>
                                <th className="p-4">Current Version</th>
                                <th className="p-4">Target Image</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {deviceDetails.map(dev => (
                                <tr key={dev.id}>
                                    <td className="p-4 font-medium">{dev.hostname}</td>
                                    <td className="p-4 text-gray-600 font-mono">{dev.ip_address}</td>
                                    <td className="p-4 text-gray-600">{dev.family}</td>
                                    <td className="p-4 text-gray-600">{dev.version}</td>
                                    <td className="p-4">
                                        {dev.golden_image ? (
                                            <div className="text-green-600 font-mono text-xs">
                                                {dev.golden_image.file} <br />
                                                <span className="text-gray-400">(v{dev.golden_image.version})</span>
                                            </div>
                                        ) : (
                                            <span className="text-red-500 flex items-center"><AlertTriangle size={14} className="mr-1" /> No Standard</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="p-4 border-t border-gray-200 flex justify-end space-x-3">
                        <button onClick={() => navigate('/devices')} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                        <button
                            onClick={() => { setStep(2); runChecks(); }}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                        >
                            Next: Readiness Checks <ArrowRight size={16} className="ml-2" />
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Readiness Checks */}
            {step === 2 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-4 border-b border-gray-200 bg-gray-50">
                        <h2 className="font-semibold text-gray-700">Pre-Upgrade Checks</h2>
                        <p className="text-xs text-gray-500 mt-1">Verifying device reachability, flash space, and configuration compliance.</p>
                    </div>

                    {checking ? (
                        <div className="p-12 text-center text-gray-500">
                            <Loader size={32} className="animate-spin mx-auto mb-4 text-blue-500" />
                            <p>Running checks on {deviceDetails.length} devices...</p>
                        </div>
                    ) : (
                        <div className="p-4 space-y-4">
                            {readinessResults.map(res => (
                                <div key={res.id} className="border border-gray-200 rounded p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="font-bold text-gray-800 flex items-center">
                                            {res.hostname}
                                            <span className={`ml-3 px-2 py-0.5 rounded text-xs uppercase ${res.status === 'Ready' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {res.status}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500 font-mono">Target: {res.target_version || 'N/A'}</div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                                        {res.checks.map((check, i) => (
                                            <div key={i} className={`flex items-center p-2 rounded ${check.status === 'Pass' ? 'bg-green-50 text-green-700' : check.status === 'Warning' ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'}`}>
                                                {check.status === 'Pass' ? <CheckCircle size={14} className="mr-2" /> : <AlertTriangle size={14} className="mr-2" />}
                                                <div>
                                                    <div className="font-semibold text-xs">{check.name}</div>
                                                    <div className="text-[10px] opacity-80">{check.message}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="p-4 border-t border-gray-200 flex justify-between items-center">
                        <button onClick={() => setStep(1)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded flex items-center">
                            <ArrowLeft size={16} className="mr-2" /> Back
                        </button>
                        <button
                            onClick={() => setStep(3)}
                            disabled={checking || !allReady}
                            className={`px-4 py-2 text-white rounded flex items-center ${allReady ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'}`}
                        >
                            Next: Distribute Image <ArrowRight size={16} className="ml-2" />
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Distribution */}
            {step === 3 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h2 className="font-semibold text-gray-700">Software Distribution</h2>
                        {distributing && (
                            <span className="text-xs font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded infinite-pulse">
                                Job Running...
                            </span>
                        )}
                    </div>

                    <div className="flex h-[500px]">
                        {/* LEFT: Summary & Actions */}
                        <div className="w-1/3 border-r border-gray-200 p-6 flex flex-col items-center justify-center bg-gray-50">
                            <div className="text-center mb-8">
                                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                                    <Server size={40} />
                                </div>
                                <h3 className="font-bold text-gray-800 text-lg">Distribution Phase</h3>
                                <p className="text-sm text-gray-600 mt-2 px-4">
                                    Transfers the golden image to devices. <br />
                                    Review results and select devices to proceed.
                                </p>
                            </div>

                            {!distributing ? (
                                <button onClick={() => startDistribution()} className="w-full max-w-xs px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded shadow-lg font-bold flex items-center justify-center">
                                    Start Distribution
                                </button>
                            ) : (
                                <div className="text-center w-full space-y-4">
                                    <div className="text-sm font-semibold text-blue-600 flex items-center justify-center">
                                        <Loader size={16} className="animate-spin mr-2" /> Distribution Active
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (selectedForNextStep.length === 0) {
                                                alert("Please select at least one device to proceed.");
                                                return;
                                            }
                                            // Update global selected for next steps
                                            setSelectedDevices(selectedForNextStep);
                                            setStep(4);
                                        }}
                                        className="w-full max-w-xs px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded shadow-lg font-bold flex items-center justify-center"
                                    >
                                        Next: Activation <ArrowRight size={16} className="ml-2" />
                                    </button>
                                    <p className="text-xs text-gray-400">
                                        Proceed only with successfully distributed devices.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* RIGHT: Detailed Job List */}
                        <div className="w-2/3 overflow-y-auto p-4 bg-white">
                            <h3 className="font-bold text-gray-700 mb-4 px-2">Job Progress ({deviceDetails.length} Devices)</h3>

                            {!distributing && Object.keys(latestJobs).length === 0 ? (
                                <div className="text-center text-gray-400 mt-20">
                                    <Server size={48} className="mx-auto mb-2 opacity-20" />
                                    <p>Waiting to start...</p>
                                </div>
                            ) : (
                                <JobList
                                    jobMap={latestJobs}
                                    devices={deviceDetails}
                                    selectedIds={selectedForNextStep}
                                    onToggleSelect={(id) => {
                                        if (selectedForNextStep.includes(id)) {
                                            setSelectedForNextStep(selectedForNextStep.filter(i => i !== id));
                                        } else {
                                            setSelectedForNextStep([...selectedForNextStep, id]);
                                        }
                                    }}
                                    onRetry={(id) => startDistribution([id])}
                                    onRemove={(id) => {
                                        setDeviceDetails(deviceDetails.filter(d => d.id !== id));
                                        setSelectedForNextStep(selectedForNextStep.filter(i => i !== id));
                                        // Also remove from latestJobs to clean up? Optional.
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Step 4: Activation Checks */}
            {step === 4 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <div>
                            <h2 className="font-semibold text-gray-700">Software Activation Checks</h2>
                            <p className="text-xs text-gray-500 mt-1">Configure pre/post checks to verify network stability.</p>
                        </div>
                    </div>
                    <div className="p-6 space-y-8">

                        {/* Scripts Section */}
                        <div>
                            <div className="flex items-center mb-3">
                                <div className="w-8 h-8 rounded bg-purple-100 text-purple-600 flex items-center justify-center mr-3">
                                    <FileCheck size={18} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 text-sm">Custom Command</h3>
                                    <p className="text-xs text-gray-500">Standard operational checks</p>
                                </div>
                            </div>
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 border-b text-xs font-bold text-gray-500 uppercase">
                                        <tr>
                                            <th className="p-3">Check Name</th>
                                            <th className="p-3 text-center w-24">Pre-Check</th>
                                            <th className="p-3 text-center w-24">Post-Check</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {availableChecks.filter(c => c.category === 'script' || !c.category).map(check => (
                                            <tr key={check.id} className="hover:bg-gray-50">
                                                <td className="p-3 font-medium text-gray-800">{check.name}</td>
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={checksConfig[check.id]?.pre || false}
                                                        onChange={(e) => setChecksConfig({ ...checksConfig, [check.id]: { ...checksConfig[check.id], pre: e.target.checked } })}
                                                        className="rounded text-blue-600"
                                                    />
                                                </td>
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={checksConfig[check.id]?.post || false}
                                                        onChange={(e) => setChecksConfig({ ...checksConfig, [check.id]: { ...checksConfig[check.id], post: e.target.checked } })}
                                                        className="rounded text-blue-600"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Genie Section */}
                        <div>
                            <div className="flex items-center mb-3">
                                <div className="w-8 h-8 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center mr-3">
                                    <Server size={18} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 text-sm">Genie Learn Modules</h3>
                                    <p className="text-xs text-gray-500">State learning and comparison</p>
                                </div>
                            </div>
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 border-b text-xs font-bold text-gray-500 uppercase">
                                        <tr>
                                            <th className="p-3">Module</th>
                                            <th className="p-3 text-center w-24">Pre-Check</th>
                                            <th className="p-3 text-center w-24">Post-Check</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {availableChecks.filter(c => c.category === 'genie').map(check => (
                                            <tr key={check.id} className="hover:bg-gray-50">
                                                <td className="p-3 font-medium text-gray-800">
                                                    {check.name}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={checksConfig[check.id]?.pre || false}
                                                        onChange={(e) => setChecksConfig({ ...checksConfig, [check.id]: { ...checksConfig[check.id], pre: e.target.checked } })}
                                                        className="rounded text-indigo-600"
                                                    />
                                                </td>
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={checksConfig[check.id]?.post || false}
                                                        onChange={(e) => setChecksConfig({ ...checksConfig, [check.id]: { ...checksConfig[check.id], post: e.target.checked } })}
                                                        className="rounded text-indigo-600"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-gray-200 flex justify-between items-center">
                        <button onClick={() => setStep(3)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded flex items-center">
                            <ArrowLeft size={16} className="mr-2" /> Back
                        </button>
                        <button
                            onClick={() => {
                                // Initialize lists: All parallel by default
                                setParallelIds(selectedDevices);
                                setSequentialIds([]);
                                setStep(5);
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                        >
                            Next: Review & Activate <ArrowRight size={16} className="ml-2" />
                        </button>
                    </div>
                </div>
            )}

            {/* Step 5: Final Execution */}
            {step === 5 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-4 border-b border-gray-200 bg-gray-50">
                        <h2 className="font-semibold text-gray-700">Ready to Activate</h2>
                    </div>
                    <div className="p-8 space-y-8">
                        {/* Upper: Summary and Scheduling */}
                        <div className="flex justify-between items-start">
                            <div className="max-w-md bg-blue-50 border border-blue-100 p-4 rounded text-left">
                                <h3 className="font-bold text-blue-800 mb-2">Configuration Summary</h3>
                                <ul className="text-sm text-blue-700 space-y-1 ml-4 list-disc">
                                    <li><strong>Devices:</strong> {selectedDevices.length} selected</li>
                                    <li><strong>Workflow:</strong> {availableWorkflows.find(w => w.id === parseInt(selectedWorkflowId))?.name || 'Default Legacy'}</li>
                                    <li><strong>Pre-Checks:</strong> {Object.values(checksConfig).filter(c => c.pre).length} enabled</li>
                                    <li><strong>Post-Checks:</strong> {Object.values(checksConfig).filter(c => c.post).length} enabled</li>
                                    <li><strong>Reboot:</strong> Automatic after activation</li>
                                </ul>
                            </div>

                            <div className="bg-white border rounded p-4 w-1/3">
                                <h3 className="font-bold text-gray-700 mb-4 text-sm uppercase">Execution Schedule</h3>
                                <div className="space-y-3">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="schedule"
                                            checked={!scheduleMode}
                                            onChange={() => setScheduleMode(false)}
                                            className="text-blue-600"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Execute Immediately</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="schedule"
                                            checked={scheduleMode}
                                            onChange={() => setScheduleMode(true)}
                                            className="text-blue-600"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Schedule for Later</span>
                                    </label>

                                    {scheduleMode && (
                                        <input
                                            type="datetime-local"
                                            value={scheduleTime}
                                            onChange={(e) => setScheduleTime(e.target.value)}
                                            className="w-full border rounded p-2 text-sm mt-2"
                                            min={new Date().toISOString().slice(0, 16)}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>




                        {/* Workflow Selection */}
                        <div className="bg-white border rounded p-4 text-left">
                            <h3 className="font-bold text-gray-700 mb-2 text-sm uppercase">Workflow Strategy</h3>
                            <select
                                value={selectedWorkflowId}
                                onChange={(e) => setSelectedWorkflowId(e.target.value)}
                                className="w-full border rounded p-2 text-sm bg-white"
                            >
                                <option value="">-- Use System Default --</option>
                                {availableWorkflows.map(wf => (
                                    <option key={wf.id} value={wf.id}>
                                        {wf.name} {wf.is_default ? '(Default)' : ''}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Select the sequence of operations (Readiness, Distribution, Wait, etc.)</p>
                        </div>

                        {/* Middle: Execution Order */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                                <h3 className="font-bold text-gray-700 text-sm">Execution Order</h3>
                                <span className="text-xs text-gray-500">Drag to reorder or use arrows (Sequential only)</span>
                            </div>
                            <div className="flex h-64">
                                {/* Sequential List */}
                                <div className="w-1/2 border-r border-gray-200 p-4 overflow-y-auto">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-semibold text-gray-700 text-xs uppercase flex items-center">
                                            <span className="w-2 h-2 rounded-full bg-purple-500 mr-2"></span>
                                            Sequential (One-by-One)
                                        </h4>
                                        <span className="text-xs font-mono bg-gray-100 px-1.5 rounded">{sequentialIds.length}</span>
                                    </div>
                                    <div className="space-y-1">
                                        {sequentialIds.map((id, index) => {
                                            const dev = deviceDetails.find(d => d.id === id);
                                            if (!dev) return null;
                                            return (
                                                <div
                                                    key={id}
                                                    draggable
                                                    onDragStart={(e) => {
                                                        // Store the index of the item being dragged
                                                        e.dataTransfer.setData('text/plain', index);
                                                        e.dataTransfer.effectAllowed = 'move';
                                                        // Optional: Styling for drag
                                                        e.currentTarget.style.opacity = '0.5';
                                                    }}
                                                    onDragEnd={(e) => {
                                                        e.currentTarget.style.opacity = '1';
                                                    }}
                                                    onDragOver={(e) => {
                                                        // Allow dropping
                                                        e.preventDefault();
                                                        e.dataTransfer.dropEffect = 'move';
                                                    }}
                                                    onDrop={(e) => {
                                                        e.preventDefault();
                                                        const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
                                                        const targetIndex = index;

                                                        if (draggedIndex === targetIndex) return;

                                                        const newIds = [...sequentialIds];
                                                        // Move item
                                                        const [draggedItem] = newIds.splice(draggedIndex, 1);
                                                        newIds.splice(targetIndex, 0, draggedItem);

                                                        setSequentialIds(newIds);
                                                    }}
                                                    className="flex justify-between items-center p-2 bg-purple-50 border border-purple-100 rounded text-sm group cursor-move hover:bg-purple-100 transition-colors"
                                                >
                                                    <span className="truncate">{dev.hostname}</span>
                                                    <div className="flex items-center space-x-1">
                                                        <div className="flex flex-col mr-2">
                                                            <button
                                                                onClick={() => {
                                                                    if (index === 0) return;
                                                                    const newIds = [...sequentialIds];
                                                                    [newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]];
                                                                    setSequentialIds(newIds);
                                                                }}
                                                                disabled={index === 0}
                                                                className={`text-gray-400 hover:text-blue-600 ${index === 0 ? 'opacity-20 cursor-default' : ''}`}
                                                                title="Move Up"
                                                            >
                                                                <ChevronUp size={12} />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (index === sequentialIds.length - 1) return;
                                                                    const newIds = [...sequentialIds];
                                                                    [newIds[index + 1], newIds[index]] = [newIds[index], newIds[index + 1]];
                                                                    setSequentialIds(newIds);
                                                                }}
                                                                disabled={index === sequentialIds.length - 1}
                                                                className={`text-gray-400 hover:text-blue-600 ${index === sequentialIds.length - 1 ? 'opacity-20 cursor-default' : ''}`}
                                                                title="Move Down"
                                                            >
                                                                <ChevronDown size={12} />
                                                            </button>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                setSequentialIds(sequentialIds.filter(i => i !== id));
                                                                setParallelIds([...parallelIds, id]);
                                                            }}
                                                            className="text-gray-400 hover:text-blue-600"
                                                            title="Move to Parallel"
                                                        >
                                                            <ArrowRight size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {sequentialIds.length === 0 && (
                                            <div className="text-center text-gray-400 text-xs italic py-8 border-2 border-dashed border-gray-100 rounded">
                                                No devices in sequential queue
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Parallel List */}
                                <div className="w-1/2 p-4 overflow-y-auto bg-gray-50/30">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-semibold text-gray-700 text-xs uppercase flex items-center">
                                            <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                                            Parallel (Concurrent)
                                        </h4>
                                        <span className="text-xs font-mono bg-gray-100 px-1.5 rounded">{parallelIds.length}</span>
                                    </div>
                                    <div className="space-y-1">
                                        {parallelIds.map(id => {
                                            const dev = deviceDetails.find(d => d.id === id);
                                            if (!dev) return null;
                                            return (
                                                <div key={id} className="flex justify-between items-center p-2 bg-white border border-gray-200 rounded text-sm shadow-sm group">
                                                    <button
                                                        onClick={() => {
                                                            setParallelIds(parallelIds.filter(i => i !== id));
                                                            setSequentialIds([...sequentialIds, id]);
                                                        }}
                                                        className="text-gray-400 hover:text-purple-600 mr-2"
                                                        title="Move to Sequential"
                                                    >
                                                        <ArrowLeft size={14} />
                                                    </button>
                                                    <span className="truncate flex-1 text-right">{dev.hostname}</span>
                                                </div>
                                            );
                                        })}
                                        {parallelIds.length === 0 && (
                                            <div className="text-center text-gray-400 text-xs italic py-8 border-2 border-dashed border-gray-100 rounded">
                                                No devices in parallel queue
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Area */}
                        <div className="text-center pt-4">
                            {activating ? (
                                <button disabled className="px-8 py-3 bg-green-500 text-white rounded-full font-bold shadow-lg flex items-center mx-auto opacity-75 cursor-not-allowed">
                                    <Loader size={20} className="animate-spin mr-2" />
                                    {scheduleMode ? 'Scheduling...' : 'Activating...'}
                                </button>
                            ) : (
                                <button
                                    onClick={async () => {
                                        if (scheduleMode && !scheduleTime) {
                                            alert("Please select a date and time for relevant schedule.");
                                            return;
                                        }
                                        if (!selectedWorkflowId) {
                                            alert("Please select a Workflow Strategy to proceed.");
                                            return;
                                        }

                                        setActivating(true);
                                        try {
                                            const checksPayload = Object.keys(checksConfig).map(id => ({
                                                id: parseInt(id),
                                                pre: checksConfig[id].pre,
                                                post: checksConfig[id].post
                                            })).filter(c => c.pre || c.post);

                                            await axios.post('/api/devices/activate_image/', {
                                                ids: selectedDevices,
                                                checks: checksPayload,
                                                schedule_time: scheduleMode ? scheduleTime : null,
                                                execution_config: {
                                                    sequential: sequentialIds,
                                                    parallel: parallelIds
                                                },
                                                workflow_id: selectedWorkflowId
                                            });

                                            // Auto advance to "Done" screen
                                            setTimeout(() => setStep(6), 1500);
                                        } catch (e) {
                                            console.error(e);
                                            alert("Activation failed to start.");
                                            setActivating(false);
                                        }
                                    }}
                                    className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-full font-bold shadow-lg transition transform hover:-translate-y-1 block mx-auto"
                                >
                                    {scheduleMode ? 'Schedule Activation' : 'Activate Image Now'}
                                </button>
                            )}
                            {scheduleMode && (
                                <p className="text-xs text-gray-400 mt-2">
                                    Job will be queued with status 'Scheduled'.
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="p-4 border-t border-gray-200 flex justify-start">
                        <button onClick={() => setStep(4)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded flex items-center">
                            <ArrowLeft size={16} className="mr-2" /> Back
                        </button>
                    </div>
                </div>
            )
            }

            {/* Step 6: Completion */}
            {
                step === 6 && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 text-center p-12">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle size={40} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Activation Job Started</h2>
                        <p className="text-gray-600 mb-6">
                            The activation process including configured checks has been queued. <br />
                            You can monitor the progress in the Job History page.
                        </p>
                        <div className="flex justify-center space-x-4">
                            <button onClick={() => navigate('/devices')} className="px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50">
                                Back to Inventory
                            </button>
                            <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                                View Job Details
                            </button>
                        </div>
                    </div>
                )
            }
        </div >
    );
};


const JobList = ({ jobMap, devices, selectedIds, onToggleSelect, onRetry, onRemove }) => {
    // We need to fetch job details for the IDs in jobMap
    const [jobs, setJobs] = useState({}); // { jobId: jobObj }

    useEffect(() => {
        let interval;
        const fetchJobs = async () => {
            try {
                const idsToFetch = Object.values(jobMap);
                if (idsToFetch.length === 0) return;

                // Ideally fetch specifics, but mock polling all
                // We could POST to /api/jobs/bulk_get/ or just filter client side
                const res = await axios.get('/api/jobs/');
                const allJobs = res.data.results || res.data;

                const newJobsMap = {};
                allJobs.forEach(j => {
                    if (idsToFetch.includes(j.id)) {
                        newJobsMap[j.id] = j;
                    }
                });
                setJobs(newJobsMap);

            } catch (e) { console.error(e) }
        };

        fetchJobs();
        interval = setInterval(fetchJobs, 2000);
        return () => clearInterval(interval);
    }, [jobMap]);

    return (
        <div className="space-y-2">
            {devices.map(device => {
                const jobId = jobMap[device.id];
                const job = jobs[jobId]; // Might be undefined initially or if not started
                const isSelected = selectedIds.includes(device.id);

                return (
                    <JobRow
                        key={device.id}
                        device={device}
                        job={job}
                        isSelected={isSelected}
                        onToggle={(checked) => onToggleSelect(device.id)}
                        onRetry={() => onRetry(device.id)}
                        onRemove={() => onRemove(device.id)}
                    />
                );
            })}
        </div>
    );
};

const JobRow = ({ device, job, isSelected, onToggle, onRetry, onRemove }) => {
    const [expanded, setExpanded] = useState(false);

    // Status Logic
    const status = job ? job.status : 'pending';
    const isRunning = ['pending', 'running', 'distributing'].includes(status);
    const isSuccess = ['success', 'distributed'].includes(status);
    const isFailed = status === 'failed';

    // Logs
    const logLines = (job?.log || '').split('\n').filter(Boolean);
    const lastLog = logLines[logLines.length - 1] || 'Waiting...';

    // Percent
    let percent = 0;
    if (job) {
        const percentMatch = lastLog.match(/(\d+)%/);
        if (percentMatch) percent = parseInt(percentMatch[1]);
        else if (isSuccess) percent = 100;
        else if (isFailed) percent = 100;
        else if (status === 'distributing') percent = 10;
    }

    return (
        <div className={`border rounded-lg overflow-hidden transition-all duration-200 ${isSelected ? 'border-blue-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-75'}`}>
            <div
                className="flex items-center justify-between p-3 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center space-x-3 w-1/2">
                    <div onClick={(e) => e.stopPropagation()}>
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => onToggle(e.target.checked)}
                            className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-gray-300"
                        />
                    </div>

                    <div onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
                        {expanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-gray-800 flex items-center">
                            <Server size={14} className="mr-2 text-gray-400" />
                            {device.hostname}
                            {!job && <span className="ml-2 text-xs text-gray-400 font-normal italic">- Pending Start</span>}
                        </div>
                        {job && (
                            <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                                <div className="truncate text-gray-700 font-medium" title={job?.workflow_name}>
                                    Profile: {job?.workflow_name || 'Legacy'}
                                </div>
                                <div className="truncate text-gray-400" title={job?.image_filename}>
                                    Image: {job?.image_filename || 'Unknown'}
                                </div>
                                {job.distribution_time && (
                                    <div className="text-blue-600 font-mono">
                                        Sch: {new Date(job.distribution_time).toLocaleString()}
                                    </div>
                                )}
                                <div className="text-xs text-gray-500 mt-0.5 truncate border-t border-gray-100 pt-1" title={lastLog}>
                                    &gt; {isSuccess ? 'Ready for Activation' : lastLog}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center space-x-3 w-1/2 justify-end" onClick={(e) => e.stopPropagation()}>
                    {/* Actions Panel */}
                    <div className="flex items-center space-x-2 mr-2">
                        {isFailed && (
                            <button
                                onClick={onRetry}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                title="Retry Distribution"
                            >
                                <RefreshCw size={14} />
                            </button>
                        )}
                        <button
                            onClick={onRemove}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Remove Device"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>

                    {/* Progress Bar */}
                    {isRunning && (
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${percent}%` }}></div>
                        </div>
                    )}

                    {isSuccess && <div className="flex items-center text-green-600 text-xs font-bold"><CheckCircle size={16} className="mr-1" /> Done</div>}
                    {isFailed && <div className="flex items-center text-red-600 text-xs font-bold"><XCircle size={16} className="mr-1" /> Failed</div>}
                    {isRunning && <Loader size={16} className="text-blue-500 animate-spin" />}
                </div>
            </div>

            {/* Expanded Details */}
            {expanded && job && (
                <div className="bg-gray-50 border-t border-gray-200 p-3 text-xs pl-12">
                    {/* Steps */}
                    <div className="space-y-1 mb-2">
                        <div className="font-bold text-gray-500 uppercase text-[10px]">Execution Steps</div>
                        {(job.steps || []).map((step, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-white p-1.5 rounded border border-gray-100">
                                <span className="text-gray-700">{step.name}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${step.status === 'success' ? 'bg-green-100 text-green-700' :
                                    step.status === 'failed' ? 'bg-red-100 text-red-700' :
                                        step.status === 'running' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                    {step.status}
                                </span>
                            </div>
                        ))}
                    </div>
                    {/* Logs view */}
                    <div className="mt-2 font-mono text-gray-500 bg-white border border-gray-200 p-2 rounded max-h-32 overflow-y-auto whitespace-pre-line">
                        {job.log}
                    </div>
                </div>
            )}
        </div>
    );
};

export default UpgradeWizard;
