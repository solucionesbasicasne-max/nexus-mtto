import React from 'react';
import { Badge } from '@/components/ui/badge';

const statusStyles = {
  'Pendiente': 'bg-amber-100 text-amber-800 border-amber-200',
  'En Proceso': 'bg-blue-100 text-blue-800 border-blue-200',
  'Completada': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Cancelada': 'bg-gray-100 text-gray-500 border-gray-200',
  'Activo': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Inactivo': 'bg-gray-100 text-gray-500 border-gray-200',
  'Pausado': 'bg-amber-100 text-amber-800 border-amber-200',
  'Operativo': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'En Mantenimiento': 'bg-blue-100 text-blue-800 border-blue-200',
  'Fuera de Servicio': 'bg-red-100 text-red-800 border-red-200',
  'Baja': 'bg-gray-100 text-gray-500 border-gray-200',
  'Crítica': 'bg-red-100 text-red-800 border-red-200',
  'Alta': 'bg-orange-100 text-orange-800 border-orange-200',
  'Media': 'bg-amber-100 text-amber-800 border-amber-200',
  'Baja': 'bg-green-100 text-green-800 border-green-200',
};

export default function StatusBadge({ status }) {
  const style = statusStyles[status] || 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <Badge variant="outline" className={`${style} text-xs font-medium px-2.5 py-0.5 border`}>
      {status}
    </Badge>
  );
}