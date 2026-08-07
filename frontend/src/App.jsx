import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ProtectedRoute, AdminRoute } from './components/Guards';
import { Layout } from './layouts/Layout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import HomeFeed from './pages/HomeFeed';
import LatestFeed from './pages/LatestFeed';
import PopularFeed from './pages/PopularFeed';
import ExploreCommunities from './pages/ExploreCommunities';
import CreateCommunity from './pages/CreateCommunity';
import CommunityPage from './pages/CommunityPage';
import CommunityModPage from './pages/CommunityModPage';
import CreatePost from './pages/CreatePost';
import PostDetailPage from './pages/PostDetailPage';
import SearchResults from './pages/SearchResults';
import SavedPosts from './pages/SavedPosts';
import Notifications from './pages/Notifications';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            {/* Guest/Auth routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />

            {/* Standard main pages (Optional/Authenticated views) */}
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<HomeFeed />} />
              <Route path="/latest" element={<LatestFeed />} />
              <Route path="/popular" element={<PopularFeed />} />
              <Route path="/c/:slug" element={<CommunityPage />} />
              <Route path="/post/:id" element={<PostDetailPage />} />
              <Route path="/u/:username" element={<ProfilePage />} />
              <Route path="/search" element={<SearchResults />} />
              <Route path="/communities" element={<ExploreCommunities />} />

              {/* Protected Member routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/communities/create" element={<CreateCommunity />} />
                <Route path="/c/:slug/mod" element={<CommunityModPage />} />
                <Route path="/create-post" element={<CreatePost />} />
                <Route path="/saved" element={<SavedPosts />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/chat/:conversationId" element={<ChatPage />} />
                <Route path="/profile" element={<SettingsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>

              {/* Protected Platform Admin routes */}
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<AdminPage />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
