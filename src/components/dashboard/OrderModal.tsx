import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { downloadCSV } from '@/lib/csv';
import { exportToExcel } from '@/lib/excel';

export type OrderItem = { tipo: string; marca?: string; quantity: number };

interface OrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  capLabel: string;
  initialItems: OrderItem[];
  onSave?: (items: OrderItem[]) => void;
}

const OrderModal = ({ open, onOpenChange, capLabel, initialItems, onSave }: OrderModalProps) => {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [newTipo, setNewTipo] = useState('');
  const [newMarca, setNewMarca] = useState('');
  const [newQty, setNewQty] = useState<number>(1);

  useEffect(() => { setItems(initialItems.map(i => ({ ...i }))); }, [initialItems]);

  const setQuantity = (idx: number, qty: number) => {
    const copy = [...items];
    copy[idx].quantity = Math.max(0, qty);
    setItems(copy);
  };

  const removeItem = (idx: number) => {
    const copy = [...items];
    copy.splice(idx, 1);
    setItems(copy);
  };

  const addItem = () => {
    if (!newTipo) return;
    setItems([...items, { tipo: newTipo, marca: newMarca || undefined, quantity: Math.max(0, newQty) }]);
    setNewTipo(''); setNewMarca(''); setNewQty(1);
  };

  const handleExport = (format: 'csv' | 'xlsx') => {
    const rows = items.map(it => ({ tipo: it.tipo, marca: it.marca || '-', cantidad: it.quantity }));
    const name = `pedido_${capLabel.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}`;
    if (format === 'csv') downloadCSV(`${name}.csv`, rows);
    else void exportToExcel(`${name}.xlsx`, rows).catch(err => console.error('Export failed', err));
  };

  const handleSave = () => {
    onSave?.(items);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Pedido — {capLabel}</DialogTitle>
          <DialogDescription>Revise y modifique la orden sugerida antes de exportarla o generarla.</DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay ítems en la orden. Agregue uno manualmente.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{it.tipo}</TableCell>
                    <TableCell>{it.marca || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Input type="number" value={it.quantity} onChange={(e) => setQuantity(idx, parseInt(e.target.value || '0'))} className="w-28" />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" onClick={() => removeItem(idx)}>Eliminar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Input placeholder="Tipo" value={newTipo} onChange={(e) => setNewTipo(e.target.value)} />
          <Input placeholder="Marca (opcional)" value={newMarca} onChange={(e) => setNewMarca(e.target.value)} />
          <Input type="number" value={newQty} onChange={(e) => setNewQty(parseInt(e.target.value || '0'))} />
        </div>
        <div className="mt-2 flex gap-2">
          <Button onClick={addItem}>Agregar ítem</Button>
        </div>

        <DialogFooter>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => handleExport('csv')}>Exportar CSV</Button>
            <Button onClick={() => handleExport('xlsx')}>Exportar XLSX</Button>
            <Button onClick={handleSave}>Guardar y Cerrar</Button>
          </div>
        </DialogFooter>

        <DialogClose />
      </DialogContent>
    </Dialog>
  );
};

export default OrderModal;
