import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UserPlus } from 'lucide-react';

const ManageUsers = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [caps, setCaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    capNumber: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchCaps();
  }, []);

  const fetchCaps = async () => {
    try {
      const { data, error } = await supabase
        .from('caps')
        .select('*')
        .order('numero', { ascending: true });

      if (error) throw error;
      setCaps(data || []);
    } catch (error) {
      console.error('Error fetching caps:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los usuarios',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'cap_user') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Rol actualizado',
        description: 'El rol del usuario ha sido actualizado correctamente',
      });
      
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el rol',
        variant: 'destructive',
      });
    }
  };

  const updateUserCap = async (userId: string, capNumber: number | null) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ cap_number: capNumber })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'CAP actualizado',
        description: 'El CAP del usuario ha sido actualizado correctamente',
      });
      
      fetchUsers();
    } catch (error) {
      console.error('Error updating CAP:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el CAP',
        variant: 'destructive',
      });
    }
  };

  const createCapUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.capNumber) {
      toast({
        title: 'Error',
        description: 'Todos los campos son requeridos',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No hay sesión activa. Por favor inicia sesión nuevamente.');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-cap-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
          },
          body: JSON.stringify({
            email: newUser.email,
            password: newUser.password,
            capNumber: parseInt(newUser.capNumber),
          }),
        }
      );

      // Manejar errores de CORS o red
      if (!response.ok && response.status === 0) {
        throw new Error('Error de conexión. Verifica que la función Edge Function esté desplegada en Supabase.');
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al crear usuario');
      }

      toast({
        title: 'Usuario creado',
        description: 'La cuenta del usuario CAP ha sido creada exitosamente',
      });

      setOpen(false);
      setNewUser({ email: '', password: '', capNumber: '' });
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear el usuario',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gestión de Usuarios</CardTitle>
            <CardDescription>
              Administra roles y asignaciones de CAP para usuarios
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Crear Usuario CAP
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Usuario CAP</DialogTitle>
                <DialogDescription>
                  Crea una nueva cuenta de usuario para un CAP específico
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@ejemplo.com"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Contraseña segura"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cap">CAP Asignado</Label>
                  <Select
                    value={newUser.capNumber}
                    onValueChange={(value) => setNewUser({ ...newUser, capNumber: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un CAP" />
                    </SelectTrigger>
                    <SelectContent>
                      {caps.map((cap) => (
                        <SelectItem key={cap.id} value={cap.numero.toString()}>
                          CAP {cap.numero} - {cap.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={createCapUser} disabled={creating}>
                  {creating ? 'Creando...' : 'Crear Usuario'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground">Cargando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>CAP Asignado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role === 'admin' ? 'Administrador' : 'Usuario CAP'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.role === 'cap_user' ? (
                      <Select
                        value={user.cap_number?.toString() || ''}
                        onValueChange={(value) => updateUserCap(user.id, parseInt(value))}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Sin asignar" />
                        </SelectTrigger>
                        <SelectContent>
                          {caps.map((cap) => (
                            <SelectItem key={cap.id} value={cap.numero.toString()}>
                              CAP {cap.numero} - {cap.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(value: 'admin' | 'cap_user') => updateUserRole(user.id, value)}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cap_user">Usuario CAP</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default ManageUsers;
