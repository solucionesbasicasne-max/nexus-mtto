import React, { useState } from 'react';
import { Users, Wrench, Tag, Calendar, CreditCard, Settings, QrCode } from 'lucide-react';
import PersonnelGeneral from './PersonnelGeneral';
import LaborForce from './LaborForce';
import Specialties from './Specialties';
import AttendanceControl from './AttendanceControl';
import EmployeeCredential from './EmployeeCredential';
import ShiftConfig from './ShiftConfig';
import QRAttendanceScanner from './QRAttendanceScanner';

const TABS = [
  { id: 'general', label: 'Personal General', icon: Users },
  { id: 'labor', label: 'Mano de Obra', icon: Wrench },
  { id: 'specialties', label: 'Especialidades', icon: Tag },
  { id: 'attendance', label: 'Control de Asistencia', icon: Calendar },
  { id: 'credentials', label: 'Credencial General', icon: CreditCard },
  { id: 'shifts', label: 'Config. de Turnos', icon: Settings },
  { id: 'qrchecker', label: 'Checador QR', icon: QrCode },
];

export default function PersonnelHub() {
  const [activeTab, setActiveTab] = useState('general');

  const renderContent = () => {
    switch (activeTab) {
      case 'general': return <PersonnelGeneral />;
      case 'labor': return <LaborForce />;
      case 'specialties': return <Specialties />;
      case 'attendance': return <AttendanceControl />;
      case 'credentials': return <EmployeeCredential />;
      case 'shifts': return <ShiftConfig />;
      case 'qrchecker': return <QRAttendanceScanner />;
      default: return <PersonnelGeneral />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Módulo de Personal</h1>
            <p className="text-blue-100 text-sm">Gestión integral del equipo de mantenimiento</p>
          </div>
        </div>
      </div>

      {/* Sub-module Tabs */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                isActive
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div>{renderContent()}</div>
    </div>
  );
}