import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bell, X, CheckCheck, AlertTriangle, Info, CheckCircle2, AlertCircle, ClipboardList, CalendarClock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const TYPE_STYLES = {
  info:    { icon: Info, bg: 'bg-blue-50',   dot: 'bg-blue-500',   text: 'text-blue-700' },
  success: { icon: CheckCircle2, bg: 'bg-emerald-50', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50',  dot: 'bg-amber-500',  text: 'text-amber-700' },
  error:   { icon: AlertCircle, bg: 'bg-red-50',    dot: 'bg-red-500',    text: 'text-red-700' },
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => base44.entities.Notification.list('-created_date', 50),
    refetchInterval: 30000, // poll every 30s
  });

  const { data: workOrders = [] } = useQuery({
    queryKey: ['workOrders'],
    queryFn: () => base44.entities.WorkOrder.list('-created_date', 100),
    refetchInterval: 60000,
  });

  const { data: mps = [] } = useQuery({
    queryKey: ['preventive'],
    queryFn: () => base44.entities.PreventiveMaintenance.list('-created_date', 100),
    refetchInterval: 60000,
  });

  const markRead = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { read: true })));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const deleteNotif = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-generate system alerts based on real data
  const systemAlerts = React.useMemo(() => {
    const alerts = [];
    const today = new Date().toISOString().split('T')[0];

    // Overdue MPs
    const overdueMPs = mps.filter(m => m.status === 'Activo' && m.next_mp_date && m.next_mp_date < today);
    overdueMPs.forEach(m => {
      alerts.push({
        id: `mp-${m.id}`,
        title: 'MP Vencido',
        message: `"${m.name}" lleva vencido más de ${Math.floor((new Date() - new Date(m.next_mp_date)) / 86400000)} día(s)`,
        type: 'warning',
        link: '/preventive',
        created_date: new Date().toISOString(),
        read: false,
        isSystem: true,
      });
    });

    // Critical open WOs
    const criticalWOs = workOrders.filter(w => w.priority === 'Crítica' && !['Completa', 'Cerrada', 'Cancelada'].includes(w.status));
    criticalWOs.forEach(w => {
      alerts.push({
        id: `wo-crit-${w.id}`,
        title: 'OT Crítica Abierta',
        message: `${w.wo_number}: ${w.description?.slice(0, 60)}...`,
        type: 'error',
        link: `/work-orders/${w.id}`,
        created_date: w.created_date || new Date().toISOString(),
        read: false,
        isSystem: true,
      });
    });

    // Recent WOs (last 24h)
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    const recentWOs = workOrders.filter(w => w.created_date > oneDayAgo);
    recentWOs.slice(0, 3).forEach(w => {
      alerts.push({
        id: `wo-new-${w.id}`,
        title: 'Nueva OT Generada',
        message: `${w.wo_number} — ${w.wo_type}: ${w.description?.slice(0, 50)}`,
        type: 'info',
        link: `/work-orders/${w.id}`,
        created_date: w.created_date,
        read: false,
        isSystem: true,
      });
    });

    return alerts;
  }, [workOrders, mps]);

  const allNotifs = [
    ...systemAlerts,
    ...notifications.map(n => ({ ...n, isSystem: false })),
  ].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  const unreadCount = allNotifs.filter(n => !n.read).length;

  const timeAgo = (dateStr) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es });
    } catch { return ''; }
  };

  const dropdown = open ? createPortal(
    <div
      style={{ position: 'fixed', top: 56, right: 16, width: 384, zIndex: 99999 }}
      className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Notificaciones</span>
          {unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
          )}
        </div>
        <button onClick={() => markAllRead.mutate()} className="text-xs text-primary hover:underline flex items-center gap-1">
          <CheckCheck className="w-3.5 h-3.5" />Marcar leídas
        </button>
      </div>

      {/* List */}
      <div className="max-h-96 overflow-y-auto divide-y divide-border/50">
        {allNotifs.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sin notificaciones</p>
          </div>
        ) : allNotifs.map(notif => {
          const style = TYPE_STYLES[notif.type] || TYPE_STYLES.info;
          const Icon = style.icon;
          return (
            <div key={notif.id} className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30 ${!notif.read ? 'bg-blue-50/30' : ''}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${style.bg}`}>
                <Icon className={`w-4 h-4 ${style.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <p className={`text-xs font-semibold ${!notif.read ? 'text-foreground' : 'text-muted-foreground'}`}>{notif.title}</p>
                  {!notif.isSystem && (
                    <button onClick={() => deleteNotif.mutate(notif.id)} className="flex-shrink-0 text-muted-foreground hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notif.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground/60">{timeAgo(notif.created_date)}</span>
                  {notif.link && (
                    <Link to={notif.link} onClick={() => setOpen(false)} className="text-[10px] text-primary hover:underline">
                      Ver →
                    </Link>
                  )}
                </div>
              </div>
              {!notif.read && <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${style.dot}`} />}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t bg-muted/20 flex justify-between items-center">
        <span className="text-xs text-muted-foreground">{allNotifs.length} alertas del sistema</span>
        <Link to="/work-orders" onClick={() => setOpen(false)} className="text-xs text-primary hover:underline">Ver OTs →</Link>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-xl hover:bg-muted transition-colors"
        title="Notificaciones"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {dropdown}
    </div>
  );
}