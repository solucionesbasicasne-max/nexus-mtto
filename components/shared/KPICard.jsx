import React from 'react';
import { Card } from '@/components/ui/card';

export default function KPICard({ title, value, subtitle, icon: Icon, color = 'primary' }) {
  const colorMap = {
    primary: 'bg-blue-50 text-blue-600',
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    destructive: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <Card className="p-5 relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold text-foreground mt-1.5 tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </Card>
  );
}