import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Pencil,
  Check,
  X,
  History,
  Plus,
  AlertTriangle,
  Package,
} from 'lucide-react';

interface CapInventoryData {
  capId: number;
  capNumero: number;
  capNombre: string;
  items: any[];
  totalItems: number;
  lowStockCount: number;
}

const ManageInventory = () => {
  const [caps, setCaps] = useState<any[]>([]);
  const [anticonceptivos, setAnticonceptivos] = useState<any[]>([]);
  const [allInventories, setAllInventories] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [expandedCaps, setExpandedCaps] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  // Inline editing
  const [editingInventoryId, setEditingInventoryId] = useState<number | null>(null);
  const [editingStock, setEditingStock] = useState(0);
  const editingRef = useRef<HTMLInputElement | null>(null);

  // Add new item to a CAP
  const [addingToCapId, setAddingToCapId] = useState<number | null>(null);
  const [addTipoId, setAddTipoId] = useState<number | null>(null);
  const [addStock, setAddStock] = useState(0);

  // Movements dialog
  const [movementsOpen, setMovementsOpen] = useState(false);
  const [movementsTitle, setMovementsTitle] = useState('');
  const [movements, setMovements] = useState<any[]>([]);
  const [movPage, setMovPage] = useState(1);
  const MOV_PAGE_SIZE = 10;

  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    Promise.all([fetchCaps(), fetchAnticonceptivos(), fetchAllInventories()]);

    const handler = (e: CustomEvent) => {
      const cid = e?.detail?.capId;
      if (cid) setExpandedCaps((prev) => new Set(prev).add(cid));
    };
    window.addEventListener('manage-inventory:open', handler as EventListener);
    return () => window.removeEventListener('manage-inventory:open', handler as EventListener);
  }, []);

  const fetchCaps = async () => {
    const { data } = await supabase.from('caps').select('*').order('numero');
    setCaps(data || []);
  };

  const fetchAnticonceptivos = async () => {
    const { data } = await supabase
      .from('tipos_anticonceptivos')
      .select('id, nombre, marca, codigo')
      .order('nombre');
    setAnticonceptivos(data || []);
  };

  const fetchAllInventories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventario_caps')
      .select('id, stock, cap_id, tipo_anticonceptivo_id, tipo:tipos_anticonceptivos(id, nombre, marca, codigo)')
      .order('tipo_anticonceptivo_id');

    if (error) {
      console.error('Error fetching inventories', error);
      setAllInventories([]);
    } else {
      setAllInventories(data || []);
    }
    setLoading(false);
  };

  const fetchMovements = async (inventoryId: number, title: string) => {
    setMovementsTitle(title);
    setMovPage(1);
    setMovementsOpen(true);
    const { data } = await supabase
      .from('inventario_movimientos')
      .select('id, tipo, cantidad, paciente_id, created_by, created_at, paciente:pacientes(id, nombre, apellido)')
      .eq('inventario_id', inventoryId)
      .order('created_at', { ascending: false });
    setMovements(data || []);
  };

  const toggleCap = (capId: number) => {
    setExpandedCaps((prev) => {
      const next = new Set(prev);
      if (next.has(capId)) next.delete(capId);
      else next.add(capId);
      return next;
    });
  };

  // Group inventories by CAP
  const capData: CapInventoryData[] = caps.map((cap) => {
    const items = allInventories.filter((inv) => inv.cap_id === cap.id);
    const lowStockCount = items.filter((inv) => inv.stock <= 5).length;
    return {
      capId: cap.id,
      capNumero: cap.numero,
      capNombre: cap.nombre,
      items,
      totalItems: items.length,
      lowStockCount,
    };
  });

  const filterItems = (items: any[]) => {
    let filtered = items;
    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter((inv) => {
        const nombre = (inv.tipo?.nombre || '').toLowerCase();
        const marca = (inv.tipo?.marca || '').toLowerCase();
        const codigo = (inv.tipo?.codigo || '').toLowerCase();
        return nombre.includes(term) || marca.includes(term) || codigo.includes(term);
      });
    }
    if (showLowOnly) {
      filtered = filtered.filter((inv) => inv.stock <= 5);
    }
    return filtered;
  };

  const handleSaveRow = async (inv: any) => {
    const newStock = editingStock;
    try {
      if (inv?.id) {
        const { data, error } = await supabase
          .from('inventario_caps')
          .update({ stock: newStock })
          .eq('id', inv.id)
          .select()
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('No se pudo encontrar el registro');
      }

      if (inv.stock !== null && inv.stock !== undefined && inv.stock !== newStock) {
        const delta = newStock - inv.stock;
        const tipoMov = delta > 0 ? 'in' : 'out';
        await supabase.from('inventario_movimientos').insert([
          {
            inventario_id: inv.id,
            tipo: tipoMov,
            cantidad: Math.abs(delta),
            paciente_id: null,
            created_by: user?.id,
          },
        ]);
      }

      setAllInventories((prev) =>
        prev.map((p) => (p.id === inv.id ? { ...p, stock: newStock } : p)),
      );
      setEditingInventoryId(null);
      toast({ title: 'Guardado', description: 'Stock actualizado' });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'No se pudo actualizar',
        variant: 'destructive',
      });
      fetchAllInventories();
    }
  };

  const handleAddItem = async (capId: number) => {
    if (!addTipoId) return;
    try {
      const { error } = await supabase.from('inventario_caps').upsert([
        { cap_id: capId, tipo_anticonceptivo_id: addTipoId, stock: addStock },
      ]);
      if (error) throw error;

      if (addStock > 0) {
        const { data: newInv } = await supabase
          .from('inventario_caps')
          .select('id')
          .eq('cap_id', capId)
          .eq('tipo_anticonceptivo_id', addTipoId)
          .maybeSingle();
        if (newInv?.id) {
          await supabase.from('inventario_movimientos').insert([
            {
              inventario_id: newInv.id,
              tipo: 'in',
              cantidad: addStock,
              paciente_id: null,
              created_by: user?.id,
            },
          ]);
        }
      }

      toast({ title: 'Agregado', description: 'Producto agregado al inventario' });
      setAddingToCapId(null);
      setAddTipoId(null);
      setAddStock(0);
      fetchAllInventories();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'No se pudo agregar',
        variant: 'destructive',
      });
    }
  };

  const StockBadge = ({ stock }: { stock: number }) => {
    if (stock <= 0)
      return (
        <Badge variant="destructive" className="tabular-nums">
          {stock}
        </Badge>
      );
    if (stock <= 5)
      return (
        <Badge variant="secondary" className="tabular-nums">
          {stock}
        </Badge>
      );
    return (
      <Badge variant="outline" className="tabular-nums">
        {stock}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, marca o código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant={showLowOnly ? 'default' : 'outline'}
              onClick={() => setShowLowOnly((s) => !s)}
              size="sm"
              className="gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              {showLowOnly ? 'Mostrar todos' : 'Solo bajo stock'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de CAPs */}
      {loading ? (
        <p className="text-center text-muted-foreground py-8">Cargando inventarios...</p>
      ) : (
        <div className="space-y-3">
          {capData.map((cap) => {
            const isExpanded = expandedCaps.has(cap.capId);
            const filteredItems = filterItems(cap.items);
            const hasLow = cap.lowStockCount > 0;

            return (
              <Collapsible
                key={cap.capId}
                open={isExpanded}
                onOpenChange={() => toggleCap(cap.capId)}
              >
                <Card
                  className={cn(
                    'transition-shadow',
                    isExpanded && 'shadow-md ring-1 ring-primary/20',
                  )}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer select-none hover:bg-muted/50 transition-colors py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-primary" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                          <div>
                            <CardTitle className="text-base">
                              CAP {cap.capNumero} — {cap.capNombre}
                            </CardTitle>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="gap-1">
                            <Package className="h-3 w-3" />
                            {cap.totalItems} productos
                          </Badge>
                          {hasLow && (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {cap.lowStockCount} bajo stock
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {filteredItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          {search || showLowOnly
                            ? 'No hay productos que coincidan con el filtro'
                            : 'Sin productos en este CAP'}
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[80px]">Código</TableHead>
                              <TableHead>Producto</TableHead>
                              <TableHead>Marca</TableHead>
                              <TableHead className="w-[120px]">Stock</TableHead>
                              <TableHead className="text-right w-[160px]">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredItems.map((inv) => (
                              <TableRow key={inv.id}>
                                <TableCell className="text-muted-foreground text-xs font-mono">
                                  {inv.tipo?.codigo || '—'}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {inv.tipo?.nombre}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {inv.tipo?.marca || '—'}
                                </TableCell>
                                <TableCell>
                                  {editingInventoryId === inv.id ? (
                                    <Input
                                      ref={editingRef}
                                      type="number"
                                      min={0}
                                      value={editingStock}
                                      onChange={(e) =>
                                        setEditingStock(parseInt(e.target.value || '0'))
                                      }
                                      className="w-20 h-8"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveRow(inv);
                                        if (e.key === 'Escape') setEditingInventoryId(null);
                                      }}
                                    />
                                  ) : (
                                    <StockBadge stock={inv.stock} />
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {editingInventoryId === inv.id ? (
                                    <div className="flex justify-end gap-1">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-green-600"
                                        onClick={() => handleSaveRow(inv)}
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8"
                                        onClick={() => setEditingInventoryId(null)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex justify-end gap-1">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8"
                                        title="Editar stock"
                                        onClick={() => {
                                          setEditingInventoryId(inv.id);
                                          setEditingStock(inv.stock);
                                          setTimeout(
                                            () => editingRef.current?.focus(),
                                            0,
                                          );
                                        }}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8"
                                        title="Ver movimientos"
                                        onClick={() =>
                                          fetchMovements(
                                            inv.id,
                                            inv.tipo?.nombre || 'Producto',
                                          )
                                        }
                                      >
                                        <History className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}

                      {/* Agregar producto */}
                      {addingToCapId === cap.capId ? (
                        <div
                          className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3"
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <div className="flex-1 min-w-[200px]">
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">
                              Anticonceptivo
                            </label>
                            <select
                              className="flex h-9 w-full items-center rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                              value={addTipoId?.toString() || ''}
                              onChange={(e) =>
                                setAddTipoId(e.target.value ? parseInt(e.target.value) : null)
                              }
                            >
                              <option value="">Seleccionar...</option>
                              {anticonceptivos
                                .filter(
                                  (a) =>
                                    !cap.items.some(
                                      (inv) => inv.tipo_anticonceptivo_id === a.id,
                                    ),
                                )
                                .map((a) => (
                                  <option key={a.id} value={a.id.toString()}>
                                    {a.codigo ? `${a.codigo} — ` : ''}
                                    {a.nombre}
                                    {a.marca ? ` — ${a.marca}` : ''}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div className="w-24">
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">
                              Stock inicial
                            </label>
                            <Input
                              type="number"
                              min={0}
                              value={addStock}
                              onChange={(e) =>
                                setAddStock(parseInt(e.target.value || '0'))
                              }
                              className="h-9"
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAddItem(cap.capId)}
                            disabled={!addTipoId}
                          >
                            Agregar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setAddingToCapId(null);
                              setAddTipoId(null);
                              setAddStock(0);
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => setAddingToCapId(cap.capId)}
                          >
                            <Plus className="h-4 w-4" />
                            Agregar producto
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Dialog de movimientos con paginación */}
      <Dialog
        open={movementsOpen}
        onOpenChange={(o) => {
          if (!o) setMovements([]);
          setMovementsOpen(o);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Movimientos — {movementsTitle}</DialogTitle>
          </DialogHeader>
          {(() => {
            const totalPages = Math.max(1, Math.ceil(movements.length / MOV_PAGE_SIZE));
            const paged = movements.slice(
              (movPage - 1) * MOV_PAGE_SIZE,
              movPage * MOV_PAGE_SIZE,
            );
            return (
              <>
                <div className="py-2">
                  {movements.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Sin movimientos registrados
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {paged.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between rounded-lg border px-3 py-2"
                        >
                          <div>
                            <div className="text-sm font-medium">
                              {m.tipo === 'in' ? (
                                <span className="text-green-600">+ Ingreso</span>
                              ) : (
                                <span className="text-red-600">— Egreso</span>
                              )}{' '}
                              • {m.cantidad} uds
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {m.paciente
                                ? `${m.paciente.apellido}, ${m.paciente.nombre}`
                                : 'Manual'}{' '}
                              • {format(new Date(m.created_at), 'dd/MM/yyyy HH:mm')}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      {movements.length} movimientos — Página {movPage}/{totalPages}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={movPage <= 1}
                        onClick={() => setMovPage((p) => Math.max(1, p - 1))}
                      >
                        Anterior
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={movPage >= totalPages}
                        onClick={() => setMovPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
          <DialogFooter>
            <Button onClick={() => setMovementsOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageInventory;
