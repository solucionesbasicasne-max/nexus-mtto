import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationBell from '@/components/shared/NotificationBell';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function AppLayout() {
  const { data: configList = [] } = useQuery({
    queryKey: ['appConfig'],
    queryFn: () => base44.entities.AppConfig.list(),
    staleTime: 60000,
  });

  const appName = configList.find(c => c.key === 'app_name')?.value || 'CMMS Pro';
  const appLogoUrl = configList.find(c => c.key === 'company_logo_url')?.value || '';

  return (
    <div className="flex h-screen overflow-hidden font-inter bg-background">
      <Sidebar appName={appName} appLogoUrl={appLogoUrl} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="h-12 border-b bg-card/80 backdrop-blur-sm flex items-center justify-end px-4 gap-2 flex-shrink-0 lg:flex">
          <NotificationBell />
        </div>
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}