import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import ProtectedRoute from './features/auth/ProtectedRoute';
import LoginPage from './features/auth/LoginPage';
import SignupPage from './features/auth/SignupPage';
import { WorkspaceProvider } from './features/workspaces/WorkspaceContext';
import WorkspaceDashboard from './features/workspaces/WorkspaceDashboard';
import WorkspaceDetail from './features/workspaces/WorkspaceDetail';
import KanbanBoard from './features/tasks/KanbanBoard';
import TasksHome from './features/tasks/TasksHome';
import ProfilePage from './features/profile/ProfilePage';
import TicketsPage from './features/tickets/TicketsPage';
import ReportsPage from './features/reports/ReportsPage';
import AppShell from './components/AppShell';

function AuthenticatedShell() {
  return (
    <WorkspaceProvider>
      <AppShell />
    </WorkspaceProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AuthenticatedShell />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<WorkspaceDashboard />} />
            <Route path="/workspaces/:workspaceId" element={<WorkspaceDetail />} />
            <Route path="/tasks" element={<TasksHome />} />
            <Route path="/boards/:boardId" element={<KanbanBoard />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
