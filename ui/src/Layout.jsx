import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Server, Activity, Settings, List, HardDrive, Lock, Shield, Calendar, Map, LogOut, UserCog, User, Zap, ShieldCheck, Clock, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { useAuth } from './context/AuthContext';

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
    const { user: authUser, logout } = useAuth();
    const navigate = useNavigate();
    const [user, setUser] = useState({ permissions: [], is_superuser: false, username: 'Loading...' });
    const [currentTime, setCurrentTime] = useState(new Date());
    const [schedulerHealthy, setSchedulerHealthy] = useState(true);

    useEffect(() => {
        if (authUser) {
            setUser(authUser);
        }
    }, [authUser]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const checkSystemStatus = async () => {
            try {
                const res = await axios.get('/api/core/system-status/');
                setSchedulerHealthy(res.data?.scheduler?.healthy ?? true);
            } catch {
                // If the endpoint fails, assume unhealthy
                setSchedulerHealthy(false);
            }
        };
        checkSystemStatus();
        const interval = setInterval(checkSystemStatus, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const can = (perm) => user.is_superuser || (user.permissions && user.permissions.includes(perm));

    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-900 text-white flex flex-col shadow-xl z-20">
                <div className="h-16 flex items-center px-6 border-b border-gray-800">
                    <Activity className="h-8 w-8 text-blue-500 mr-2" />
                    <span className="text-xl font-bold tracking-wide">OS <span className="text-blue-500">Upgrade</span></span>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-2">
                    <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Main Menu</p>
                    {(can('core.view_dashboard') || user.is_superuser) && (
                        <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" />
                    )}

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

                    {(can('core.can_view_ztp') || user.is_superuser) && (
                        <div className="pt-4">
                            <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Automation</p>
                            <SidebarItem to="/ztp" icon={Zap} label="Zero Touch Prov." />
                        </div>
                    )}

                    <div className="pt-6">
                        <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">System</p>
                        {user.is_superuser && (
                            <>
                                <SidebarItem to="/admin" icon={UserCog} label="Admin Panel" />
                                <SidebarItem to="/supported-models" icon={ShieldCheck} label="Supported Models" />
                            </>
                        )}
                        <SidebarItem to="/profile" icon={User} label="My Profile" />
                        {user.is_superuser && (
                            <>
                                <SidebarItem to="/settings" icon={Settings} label="Settings" />
                                <div className="pl-12 text-gray-400 text-sm space-y-2 mt-1">
                                    <Link to="/standards" className="block hover:text-white">• Golden Standards</Link>
                                    <Link to="/settings/validation" className="block hover:text-white">• Validation Checks</Link>
                                    <Link to="/workflows" className="block hover:text-white">• Workflows</Link>
                                </div>
                            </>
                        )}
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-white shadow-sm flex items-center justify-between px-8 z-10">
                    <h2 className="text-xl font-semibold text-gray-800">Cisco Switch OS Upgrade</h2>
                    <div className="flex items-center space-x-2 text-gray-500 text-sm">
                        <Clock size={15} className="text-blue-500" />
                        <span className="font-medium">
                            {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className="text-gray-300">|</span>
                        <span className="font-mono text-gray-600">
                            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' })}
                        </span>
                    </div>
                    <div className="flex items-center space-x-4">
                        {/* Status Badge */}
                        {user.is_superuser && (
                            <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full border border-purple-200 flex items-center">
                                <Lock size={12} className="mr-1" /> Admin Mode
                            </span>
                        )}
                        {schedulerHealthy ? (
                            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full border border-green-200">
                                System Operational
                            </span>
                        ) : (
                            <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full border border-amber-300 flex items-center animate-pulse">
                                <AlertTriangle size={12} className="mr-1" /> Scheduler Offline
                            </span>
                        )}

                        {/* User Info */}
                        <div className="flex items-center space-x-3 pl-4 border-l border-gray-200">
                            <Link to="/profile" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                                <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold text-white">
                                    {user.username ? user.username.charAt(0).toUpperCase() : 'G'}
                                </div>
                                <div className="text-sm">
                                    <p className="font-medium text-gray-800">{user.username}</p>
                                    <p className="text-gray-500 text-xs">{user.is_superuser ? 'Super Admin' : 'User'}</p>
                                </div>
                            </Link>
                            <button
                                onClick={handleLogout}
                                className="flex items-center space-x-1 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                                title="Logout"
                            >
                                <LogOut size={18} />
                                <span className="text-sm font-medium">Logout</span>
                            </button>
                        </div>
                    </div>
                </header>

                {/* Scrollable Content Area */}
                <main className="flex-1 overflow-auto p-8">
                    <Outlet />
                </main>

                {/* Footer */}
                <footer className="bg-white border-t border-gray-200 px-8 py-4">
                    <div className="flex items-center justify-between text-sm text-gray-500">
                        <div>
                            <span>SWIM - Cisco OS Upgrade Management</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <a
                                href="/api/schema/swagger-ui/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-blue-600 transition-colors"
                            >
                                Swagger UI
                            </a>
                            <span className="text-gray-300">|</span>
                            <a
                                href="/api/schema/redoc/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-blue-600 transition-colors"
                            >
                                ReDoc
                            </a>
                            <span className="text-gray-300">|</span>
                            <a
                                href="/api/schema/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-blue-600 transition-colors"
                            >
                                OpenAPI Schema
                            </a>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default Layout;
