import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Jobs } from './pages/Jobs';
import { JobDetail } from './pages/JobDetail';
import { JobTitles } from './pages/JobTitles';
import { Resumes } from './pages/Resumes';
import { HRContacts } from './pages/HRContacts';
import { Applications } from './pages/Applications';
import { ApplicationDetail } from './pages/ApplicationDetail';
import { LLMProviders } from './pages/LLMProviders';
import { EmailSettings } from './pages/EmailSettings';
import { Profile } from './pages/Profile';
import { AutoApply } from './pages/AutoApply';
import { ManualApply } from './pages/ManualApply';
import { AddExternalApplication } from './pages/AddExternalApplication';
import { Interviews } from './pages/Interviews';
import { InterviewDetail } from './pages/InterviewDetail';
import { Learning } from './pages/Learning';

export const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Auth routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Authenticated Workspace routes */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/auto-apply" element={<AutoApply />} />
          <Route path="/manual-apply" element={<ManualApply />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/job-titles" element={<JobTitles />} />
          <Route path="/resumes" element={<Resumes />} />
          <Route path="/learning" element={<Learning />} />
          <Route path="/hr-contacts" element={<HRContacts />} />
          <Route path="/interviews" element={<Interviews />} />
          <Route path="/interviews/:id" element={<InterviewDetail />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/applications/add" element={<AddExternalApplication />} />
          <Route path="/applications/:id" element={<ApplicationDetail />} />
          <Route path="/llm-providers" element={<LLMProviders />} />
          <Route path="/email-settings" element={<EmailSettings />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
