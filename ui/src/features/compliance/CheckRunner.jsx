import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, Play, CheckCircle, XCircle, Clock, Activity, Terminal, ChevronDown, ChevronRight } from 'lucide-react';

const Checks = () => {
    // Data
    const [devices, setDevices] = useState([]);
    const [availableChecks, setAvailableChecks] = useState([]);
    const [checkRuns, setCheckRuns] = useState([]);

    // Selection
    const [selectedDeviceIds, setSelectedDeviceIds] = useState([]);
    const [selectedCheckIds, setSelectedCheckIds] = useState([]);

    // UI State
    const [loading, setLoading] = useState(false);
    const [running, setRunning] = useState(false);
    const [expandedRunId, setExpandedRunId] = useState(null);

    useEffect(() => {
        fetchDevices();
        fetchAvailableChecks();
        fetchCheckRuns();

        const interval = setInterval(fetchCheckRuns, 3000);
        return () => clearInterval(interval);
    }, []);

    const fetchDevices = async () => {
        try {
            const res = await axios.get('/api/devices/');
            setDevices(res.data.results || res.data);
        } catch (error) { console.error(error); }
    };

    const fetchAvailableChecks = async () => {
        try {
            // Filter only genie/script checks, maybe? For now create all allowed.
            const res = await axios.get('/api/checks/');
            setAvailableChecks(res.data.results || res.data);
        } catch (error) { console.error(error); }
    };

    const fetchCheckRuns = async () => {
        try {
            const res = await axios.get('/api/check-runs/');
            setCheckRuns(res.data.results || res.data);
        } catch (error) { console.error(error); }
    };

    const handleRunChecks = async () => {
        if (selectedDeviceIds.length === 0 || selectedCheckIds.length === 0) {
            alert("Please select at least one device and one check.");
            return;
        }

        setRunning(true);
        try {
            await axios.post('/api/check-runs/run/', {
                devices: selectedDeviceIds,
                checks: selectedCheckIds
            });
            // Clear selections after run? Maybe keep for repeat.
            fetchCheckRuns();
        } catch (error) {
            alert("Failed to start checks.");
        } finally {
            setRunning(false);
        }
    };

    const toggleDevice = (id) => {
        if (selectedDeviceIds.includes(id)) setSelectedDeviceIds(selectedDeviceIds.filter(d => d !== id));
        else setSelectedDeviceIds([...selectedDeviceIds, id]);
    };

    const toggleCheck = (id) => {
        if (selectedCheckIds.includes(id)) setSelectedCheckIds(selectedCheckIds.filter(c => c !== id));
        else setSelectedCheckIds([...selectedCheckIds, id]);
    };

    return (
        <div className="flex h-full space-x-6">

            {/* Left Panel: Configuration */}
            <div className="w-1/3 flex flex-col space-y-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 font-bold text-gray-700 flex justify-between items-center">
                        <span>1. Select Devices</span>
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">{selectedDeviceIds.length} Selected</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {devices.map(device => (
                            <div
                                key={device.id}
                                onClick={() => toggleDevice(device.id)}
                                className={`p-3 mb-2 rounded-lg cursor-pointer border flex justify-between items-center transition ${selectedDeviceIds.includes(device.id) ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' : 'bg-white border-gray-100 hover:border-gray-300'}`}
                            >
                                <div>
                                    <h4 className="font-bold text-sm text-gray-800">{device.hostname}</h4>
                                    <p className="text-xs text-gray-400">{device.ip_address}</p>
                                </div>
                                {selectedDeviceIds.includes(device.id) && <CheckCircle size={16} className="text-blue-600" />}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 font-bold text-gray-700 flex justify-between items-center">
                        <span>2. Select Checks</span>
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">{selectedCheckIds.length} Selected</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {availableChecks.map(check => (
                            <div
                                key={check.id}
                                onClick={() => toggleCheck(check.id)}
                                className={`p-3 mb-2 rounded-lg cursor-pointer border flex justify-between items-center transition ${selectedCheckIds.includes(check.id) ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-300' : 'bg-white border-gray-100 hover:border-gray-300'}`}
                            >
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <Shield size={14} className={check.category === 'genie' ? "text-purple-500" : "text-gray-400"} />
                                        <h4 className="font-bold text-sm text-gray-800">{check.name}</h4>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1 truncate w-48">{check.description}</p>
                                </div>
                                {selectedCheckIds.includes(check.id) && <CheckCircle size={16} className="text-indigo-600" />}
                            </div>
                        ))}
                    </div>
                </div>

                <button
                    onClick={handleRunChecks}
                    disabled={running}
                    className="w-full py-3 bg-green-600 text-white rounded-xl font-bold shadow hover:bg-green-700 transition flex items-center justify-center disabled:opacity-50"
                >
                    {running ? <Activity className="animate-spin mr-2" /> : <Play className="mr-2" />} Run Checks Now
                </button>
            </div>

            {/* Right Panel: Execution Results */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h2 className="font-bold text-gray-800 flex items-center"><Activity size={18} className="mr-2 text-gray-500" /> Execution Results</h2>
                    <button className="text-xs text-blue-600 hover:underline" onClick={fetchCheckRuns}>Refresh</button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white text-gray-500 border-b border-gray-100 font-bold text-xs uppercase">
                            <tr>
                                <th className="p-4 w-8"></th>
                                <th className="p-4">Device</th>
                                <th className="p-4">Check</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {checkRuns.map(run => (
                                <React.Fragment key={run.id}>
                                    <tr
                                        onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
                                        className="hover:bg-gray-50 cursor-pointer"
                                    >
                                        <td className="p-4 text-gray-300">
                                            {expandedRunId === run.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </td>
                                        <td className="p-4 font-medium text-gray-900">{run.device_hostname}</td>
                                        <td className="p-4 text-gray-600">{run.check_name}</td>
                                        <td className="p-4">
                                            {run.status === 'success' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700"><CheckCircle size={10} className="mr-1" /> Pass</span>}
                                            {run.status === 'failed' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700"><XCircle size={10} className="mr-1" /> Fail</span>}
                                            {run.status === 'running' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700"><Activity size={10} className="mr-1 animate-spin" /> Running</span>}
                                            {run.status === 'pending' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-500"><Clock size={10} className="mr-1" /> Pending</span>}
                                        </td>
                                        <td className="p-4 text-gray-400 text-xs">{new Date(run.created_at).toLocaleTimeString()}</td>
                                    </tr>
                                    {expandedRunId === run.id && (
                                        <tr className="bg-gray-50">
                                            <td colSpan="5" className="p-4">
                                                <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
                                                    <div className="flex items-center text-gray-400 text-xs mb-2 border-b border-gray-700 pb-2">
                                                        <Terminal size={12} className="mr-2" /> Console Output
                                                    </div>
                                                    <pre className="text-gray-300 font-mono text-xs whitespace-pre-wrap max-h-64 overflow-y-auto">
                                                        {run.output || "No output available."}
                                                    </pre>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                    {checkRuns.length === 0 && (
                        <div className="p-8 text-center text-gray-400">Run a check to see results here.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Checks;
