import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { LayoutDashboard, Server, Activity, Settings, List, HardDrive, Lock, Shield, Calendar, Map } from 'lucide-react';
import axios from 'axios';

const SidebarItem = ({ to, icon: Icon, label }) => (
    <NavLink
        to={to}
        className={({ isActive }) =>
            `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`
        }
    >
        <Icon size={20} />
        <span className="font-medium">{label}</span>
    </NavLink>
);

const Layout = () => {
    const [user, setUser] = useState({ permissions: [], is_superuser: false, username: 'Checking...' });

    useEffect(() => {
        // Fetch user permissions
        axios.get('/api/auth/me/')
            .then(res => setUser(res.data))
            .catch(err => {
                console.error("Auth check failed", err);
                // Fallback for dev/demo if auth fails
                setUser({ permissions: [], is_superuser: true, username: 'Guest' });
            });
    }, []);

    // Helper to check permission
    // In real app, check specific permissions like 'devices.view_device'
    const can = (perm) => user.is_superuser || (user.permissions && user.permissions.includes(perm));

    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-900 text-white flex flex-col shadow-xl z-20">
                <div className="h-16 flex items-center px-6 border-b border-gray-800">
                    <Activity className="h-8 w-8 text-blue-500 mr-2" />
                    <span className="text-xl font-bold tracking-wide">SWIM<span className="text-blue-500">Pro</span></span>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-2">
                    <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Main Menu</p>
                    <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" />

                    {(can('devices.view_device') || user.is_superuser) && (
                        <>
                            <SidebarItem to="/devices" icon={Server} label="Devices" />
                            <SidebarItem to="/sites" icon={Map} label="Sites" />
                            <SidebarItem to="/site-management" icon={Map} label="Sites & Regions" />
                        </>
                    )}

                    {(can('core.view_job') || user.is_superuser) && (
                        <>
                            <SidebarItem to="/jobs" icon={List} label="Job History" />
                            <SidebarItem to="/scheduled-jobs" icon={Calendar} label="Scheduled Jobs" />
                        </>
                    )}

                    {(can('images.view_image') || user.is_superuser) && (
                        <SidebarItem to="/images" icon={HardDrive} label="Image Repository" />
                    )}

                    {(can('core.view_checkrun') || user.is_superuser) && (
                        <SidebarItem to="/checks" icon={Shield} label="Compliance Checks" />
                    )}

                    <div className="pt-6">
                        <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">System</p>
                        <SidebarItem to="/settings" icon={Settings} label="Settings" />
                        <div className="pl-12 text-gray-400 text-sm space-y-2 mt-1">
                            <Link to="/standards" className="block hover:text-white">• Golden Standards</Link>
                            <Link to="/settings/validation" className="block hover:text-white">• Validation Checks</Link>
                            <Link to="/workflows" className="block hover:text-white">• Workflows</Link>
                        </div>
                    </div>
                </nav>

                <div className="p-4 border-t border-gray-800">
                    <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold">
                            {user.username ? user.username.charAt(0).toUpperCase() : 'G'}
                        </div>
                        <div className="text-sm">
                            <p className="font-medium capitalize">{user.username}</p>
                            <p className="text-gray-500 text-xs">{user.is_superuser ? 'Super Admin' : 'User'}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-white shadow-sm flex items-center justify-between px-8 z-10">
                    <h2 className="text-xl font-semibold text-gray-800">Campus Fabric Manager</h2>
                    <div className="flex items-center space-x-4">
                        {/* Status Badge */}
                        {user.is_superuser && (
                            <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full border border-purple-200 flex items-center">
                                <Lock size={12} className="mr-1" /> Admin Mode
                            </span>
                        )}
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full border border-green-200">
                            System Operational
                        </span>
                    </div>
                </header>

                {/* Scrollable Content Area */}
                <main className="flex-1 overflow-auto p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;
