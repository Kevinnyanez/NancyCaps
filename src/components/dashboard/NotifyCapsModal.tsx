import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface DestCap {
  cap_id: number;
  cap_numero?: string;
  cap_nombre?: string;
  paciente_id?: number | null;
}

interface NotifyCapsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dni: string;
  pacienteName?: string;
  tipoId?: number | null;
  tipoNombre?: string | null;
  origenCapId?: number | null;
  destinations: DestCap[];
}

const NotifyCapsModal = ({ open, onOpenChange, dni, pacienteName, tipoId, tipoNombre, origenCapId, destinations }: NotifyCapsModalProps) => {
  const [message, setMessage] = useState<string>(`Paciente ${pacienteName || dni} ya recibió ${tipoNombre || 'el anticonceptivo'} en CAP ${origenCapId}`);
  // Default select only CAPs where paciente is registered (paciente_id present)
  const [selected, setSelected] = useState<Record<number, boolean>>(() => {
    const map: Record<number, boolean> = {};
    destinations.forEach(d => { if (d.cap_id !== origenCapId) map[d.cap_id] = !!d.paciente_id; });
    return map;
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // keep selected in sync when destinations change (select only registered CAPS)
  React.useEffect(() => {
    const map: Record<number, boolean> = {};
    destinations.forEach(d => { if (d.cap_id !== origenCapId) map[d.cap_id] = !!d.paciente_id; });
    setSelected(map);
    setMessage(`Paciente ${pacienteName || dni} ya recibió ${tipoNombre || 'el anticonceptivo'} en CAP ${origenCapId}`);
  }, [destinations, dni, pacienteName, tipoId, tipoNombre, origenCapId]);

  // Use explicit setter with the checked value coming from the Checkbox
  const handleSetSelected = (capId: number, checked: boolean) => {
    setSelected(prev => ({ ...prev, [capId]: checked }));
  };

  const handleSend = async () => {
    const targets = destinations.filter(d => selected[d.cap_id] && d.cap_id !== origenCapId);
    if (targets.length === 0) {
      toast({ title: 'Error', description: 'No hay CAPs destino seleccionadas o el paciente no está registrado en otras CAPs.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const inserts = targets.map(t => ({
        registro_id: null,
        paciente_id: t.paciente_id || null,
        dni,
        tipo_anticonceptivo_id: tipoId || null,
        cap_origen: origenCapId || null,
        cap_destino: t.cap_id,
        mensaje: message,
        created_by: user?.id || null,
      }));

      const { error } = await (supabase as any).from('entrega_notificaciones').insert(inserts as any);
      if (error) throw error;

      toast({ title: 'Notificaciones enviadas', description: `Se enviaron ${inserts.length} notificaciones` });
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error sending notifications', err);
      const status = err?.status || err?.statusCode || null;
      const details = err?.message || err?.details || JSON.stringify(err);
      if (status === 403) {
        toast({ title: 'Permiso denegado', description: 'No tienes permisos para crear notificaciones. Verifica las políticas RLS en la base de datos.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: details || 'No se pudieron enviar las notificaciones', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notificar otras CAPs</DialogTitle>
          <DialogDescription>Envía un aviso a las CAPs donde el paciente está registrado para indicar que ya recibió el anticonceptivo.</DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <div>
            <Label>Paciente</Label>
            <div className="text-sm">{pacienteName || dni}</div>
          </div>
          <div>
            <Label>CAPs destino</Label>
            <div className="grid grid-cols-1 gap-2 mt-2">
              {destinations.filter(d => d.cap_id !== origenCapId).map(d => {
                const id = `notify-cap-${d.cap_id}`;
                const isRegistered = !!d.paciente_id;
                return (
                  <div key={d.cap_id} className="flex items-center gap-2">
                    <Checkbox id={id} checked={!!selected[d.cap_id]} disabled={!isRegistered} onCheckedChange={(v) => handleSetSelected(d.cap_id, v === true)} />
                    <label htmlFor={id} className={`text-sm ${isRegistered ? 'cursor-pointer' : 'text-muted-foreground'}`}>CAP {d.cap_numero} - {d.cap_nombre} {d.paciente_id ? '(Paciente registrado)' : '(Paciente no registrado)'}</label>
                  </div>
                );
              })}
              {destinations.filter(d => d.cap_id !== origenCapId).length === 0 && (
                <div className="text-sm text-muted-foreground mt-2">No hay CAPs destino disponibles para notificar.</div>
              )}
            </div>
          </div>
          <div>
            <Label>Mensaje</Label>
            <Input value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSend} disabled={loading}>{loading ? 'Enviando...' : 'Enviar Notificaciones'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NotifyCapsModal;
