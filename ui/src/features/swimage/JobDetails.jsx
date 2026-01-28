import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
    ArrowLeft, Activity, CheckCircle, XCircle, Clock,
    Server, FileText, Download, Terminal, AlertTriangle,
    Share2, Calendar, ChevronDown
} from 'lucide-react';

const JobDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState([]);
    const [previewCheck, setPreviewCheck] = useState(null);

    const downloadCheck = (run) => {
        const element = document.createElement("a");
        const file = new Blob([run.output], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = `${run.check_name.replace(/\s+/g, '_')}_${run.id}_report.txt`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    const downloadArtifact = async (type) => {
        try {
            const res = await axios.get(`/api/jobs/${id}/download_artifacts/`, {
                params: { type },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;

            // Guess filename from headers or default
            let filename = `job_${id}_${type}.zip`;
            if (type === 'report' || type === 'diff') filename = `job_${id}_${type}.txt`;

            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
        } catch (error) {
            console.error("Download failed", error);
            alert("Failed to download artifacts.");
        }
    };

    // Auto-refresh logs if job is running
    useEffect(() => {
        fetchJobDetails();
        const interval = setInterval(() => {
            if (job && ['running', 'distributing', 'activating'].includes(job.status)) {
                fetchJobDetails();
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [id, job?.status]); // Re-run if ID changes or status changes

    const fetchJobDetails = async () => {
        try {
            const res = await axios.get(`/api/jobs/${id}/`);
            setJob(res.data);

            // Parse logs from the big string
            if (res.data.log) {
                const lines = res.data.log.split('\n').filter(l => l.trim());
                setLogs(lines);
            }
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch job", error);
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading Job Details...</div>;
    if (!job) return <div className="p-8 text-center text-red-500">Job not found</div>;

    const getStatusColor = (status) => {
        if (['success', 'distributed'].includes(status)) return 'bg-green-100 text-green-700 border-green-200';
        if (['running', 'distributing', 'activating'].includes(status)) return 'bg-blue-100 text-blue-700 border-blue-200';
        if (status === 'failed') return 'bg-red-100 text-red-700 border-red-200';
        if (status === 'cancelled') return 'bg-gray-100 text-gray-700 border-gray-200';
        return 'bg-orange-100 text-orange-700 border-orange-200';
    };

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div>
                <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800 flex items-center mb-4 text-sm">
                    <ArrowLeft size={16} className="mr-1" /> Back
                </button>

                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center space-x-3 mb-2">
                            <h1 className="text-2xl font-bold text-gray-900">Job #{job.id}</h1>
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${getStatusColor(job.status)}`}>
                                {job.status}
                            </span>
                        </div>
                        <div className="flex items-center text-gray-500 text-sm space-x-4">
                            <span className="flex items-center">
                                <Server size={14} className="mr-1" /> {job.device_hostname}
                            </span>
                            <span className="flex items-center">
                                <Activity size={14} className="mr-1" /> {job.task_name}
                            </span>
                            <span className="flex items-center">
                                <Calendar size={14} className="mr-1" /> {new Date(job.created_at).toLocaleString()}
                            </span>
                        </div>
                    </div>

                    <div className="flex space-x-2 relative group">
                        <button className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 text-gray-600 flex items-center text-sm">
                            <Download size={16} className="mr-2" /> Download Logs
                            <ChevronDown size={14} className="ml-2" />
                        </button>
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg hidden group-hover:block z-20">
                            <div className="py-1">
                                <button onClick={() => downloadArtifact('report')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    Full Report (TXT)
                                </button>
                                <button onClick={() => downloadArtifact('pre')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    Pre-Checks (ZIP)
                                </button>
                                <button onClick={() => downloadArtifact('post')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    Post-Checks (ZIP)
                                </button>
                                <button onClick={() => downloadArtifact('diff')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    Diff Summary (TXT)
                                </button>
                                <div className="border-t border-gray-100 my-1"></div>
                                <button onClick={() => downloadArtifact('all')} className="block w-full text-left px-4 py-2 text-sm font-bold text-blue-600 hover:bg-gray-100">
                                    Download All (ZIP)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Left Column: Info & Checks */}
                <div className="space-y-6">
                    {/* Device Info */}
                    <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                            <Server size={18} className="mr-2 text-blue-600" /> Device Information
                        </h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Hostname</span>
                                <Link to={`/devices/${job.device}`} className="font-medium text-blue-600 hover:underline">
                                    {job.device_hostname}
                                </Link>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Device ID</span>
                                <span className="font-mono">{job.device}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Target Image</span>
                                <span className="font-medium text-blue-600">{job.image_filename || "N/A"}</span>
                            </div>
                            {job.file_server_name && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">File Server</span>
                                    <span className="font-medium">{job.file_server_name} ({job.file_server_address})</span>
                                </div>
                            )}
                            {job.file_path && (
                                <div className="flex justify-between flex-col">
                                    <span className="text-gray-500">File Path</span>
                                    <span className="font-mono text-xs text-gray-700 bg-gray-50 p-1 rounded break-all">{job.file_path}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Selected Checks Config */}
                    <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                            <CheckCircle size={18} className="mr-2 text-purple-600" /> Selected Checks
                        </h3>
                        <div className="space-y-3">
                            {job.selected_checks_details && job.selected_checks_details.length > 0 ? (
                                job.selected_checks_details.map(check => (
                                    <div key={check.id} className="text-sm p-2 bg-purple-50 rounded border border-purple-100">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-gray-800 text-xs">{check.name}</span>
                                            <span className="text-[10px] uppercase font-bold text-purple-700 px-1.5 py-0.5 bg-purple-100 rounded">{check.check_type || 'Custom'}</span>
                                        </div>
                                        <div className="font-mono text-xs text-gray-600 break-all">{check.command}</div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-400 text-sm italic">No checks selected.</p>
                            )}
                        </div>
                    </div>

                    {/* Progress Timeline */}
                    <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                            <Activity size={18} className="mr-2 text-orange-500" /> Job Progress
                        </h3>
                        <div className="relative border-l-2 border-gray-100 ml-3 space-y-6 pl-6 py-2">
                            {/* Always show core phases, check job.steps for status */}
                            {/* Dynamic Steps from Workflow Engine */}
                            {(job.steps && job.steps.length > 0) ? (
                                job.steps.map((step, idx) => (
                                    <div key={idx} className="relative">
                                        <span className={`absolute -left-[31px] w-4 h-4 rounded-full border-2 ${step.status === 'success' ? 'bg-green-500 border-green-500' :
                                            step.status === 'running' ? 'bg-blue-500 border-blue-500 animate-pulse' :
                                                step.status === 'failed' ? 'bg-red-500 border-red-500' :
                                                    'bg-white border-gray-300'
                                            }`}></span>
                                        <p className={`text-sm font-bold ${step.status === 'pending' ? 'text-gray-400' : 'text-gray-800'
                                            }`}>{step.name}</p>
                                        <p className="text-xs text-gray-400">{step.timestamp || 'Pending'}</p>
                                    </div>
                                ))
                            ) : (
                                /* Fallback for legacy jobs */
                                ['Readiness Verification', 'Software Distribution', 'File Activation', 'Diff Generation'].map((step, idx) => {
                                    const loggedStep = job.steps && job.steps.find(s => s.name === step);
                                    const status = loggedStep ? loggedStep.status : 'pending';
                                    return (
                                        <div key={idx} className="relative">
                                            <span className={`absolute -left-[31px] w-4 h-4 rounded-full border-2 ${status === 'success' ? 'bg-green-500 border-green-500' :
                                                status === 'running' ? 'bg-blue-500 border-blue-500 animate-pulse' :
                                                    status === 'failed' ? 'bg-red-500 border-red-500' :
                                                        'bg-white border-gray-300'
                                                }`}></span>
                                            <p className={`text-sm font-bold ${status === 'pending' ? 'text-gray-400' : 'text-gray-800'
                                                }`}>{step}</p>
                                            <p className="text-xs text-gray-400">{loggedStep ? loggedStep.timestamp : 'Pending'}</p>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Pre-Checks Summary */}
                    <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                            <CheckCircle size={18} className="mr-2 text-indigo-600" /> Checks & Reports
                        </h3>
                        <div className="space-y-3">
                            {job.check_runs && job.check_runs.length > 0 ? (
                                job.check_runs.map(run => (
                                    <div key={run.id} className="text-sm p-3 bg-gray-50 rounded border border-gray-100">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800 text-xs uppercase tracking-wider">{run.check_type} Check</span>
                                                <span className="font-medium text-blue-900">{run.check_name}</span>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${run.status === 'success' ? 'bg-green-100 text-green-700' :
                                                run.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                {run.status}
                                            </span>
                                        </div>

                                        {/* Parameters */}
                                        <div className="mb-2">
                                            <code className="text-[10px] bg-gray-200 px-1 py-0.5 rounded text-gray-600 break-all">
                                                {run.check_command}
                                            </code>
                                        </div>

                                        <div className="flex justify-end space-x-2 pt-2 border-t border-gray-200">
                                            <button
                                                onClick={() => setPreviewCheck(run)}
                                                className="flex items-center space-x-1 text-xs text-gray-500 hover:text-blue-600 font-medium"
                                            >
                                                <FileText size={12} /> <span>Preview</span>
                                            </button>
                                            <button
                                                onClick={() => downloadCheck(run)}
                                                className="flex items-center space-x-1 text-xs text-gray-500 hover:text-blue-600 font-medium"
                                            >
                                                <Download size={12} /> <span>Download</span>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-400 text-sm italic">No specific checks executed.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Console/Logs */}
                <div className="md:col-span-2 space-y-6">
                    {/* Real-time Logs */}
                    <div className="bg-gray-900 rounded-lg shadow-lg overflow-hidden flex flex-col h-[600px]">
                        <div className="bg-gray-800 px-4 py-2 flex justify-between items-center border-b border-gray-700">
                            <h3 className="font-mono text-gray-200 text-sm flex items-center">
                                <Terminal size={14} className="mr-2 text-green-400" /> Execution Log
                            </h3>
                            <span className="text-xs text-gray-500">Live Output</span>
                        </div>
                        <div className="flex-1 p-4 font-mono text-xs overflow-y-auto text-gray-300 space-y-1">
                            {logs.length === 0 ? (
                                <div className="text-gray-600 italic">Waiting for logs...</div>
                            ) : (
                                logs.map((line, idx) => (
                                    <div key={idx} className="break-all border-l-2 border-transparent hover:border-gray-600 pl-2">
                                        {line}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {/* Log Modal */}
            {
                previewCheck && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg shadow-xl w-3/4 max-w-4xl h-3/4 flex flex-col p-0 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">{previewCheck.check_name} Output</h3>
                                    <p className="text-xs text-gray-500 font-mono mt-1">ID: {previewCheck.id} • {new Date(previewCheck.created_at).toLocaleString()}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => downloadCheck(previewCheck)}
                                        className="px-3 py-1.5 border border-gray-300 rounded text-xs font-bold hover:bg-white text-gray-600 flex items-center"
                                    >
                                        <Download size={12} className="mr-1" /> Download
                                    </button>
                                    <button onClick={() => setPreviewCheck(null)} className="text-gray-400 hover:text-gray-600">
                                        <XCircle size={24} />
                                    </button>
                                </div>
                            </div>
                            <pre className="flex-1 bg-gray-900 text-gray-300 p-6 overflow-auto font-mono text-xs whitespace-pre-wrap">
                                {previewCheck.output || "No output captured."}
                            </pre>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default JobDetails;
