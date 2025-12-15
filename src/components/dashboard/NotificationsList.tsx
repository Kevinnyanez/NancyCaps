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
        .select('id, mensaje, created_at, registro_id, registro:registros_anticonceptivos(id, paciente_id, tipo_anticonceptivo_id, cantidad), paciente:pacientes(id, nombre, apellido, dni)')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!admin && capId) q.eq('cap_id', capId);

      const { data, error } = await q;
      if (error) {
        console.error('Error fetching notifications', error);
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
                </div>
                <div className="text-right text-xs text-muted-foreground">{n.registro ? `Registro #${n.registro.id}` : n.paciente ? `${n.paciente.apellido}` : ''}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationsList;
