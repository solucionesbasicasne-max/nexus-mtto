import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/shared/PageHeader';
import KPICard from '@/components/shared/KPICard';
import { AlertTriangle, ArrowUpCircle, ArrowDownCircle, SlidersHorizontal, Package, TrendingDown, DollarSign, Plus, Search, Filter, Pencil, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

export default function Inventory() {
  const [tab, setTab] = useState('stock');
  const [showMovement, setShowMovement] = useState(false);
  const [movementType, setMovementType] = useState('Entrada');
  const [selectedPart, setSelectedPart] = useState(null);
  const [movForm, setMovForm] = useState({ quantity: 1, unit_cost: 0, reference: '', notes: '', supplier: '', movement_date: format(new Date(), 'yyyy-MM-dd') });
  const [search, setSearch] = useState('');
  const [alertFilter, setAlertFilter] = useState('all');
  const queryClient = useQueryClient();

  const [showPartForm, setShowPartForm] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [partForm, setPartForm] = useState({ part_number: '', name: '', component_id: '', stock_current: 0, stock_min: 0, stock_max: 0, unit: 'Pieza', unit_cost: 0, location_storage: '', supplier: '', description: '' });

  const openNewPart = () => {
    setEditingPart(null);
    setPartForm({ part_number: '', name: '', component_id: '', stock_current: 0, stock_min: 0, stock_max: 0, unit: 'Pieza', unit_cost: 0, location_storage: '', supplier: '', description: '' });
    setShowPartForm(true);
  };

  const openEditPart = (part) => {
    setEditingPart(part);
    setPartForm({ ...part });
    setShowPartForm(true);
  };

  const savePartMutation = useMutation({
    mutationFn: (data) => editingPart ? base44.entities.SparePart.update(editingPart.id, data) : base44.entities.SparePart.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spareParts'] });
      setShowPartForm(false);
      setEditingPart(null);
      toast.success(editingPart ? 'Refacción actualizada' : 'Refacción creada');
    },
    onError: (e) => toast.error(e.message)
  });

  const deletePartMutation = useMutation({
    mutationFn: (id) => base44.entities.SparePart.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spareParts'] });
      toast.success('Refacción eliminada');
    },
    onError: (e) => toast.error(e.message)
  });

  // Get pre-selected part from URL
  const urlParams = new URLSearchParams(window.location.search);
  const preSelectedPartId = urlParams.get('part');

  const { data: spareParts = [], isLoading: loadingParts } = useQuery({ queryKey: ['spareParts'], queryFn: () => base44.entities.SparePart.list('-created_date') });
  const { data: movements = [], isLoading: loadingMovements } = useQuery({ queryKey: ['movements'], queryFn: () => base44.entities.InventoryMovement.list('-created_date', 500) });
  const { data: workOrders = [] } = useQuery({ queryKey: ['workOrders'], queryFn: () => base44.entities.WorkOrder.list('-created_date', 200) });
  const { data: components = [] } = useQuery({ queryKey: ['components'], queryFn: () => base44.entities.Component.list() });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });

  // Open movement dialog for pre-selected part
  React.useEffect(() => {
    if (preSelectedPartId && spareParts.length > 0) {
      const part = spareParts.find(p => p.id === preSelectedPartId);
      if (part) { setSelectedPart(part); setMovementType('Entrada'); setShowMovement(true); }
    }
  }, [preSelectedPartId, spareParts.length]);

  const getName = (list, id) => list.find(x => x.id === id)?.name || '—';

  // KPIs
  const totalItems = spareParts.length;
  const outOfStock = spareParts.filter(p => (p.stock_current || 0) === 0).length;
  const lowStock = spareParts.filter(p => (p.stock_current || 0) > 0 && (p.stock_current || 0) <= (p.stock_min || 0)).length;
  const totalValue = spareParts.reduce((s, p) => s + ((p.stock_current || 0) * (p.unit_cost || 0)), 0);

  const filteredParts = useMemo(() => {
    return spareParts.filter(p => {
      const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.part_number?.toLowerCase().includes(search.toLowerCase());
      const matchAlert = alertFilter === 'all' ? true
        : alertFilter === 'out' ? (p.stock_current || 0) === 0
        : alertFilter === 'low' ? (p.stock_current || 0) > 0 && (p.stock_current || 0) <= (p.stock_min || 0)
        : alertFilter === 'ok' ? (p.stock_current || 0) > (p.stock_min || 0)
        : true;
      return matchSearch && matchAlert;
    });
  }, [spareParts, search, alertFilter]);

  const openMovement = (part, type) => {
    setSelectedPart(part);
    setMovementType(type);
    setMovForm({ quantity: 1, unit_cost: part.unit_cost || 0, reference: '', notes: '', supplier: part.supplier || '', movement_date: format(new Date(), 'yyyy-MM-dd') });
    setShowMovement(true);
  };

  const movementMutation = useMutation({
    mutationFn: async (data) => {
      const part = selectedPart;
      const before = part.stock_current || 0;
      const qty = data.movement_type === 'Salida' ? -Math.abs(data.quantity) : Math.abs(data.quantity);
      const after = before + qty;
      if (after < 0) throw new Error('Stock insuficiente para esta salida');

      const movement = await base44.entities.InventoryMovement.create({
        ...data,
        spare_part_id: part.id,
        quantity: Math.abs(data.quantity),
        quantity_before: before,
        quantity_after: after,
        total_cost: Math.abs(data.quantity) * (data.unit_cost || 0),
      });

      await base44.entities.SparePart.update(part.id, { stock_current: after });
      return movement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spareParts'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      setShowMovement(false);
      toast.success(`Movimiento de ${movementType} registrado`);
    },
    onError: (e) => toast.error(e.message)
  });

  const handleMovement = (e) => {
    e.preventDefault();
    movementMutation.mutate({ ...movForm, movement_type: movementType });
  };

  const getStockStatus = (part) => {
    const stock = part.stock_current || 0;
    const min = part.stock_min || 0;
    if (stock === 0) return { label: 'Sin stock', color: 'bg-red-100 text-red-800 border-red-200' };
    if (stock <= min) return { label: 'Stock bajo', color: 'bg-amber-100 text-amber-800 border-amber-200' };
    return { label: 'Normal', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  };

  const getMovIcon = (type) => type === 'Entrada'
    ? <ArrowUpCircle className="w-4 h-4 text-emerald-600" />
    : type === 'Salida'
    ? <ArrowDownCircle className="w-4 h-4 text-red-500" />
    : <SlidersHorizontal className="w-4 h-4 text-blue-500" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventario de Refacciones"
        subtitle="Control de stock, entradas y salidas"
        action={openNewPart}
        actionLabel="Nueva Refacción"
        actionIcon={Plus}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Refacciones" value={totalItems} icon={Package} color="primary" />
        <KPICard title="Sin Stock" value={outOfStock} icon={AlertTriangle} color="destructive" subtitle="Requieren reabastecimiento" />
        <KPICard title="Stock Bajo" value={lowStock} icon={TrendingDown} color="warning" subtitle="Por debajo del mínimo" />
        <KPICard title="Valor Total Inventario" value={`$${totalValue.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`} icon={DollarSign} color="success" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="stock">Stock Actual</TabsTrigger>
          <TabsTrigger value="movements">Movimientos</TabsTrigger>
          <TabsTrigger value="alerts">Alertas ({outOfStock + lowStock})</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'stock' && (
        <div className="space-y-4">
          {/* Search & filter bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por nombre o No. Parte..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={alertFilter} onValueChange={setAlertFilter}>
              <SelectTrigger className="w-44"><Filter className="w-3.5 h-3.5 mr-2" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="out">Sin stock</SelectItem>
                <SelectItem value="low">Stock bajo</SelectItem>
                <SelectItem value="ok">Normal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">No. Parte</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Refacción</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Componente</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Stock</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Mín / Máx</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Estado</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Costo U.</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Valor</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Ubicación</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingParts ? Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={10}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  )) : filteredParts.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-10">Sin refacciones encontradas</TableCell></TableRow>
                  ) : filteredParts.map(part => {
                    const status = getStockStatus(part);
                    return (
                      <TableRow key={part.id} className="hover:bg-muted/20">
                        <TableCell><span className="font-mono text-xs font-semibold">{part.part_number}</span></TableCell>
                        <TableCell><span className="font-medium text-sm">{part.name}</span></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{getName(components, part.component_id)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-lg font-bold ${(part.stock_current || 0) === 0 ? 'text-red-600' : (part.stock_current || 0) <= (part.stock_min || 0) ? 'text-amber-600' : 'text-emerald-700'}`}>
                              {part.stock_current ?? 0}
                            </span>
                            <span className="text-xs text-muted-foreground">{part.unit}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{part.stock_min ?? 0} / {part.stock_max ?? '—'}</TableCell>
                        <TableCell><Badge variant="outline" className={`${status.color} text-xs border`}>{status.label}</Badge></TableCell>
                        <TableCell className="text-xs">${(part.unit_cost || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-xs font-semibold">${((part.stock_current || 0) * (part.unit_cost || 0)).toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{part.location_storage || '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={() => openMovement(part, 'Entrada')} title="Registrar Entrada">
                              <ArrowUpCircle className="w-3.5 h-3.5" />E
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => openMovement(part, 'Salida')} title="Registrar Salida">
                              <ArrowDownCircle className="w-3.5 h-3.5" />S
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => openMovement(part, 'Ajuste')} title="Ajuste de Stock">
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEditPart(part)} title="Editar Refacción">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-red-50" onClick={() => { if (confirm('¿Eliminar esta refacción?')) deletePartMutation.mutate(part.id); }} title="Eliminar Refacción">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'movements' && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Fecha</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Tipo</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Refacción</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Cantidad</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Antes → Después</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Costo Total</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">OT</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Referencia</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMovements ? Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                )) : movements.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-10">Sin movimientos registrados</TableCell></TableRow>
                ) : movements.map(m => {
                  const part = spareParts.find(p => p.id === m.spare_part_id);
                  const wo = workOrders.find(w => w.id === m.wo_id);
                  return (
                    <TableRow key={m.id} className="hover:bg-muted/20">
                      <TableCell className="text-xs">{m.movement_date ? format(parseISO(m.movement_date), 'dd/MM/yyyy') : '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {getMovIcon(m.movement_type)}
                          <span className="text-xs font-medium">{m.movement_type}</span>
                        </div>
                      </TableCell>
                      <TableCell><span className="text-sm font-medium">{part?.name || m.spare_part_id}</span></TableCell>
                      <TableCell>
                        <span className={`font-bold text-sm ${m.movement_type === 'Salida' ? 'text-red-600' : 'text-emerald-600'}`}>
                          {m.movement_type === 'Salida' ? '-' : '+'}{m.quantity} {part?.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.quantity_before ?? '?'} → {m.quantity_after ?? '?'}</TableCell>
                      <TableCell className="text-xs font-medium">${(m.total_cost || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-primary">{wo ? wo.wo_number : m.wo_id ? m.wo_id.slice(-6) : '—'}</TableCell>
                      <TableCell className="text-xs">{m.reference || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{m.notes || '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {tab === 'alerts' && (
        <div className="space-y-3">
          {spareParts.filter(p => (p.stock_current || 0) <= (p.stock_min || 0)).length === 0 ? (
            <Card className="border-0 shadow-sm p-8 text-center">
              <p className="text-emerald-600 font-medium">✓ Todos los stocks están en niveles normales</p>
            </Card>
          ) : spareParts.filter(p => (p.stock_current || 0) <= (p.stock_min || 0)).map(part => {
            const status = getStockStatus(part);
            return (
              <Card key={part.id} className={`border-0 shadow-sm p-4 border-l-4 ${(part.stock_current || 0) === 0 ? 'border-l-red-500' : 'border-l-amber-400'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={`w-5 h-5 ${(part.stock_current || 0) === 0 ? 'text-red-500' : 'text-amber-500'}`} />
                    <div>
                      <p className="font-semibold text-sm">{part.name}</p>
                      <p className="text-xs text-muted-foreground">No. Parte: {part.part_number} · Proveedor: {part.supplier || 'No definido'}</p>
                      <p className="text-xs text-muted-foreground">Stock: <strong className={`${(part.stock_current || 0) === 0 ? 'text-red-600' : 'text-amber-600'}`}>{part.stock_current ?? 0} {part.unit}</strong> · Mínimo: {part.stock_min ?? 0} · Tiempo entrega: {part.lead_time_days ? `${part.lead_time_days} días` : 'N/D'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className={`${status.color} border text-xs`}>{status.label}</Badge>
                    <Button size="sm" className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => openMovement(part, 'Entrada')}>
                      <ArrowUpCircle className="w-3.5 h-3.5" />Entrada
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Movement Dialog */}
      <Dialog open={showMovement} onOpenChange={setShowMovement}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getMovIcon(movementType)}
              {movementType === 'Entrada' ? 'Registrar Entrada' : movementType === 'Salida' ? 'Registrar Salida' : 'Ajuste de Inventario'}
            </DialogTitle>
          </DialogHeader>
          {selectedPart && (
            <div className="p-3 bg-muted/30 rounded-lg mb-2">
              <p className="font-semibold text-sm">{selectedPart.name}</p>
              <p className="text-xs text-muted-foreground">Stock actual: <strong>{selectedPart.stock_current ?? 0} {selectedPart.unit}</strong> · No. Parte: {selectedPart.part_number}</p>
            </div>
          )}
          <form onSubmit={handleMovement} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cantidad *</Label><Input type="number" min="0.01" step="0.01" value={movForm.quantity} onChange={e => setMovForm({ ...movForm, quantity: parseFloat(e.target.value) })} required /></div>
              <div><Label>Costo Unitario</Label><Input type="number" step="0.01" value={movForm.unit_cost} onChange={e => setMovForm({ ...movForm, unit_cost: parseFloat(e.target.value) })} /></div>
            </div>
            <div><Label>Fecha</Label><Input type="date" value={movForm.movement_date} onChange={e => setMovForm({ ...movForm, movement_date: e.target.value })} /></div>
            {movementType === 'Entrada' && (
              <div><Label>Proveedor</Label><Input value={movForm.supplier} onChange={e => setMovForm({ ...movForm, supplier: e.target.value })} /></div>
            )}
            {movementType === 'Salida' && (
              <div><Label>OT Relacionada</Label>
                <Select value={movForm.wo_id || ''} onValueChange={v => setMovForm({ ...movForm, wo_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Ninguna</SelectItem>
                    {workOrders.filter(w => w.status !== 'Cancelada').map(w => <SelectItem key={w.id} value={w.id}>{w.wo_number} — {w.description?.slice(0, 40)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Referencia / Folio</Label><Input value={movForm.reference} onChange={e => setMovForm({ ...movForm, reference: e.target.value })} placeholder="Ej: Factura, Remisión..." /></div>
            <div><Label>Notas</Label><Textarea value={movForm.notes} onChange={e => setMovForm({ ...movForm, notes: e.target.value })} /></div>
            <div className="p-3 bg-muted/30 rounded-lg text-sm">
              <span className="text-muted-foreground">Costo total del movimiento: </span>
              <strong>${(movForm.quantity * movForm.unit_cost).toFixed(2)}</strong>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowMovement(false)}>Cancelar</Button>
              <Button type="submit" disabled={movementMutation.isPending}
                className={movementType === 'Entrada' ? 'bg-emerald-600 hover:bg-emerald-700' : movementType === 'Salida' ? 'bg-red-600 hover:bg-red-700' : ''}>
                {movementMutation.isPending ? 'Guardando...' : `Registrar ${movementType}`}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* Spare Part Form Dialog */}
      <Dialog open={showPartForm} onOpenChange={setShowPartForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingPart ? 'Editar Refacción' : 'Nueva Refacción'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); savePartMutation.mutate(partForm); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>No. Parte *</Label>
                <Input value={partForm.part_number || ''} onChange={e => setPartForm({...partForm, part_number: e.target.value})} required placeholder="Ej: REF-1001" />
              </div>
              <div>
                <Label>Nombre de la Refacción *</Label>
                <Input value={partForm.name || ''} onChange={e => setPartForm({...partForm, name: e.target.value})} required placeholder="Ej: Filtro de aire" />
              </div>
              <div>
                <Label>Componente</Label>
                <Select value={partForm.component_id || ''} onValueChange={v => setPartForm({...partForm, component_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar componente (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Ninguno</SelectItem>
                    {components.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidad *</Label>
                <Input value={partForm.unit || ''} onChange={e => setPartForm({...partForm, unit: e.target.value})} required placeholder="Ej: Pieza, Litro, Juego" />
              </div>
              <div>
                <Label>Stock Inicial *</Label>
                <Input type="number" min="0" value={partForm.stock_current ?? 0} onChange={e => setPartForm({...partForm, stock_current: parseFloat(e.target.value) || 0})} required disabled={!!editingPart} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Stock Mínimo</Label>
                  <Input type="number" min="0" value={partForm.stock_min ?? 0} onChange={e => setPartForm({...partForm, stock_min: parseFloat(e.target.value) || 0})} />
                </div>
                <div>
                  <Label>Stock Máximo</Label>
                  <Input type="number" min="0" value={partForm.stock_max ?? 0} onChange={e => setPartForm({...partForm, stock_max: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
              <div>
                <Label>Costo Unitario ($) *</Label>
                <Input type="number" min="0" step="0.01" value={partForm.unit_cost ?? 0} onChange={e => setPartForm({...partForm, unit_cost: parseFloat(e.target.value) || 0})} required />
              </div>
              <div>
                <Label>Proveedor</Label>
                <Input value={partForm.supplier || ''} onChange={e => setPartForm({...partForm, supplier: e.target.value})} placeholder="Ej: Distribuidora Industrial" />
              </div>
              <div>
                <Label>Ubicación Almacén</Label>
                <Input value={partForm.location_storage || ''} onChange={e => setPartForm({...partForm, location_storage: e.target.value})} placeholder="Ej: Estante A-2" />
              </div>
              <div className="col-span-2">
                <Label>Descripción / Especificaciones</Label>
                <Textarea value={partForm.description || ''} onChange={e => setPartForm({...partForm, description: e.target.value})} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowPartForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={savePartMutation.isPending}>Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}