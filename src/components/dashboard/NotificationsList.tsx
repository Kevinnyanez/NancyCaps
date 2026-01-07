import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';

interface Props {
  capId?: number | null;
  admin?: boolean;
}

const NotificationsList = ({ capId, admin }: Props) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [notifs, setNotifs] = useState<any[]>([]);

  useEffect(() => {
    const fetchNotifs = async () => {
      // use any to avoid strict typed client errors for generated types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = (supabase as any)
        .from('entrega_notificaciones')
        .select(`id, mensaje, created_at, registro_id, cap_origen, cap_destino, cap_origen_cap:caps!cap_origen(id, numero, nombre), cap_destino_cap:caps!cap_destino(id, numero, nombre), registro:registros_anticonceptivos(id, paciente_id, tipo_anticonceptivo_id, cantidad), paciente:pacientes(id, nombre, apellido, dni)`) // include cap origin/destination info
        .order('created_at', { ascending: false })
        .limit(50);

      // For CAP users, show notifications where cap_destino = this CAP
      if (!admin && capId) q.eq('cap_destino', capId);

      const { data, error } = await q;
      if (error) {
        console.error('Error fetching notifications', error, error?.message, error?.details);
        setNotifs([]);
        return;
      }

      setNotifs(data || []);
    };

    fetchNotifs();
  }, [capId, admin]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{admin ? 'Notificaciones (admin)' : 'Notificaciones del CAP'}</CardTitle>
      </CardHeader>
      <CardContent>
        {notifs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin notificaciones</p>
        ) : (
          <ul className="space-y-3">
            {notifs.map((n) => (
              <li key={n.id} className="flex items-start justify-between">
                <div>
                  <div className="text-sm">{n.mensaje}</div>
                  <div className="text-xs text-muted-foreground">{format(new Date(n.created_at), 'yyyy-MM-dd HH:mm')}</div>
                  {n.cap_origen_cap && (
                    <div className="text-xs text-muted-foreground mt-1">Desde: CAP {n.cap_origen_cap.numero} - {n.cap_origen_cap.nombre}</div>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {n.registro ? `Registro #${n.registro.id}` : n.paciente ? `${n.paciente.apellido}` : ''}
                  {n.cap_destino_cap && (
                    <div className="text-xs text-muted-foreground">Dirigido a: CAP {n.cap_destino_cap.numero}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationsList;
