import React, { useState } from 'react';
import { BarChart2, Calendar, Users, TrendingUp } from 'lucide-react';
import WeeklyScheduleReport from './WeeklyScheduleReport';
import AttendanceReport from './AttendanceReport';
import AttendanceProjection from './AttendanceProjection';

const TABS = [
  { id: 'weekly', label: 'Programa Semanal', icon: Calendar },
  { id: 'attendance', label: 'Reporte de Asistencia', icon: Users },
  { id: 'projection', label: 'Proyección de Asistencia', icon: TrendingUp },
];

export default function ReportsHub() {
  const [activeTab, setActiveTab] = useState('weekly');

  const renderContent = () => {
    switch (activeTab) {
      case 'weekly': return <WeeklyScheduleReport />;
      case 'attendance': return <AttendanceReport />;
      case 'projection': return <AttendanceProjection />;
      default: return <WeeklyScheduleReport />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Módulo de Reportes</h1>
            <p className="text-slate-300 text-sm">Programa semanal, asistencia y proyecciones</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                isActive ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>{renderContent()}</div>
    </div>
  );
}