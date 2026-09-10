import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  ListTodo,
  FileText,
  UserCheck,
  Send,
  Cpu,
  Mail,
  User as UserIcon,
  LogOut,
  Sparkles,
  Zap,
} from 'lucide-react';
import { authApi } from '../services/api';
import { User } from '../types';

export const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    authApi
      .getMe()
      .then(setCurrentUser)
      .catch(() => {
        localStorage.removeItem('token');
        navigate('/login');
      });
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Auto Apply Pipeline', path: '/auto-apply', icon: Zap },
    { label: 'Job Search', path: '/jobs', icon: Briefcase },
    { label: 'Job Titles', path: '/job-titles', icon: ListTodo },
    { label: 'Resumes', path: '/resumes', icon: FileText },
    { label: 'HR Contacts Required', path: '/hr-contacts', icon: UserCheck },
    { label: 'Applications', path: '/applications', icon: Send },
    { label: 'LLM Providers', path: '/llm-providers', icon: Cpu },
    { label: 'Email Settings', path: '/email-settings', icon: Mail },
    { label: 'Profile', path: '/profile', icon: UserIcon },
  ];

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo-icon">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="sidebar-title">JobAutoApply</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>Local Discovery & Apply</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{currentUser?.email.split('@')[0]}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Local User</span>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-secondary btn-sm"
            title="Logout"
            style={{ padding: '6px 8px' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        <header className="top-bar">
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Personal Local Assistant • Failover Enabled • SMTP Active
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span className="badge badge-source">Infopark & Technopark</span>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-main)', fontWeight: 500 }}>
              {currentUser?.email}
            </span>
          </div>
        </header>

        <main className="page-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
