import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { downloadCSV } from '@/lib/csv';
import { exportToExcel } from '@/lib/excel';
import OrderModal, { OrderItem } from './OrderModal';

interface AdminStockReportProps { preselectedCapId?: number | null }

const AdminStockReport = ({ preselectedCapId = null }: AdminStockReportProps) => {
  const [caps, setCaps] = useState<any[]>([]);
  const [inventario, setInventario] = useState<any[]>([]);
  const [threshold, setThreshold] = useState<number>(5);
  const [target, setTarget] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const pageSizes = [10, 25, 50];
  const [capSearch, setCapSearch] = useState<string>('');

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
      // traer inventario con relación al tipo y cap
      const { data } = await supabase.from('inventario_caps')
        .select('id, stock, tipo:tipos_anticonceptivos(id, nombre, marca), cap:caps(id, numero, nombre)')
        .order('cap_id');

      setInventario(data || []);
    } catch (err) {
      console.error('Error fetching inventory', err);
    } finally {
      setLoading(false);
    }
  };

  const computeSuggested = () => {
    // por cap, por tipo: si stock < threshold => sugerir target - stock
    const perCap: Record<number, any[]> = {};
    inventario.forEach((i: any) => {
      const capId = i.cap?.id || i.cap_id;
      if (!perCap[capId]) perCap[capId] = [];
      const suggested = i.stock < threshold ? Math.max(0, target - i.stock) : 0;
      perCap[capId].push({
        tipo: i.tipo?.nombre || '-',
        marca: i.tipo?.marca || '-',
        stock: i.stock,
        suggested,
      });
    });

    return perCap;
  };

  const handleExport = () => {
    const perCap = computeSuggested();
    const rows: any[] = [];
    Object.entries(perCap).forEach(([capId, items]) => {
      const cap = caps.find(c => c.id === parseInt(capId));
      (items as any[]).forEach(it => {
        rows.push({ cap: cap ? `${cap.numero} - ${cap.nombre}` : capId, tipo: it.tipo, marca: it.marca, stock: it.stock, suggested: it.suggested });
      });
    });

    downloadCSV(`stock_report_${new Date().toISOString().slice(0,10)}.csv`, rows);
  };

  const handleGenerateOrder = () => {
    // generar CSV solo con ítems sugeridos (>0)
    const perCap = computeSuggested();
    const rows: any[] = [];
    Object.entries(perCap).forEach(([capId, items]) => {
      const cap = caps.find(c => c.id === parseInt(capId));
      (items as any[]).forEach(it => {
        if (it.suggested > 0) rows.push({ cap: cap ? `${cap.numero} - ${cap.nombre}` : capId, tipo: it.tipo, marca: it.marca, quantity: it.suggested });
      });
    });

    downloadCSV(`pedido_sugerido_${new Date().toISOString().slice(0,10)}.csv`, rows);
  };

  const perCap = computeSuggested();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialItems, setModalInitialItems] = useState<OrderItem[]>([]);
  const [modalCapLabel, setModalCapLabel] = useState<string>('');

  // build ordered cap list from `caps` to keep consistent ordering and support pagination
  const orderedCapIds = caps.map(c => c.id).filter(id => perCap[id] !== undefined);
  const filteredCapIds = orderedCapIds.filter(id => {
    if (!capSearch) return true;
    const cap = caps.find(c => c.id === id);
    const s = capSearch.toLowerCase();
    return String(cap?.numero || '').toLowerCase().includes(s) || String(cap?.nombre || '').toLowerCase().includes(s);
  });

  const totalPages = Math.max(1, Math.ceil(filteredCapIds.length / pageSize));
  if (page > totalPages) setPage(totalPages);
  const paginatedCapIds = filteredCapIds.slice((page - 1) * pageSize, page * pageSize);

  // Calcular totales
  const totalsByCap: Record<number, { lowCount: number; suggestedTotal: number }> = {};
  Object.entries(perCap).forEach(([capId, items]) => {
    const lowCount = (items as any[]).filter(it => it.suggested > 0).length;
    const suggestedTotal = (items as any[]).reduce((s, it) => s + (it.suggested || 0), 0);
    totalsByCap[parseInt(capId)] = { lowCount, suggestedTotal };
  });
  const globalSuggested = Object.values(totalsByCap).reduce((s, t) => s + t.suggestedTotal, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Stock por CAP</CardTitle>
            <CardDescription>Visualice el stock actual por CAP y genere pedidos sugeridos.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="number" value={threshold} onChange={(e) => setThreshold(parseInt(e.target.value || '0'))} className="w-24" />
            <Input type="number" value={target} onChange={(e) => setTarget(parseInt(e.target.value || '0'))} className="w-24" />

            <div className="flex items-center gap-2 ml-auto">
              <Button onClick={handleExport}>Descargar CSV</Button>
              <Button onClick={() => {
                const perCap = computeSuggested();
                const rows: any[] = [];
                Object.entries(perCap).forEach(([capId, items]) => {
                  const cap = caps.find(c => c.id === parseInt(capId));
                  (items as any[]).forEach(it => {
                    rows.push({ cap: cap ? `${cap.numero} - ${cap.nombre}` : capId, tipo: it.tipo, marca: it.marca, stock: it.stock, suggested: it.suggested });
                  });
                });
                void exportToExcel(`stock_report_${new Date().toISOString().slice(0,10)}.xlsx`, rows).catch(err => console.error('Export failed', err));
              }}>Exportar XLSX</Button>
              <Button onClick={handleGenerateOrder}>Generar Pedido</Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 text-sm text-muted-foreground">Total sugerido a pedir (todos los CAPS): <strong>{globalSuggested}</strong> unidades</div>

        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Input placeholder="Buscar CAP..." value={capSearch} onChange={(e) => { setCapSearch(e.target.value); setPage(1); }} className="w-48 sm:w-64" />
            <select value={pageSize} onChange={(e) => { setPageSize(parseInt(e.target.value)); setPage(1); }} className="border rounded p-1 text-sm">
              {pageSizes.map(ps => (<option key={ps} value={ps}>{ps} / pag</option>))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</Button>
            <div className="text-sm">Página {page} / {Math.max(1, Math.ceil(Object.keys(perCap).length / pageSize))}</div>
            <Button size="sm" disabled={page >= Math.max(1, Math.ceil(Object.keys(perCap).length / pageSize))} onClick={() => setPage(p => Math.min(Math.max(1, Math.ceil(Object.keys(perCap).length / pageSize)), p + 1))}>Next</Button>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground">Cargando...</p>
        ) : (
          <div className="space-y-4">
            {paginatedCapIds.length === 0 ? (
              <p className="text-center text-muted-foreground">No hay CAPS en esta página / filtro</p>
            ) : (
              paginatedCapIds.map((capId) => {
                const items = perCap[capId] || [];
                const cap = caps.find(c => c.id === parseInt(String(capId)));
                return (
                  <div key={capId} className={`border rounded p-3 ${preselectedCapId && parseInt(String(capId)) === preselectedCapId ? 'ring-2 ring-primary/40' : ''}`}>
                    <h4 className="font-semibold">CAP {cap?.numero || capId} - {cap?.nombre || ''}</h4>
                    <div className="text-xs text-muted-foreground mb-2">Items bajos: <strong>{totalsByCap[parseInt(String(capId))]?.lowCount || 0}</strong> • Sugerido: <strong>{totalsByCap[parseInt(String(capId))]?.suggestedTotal || 0}</strong></div>
                    <div className="mb-2">
                      <Button onClick={() => {
                        const itemsForModal: OrderItem[] = items.filter((it: any) => it.suggested > 0).map((it: any) => ({ tipo: it.tipo, marca: it.marca, quantity: it.suggested }));
                        setModalCapLabel(`${cap?.numero || capId} - ${cap?.nombre || ''}`);
                        setModalInitialItems(itemsForModal);
                        setModalOpen(true);
                      }}>Editar Pedido</Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Marca</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead>Sugerido</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((it: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{it.tipo}</TableCell>
                            <TableCell>{it.marca || '-'}</TableCell>
                            <TableCell>{it.stock}</TableCell>
                            <TableCell>{it.suggested}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardContent>
      <OrderModal open={modalOpen} onOpenChange={setModalOpen} capLabel={modalCapLabel} initialItems={modalInitialItems} onSave={(items) => {
        const rows = items.map(it => ({ tipo: it.tipo, marca: it.marca || '-', cantidad: it.quantity }));
        downloadCSV(`pedido_guardado_${modalCapLabel.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`, rows);
      }} />
    </Card>
  );
};

export default AdminStockReport;