import React, { useState } from 'react';
import { X, Plus, Trash2, ChevronUp, ChevronDown, RotateCcw, Save } from 'lucide-react';

const TableConfigModal = ({ isOpen, onClose, availableColumns, selectedColumns, onSave }) => {
    const [selected, setSelected] = useState([...selectedColumns]);
    const [available, setAvailable] = useState(
        availableColumns.filter(col => !selectedColumns.find(s => s.key === col.key))
    );

    const addColumn = (column) => {
        setSelected([...selected, column]);
        setAvailable(available.filter(c => c.key !== column.key));
    };

    const removeColumn = (column) => {
        setAvailable([...available, column]);
        setSelected(selected.filter(c => c.key !== column.key));
    };

    const moveUp = (index) => {
        if (index === 0) return;
        const newSelected = [...selected];
        [newSelected[index - 1], newSelected[index]] = [newSelected[index], newSelected[index - 1]];
        setSelected(newSelected);
    };

    const moveDown = (index) => {
        if (index === selected.length - 1) return;
        const newSelected = [...selected];
        [newSelected[index], newSelected[index + 1]] = [newSelected[index + 1], newSelected[index]];
        setSelected(newSelected);
    };

    const handleReset = () => {
        setSelected([...selectedColumns]);
        setAvailable(availableColumns.filter(col => !selectedColumns.find(s => s.key === col.key)));
    };

    const handleSave = () => {
        onSave(selected);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-gray-900">Table Configuration</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden flex p-6 gap-6">
                    {/* Available Columns */}
                    <div className="flex-1 flex flex-col">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Available Columns</h4>
                        <div className="flex-1 border border-gray-200 rounded-lg overflow-y-auto bg-gray-50">
                            <div className="p-2 space-y-1">
                                {available.map((col) => (
                                    <div
                                        key={col.key}
                                        className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 hover:border-blue-300 transition group"
                                    >
                                        <span className="text-sm text-gray-700">{col.label}</span>
                                        <button
                                            onClick={() => addColumn(col)}
                                            className="opacity-0 group-hover:opacity-100 text-green-600 hover:text-green-700 transition"
                                            title="Add column"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                                {available.length === 0 && (
                                    <div className="p-8 text-center text-gray-400 text-sm">
                                        All columns selected
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => available.forEach(col => addColumn(col))}
                            disabled={available.length === 0}
                            className="mt-3 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm flex items-center justify-center gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Add All
                        </button>
                    </div>

                    {/* Selected Columns */}
                    <div className="flex-1 flex flex-col">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Selected Columns</h4>
                        <div className="flex-1 border border-gray-200 rounded-lg overflow-y-auto bg-gray-50">
                            <div className="p-2 space-y-1">
                                {selected.map((col, index) => (
                                    <div
                                        key={col.key}
                                        className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 group"
                                    >
                                        <span className="text-sm text-gray-700 font-medium">{col.label}</span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => moveUp(index)}
                                                disabled={index === 0}
                                                className="text-blue-600 hover:text-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition p-1"
                                                title="Move up"
                                            >
                                                <ChevronUp className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => moveDown(index)}
                                                disabled={index === selected.length - 1}
                                                className="text-blue-600 hover:text-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition p-1"
                                                title="Move down"
                                            >
                                                <ChevronDown className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => removeColumn(col)}
                                                className="text-red-600 hover:text-red-700 transition p-1"
                                                title="Remove column"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {selected.length === 0 && (
                                    <div className="p-8 text-center text-gray-400 text-sm">
                                        No columns selected
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => selected.forEach(col => removeColumn(col))}
                            disabled={selected.length === 0}
                            className="mt-3 w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm flex items-center justify-center gap-2"
                        >
                            <Trash2 className="h-4 w-4" />
                            Remove All
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium text-sm flex items-center gap-2"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Reset
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm flex items-center gap-2"
                    >
                        <Save className="h-4 w-4" />
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TableConfigModal;
