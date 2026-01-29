import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, FileCode, Server, CheckCircle, AlertTriangle } from 'lucide-react';

const ValidationSettings = () => {
    const [checks, setChecks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('script'); // 'script' or 'genie'

    // Form State
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newCommand, setNewCommand] = useState(''); // For scripts
    const [genieModule, setGenieModule] = useState(''); // For genie
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        fetchChecks();
    }, []);

    const fetchChecks = async () => {
        try {
            const res = await axios.get('/api/core/checks/');
            setChecks(res.data.results || res.data);
        } catch (error) {
            console.error("Failed to fetch checks", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        // Simple direct delete without native confirm to avoid browser blocking issues
        // In production use a custom modal
        try {
            await axios.delete(`/api/core/checks/${id}/`);
            setChecks(checks.filter(c => c.id !== id));
        } catch (error) {
            console.error("Delete failed", error);
            alert("Failed to delete check.");
        }
    };

    const handleAddScript = async (e) => {
        e.preventDefault();
        setAdding(true);
        try {
            const res = await axios.post('/api/core/checks/', {
                name: newName,
                description: newDesc,
                command: newCommand,
                category: 'script'
            });
            setChecks([...checks, res.data]);
            setNewName('');
            setNewDesc('');
            setNewCommand('');
        } catch (error) {
            console.error("Add failed", error);
            alert("Failed to add script.");
        } finally {
            setAdding(false);
        }
    };

    const handleAddGenie = async (e) => {
        e.preventDefault();
        setAdding(true);
        try {
            // No auto-formatting prefixes, take user input as-is via 'genieModule' state (mapped to name/command)
            // User requested: "don't add prefix 'learn' in genie learn module"
            // We assume the user enters the NAME (e.g. "Ospf") and COMMAND (e.g. "learn ospf") 
            // BUT the form only has "Genie Module" input currently.
            // Let's adapt: "Genie Module" input -> Name. Make command implied or add input?
            // "don't add prefix 'learn'" implies they want to type "learn ospf" themselves OR they just want the name "Ospf".
            // Let's check the previous code: it generated command `learn ${module}`.

            // To be safe and flexible: I will change the form to have Name and Command, pre-filled with defaults if possible, 
            // OR just use the input for both but without forcing "learn".
            // Re-reading request: "I can't delete name or module name, and also don't add prefix "learn" in genie learn module"

            // Let's trust the user to type what they want.
            // We'll treat the input as the Name (e.g. "Ospf") and default the command to `learn ${input}` but allow editing if I had a command field.
            // Since I don't have a command field in the genie form, I'll add one OR simple logic:
            // Input: "Ospf" -> Name: "Ospf", Command: "learn ospf" (Standard Genie pattern).
            // Input: "learn ospf" -> Name: "Ospf", Command: "learn ospf".

            // Actually, best approach based on "don't add prefix 'learn'":
            // Just use the input value as the Name. 
            // And for command? The backend runner usually needs `learn <feature>`.
            // If the user says "don't add prefix", maybe they want to control the command fully.
            // Let's default command to `learn ${input}` but remove "Genie Learn" from Name.

            const name = genieModule.trim();
            const command = name.toLowerCase(); // User requested removing 'learn' prefix

            const res = await axios.post('/api/core/checks/', {
                name: name, // Just the input, e.g. "Ospf"
                description: newDesc || `Validates ${name} state`,
                command: command, // Still needs to be a valid pyATS command
                category: 'genie'
            });
            setChecks([...checks, res.data]);
            setGenieModule('');
            setNewDesc('');
        } catch (error) {
            console.error("Add failed", error);
            alert("Failed to add Genie module.");
        } finally {
            setAdding(false);
        }
    };

    const scriptChecks = checks.filter(c => c.category === 'script' || !c.category);
    const genieChecks = checks.filter(c => c.category === 'genie');

    if (loading) return <div className="p-8 text-center text-gray-500">Loading settings...</div>;

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">Validation Configuration</h1>
                <p className="text-gray-500 text-sm mt-1">Manage standard scripts and Genie learning modules used in Upgrade Activation.</p>
            </div>

            {/* Tabs */}
            <div className="flex space-x-4 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('script')}
                    className={`pb-3 px-4 flex items-center font-medium text-sm transition-colors ${activeTab === 'script' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <FileCode size={18} className="mr-2" /> Custom Command
                </button>
                <button
                    onClick={() => setActiveTab('genie')}
                    className={`pb-3 px-4 flex items-center font-medium text-sm transition-colors ${activeTab === 'genie' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Server size={18} className="mr-2" /> Genie Learn Modules
                </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {activeTab === 'script' ? (
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="font-bold text-gray-700">Custom Command</h2>
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">{scriptChecks.length} configured</span>
                        </div>

                        {/* Add Form */}
                        <form onSubmit={handleAddScript} className="bg-gray-50 p-4 rounded border border-gray-200 mb-8 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                                <input required type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full border rounded p-2 text-sm" placeholder="e.g. Check OSPF" />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Command</label>
                                <input required type="text" value={newCommand} onChange={e => setNewCommand(e.target.value)} className="w-full border rounded p-2 text-sm font-mono" placeholder="e.g. show ip ospf neighbor" />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                                <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="w-full border rounded p-2 text-sm" placeholder="Optional context" />
                            </div>
                            <div className="col-span-1">
                                <button type="submit" disabled={adding} className="w-full bg-blue-600 text-white rounded p-2 text-sm font-bold hover:bg-blue-700 flex items-center justify-center">
                                    <Plus size={16} className="mr-1" /> Add Script
                                </button>
                            </div>
                        </form>

                        {/* List */}
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b text-xs text-gray-400 uppercase font-bold">
                                <tr>
                                    <th className="p-3 pl-4">Name</th>
                                    <th className="p-3">Command</th>
                                    <th className="p-3">Description</th>
                                    <th className="p-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {scriptChecks.map(check => (
                                    <tr key={check.id} className="hover:bg-gray-50 group">
                                        <td className="p-3 pl-4 font-semibold text-gray-700">{check.name}</td>
                                        <td className="p-3 font-mono text-gray-600 text-xs">{check.command}</td>
                                        <td className="p-3 text-gray-500 text-xs italic">{check.description || '-'}</td>
                                        <td className="p-3 text-right">
                                            <button onClick={() => handleDelete(check.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="font-bold text-gray-700">Genie Learning Modules</h2>
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">{genieChecks.length} configured</span>
                        </div>

                        {/* Add Form */}
                        <form onSubmit={handleAddGenie} className="bg-indigo-50 p-4 rounded border border-indigo-100 mb-8 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-indigo-500 uppercase mb-1">Module / Feature</label>
                                <input required type="text" value={genieModule} onChange={e => setGenieModule(e.target.value)} className="w-full border border-indigo-200 rounded p-2 text-sm font-mono text-indigo-900" placeholder="e.g. ospf, vlan" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-indigo-500 uppercase mb-1">Description</label>
                                <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="w-full border border-indigo-200 rounded p-2 text-sm" placeholder="Optional description" />
                            </div>
                            <div className="col-span-1">
                                <button type="submit" disabled={adding} className="w-full bg-indigo-600 text-white rounded p-2 text-sm font-bold hover:bg-indigo-700 flex items-center justify-center">
                                    <Plus size={16} className="mr-1" /> Add Module
                                </button>
                            </div>
                        </form>

                        {/* List */}
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b text-xs text-gray-400 uppercase font-bold">
                                <tr>
                                    <th className="p-3 pl-4">Name</th>
                                    <th className="p-3">Command (Auto)</th>
                                    <th className="p-3">Description</th>
                                    <th className="p-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {genieChecks.map(check => (
                                    <tr key={check.id} className="hover:bg-gray-50 group">
                                        <td className="p-3 pl-4 font-semibold text-gray-700">{check.name}</td>
                                        <td className="p-3 font-mono text-indigo-600 text-xs">{check.command}</td>
                                        <td className="p-3 text-gray-500 text-xs italic">{check.description || '-'}</td>
                                        <td className="p-3 text-right">
                                            <button onClick={() => handleDelete(check.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ValidationSettings;
