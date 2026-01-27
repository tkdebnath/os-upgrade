import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

const SortableHeader = ({ label, sortKey, currentSort, onSort, className = "" }) => {
    const isSorted = currentSort && currentSort.key === sortKey;
    const direction = isSorted ? currentSort.direction : null;

    return (
        <th
            className={`p-4 font-semibold text-gray-600 uppercase text-xs cursor-pointer hover:bg-gray-100 transition select-none group ${className}`}
            onClick={() => onSort(sortKey)}
        >
            <div className="flex items-center space-x-1">
                <span>{label}</span>
                <span className={`text-gray-400 ${isSorted ? 'opacity-100 text-blue-600' : 'opacity-0 group-hover:opacity-50'}`}>
                    {direction === 'ascending' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                </span>
            </div>
        </th>
    );
};

export default SortableHeader;
