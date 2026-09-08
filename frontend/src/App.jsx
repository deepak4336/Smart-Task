import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import ProtectedRoute from './features/auth/ProtectedRoute';
import LoginPage from './features/auth/LoginPage';
import SignupPage from './features/auth/SignupPage';
import WorkspaceDashboard from './features/workspaces/WorkspaceDashboard';
import WorkspaceDetail from './features/workspaces/WorkspaceDetail';
import KanbanBoard from './features/tasks/KanbanBoard';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <WorkspaceDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspaces/:workspaceId"
            element={
              <ProtectedRoute>
                <WorkspaceDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/boards/:boardId"
            element={
              <ProtectedRoute>
                <KanbanBoard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
