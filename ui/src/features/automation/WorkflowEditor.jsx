import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, X, GripVertical, Save, Play, Clock, CheckCircle, Server, FileText, Trash2 } from 'lucide-react';

const STEP_TYPES = [
    { type: 'readiness', label: 'Readiness Check', icon: CheckCircle, color: 'text-indigo-600' },
    { type: 'distribution', label: 'Software Distribution', icon: Server, color: 'text-blue-600' },
    { type: 'precheck', label: 'Pre-Checks', icon: FileText, color: 'text-purple-600' },
    { type: 'activation', label: 'Activation', icon: Play, color: 'text-green-600' },
    { type: 'postcheck', label: 'Post-Checks', icon: FileText, color: 'text-teal-600' },
    { type: 'wait', label: 'Wait', icon: Clock, color: 'text-orange-600' },
    { type: 'ping', label: 'Reachability Check', icon: Server, color: 'text-pink-600' },
];

const WorkflowEditor = () => {
    const [workflows, setWorkflows] = useState([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState(null);
    const [steps, setSteps] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        fetchWorkflows();
    }, []);

    const fetchWorkflows = async () => {
        try {
            const res = await axios.get('/api/workflows/');
            const data = res.data.results || res.data; // Handle pagination
            setWorkflows(data);
            if (data.length > 0 && !selectedWorkflow) {
                selectWorkflow(data[0]);
            }
        } catch (error) {
            console.error("Failed to fetch workflows", error);
        }
    };

    const selectWorkflow = (wf) => {
        setSelectedWorkflow(wf);
        setShowDeleteConfirm(false);
        // Deep copy steps
        const sortedSteps = [...wf.steps].sort((a, b) => a.order - b.order);
        setSteps(sortedSteps);
    };

    const handleDragEnd = (result) => {
        if (!result.destination) return;

        const items = Array.from(steps);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        // Update order locally
        const updated = items.map((item, index) => ({
            ...item,
            order: index + 1
        }));
        setSteps(updated);
    };

    const addStep = (type) => {
        const typeDef = STEP_TYPES.find(t => t.type === type);
        const newStep = {
            id: `temp-${Date.now()}`, // Temporary ID
            name: typeDef.label,
            step_type: type,
            order: steps.length + 1,
            config: type === 'wait' ? { duration: 30 } : type === 'ping' ? { retries: 3, interval: 10 } : {}
        };
        setSteps([...steps, newStep]);
    };

    const removeStep = (index) => {
        const newSteps = [...steps];
        newSteps.splice(index, 1);
        setSteps(newSteps.map((s, i) => ({ ...s, order: i + 1 })));
    };

    const updateStepConfig = (index, key, value) => {
        const newSteps = [...steps];
        newSteps[index].config = { ...newSteps[index].config, [key]: value };
        setSteps(newSteps);
    };

    const saveWorkflow = async () => {
        if (!selectedWorkflow) return;
        setIsSaving(true);
        try {
            // Strip temp IDs
            const payload = steps.map(s => ({
                name: s.name,
                step_type: s.step_type,
                order: s.order,
                config: s.config
            }));

            await axios.post(`/api/workflows/${selectedWorkflow.id}/update_steps/`, payload);
            await fetchWorkflows(); // Refresh
            alert("Workflow saved successfully!");
        } catch (error) {
            console.error("Failed to save", error);
            alert("Failed to save workflow.");
        } finally {
            setIsSaving(false);
        }
    };

    const createNewWorkflow = async () => {
        const name = prompt("Enter workflow name:");
        if (name) {
            try {
                const res = await axios.post('/api/workflows/', { name, description: 'Custom workflow' });
                setWorkflows([...workflows, res.data]);
                selectWorkflow(res.data);
            } catch (error) {
                console.error("Failed to create workflow", error);
            }
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-6 flex h-[calc(100vh-100px)] space-x-6">
            {/* Sidebar: Workflow List */}
            <div className="w-1/4 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="font-bold text-gray-700">Workflows</h2>
                    <button onClick={createNewWorkflow} className="text-blue-600 hover:text-blue-800">
                        <Plus size={20} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {workflows.map(wf => (
                        <div
                            key={wf.id}
                            onClick={() => selectWorkflow(wf)}
                            className={`p-3 cursor-pointer hover:bg-gray-50 border-l-4 ${selectedWorkflow?.id === wf.id ? 'border-blue-500 bg-blue-50' : 'border-transparent'}`}
                        >
                            <div className="font-medium text-gray-800 flex items-center justify-between">
                                {wf.name}
                                {wf.is_default && <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded border border-green-200">DEFAULT</span>}
                            </div>
                            <div className="text-xs text-gray-400">{wf.steps?.length || 0} steps</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Area: Editor */}
            <div className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
                {selectedWorkflow ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-lg">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                                    {selectedWorkflow.name}
                                    {selectedWorkflow.is_default && (
                                        <span className="ml-3 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold uppercase rounded-full border border-green-200">
                                            Default
                                        </span>
                                    )}
                                </h2>
                                <p className="text-sm text-gray-500">Drag and drop to reorder steps</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                {!selectedWorkflow.is_default && (
                                    <>
                                        {showDeleteConfirm ? (
                                            <div className="flex items-center space-x-2 bg-red-50 p-1 rounded border border-red-100">
                                                <span className="text-xs text-red-700 font-bold ml-1">Confirm?</span>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            await axios.delete(`/api/workflows/${selectedWorkflow.id}/`);
                                                            await fetchWorkflows(); // Refresh
                                                            setSelectedWorkflow(null); // Reset
                                                            alert("Workflow deleted.");
                                                        } catch (e) {
                                                            console.error(e);
                                                            alert(e.response?.data?.error || "Failed to delete workflow");
                                                            // Removed setShowDeleteConfirm(false) here to fix UX
                                                        }
                                                    }}
                                                    className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                                >
                                                    Yes
                                                </button>
                                                <button
                                                    onClick={() => setShowDeleteConfirm(false)}
                                                    className="px-2 py-1 text-xs bg-white text-gray-600 border rounded hover:bg-gray-100"
                                                >
                                                    No
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setShowDeleteConfirm(true)}
                                                className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded font-medium border border-transparent hover:border-red-200"
                                                title="Delete Workflow"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await axios.post(`/api/workflows/${selectedWorkflow.id}/set_default/`);
                                                    await fetchWorkflows();
                                                    // Only update flag locally to avoid full re-select flicker
                                                    setWorkflows(prev => prev.map(w => ({ ...w, is_default: w.id === selectedWorkflow.id })));
                                                    setSelectedWorkflow({ ...selectedWorkflow, is_default: true });
                                                    alert("Set as Default Workflow");
                                                } catch (e) {
                                                    console.error(e);
                                                    alert("Failed to set default");
                                                }
                                            }}
                                            className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded font-medium border border-gray-300"
                                        >
                                            Set as Default
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={saveWorkflow}
                                    disabled={isSaving}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center font-medium disabled:opacity-50"
                                >
                                    <Save size={18} className="mr-2" /> {isSaving ? 'Saving...' : 'Save Workflow'}
                                </button>
                            </div>
                        </div>

                        {/* Editor Canvas */}
                        <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
                            <DragDropContext onDragEnd={handleDragEnd}>
                                <Droppable droppableId="workflow-steps">
                                    {(provided) => (
                                        <div
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                            className="space-y-3"
                                        >
                                            {steps.map((step, index) => {
                                                const typeDef = STEP_TYPES.find(t => t.type === step.step_type) || STEP_TYPES[0];
                                                const Icon = typeDef.icon;

                                                return (
                                                    <Draggable key={step.id || `step-${index}`} draggableId={String(step.id || `step-${index}`)} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                className={`bg-white p-4 rounded border shadow-sm flex items-center group ${snapshot.isDragging ? 'ring-2 ring-blue-500 z-10' : 'border-gray-200'}`}
                                                            >
                                                                {/* Drag Handle */}
                                                                <div {...provided.dragHandleProps} className="mr-3 text-gray-400 cursor-grab hover:text-gray-600">
                                                                    <GripVertical size={20} />
                                                                </div>

                                                                {/* Icon */}
                                                                <div className={`p-2 rounded bg-gray-100 mr-4 ${typeDef.color}`}>
                                                                    <Icon size={20} />
                                                                </div>

                                                                {/* Content */}
                                                                <div className="flex-1">
                                                                    <div className="font-bold text-gray-700">{step.name}</div>
                                                                    <div className="text-xs text-gray-400 font-mono uppercase">{step.step_type}</div>

                                                                    {/* Config Inputs */}
                                                                    {step.step_type === 'wait' && (
                                                                        <div className="mt-2 flex items-center text-sm">
                                                                            <span className="mr-2 text-gray-600">Duration (sec):</span>
                                                                            <input
                                                                                type="number"
                                                                                value={step.config?.duration || 30}
                                                                                onChange={(e) => updateStepConfig(index, 'duration', parseInt(e.target.value))}
                                                                                className="w-20 px-2 py-1 border rounded text-xs"
                                                                            />
                                                                        </div>
                                                                    )}
                                    {step.step_type === 'ping' && (
                                        <div className="mt-2 flex items-center space-x-4 text-sm">
                                            <div className="flex items-center">
                                                <span className="mr-2 text-gray-600">Retries:</span>
                                                <input
                                                    type="number"
                                                    value={step.config?.retries || 3}
                                                    onChange={(e) => updateStepConfig(index, 'retries', parseInt(e.target.value))}
                                                    className="w-16 px-2 py-1 border rounded text-xs"
                                                />
                                            </div>
                                            <div className="flex items-center">
                                                <span className="mr-2 text-gray-600">Interval (s):</span>
                                                <input
                                                    type="number"
                                                    value={step.config?.interval || 10}
                                                    onChange={(e) => updateStepConfig(index, 'interval', parseInt(e.target.value))}
                                                    className="w-16 px-2 py-1 border rounded text-xs"
                                                />
                                            </div>
                                        </div>
                                    )}
                                                                </div>

                                                                {/* Delete */}
                                                                <button onClick={() => removeStep(index)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <X size={20} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                );
                                            })}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </DragDropContext>

                            {/* Add Step Bar */}
                            <div className="mt-6 border-t-2 border-dashed border-gray-200 pt-6">
                                <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">Add Step</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                                    {STEP_TYPES.map(type => (
                                        <button
                                            key={type.type}
                                            onClick={() => addStep(type.type)}
                                            className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded hover:bg-white hover:border-blue-300 hover:shadow-sm transition-all bg-gray-50"
                                        >
                                            <type.icon size={20} className={`mb-1 ${type.color}`} />
                                            <span className="text-xs font-medium text-gray-600">{type.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                        Select a workflow to edit
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkflowEditor;
