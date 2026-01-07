import React, { useEffect, useState } from 'react';
const NotifyCapsModal = React.lazy(() => import('./NotifyCapsModal'));
import PatientDetailModal from './PatientDetailModal';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { downloadCSV } from '@/lib/csv';
import { exportToExcel } from '@/lib/excel';

const DeliveredPatientsReport = () => {
  const now = new Date();
  const [month, setMonth] = useState((now.getMonth() + 1).toString());
  const [year, setYear] = useState(now.getFullYear().toString());
  const [caps, setCaps] = useState<any[]>([]);
  const [selectedCap, setSelectedCap] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [crossCapInfo, setCrossCapInfo] = useState<Record<string, any>>({});
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyPayload, setNotifyPayload] = useState<any>(null);
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [patientModalPayload, setPatientModalPayload] = useState<any>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  useEffect(() => { fetchCaps(); }, []);

  useEffect(() => { fetchReport(); }, [month, year, selectedCap]);

  const fetchCaps = async () => {
    const { data } = await supabase.from('caps').select('id, numero, nombre').order('numero');
    setCaps(data || []);
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const start = new Date(parseInt(year), parseInt(month) - 1, 1);
      const next = new Date(start);
      next.setMonth(start.getMonth() + 1);

      // entgrgas con paciente y cap info
      const { data: entregas } = await supabase
        .from('entregas_anticonceptivos')
        .select(`
          id,
          cantidad,
          fecha_entrega,
          paciente:pacientes(id, nombre, apellido, dni, cap_id, cap:caps(id, numero, nombre)),
          tipo:tipos_anticonceptivos(id, nombre, marca)
        `)
        .gte('fecha_entrega', start.toISOString())
        .lt('fecha_entrega', next.toISOString())
        .order('fecha_entrega', { ascending: false });

      let rows = entregas || [];

      // Build cross-cap info for DNIs present in the period
      const dnis = Array.from(new Set((rows || []).map((r: any) => r.paciente?.dni).filter(Boolean)));
      let pacientesByDni: Record<string, any[]> = {};
      if (dnis.length > 0) {
        const { data: pacs } = await supabase
          .from('pacientes')
          .select('id, dni, cap_id, cap:caps(id, numero, nombre)')
          .in('dni', dnis as string[]);
        (pacs || []).forEach((p: any) => {
          pacientesByDni[p.dni] = pacientesByDni[p.dni] || [];
          pacientesByDni[p.dni].push(p);
        });

        // Build per-DNI aggregation of entregas per cap
        const agg: Record<string, any> = {};
        (rows || []).forEach((r: any) => {
          const dni = r.paciente?.dni;
          if (!dni) return;
          agg[dni] = agg[dni] || { total: 0, perCap: {}, caps: new Set<number>() };
          agg[dni].total += r.cantidad || 0;
          const capId = r.paciente?.cap_id;
          agg[dni].perCap[capId] = (agg[dni].perCap[capId] || 0) + (r.cantidad || 0);
          if (capId) agg[dni].caps.add(capId);
        });

        // Convert sets to arrays and include patient registrations (union of delivery CAPS and registered CAPS)
        Object.entries(agg).forEach(([dni, info]: any) => {
          const registeredCaps = (pacientesByDni[dni] || []).map((p: any) => p.cap_id).filter(Boolean);
          const capIds = Array.from(new Set([...(Array.from(info.caps) || []), ...registeredCaps]));
          const capList = capIds.map((cid: number) => {
            const p = (pacientesByDni[dni] || []).find((pp: any) => pp.cap_id === cid);
            return { cap_id: cid, paciente_id: p?.id || null, cap_numero: p?.cap?.numero, cap_nombre: p?.cap?.nombre, count: info.perCap[cid] || 0 };
          });
          agg[dni] = { total: info.total, capList, pacienteRegs: pacientesByDni[dni] || [] };
        });

        setCrossCapInfo(agg);
      } else {
        setCrossCapInfo({});
      }

      if (selectedCap !== 'all') {
        rows = rows.filter((r: any) => r.paciente?.cap_id === parseInt(selectedCap));
      }

      if (search) {
        const s = search.toLowerCase();
        rows = rows.filter((r: any) => {
          const p = r.paciente;
          return p && (`${p.nombre} ${p.apellido} ${p.dni}`).toLowerCase().includes(s);
        });
      }

      setData(rows);

      // Reset patient modal if the selected dni is no longer present
      if (patientModalPayload && !Array.from(new Set((rows || []).map((r: any) => r.paciente?.dni))).includes(patientModalPayload.dni)) {
        setPatientModalPayload(null);
        setPatientModalOpen(false);
      }
    } catch (err) {
      console.error('Error fetching delivered report', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const rows = data.map((r: any) => ({
      fecha: new Date(r.fecha_entrega).toLocaleString('es-AR'),
      cap: r.paciente?.cap?.numero ? `CAP ${r.paciente.cap.numero} - ${r.paciente.cap.nombre}` : r.paciente?.cap_id || '-',
      paciente: `${r.paciente?.apellido || ''}, ${r.paciente?.nombre || ''}`,
      dni: r.paciente?.dni || '-',
      tipo: r.tipo?.nombre || '-',
      marca: r.tipo?.marca || '-',
      cantidad: r.cantidad || 1,
    }));
    downloadCSV(`entregas_${year}-${month}.csv`, rows);
  };

  const months = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Pacientes con Entregas</CardTitle>
            <CardDescription>Lista de pacientes que recibieron anticonceptivos en el período seleccionado</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleExport}>Descargar CSV</Button>
            <Button onClick={() => {
              const rows = data.map((r: any) => ({
                fecha: new Date(r.fecha_entrega).toLocaleString('es-AR'),
                cap: r.paciente?.cap?.numero ? `CAP ${r.paciente.cap.numero} - ${r.paciente.cap.nombre}` : r.paciente?.cap_id || '-',
                paciente: `${r.paciente?.apellido || ''}, ${r.paciente?.nombre || ''}`,
                dni: r.paciente?.dni || '-',
                tipo: r.tipo?.nombre || '-',
                marca: r.tipo?.marca || '-',
                cantidad: r.cantidad || 1,
              }));
              void exportToExcel(`entregas_${year}-${month}.xlsx`, rows).catch(err => console.error('Export failed', err));
            }}>Exportar XLSX</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium">Mes</label>
            <select className="w-full" value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m, i) => i>0 && <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Año</label>
            <select className="w-full" value={year} onChange={(e) => setYear(e.target.value)}>
              {[new Date().getFullYear(), new Date().getFullYear()-1, new Date().getFullYear()-2].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">CAP</label>
            <select className="w-full" value={selectedCap} onChange={(e) => setSelectedCap(e.target.value)}>
              <option value="all">Todos</option>
              {caps.map(c => <option key={c.id} value={c.id}>{c.numero} - {c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Buscar</label>
            <Input placeholder="Nombre, apellido o DNI..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground">Cargando...</p>
        ) : data.length === 0 ? (
          <p className="text-center text-muted-foreground">No se encontraron entregas en este periodo</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>CAP</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Multicap</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.fecha_entrega).toLocaleString('es-AR')}</TableCell>
                  <TableCell>{r.paciente?.cap ? `CAP ${r.paciente.cap.numero} - ${r.paciente.cap.nombre}` : r.paciente?.cap_id || '-'}</TableCell>
                  <TableCell>{r.paciente ? `${r.paciente.apellido}, ${r.paciente.nombre}` : '-'}</TableCell>
                  <TableCell>{r.paciente?.dni || '-'}</TableCell>
                  <TableCell>{r.tipo?.nombre || '-'}</TableCell>
                  <TableCell>{r.tipo?.marca || '-'}</TableCell>
                  <TableCell>
                    {(() => {
                      const dni = r.paciente?.dni;
                      const info = dni ? crossCapInfo[dni] : null;
                      if (info && (info.pacienteRegs?.length || 0) > 1) {
                        return (
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">Registrado en {info.pacienteRegs.length} CAPs</Badge>
                            <Button size="sm" onClick={() => {
                              setNotifyPayload({ dni, pacienteName: `${r.paciente?.apellido}, ${r.paciente?.nombre}`, tipoId: r.tipo?.id, tipoNombre: r.tipo?.nombre, origenCapId: r.paciente?.cap_id, destinations: info.capList });
                              setNotifyOpen(true);
                            }}>Notificar CAPs</Button>
                          </div>
                        );
                      }
                      // If delivered in multiple caps in period but patient not registered in multiple caps, still show delivered in other caps count
                      if (info && (info.capList?.length || 0) > 1) {
                        return (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Entregas en {info.capList.length} CAPs</Badge>
                            <Button size="sm" onClick={() => {
                              setNotifyPayload({ dni, pacienteName: `${r.paciente?.apellido}, ${r.paciente?.nombre}`, tipoId: r.tipo?.id, tipoNombre: r.tipo?.nombre, origenCapId: r.paciente?.cap_id, destinations: info.capList });
                              setNotifyOpen(true);
                            }}>Notificar CAPs</Button>
                          </div>
                        );
                      }

                      return <span className="text-muted-foreground">-</span>;
                    })()}
                  </TableCell>
                  <TableCell className="text-right">{r.cantidad}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {notifyPayload && (
        // dynamic import of modal to avoid loading extra code when not needed
        <React.Suspense fallback={null}>
          {/* @ts-ignore */}
          <NotifyCapsModal
            open={notifyOpen}
            onOpenChange={(o: boolean) => { setNotifyOpen(o); if (!o) setNotifyPayload(null); }}
            dni={notifyPayload.dni}
            pacienteName={notifyPayload.pacienteName}
            tipoId={notifyPayload.tipoId}
            tipoNombre={notifyPayload.tipoNombre}
            origenCapId={notifyPayload.origenCapId}
            destinations={notifyPayload.destinations || []}
          />
        </React.Suspense>
      )}

      {patientModalPayload && (
        <PatientDetailModal
          open={patientModalOpen}
          onOpenChange={(o: boolean) => { setPatientModalOpen(o); if (!o) setPatientModalPayload(null); }}
          dni={patientModalPayload.dni}
          pacienteName={patientModalPayload.pacienteName}
          deliveries={patientModalPayload.deliveries || []}
          capList={patientModalPayload.capList || []}
        />
      )}
    </Card>
  );
};

export default DeliveredPatientsReport;
