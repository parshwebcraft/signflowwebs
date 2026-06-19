import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import DocumentsList from "@/pages/DocumentsList";
import UploadDocument from "@/pages/UploadDocument";
import DocumentDetails from "@/pages/DocumentDetails";
import PublicSign from "@/pages/PublicSign";
import { Toaster } from "@/components/ui/sonner";

function RootRedirect() {
  const { user, ready } = useAuth();
  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-zinc-500">Loading…</div>;
  }
  return <Navigate to={user ? "/app" : "/login"} replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/sign/:token" element={<PublicSign />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="documents" element={<DocumentsList />} />
            <Route path="documents/:id" element={<DocumentDetails />} />
            <Route path="upload" element={<UploadDocument />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;
