import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

const ConfirmModal = ({ title = "Confirm Action", message, onConfirm, onCancel, confirmText = "Confirm", isDestructive = false, showCancel = true }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center">
                        <AlertTriangle size={20} className={`mr-2 ${isDestructive ? 'text-red-600' : 'text-blue-600'}`} />
                        {title}
                    </h2>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded transition">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <p className="text-gray-600 text-sm leading-relaxed">
                        {message}
                    </p>

                    <div className="pt-6 flex justify-end space-x-3">
                        {showCancel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition font-medium"
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onConfirm}
                            className={`px-4 py-2 rounded text-sm font-bold shadow-sm transition flex items-center ${isDestructive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
