import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { exportToExcel } from '@/lib/excel';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  ShoppingCart,
  Package,
  AlertTriangle,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Warehouse,
  Settings2,
  Pencil,
} from 'lucide-react';

interface AdminStockReportProps {
  preselectedCapId?: number | null;
}

interface InventoryRow {
  id: number;
  stock: number;
  tipo: { id: number; nombre: string; marca: string | null; codigo: string | null };
  cap: { id: number; numero: number; nombre: string };
}

interface GlobalOrderItem {
  tipoId: number;
  nombre: string;
  marca: string;
  codigo: string;
  totalStock: number;
  totalNeeded: number;
  quantity: number;
  capBreakdown: { capId: number; capNumero: number; capNombre: string; stock: number; needed: number }[];
}

const PAGE_SIZE = 15;

const AdminStockReport = ({ preselectedCapId = null }: AdminStockReportProps) => {
  const { toast } = useToast();
  const [caps, setCaps] = useState<any[]>([]);
  const [inventario, setInventario] = useState<InventoryRow[]>([]);
  const [threshold, setThreshold] = useState<number>(5);
  const [target, setTarget] = useState<number>(20);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'global' | 'caps'>('global');
  const [search, setSearch] = useState('');
  const [capFilter, setCapFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [editQuantities, setEditQuantities] = useState<Record<number, number>>({});
  const [configOpen, setConfigOpen] = useState(false);

  useEffect(() => {
    fetchCaps();
    fetchInventory();
  }, []);

  const fetchCaps = async () => {
    const { data } = await supabase.from('caps').select('id, numero, nombre').order('numero');
    setCaps(data || []);
  };

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('inventario_caps')
        .select('id, stock, tipo:tipos_anticonceptivos(id, nombre, marca, codigo), cap:caps(id, numero, nombre)')
        .order('cap_id');
      setInventario((data as any) || []);
    } catch (err) {
      console.error('Error fetching inventory', err);
    } finally {
      setLoading(false);
    }
  };

  const globalOrder = useMemo(() => {
    const map = new Map<number, GlobalOrderItem>();

    inventario.forEach((inv) => {
      const tipoId = inv.tipo?.id;
      if (!tipoId) return;

      const needed = inv.stock < threshold ? Math.max(0, target - inv.stock) : 0;

      if (!map.has(tipoId)) {
        map.set(tipoId, {
          tipoId,
          nombre: inv.tipo.nombre,
          marca: inv.tipo.marca || '-',
          codigo: inv.tipo.codigo || '',
          totalStock: 0,
          totalNeeded: 0,
          quantity: 0,
          capBreakdown: [],
        });
      }

      const item = map.get(tipoId)!;
      item.totalStock += inv.stock;
      item.totalNeeded += needed;
      item.quantity += needed;
      item.capBreakdown.push({
        capId: inv.cap.id,
        capNumero: inv.cap.numero,
        capNombre: inv.cap.nombre,
        stock: inv.stock,
        needed,
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalNeeded - a.totalNeeded);
  }, [inventario, threshold, target]);

  const capDistribution = useMemo(() => {
    const map = new Map<number, {
      capId: number;
      capNumero: number;
      capNombre: string;
      items: { nombre: string; marca: string; codigo: string; stock: number; needed: number }[];
      totalNeeded: number;
    }>();

    inventario.forEach((inv) => {
      const capId = inv.cap.id;
      const needed = inv.stock < threshold ? Math.max(0, target - inv.stock) : 0;

      if (!map.has(capId)) {
        map.set(capId, {
          capId,
          capNumero: inv.cap.numero,
          capNombre: inv.cap.nombre,
          items: [],
          totalNeeded: 0,
        });
      }

      const cap = map.get(capId)!;
      cap.items.push({
        nombre: inv.tipo.nombre,
        marca: inv.tipo.marca || '-',
        codigo: inv.tipo.codigo || '',
        stock: inv.stock,
        needed,
      });
      cap.totalNeeded += needed;
    });

    return Array.from(map.values()).sort((a, b) => a.capNumero - b.capNumero);
  }, [inventario, threshold, target]);

  // Effective quantities (with manual edits)
  const getEffectiveQty = (tipoId: number) => {
    if (editQuantities[tipoId] !== undefined) return editQuantities[tipoId];
    const item = globalOrder.find((o) => o.tipoId === tipoId);
    return item?.quantity || 0;
  };

  // Filtered and paginated global order
  const filteredGlobal = globalOrder.filter((item) => {
    if (search) {
      const term = search.toLowerCase();
      if (
        !`${item.nombre} ${item.marca} ${item.codigo}`
          .toLowerCase()
          .includes(term)
      )
        return false;
    }
    return true;
  });

  const onlyWithOrder = filteredGlobal.filter((item) => getEffectiveQty(item.tipoId) > 0);
  const displayItems = view === 'global' ? filteredGlobal : filteredGlobal;

  const totalPages = Math.max(1, Math.ceil(displayItems.length / PAGE_SIZE));
  const pagedItems = displayItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Filtered cap distribution
  const filteredCaps = capDistribution.filter((cap) => {
    if (capFilter !== 'all' && cap.capId !== parseInt(capFilter)) return false;
    if (search) {
      const term = search.toLowerCase();
      if (
        !`CAP ${cap.capNumero} ${cap.capNombre}`
          .toLowerCase()
          .includes(term) &&
        !cap.items.some((it) =>
          `${it.nombre} ${it.marca} ${it.codigo}`.toLowerCase().includes(term),
        )
      )
        return false;
    }
    return true;
  });

  // Stats
  const totalUnitsNeeded = globalOrder.reduce(
    (s, it) => s + getEffectiveQty(it.tipoId),
    0,
  );
  const productsToOrder = globalOrder.filter(
    (it) => getEffectiveQty(it.tipoId) > 0,
  ).length;
  const capsWithLowStock = capDistribution.filter((c) => c.totalNeeded > 0).length;

  // Export
  const handleExportGlobal = async () => {
    const rows = globalOrder
      .filter((it) => getEffectiveQty(it.tipoId) > 0)
      .map((it) => ({
        Anticonceptivo: it.nombre,
        Marca: it.marca,
        Código: it.codigo,
        'Stock Total': it.totalStock,
        'Cantidad a Pedir': getEffectiveQty(it.tipoId),
      }));

    if (rows.length === 0) {
      toast({ title: 'Sin items', description: 'No hay productos para pedir.', variant: 'destructive' });
      return;
    }

    try {
      await exportToExcel(
        `pedido_global_${new Date().toISOString().slice(0, 10)}.xlsx`,
        rows,
      );
      toast({ title: 'Exportado', description: 'Pedido global descargado.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'No se pudo exportar.', variant: 'destructive' });
    }
  };

  const handleExportDistribution = async () => {
    const rows: any[] = [];
    capDistribution.forEach((cap) => {
      cap.items
        .filter((it) => it.needed > 0)
        .forEach((it) => {
          rows.push({
            CAP: `CAP ${cap.capNumero} — ${cap.capNombre}`,
            Anticonceptivo: it.nombre,
            Marca: it.marca,
            Código: it.codigo,
            'Stock Actual': it.stock,
            'A Reponer': it.needed,
          });
        });
    });

    if (rows.length === 0) {
      toast({ title: 'Sin items', description: 'Ninguna CAP necesita reposición.', variant: 'destructive' });
      return;
    }

    try {
      await exportToExcel(
        `distribucion_por_cap_${new Date().toISOString().slice(0, 10)}.xlsx`,
        rows,
      );
      toast({ title: 'Exportado', description: 'Distribución por CAP descargada.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'No se pudo exportar.', variant: 'destructive' });
    }
  };

  const handleExportBoth = async () => {
    await handleExportGlobal();
    await handleExportDistribution();
  };

  return (
    <div className="space-y-4">
      {/* Config */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Mínimo (alerta si stock menor a)</Label>
                <Input
                  type="number"
                  value={threshold}
                  onChange={(e) => {
                    setThreshold(Math.max(0, parseInt(e.target.value || '0')));
                    setPage(1);
                    setEditQuantities({});
                  }}
                  className="w-24 h-9"
                  min={0}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Objetivo (reponer hasta)</Label>
                <Input
                  type="number"
                  value={target}
                  onChange={(e) => {
                    setTarget(Math.max(0, parseInt(e.target.value || '0')));
                    setPage(1);
                    setEditQuantities({});
                  }}
                  className="w-24 h-9"
                  min={0}
                />
              </div>
            </div>

            <div className="flex-1" />

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleExportGlobal}
              >
                <Download className="h-4 w-4" />
                Pedido Global
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleExportDistribution}
              >
                <Download className="h-4 w-4" />
                Distribución por CAP
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleExportBoth}
              >
                <Download className="h-4 w-4" />
                Exportar Todo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Unidades a pedir</p>
                <p className="text-lg font-bold">{totalUnitsNeeded}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Productos a reponer</p>
                <p className="text-lg font-bold">{productsToOrder}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                capsWithLowStock > 0 ? 'bg-amber-500/10' : 'bg-green-500/10',
              )}>
                <AlertTriangle className={cn('h-5 w-5', capsWithLowStock > 0 ? 'text-amber-600' : 'text-green-600')} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CAPs con stock bajo</p>
                <p className="text-lg font-bold">{capsWithLowStock} / {caps.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View toggle + filters */}
      <Card>
        <CardContent className="pt-6 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border p-0.5">
              <button
                onClick={() => { setView('global'); setPage(1); }}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  view === 'global'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Pedido Global
              </button>
              <button
                onClick={() => { setView('caps'); setPage(1); }}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  view === 'caps'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Por CAP
              </button>
            </div>

            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar anticonceptivo..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 h-9"
              />
            </div>

            {view === 'caps' && (
              <Select value={capFilter} onValueChange={(v) => { setCapFilter(v); setPage(1); }}>
                <SelectTrigger className="w-48 h-9">
                  <SelectValue placeholder="Todas las CAPs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las CAPs</SelectItem>
                  {caps.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      CAP {c.numero} — {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">Cargando inventario...</p>
          </CardContent>
        </Card>
      ) : view === 'global' ? (
        /* GLOBAL ORDER VIEW */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Pedido Unificado
            </CardTitle>
            <CardDescription>
              Suma de todas las CAPs. Si CAP 1 necesita 5 y CAP 2 necesita 5, se pide 10 en total. Podés editar las cantidades antes de exportar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredGlobal.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto text-green-500 mb-3" />
                <p className="text-muted-foreground font-medium">
                  No hay productos que necesiten reposición
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Todos los productos están por encima del mínimo ({threshold})
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Anticonceptivo</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead className="text-center">Stock Total</TableHead>
                      <TableHead className="text-center">CAPs que necesitan</TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Pencil className="h-3 w-3" />
                          Cantidad a Pedir
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedItems.map((item) => {
                      const qty = getEffectiveQty(item.tipoId);
                      const capsNeed = item.capBreakdown.filter((c) => c.needed > 0);
                      return (
                        <TableRow
                          key={item.tipoId}
                          className={cn(qty === 0 && 'opacity-50')}
                        >
                          <TableCell className="font-medium">{item.nombre}</TableCell>
                          <TableCell className="text-muted-foreground">{item.marca}</TableCell>
                          <TableCell>
                            {item.codigo ? (
                              <Badge variant="secondary" className="text-xs">
                                {item.codigo}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">{item.totalStock}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-wrap justify-center gap-1">
                              {capsNeed.length > 0 ? (
                                capsNeed.map((c) => (
                                  <Badge
                                    key={c.capId}
                                    variant="outline"
                                    className="text-[10px] gap-0.5"
                                  >
                                    CAP {c.capNumero}
                                    <span className="text-amber-600 font-bold">({c.needed})</span>
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center">
                              <Input
                                type="number"
                                value={qty}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value || '0'));
                                  setEditQuantities((prev) => ({
                                    ...prev,
                                    [item.tipoId]: val,
                                  }));
                                }}
                                className={cn(
                                  'w-20 h-8 text-center',
                                  qty > 0 && 'border-primary font-semibold',
                                )}
                                min={0}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t">
                    <span className="text-xs text-muted-foreground">
                      {filteredGlobal.length} producto(s) — Página {page}/{totalPages}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Siguiente
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        /* DISTRIBUTION BY CAP VIEW */
        <div className="space-y-3">
          {filteredCaps.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Warehouse className="h-12 w-12 mx-auto text-green-500 mb-3" />
                  <p className="text-muted-foreground font-medium">
                    {capFilter !== 'all'
                      ? 'Esta CAP no necesita reposición'
                      : 'Ninguna CAP necesita reposición'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredCaps.map((cap) => {
              const itemsNeed = cap.items.filter((it) => it.needed > 0);
              const allItems = cap.items;
              return (
                <Card
                  key={cap.capId}
                  className={cn(
                    preselectedCapId === cap.capId && 'ring-2 ring-primary/40',
                  )}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Warehouse className="h-4 w-4" />
                        CAP {cap.capNumero} — {cap.capNombre}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {cap.totalNeeded > 0 ? (
                          <Badge variant="destructive" className="text-xs">
                            Necesita {cap.totalNeeded} uds
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-green-700">
                            Stock OK
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Anticonceptivo</TableHead>
                          <TableHead>Marca</TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead className="text-center">Stock</TableHead>
                          <TableHead className="text-center">Mínimo</TableHead>
                          <TableHead className="text-center">A Reponer</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allItems.map((it, idx) => (
                          <TableRow
                            key={idx}
                            className={cn(it.needed === 0 && 'opacity-50')}
                          >
                            <TableCell className="font-medium">{it.nombre}</TableCell>
                            <TableCell className="text-muted-foreground">{it.marca}</TableCell>
                            <TableCell>
                              {it.codigo ? (
                                <Badge variant="secondary" className="text-xs">
                                  {it.codigo}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className={cn(
                              'text-center font-semibold',
                              it.stock < threshold && 'text-red-600',
                            )}>
                              {it.stock}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              {threshold}
                            </TableCell>
                            <TableCell className="text-center">
                              {it.needed > 0 ? (
                                <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
                                  +{it.needed}
                                </Badge>
                              ) : (
                                <span className="text-green-600 text-sm">✓</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default AdminStockReport;
