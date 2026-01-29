import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, Plus, RefreshCw, Server, Filter, ChevronDown, CheckCircle, AlertCircle, HardDrive, Settings } from 'lucide-react';
import ImportManager from './ImportManager';
import AddDeviceModal from './AddDeviceModal';
import ConfirmModal from './ConfirmModal';
import TableConfigModal from './TableConfigModal';
import { useSortableData } from '../../hooks/useSortableData';
import SortableHeader from '../../components/SortableHeader';
import { useAuth } from '../../context/AuthContext';

const Devices = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [focusMode, setFocusMode] = useState('Default'); // Default, Software Images
    const [showFocusMenu, setShowFocusMenu] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showConfigModal, setShowConfigModal] = useState(false);

    // Confirm Modal State
    const [confirmModalData, setConfirmModalData] = useState(null);

    // New State for Search & Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSite, setFilterSite] = useState('');
    const [filterModel, setFilterModel] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Legacy support for sidebar filters (now mostly for compliance checks)
    const [selectedFilters, setSelectedFilters] = useState(new Set());
    const [showFilterSidebar, setShowFilterSidebar] = useState(false); // Default to closed as we have top filters now

    // New State for Selection
    const [selectedDevices, setSelectedDevices] = useState(new Set());

    // Define all possible columns
    const allColumns = [
        { key: 'hostname', label: 'Device Name', sortKey: 'hostname', required: true },
        { key: 'ip_address', label: 'IP Address', sortKey: 'ip_address' },
        { key: 'site', label: 'Site', sortKey: 'site' },
        { key: 'model', label: 'Model', sortKey: 'model' },
        { key: 'family', label: 'Device Family', sortKey: 'family' },
        { key: 'platform', label: 'Platform', sortKey: 'platform' },
        { key: 'version', label: 'Image Version', sortKey: 'version' },
        { key: 'last_sync', label: 'Last Sync', sortKey: 'last_sync_time' },
        { key: 'reachability', label: 'Reachability', sortKey: 'reachability' },
        { key: 'compliance', label: 'Compliance', sortKey: 'compliance_status' },
        { key: 'boot_method', label: 'Boot Method', sortKey: 'boot_method' },
        { key: 'mac_address', label: 'MAC Address', sortKey: 'mac_address' },
    ];

    // Focus mode presets - define which columns to show for each focus
    const focusPresets = {
        'Default': ['hostname', 'ip_address', 'site', 'model', 'family', 'last_sync', 'reachability', 'compliance'],
        'Software Images': ['hostname', 'ip_address', 'site', 'model', 'version', 'boot_method', 'last_sync', 'compliance'],
        'Provision': ['hostname', 'ip_address', 'mac_address', 'site', 'model', 'platform', 'reachability', 'family']
    };

    // Load selected columns from localStorage or use defaults
    const getDefaultColumns = () => {
        const saved = localStorage.getItem('deviceTableColumns');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to parse saved columns', e);
            }
        }
        // Default columns based on current focus mode
        const presetKeys = focusPresets['Default'];
        return allColumns.filter(col => presetKeys.includes(col.key));
    };

    const [selectedColumns, setSelectedColumns] = useState(getDefaultColumns());

    const saveColumnConfig = (columns) => {
        setSelectedColumns(columns);
        localStorage.setItem('deviceTableColumns', JSON.stringify(columns));
    };

    // Apply focus mode preset
    const applyFocusPreset = (mode) => {
        const presetKeys = focusPresets[mode];
        if (presetKeys) {
            const presetColumns = allColumns.filter(col => presetKeys.includes(col.key));
            saveColumnConfig(presetColumns);
        }
        setFocusMode(mode);
        setShowFocusMenu(false);
    };

    const toggleFilter = (filter) => {
        const newFilters = new Set(selectedFilters);
        if (newFilters.has(filter)) {
            newFilters.delete(filter);
        } else {
            newFilters.add(filter);
        }
        setSelectedFilters(newFilters);
    };

    // Selection Handlers
    const toggleSelectAll = () => {
        if (selectedDevices.size === filteredDevices.length) {
            setSelectedDevices(new Set());
        } else {
            const allIds = new Set(filteredDevices.map(d => d.id));
            setSelectedDevices(allIds);
        }
    };

    const toggleSelectDevice = (id) => {
        const newSelected = new Set(selectedDevices);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedDevices(newSelected);
    };

    // Extract unique values for dropdowns
    const uniqueSites = [...new Set(devices.map(d => d.site || 'Global'))].sort();
    const uniqueModels = [...new Set(devices.map(d => d.model).filter(Boolean))].sort();

    const filteredDevices = devices.filter(dev => {
        // 1. Structured Filters
        if (filterSite && (dev.site || 'Global') !== filterSite) return false;
        if (filterModel && dev.model !== filterModel) return false;
        if (filterStatus && (dev.last_sync_status || 'Pending') !== filterStatus) return false;

        // 2. Text Search (Generic)
        const searchLower = searchTerm.toLowerCase();
        if (searchTerm && !((dev.hostname || '').toLowerCase().includes(searchLower) ||
            (dev.ip_address || '').includes(searchLower))) {
            return false;
        }

        // 2. Sidebar Filters (OR logic)
        if (selectedFilters.size === 0) return true;

        let matchesFilter = false;
        if (selectedFilters.has('Unreachable') && dev.reachability === 'Unreachable') matchesFilter = true;
        if (selectedFilters.has('Unassigned') && (!dev.site || dev.site === 'Global')) matchesFilter = true;
        // For demo purposes, we can assume 'Non Compliant' matches if version is not 17.9.4a
        if (selectedFilters.has('Non Compliant') && dev.version !== '17.9.4a') matchesFilter = true;
        if (selectedFilters.has('Outdated Software Image') && dev.version !== '17.9.4a') matchesFilter = true;

        return matchesFilter;
    });

    const { items: sortedDevices, requestSort, sortConfig } = useSortableData(filteredDevices);

    // Permission check helper
    const can = (perm) => {
        if (!user) return false;
        return user.is_superuser || (user.permissions && user.permissions.includes(perm));
    };

    useEffect(() => {
        fetchDevices();
    }, []);

    const fetchDevices = async () => {
        // Only show loading spinner on initial load to avoid flickering during polling
        if (devices.length === 0) setLoading(true);
        try {
            const res = await axios.get('/api/dcim/devices/');
            setDevices(res.data.results || res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Polling Effect: If any device is 'In Progress', poll every 3 seconds
    useEffect(() => {
        const hasInProgress = devices.some(d => d.last_sync_status === 'In Progress');
        if (hasInProgress) {
            const interval = setInterval(fetchDevices, 3000);
            return () => clearInterval(interval);
        }
    }, [devices]);

    const handleSync = async (idsOrEvent = null) => {
        let targets = [];

        // Determine targets: passed array (floating btn) or current selection (top btn)
        if (Array.isArray(idsOrEvent)) {
            targets = idsOrEvent;
        } else if (selectedDevices.size > 0) {
            targets = Array.from(selectedDevices);
        }

        // Enforce selection
        if (targets.length === 0) {
            setConfirmModalData({
                title: "Selection Required",
                message: "Please select at least one device to sync.",
                confirmText: "OK",
                showCancel: false,
                onConfirm: () => setConfirmModalData(null),
                onCancel: () => setConfirmModalData(null)
            });
            return;
        }

        setConfirmModalData({
            title: "Sync Confirmation",
            message: `This will connect to ${targets.length} devices to discover versions and inventory data. Continue?`,
            confirmText: "Start Sync",
            onConfirm: async () => {
                setConfirmModalData(null);
                try {
                    await axios.post('/api/dcim/devices/sync/', { scope: 'selection', ids: targets });
                    // alert("Sync started! Check job history or refresh list in a few moments."); // Removed alert
                    setSelectedDevices(new Set());
                    // Trigger immediate fetch to see "In Progress"
                    fetchDevices();
                    // And another one in 500ms to ensure threads started
                    setTimeout(fetchDevices, 500);
                } catch (error) {
                    console.error(error);
                    alert("Failed to start sync.");
                }
            }
        });
    };

    const handleDelete = async () => {
        if (selectedDevices.size === 0) return;

        setConfirmModalData({
            title: "Delete Devices",
            message: `Are you sure you want to delete ${selectedDevices.size} selected devices? This action cannot be undone.`,
            confirmText: "Delete",
            isDestructive: true,
            onConfirm: async () => {
                setConfirmModalData(null);
                try {
                    // Delete one by one for now or bulk if API supports
                    await Promise.all(Array.from(selectedDevices).map(id => axios.delete(`/api/dcim/devices/${id}/`)));
                    alert("Devices deleted successfully.");
                    setSelectedDevices(new Set());
                    fetchDevices();
                } catch (error) {
                    console.error(error);
                    alert("Failed to delete devices.");
                }
            }
        });
    };

    const handleUpgrade = () => {
        if (selectedDevices.size === 0) return;
        navigate('/upgrade', { state: { selectedDevices: Array.from(selectedDevices) } });
    };

    // Render cell based on column key
    const renderCell = (dev, column) => {
        switch (column.key) {
            case 'hostname':
                return (
                    <td key={column.key} className="p-4 font-semibold text-blue-600 group-hover:underline cursor-pointer flex items-center">
                        <Server size={16} className="mr-2 text-gray-400 group-hover:text-blue-500" />
                        <Link to={`/devices/${dev.id}`} className="hover:underline">
                            {dev.hostname}
                        </Link>
                    </td>
                );
            case 'ip_address':
                return <td key={column.key} className="p-4 text-gray-600 font-mono text-xs">{dev.ip_address}</td>;
            case 'site':
                return (
                    <td key={column.key} className="p-4 text-gray-600">
                        <Link
                            to={`/sites/${dev.site_id || 'Global'}`}
                            className="hover:text-blue-600 hover:underline text-left block"
                        >
                            {dev.site || 'Global'}
                        </Link>
                    </td>
                );
            case 'model':
                return (
                    <td key={column.key} className="p-4 text-gray-600 font-medium">
                        {dev.model_id ? (
                            <Link to={`/models/${dev.model_id}`} className="hover:text-blue-600 hover:underline">
                                {dev.model}
                            </Link>
                        ) : '-'}
                    </td>
                );
            case 'family':
                return <td key={column.key} className="p-4 text-gray-600">{dev.family || 'Switch'}</td>;
            case 'platform':
                return <td key={column.key} className="p-4 text-gray-600">{dev.platform || '-'}</td>;
            case 'version':
                return <td key={column.key} className="p-4 text-gray-600">{dev.version || '-'}</td>;
            case 'last_sync':
                return (
                    <td key={column.key} className="p-4">
                        <div className="flex flex-col">
                            <span className={`text-xs font-bold ${
                                dev.last_sync_status === 'Completed' ? 'text-green-600' :
                                dev.last_sync_status === 'Failed' ? 'text-red-500' :
                                dev.last_sync_status === 'In Progress' ? 'text-blue-500' : 'text-gray-400'
                            }`}>
                                {dev.last_sync_status || 'Pending'}
                            </span>
                            {dev.last_sync_time && (
                                <span className="text-[10px] text-gray-400">
                                    {new Date(dev.last_sync_time).toLocaleString()}
                                </span>
                            )}
                        </div>
                    </td>
                );
            case 'reachability':
                return (
                    <td key={column.key} className="p-4">
                        <div className={`flex items-center text-xs font-medium ${
                            dev.reachability === 'Unreachable' ? 'text-red-500' :
                            dev.reachability === 'Reachable' ? 'text-green-600' : 'text-gray-400'
                        }`}>
                            {dev.reachability === 'Unreachable' ? (
                                <><AlertCircle size={14} className="mr-1" /> Unreachable</>
                            ) : dev.reachability === 'Reachable' ? (
                                <><CheckCircle size={14} className="mr-1" /> Reachable</>
                            ) : (
                                <><AlertCircle size={14} className="mr-1" /> Unknown</>
                            )}
                        </div>
                    </td>
                );
            case 'compliance':
                return (
                    <td key={column.key} className="p-4">
                        {(() => {
                            const golden = dev.golden_image?.version;
                            const current = dev.version;
                            if (!golden) {
                                return <span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-500">No Standard</span>;
                            }
                            const compareVersions = (v1, v2) => {
                                if (!v1 || !v2) return 0;
                                const p1 = v1.toString().split(/[\.-]/);
                                const p2 = v2.toString().split(/[\.-]/);
                                for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
                                    const val1 = p1[i] || '';
                                    const val2 = p2[i] || '';
                                    const n1 = parseInt(val1);
                                    const n2 = parseInt(val2);
                                    if (!isNaN(n1) && !isNaN(n2)) {
                                        if (n1 > n2) return 1;
                                        if (n1 < n2) return -1;
                                    } else {
                                        if (val1 > val2) return 1;
                                        if (val1 < val2) return -1;
                                    }
                                }
                                return 0;
                            };
                            const comparison = compareVersions(current, golden);
                            if (comparison < 0) {
                                return <span className="text-xs font-bold px-2 py-1 rounded-full bg-orange-100 text-orange-700">Outdated</span>;
                            } else if (comparison > 0) {
                                return <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700">Ahead</span>;
                            } else {
                                return <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-700">Up to Date</span>;
                            }
                        })()}
                    </td>
                );
            case 'boot_method':
                return <td key={column.key} className="p-4 text-gray-600 text-xs">{dev.boot_method || 'Unknown'}</td>;
            case 'mac_address':
                return <td key={column.key} className="p-4 text-gray-400 text-xs font-mono uppercase">{dev.mac_address || '-'}</td>;
            default:
                return <td key={column.key} className="p-4 text-gray-600">-</td>;
        }
    };

    // Better approach: Import useNavigate at top and use it

    // ... (This replace block is tricky without imports. Let's fix imports first in another block or do it carefully)

    // Actual implementation plan:
    // 1. Add hook call at top: const navigate = useNavigate();
    // 2. Update handleUpgrade to use navigate('/upgrade', { state: { selectedDevices: Array.from(selectedDevices) } })

    // Let's do step 1 and 2 in separate replace calls or one smart one.
    // I will use a larger block to add import and hook.

    return (
        <div className="space-y-4">
            {/* Header / Breadcrumb Area */}
            <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <span className="font-bold text-gray-800 text-lg">Provision / Inventory</span>
                </div>
                <div className="flex space-x-4">
                    <Link to="/standards" className="text-gray-600 text-sm font-semibold hover:underline flex items-center bg-white border border-gray-200 px-3 py-2 rounded hover:bg-gray-50">
                        <CheckCircle size={16} className="mr-1 text-green-600" /> Standards
                    </Link>
                    {can('devices.sync_device_inventory') && (
                        <button onClick={handleSync} className="text-gray-600 text-sm font-semibold hover:underline flex items-center bg-white border border-gray-200 px-3 py-2 rounded hover:bg-gray-50">
                            <RefreshCw size={16} className="mr-1" /> Sync Inventory
                        </button>
                    )}
                    <button
                        onClick={() => setShowConfigModal(true)}
                        className="text-gray-600 text-sm font-semibold hover:underline flex items-center bg-white border border-gray-200 px-3 py-2 rounded hover:bg-gray-50"
                        title="Configure Table Columns"
                    >
                        <Settings size={16} className="mr-1" /> Configure Table
                    </button>
                    {can('devices.add_device') && <ImportManager onImportSuccess={fetchDevices} />}
                    {can('devices.add_device') && (
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="text-blue-600 text-sm font-semibold hover:underline flex items-center bg-white border border-gray-200 px-3 py-2 rounded hover:bg-gray-50"
                        >
                            <Plus size={16} className="mr-1" /> Add Device
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center justify-between bg-white p-2 rounded shadow-sm border border-gray-200">
                <div className="flex items-center space-x-4 w-full">
                    {/* Focus Dropdown */}
                    <div className="relative">
                        <span className="text-xs text-gray-500 mr-2 uppercase font-bold tracking-wider">Devices ({filteredDevices.length})</span>
                        <div className="inline-block relative">
                            <span className="text-xs text-gray-500 mr-1">Focus:</span>
                            <button
                                onClick={() => setShowFocusMenu(!showFocusMenu)}
                                className="text-blue-600 font-semibold text-sm flex items-center hover:underline focus:outline-none"
                            >
                                {focusMode} <ChevronDown size={14} className="ml-1" />
                            </button>

                            {/* Focus Menu */}
                            {showFocusMenu && (
                                <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-200 shadow-lg rounded-md z-50 py-1">
                                    <button onClick={() => applyFocusPreset('Default')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600">Default</button>
                                    <button onClick={() => applyFocusPreset('Software Images')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600">Software Images</button>
                                    <button onClick={() => applyFocusPreset('Provision')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600">Provision</button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="h-6 w-px bg-gray-300 mx-2"></div>

                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Data search (hostname, IP, platform...)"
                            className="pl-9 pr-4 py-1.5 border border-gray-200 rounded w-full text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <span className="text-xs font-bold">✕</span>
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex items-center space-x-2 pl-4">
                    <button
                        onClick={() => { setSearchTerm(''); setFilterSite(''); setFilterModel(''); setFilterStatus(''); setSelectedFilters(new Set()); fetchDevices(); }}
                        className="p-2 text-gray-500 hover:text-blue-600 text-xs font-semibold border border-transparent hover:border-gray-200 rounded"
                        title="Reset Search & Filters"
                    >
                        Reset
                    </button>
                    <button onClick={fetchDevices} className="p-2 text-gray-500 hover:text-blue-600"><RefreshCw size={16} /></button>
                    <button
                        onClick={() => setShowFilterSidebar(!showFilterSidebar)}
                        className={`p-2 hover:text-blue-600 ${showFilterSidebar ? 'text-blue-600 bg-blue-50 rounded' : 'text-gray-500'}`}
                    >
                        <Filter size={16} />
                    </button>
                </div>
            </div>

            {/* Main Content Area: Sidebar + Table */}
            <div className="flex items-start space-x-4">
                {/* Left Filter Sidebar */}
                {showFilterSidebar && (
                    <div className="w-64 flex-shrink-0 transition-all duration-300">
                        <div className="flex justify-between items-center mb-3 px-1">
                            <h3 className="text-xs font-bold text-gray-500 uppercase">Device Work Items</h3>
                            {selectedFilters.size > 0 && (
                                <button onClick={() => setSelectedFilters(new Set())} className="text-[10px] text-blue-600 hover:underline">Clear</button>
                            )}
                        </div>
                        <div className="bg-white rounded border border-gray-200 p-2 space-y-1 max-h-[600px] overflow-y-auto">
                            {['Unreachable', 'Unassigned', 'Untagged', 'Failed Provision', 'Non Compliant', 'Outdated Software Image', 'No Golden Image'].map(item => (
                                <label key={item} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        className="rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                                        checked={selectedFilters.has(item)}
                                        onChange={() => toggleFilter(item)}
                                    />
                                    <span className={`text-sm ${selectedFilters.has(item) ? 'text-blue-700 font-medium' : 'text-gray-600'} group-hover:text-gray-900`}>{item}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="flex-1 bg-white rounded border border-gray-200 overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white border-b border-gray-200 text-gray-500 font-bold text-xs">
                            <tr>
                                <th className="p-4 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded"
                                        checked={filteredDevices.length > 0 && selectedDevices.size === filteredDevices.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                {selectedColumns.map(col => (
                                    <SortableHeader 
                                        key={col.key}
                                        label={col.label} 
                                        sortKey={col.sortKey} 
                                        currentSort={sortConfig} 
                                        onSort={requestSort} 
                                    />
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sortedDevices.length > 0 ? (
                                sortedDevices.map(dev => (
                                    <tr key={dev.id} className={`transition duration-150 ease-in-out group ${selectedDevices.has(dev.id) ? 'bg-blue-50' : 'hover:bg-blue-50/50'}`}>
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                className="rounded"
                                                checked={selectedDevices.has(dev.id)}
                                                onChange={() => toggleSelectDevice(dev.id)}
                                            />
                                        </td>
                                        {selectedColumns.map(col => renderCell(dev, col))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={selectedColumns.length + 1} className="p-8 text-center text-gray-500">
                                        No devices found matching your search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    {/* Footer / Pagination Mock */}
                    <div className="bg-gray-50 p-2 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center px-4">
                        <span>{selectedDevices.size} selected</span>
                        <span>1-{devices.length} of {devices.length}</span>
                    </div>
                </div>
                {/* Floating Action Bar for Selection */}
                {selectedDevices.size > 0 && (
                    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 shadow-xl rounded-full px-6 py-3 flex items-center space-x-6 z-50 animate-in fade-in slide-in-from-bottom-4">
                        <span className="text-sm font-bold text-gray-700">{selectedDevices.size} selected</span>
                        <div className="h-4 w-px bg-gray-300"></div>
                        {can('devices.sync_device_inventory') && (
                            <button
                                onClick={() => handleSync(Array.from(selectedDevices))}
                                className="text-sm font-medium text-gray-600 hover:text-blue-600 flex items-center"
                            >
                                <RefreshCw size={16} className="mr-2" /> Sync
                            </button>
                        )}
                        {can('devices.upgrade_device_firmware') && (
                            <button
                                onClick={handleUpgrade}
                                className="text-sm font-medium text-gray-600 hover:text-blue-600 flex items-center"
                            >
                                <HardDrive size={16} className="mr-2" /> Upgrade
                            </button>
                        )}
                        {can('devices.delete_device') && (
                            <button
                                onClick={handleDelete}
                                className="text-sm font-medium text-gray-600 hover:text-red-600 flex items-center"
                            >
                                <AlertCircle size={16} className="mr-2" /> Delete
                            </button>
                        )}
                        <div className="h-4 w-px bg-gray-300"></div>
                        <button
                            onClick={() => setSelectedDevices(new Set())}
                            className="text-xs text-gray-400 hover:text-gray-600"
                        >
                            Clear Selection
                        </button>
                    </div>
                )}

            </div>

            {/* Modals */}
            {
                showAddModal && (
                    <AddDeviceModal
                        onClose={() => setShowAddModal(false)}
                        onSuccess={fetchDevices}
                    />
                )
            }

            {/* Confirm Modal */}
            {
                confirmModalData && (
                    <ConfirmModal
                        title={confirmModalData.title}
                        message={confirmModalData.message}
                        confirmText={confirmModalData.confirmText}
                        onConfirm={confirmModalData.onConfirm}
                        onCancel={() => setConfirmModalData(null)}
                        showCancel={confirmModalData.showCancel !== undefined ? confirmModalData.showCancel : true}
                    />
                )
            }

            {/* Table Configuration Modal */}
            {showConfigModal && (
                <TableConfigModal
                    isOpen={showConfigModal}
                    onClose={() => setShowConfigModal(false)}
                    availableColumns={allColumns}
                    selectedColumns={selectedColumns}
                    onSave={saveColumnConfig}
                />
            )}
        </div >
    );
};

export default Devices;

