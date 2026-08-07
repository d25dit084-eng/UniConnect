import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { LeftSidebar } from '../components/LeftSidebar';
import { RightSidebar } from '../components/RightSidebar';
import { ReportModal } from '../components/ReportModal';
import { MobileNav } from '../components/MobileNav';

export const Layout = () => {
  return (
    <div className="app-container">
      <Navbar />
      <div className="main-layout">
        <LeftSidebar />
        <main className="page-container">
          <Outlet />
        </main>
        <RightSidebar />
      </div>
      <ReportModal />
      <MobileNav />
    </div>
  );
};
