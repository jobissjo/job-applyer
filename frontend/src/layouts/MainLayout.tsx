import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Briefcase, Cpu, FileText, LayoutDashboard, ListTodo, LogOut, Mail, Menu, PenLine, Send, UserCheck, UserRound, X, Zap } from 'lucide-react';
import { authApi } from '../services/api';
import type { User } from '../types';

const groups = [
  { label: 'Workspace', items: [
    { label: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Find jobs', path: '/jobs', icon: Briefcase },
    { label: 'Manual apply', path: '/manual-apply', icon: PenLine },
    { label: 'Applications', path: '/applications', icon: Send },
    { label: 'Auto apply', path: '/auto-apply', icon: Zap },
  ] },
  { label: 'Your toolkit', items: [
    { label: 'Resumes', path: '/resumes', icon: FileText },
    { label: 'Target roles', path: '/job-titles', icon: ListTodo },
    { label: 'Recruiter contacts', path: '/hr-contacts', icon: UserCheck },
  ] },
  { label: 'Settings', items: [
    { label: 'My profile', path: '/profile', icon: UserRound },
    { label: 'AI providers', path: '/llm-providers', icon: Cpu },
    { label: 'Email connection', path: '/email-settings', icon: Mail },
  ] },
];

export const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const currentPage = groups.flatMap(group => group.items).find(item => pathname === item.path || pathname.startsWith(item.path + '/'));
  useEffect(() => {
    if (!localStorage.getItem('token')) { navigate('/login'); return; }
    authApi.getMe().then(setCurrentUser).catch(() => { localStorage.removeItem('token'); navigate('/login'); });
  }, [navigate]);
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);
  return (
    <div className="app-container">
      <a href="#main-content" className="skip-link">Skip to content</a>
      {menuOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside id="workspace-navigation" className={'sidebar' + (menuOpen ? ' is-open' : '')}>
        <Link className="sidebar-header" to="/dashboard" aria-label="JobApply home">
          <div className="sidebar-logo-icon"><Briefcase size={20} /></div>
          <div><div className="sidebar-title">JobApply<span className="brand-dot">.</span></div><div className="brand-caption">Your next chapter</div></div>
        </Link>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {groups.map(group => <div className="nav-group" key={group.label}>
            <p className="nav-group-label">{group.label}</p>
            {group.items.map(item => <NavLink key={item.path} to={item.path} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
              <item.icon size={18} /><span>{item.label}</span>
            </NavLink>)}
          </div>)}
        </nav>
        <div className="sidebar-note"><span className="eyebrow">A little progress, every day</span><p>Your next opportunity starts with one good application.</p><Link to="/jobs">Explore jobs <ArrowUpRight size={14} /></Link></div>
        <div className="sidebar-footer">
          <div className="user-avatar">{currentUser?.email.charAt(0).toUpperCase() || 'J'}</div>
          <div className="user-info"><strong>{currentUser?.email.split('@')[0] || 'Your workspace'}</strong><span>Personal workspace</span></div>
          <button onClick={() => { localStorage.removeItem('token'); navigate('/login'); }} className="icon-button" aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
        </div>
      </aside>
      <div className="main-content">
        <header className="top-bar">
          <div className="breadcrumb"><button className="icon-button mobile-menu" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="workspace-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button><span>Workspace</span><span className="breadcrumb-divider">/</span><strong>{currentPage?.label || 'Overview'}</strong></div>
          <div className="top-bar-actions"><span className="workspace-pill"><span className="status-dot" /> Personal workspace</span><Link to="/profile" className="user-avatar small" aria-label="Open your profile">{currentUser?.email.charAt(0).toUpperCase() || 'J'}</Link></div>
        </header>
        <main id="main-content" className="page-body" tabIndex={-1}><Outlet /></main>
        <footer className="workspace-footer"><span>Made for your next move.</span><span>Infopark · Technopark</span></footer>
      </div>
    </div>
  );
};
