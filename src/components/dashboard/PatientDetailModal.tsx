import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import NotifyCapsModal from './NotifyCapsModal';

interface CapInfo { cap_id: number; cap_numero?: string; cap_nombre?: string; paciente_id?: number | null; count?: number }

interface PatientDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dni: string;
  pacienteName?: string;
  deliveries: any[];
  capList: CapInfo[];
}

const PatientDetailModal = ({ open, onOpenChange, dni, pacienteName, deliveries, capList }: PatientDetailModalProps) => {
  const [stockByCap, setStockByCap] = useState<Record<number, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    fetchStock();
  }, [open]);

  const fetchStock = async () => {
    const capIds = (capList || []).map(c => c.cap_id).filter(Boolean);
    const tipos = Array.from(new Set((deliveries || []).map(d => d.tipo?.id).filter(Boolean)));
    if (capIds.length === 0 || tipos.length === 0) {
      setStockByCap({});
      return;
    }

    setLoading(true);
    try {
      const { data: inv, error } = await (supabase as any)
        .from('inventario_caps')
        .select('cap_id, stock, tipo_anticonceptivo_id, tipo:tipos_anticonceptivos(id, nombre, marca)')
        .in('cap_id', capIds as number[])
        .in('tipo_anticonceptivo_id', tipos as number[]);

      if (error) throw error;
      const grouped: Record<number, any[]> = {};
      (inv || []).forEach((row: any) => {
        grouped[row.cap_id] = grouped[row.cap_id] || [];
        grouped[row.cap_id].push(row);
      });
      setStockByCap(grouped);
    } catch (err: any) {
      console.error('Error fetching stock in detail modal', err);
      toast({ title: 'Error', description: err.message || 'No se pudo cargar stock', variant: 'destructive' });
      setStockByCap({});
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalle de paciente</DialogTitle>
          <DialogDescription>{pacienteName || dni}</DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <div>
            <div className="font-medium mb-2">Entregas en el periodo</div>
            {deliveries.length === 0 ? (
              <div className="text-sm text-muted-foreground">No se encontraron entregas para este paciente</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>CAP</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map(d => (
                    <TableRow key={d.id}>
                      <TableCell>{new Date(d.fecha_entrega).toLocaleString('es-AR')}</TableCell>
                      <TableCell>{d.paciente?.cap ? `CAP ${d.paciente.cap.numero}` : d.cap_id}</TableCell>
                      <TableCell>{d.tipo?.nombre || '-'}</TableCell>
                      <TableCell className="text-right">{d.cantidad}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <div className="font-medium mb-2">Stock por CAP (tipos en entregas)</div>
              <div className="text-xs text-muted-foreground">Actualizado en tiempo real</div>
            </div>

            {loading ? (
              <div className="text-sm text-muted-foreground">Cargando stock...</div>
            ) : Object.entries(stockByCap).length === 0 ? (
              <div className="text-sm text-muted-foreground">No hay stock registrado para los tipos entregados</div>
            ) : (
              <div className="space-y-3">
                {Object.entries(stockByCap).map(([capId, rows]: any) => (
                  <div key={capId} className="border rounded p-3">
                    <div className="font-medium">CAP {capId}</div>
                    <div className="text-sm mt-2 space-y-1">
                      {rows.map((r: any) => (
                        <div key={`${capId}-${r.tipo_anticonceptivo_id}`} className="flex items-center justify-between">
                          <div>{r.tipo?.nombre} {r.tipo?.marca ? `- ${r.tipo?.marca}` : ''}</div>
                          <div className="font-semibold">{r.stock}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
            <Button onClick={() => setNotifyOpen(true)} disabled={capList.length === 0}>Notificar CAPs</Button>
          </div>
        </DialogFooter>

        {notifyOpen && (
          <NotifyCapsModal
            open={notifyOpen}
            onOpenChange={(o) => setNotifyOpen(o)}
            dni={dni}
            pacienteName={pacienteName}
            tipoId={null}
            tipoNombre={null}
            origenCapId={null}
            destinations={capList}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PatientDetailModal;
