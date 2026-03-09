import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMigrationPending } from '@/hooks/useMigrationPending';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, Info, AlertTriangle, CheckCircle, RefreshCw, ThumbsUp, ExternalLink, Star, BookmarkPlus, CircleCheck } from 'lucide-react';

interface Aviso {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: string;
  activo: boolean;
  created_at: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  info: <Info className="h-5 w-5 text-blue-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
  success: <CheckCircle className="h-5 w-5 text-green-500" />,
  update: <RefreshCw className="h-5 w-5 text-violet-500" />,
};

const BADGE_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  info: { label: 'Información', variant: 'secondary' },
  warning: { label: 'Importante', variant: 'destructive' },
  success: { label: 'Novedad', variant: 'default' },
  update: { label: 'Actualización', variant: 'outline' },
};

const BG_MAP: Record<string, string> = {
  info: 'bg-blue-50 border-blue-200',
  warning: 'bg-amber-50 border-amber-200',
  success: 'bg-green-50 border-green-200',
  update: 'bg-violet-50 border-violet-200',
};

interface Props {
  onPendingChange?: (pending: boolean) => void;
}

const NotificationsList = ({ onPendingChange }: Props) => {
  const { user } = useAuth();
  const { pending: migrationPending, confirm: confirmMigration } = useMigrationPending();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingMigration, setConfirmingMigration] = useState(false);

  useEffect(() => {
    onPendingChange?.(migrationPending);
  }, [migrationPending, onPendingChange]);

  const [totalLikes, setTotalLikes] = useState(0);
  const [userLiked, setUserLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  const fetchLikes = useCallback(async () => {
    const { count } = await supabase
      .from('app_likes')
      .select('*', { count: 'exact', head: true });
    setTotalLikes(count || 0);

    if (user?.id) {
      const { data } = await supabase
        .from('app_likes')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      setUserLiked(!!data);
    }
  }, [user?.id]);

  useEffect(() => {
    const fetchAvisos = async () => {
      const { data, error } = await supabase
        .from('avisos_sistema')
        .select('*')
        .eq('activo', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching avisos:', error);
        setAvisos([]);
      } else {
        setAvisos(data || []);
      }
      setLoading(false);
    };
    fetchAvisos();
    fetchLikes();
  }, [fetchLikes]);

  const toggleLike = async () => {
    if (!user?.id || likeLoading) return;
    setLikeLoading(true);
    try {
      if (userLiked) {
        await supabase.from('app_likes').delete().eq('user_id', user.id);
        setUserLiked(false);
        setTotalLikes((p) => Math.max(0, p - 1));
      } else {
        await supabase.from('app_likes').insert({ user_id: user.id });
        setUserLiked(true);
        setTotalLikes((p) => p + 1);
      }
    } catch (e) {
      console.error('Error toggling like:', e);
    }
    setLikeLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold">Notificaciones del Sistema</h2>
            <p className="text-sm text-muted-foreground">Avisos y novedades del equipo de desarrollo</p>
          </div>
        </div>
      </div>

      {/* Migration banner */}
      <Card className={`border-2 shadow-md ${migrationPending ? 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50' : 'border-green-200 bg-green-50/50'}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${migrationPending ? 'bg-green-100' : 'bg-green-200'}`}>
                {migrationPending ? <ExternalLink className="h-5 w-5 text-green-600" /> : <CircleCheck className="h-5 w-5 text-green-700" />}
              </div>
              <div>
                <CardTitle className="text-base text-green-800">Nuevo servidor disponible</CardTitle>
                <p className="text-xs text-green-600 mt-0.5">
                  {migrationPending ? 'Accedé al sistema desde el nuevo enlace' : 'Ya confirmaste la migración. ¡Gracias!'}
                </p>
              </div>
            </div>
            {!migrationPending && (
              <Badge className="bg-green-600 text-white">Completado</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <a
              href="https://appy-caps.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-green-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Ir al nuevo sistema
            </a>
            <span className="text-xs text-green-700 font-mono bg-green-100 px-2 py-1 rounded">
              appy-caps.vercel.app
            </span>
          </div>

          {migrationPending && (
            <>
              <div className="rounded-lg bg-white/70 border border-green-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BookmarkPlus className="h-4 w-4 text-green-700" />
                  <p className="text-sm font-semibold text-green-800">¿Cómo guardarlo en favoritos?</p>
                </div>
                <ol className="space-y-2 text-sm text-green-900">
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-200 text-xs font-bold text-green-800 shrink-0 mt-0.5">1</span>
                    <span>Hacé clic en <strong>"Ir al nuevo sistema"</strong> para abrir el enlace.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-200 text-xs font-bold text-green-800 shrink-0 mt-0.5">2</span>
                    <span>Una vez en la nueva página, mantené presionada la tecla <kbd className="px-1.5 py-0.5 bg-green-100 border border-green-300 rounded text-xs font-mono">Ctrl</kbd> y luego presioná la tecla <kbd className="px-1.5 py-0.5 bg-green-100 border border-green-300 rounded text-xs font-mono">D</kbd>.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-200 text-xs font-bold text-green-800 shrink-0 mt-0.5">3</span>
                    <span>Se abrirá una ventana para guardar el favorito. Hacé clic en <strong>"Listo"</strong> o <strong>"Guardar"</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-200 text-xs font-bold text-green-800 shrink-0 mt-0.5">4</span>
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      <span>¡Listo! Ahora aparecerá en tu barra de favoritos para acceder rápidamente.</span>
                    </div>
                  </li>
                </ol>
              </div>

              <div className="rounded-lg bg-green-100 border border-green-300 p-4">
                <p className="text-sm font-medium text-green-800 mb-3">¿Ya pudiste acceder al nuevo sistema y guardarlo en favoritos?</p>
                <Button
                  onClick={async () => {
                    setConfirmingMigration(true);
                    await confirmMigration();
                    setConfirmingMigration(false);
                  }}
                  disabled={confirmingMigration}
                  className="bg-green-600 hover:bg-green-700 text-white gap-2"
                >
                  <CircleCheck className="h-4 w-4" />
                  {confirmingMigration ? 'Confirmando...' : 'Sí, ya lo hice'}
                </Button>
                <p className="text-xs text-green-700 mt-2">Al confirmar, se quitará la alerta de notificaciones pendientes.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Like banner */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-violet-50">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <ThumbsUp className={`h-5 w-5 ${userLiked ? 'text-primary fill-primary' : 'text-primary'}`} />
            </div>
            <div>
              <p className="text-sm font-medium">¿Te gusta el sistema?</p>
              <p className="text-xs text-muted-foreground">
                {totalLikes === 0
                  ? 'Sé el primero en dar tu like'
                  : totalLikes === 1
                    ? '1 persona le dio like'
                    : `${totalLikes} personas le dieron like`}
              </p>
            </div>
          </div>
          <Button
            variant={userLiked ? 'default' : 'outline'}
            size="sm"
            onClick={toggleLike}
            disabled={likeLoading}
            className="gap-2"
          >
            <ThumbsUp className={`h-4 w-4 ${userLiked ? 'fill-current' : ''}`} />
            {userLiked ? 'Te gusta' : 'Me gusta'}
            {totalLikes > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                {totalLikes}
              </Badge>
            )}
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Cargando avisos...
          </CardContent>
        </Card>
      ) : avisos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No hay notificaciones en este momento</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {avisos.map((a) => {
            const badge = BADGE_MAP[a.tipo] || BADGE_MAP.info;
            const bg = BG_MAP[a.tipo] || BG_MAP.info;
            const icon = ICON_MAP[a.tipo] || ICON_MAP.info;

            return (
              <Card key={a.id} className={`border ${bg}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {icon}
                      <CardTitle className="text-base">{a.titulo}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(a.created_at), "d 'de' MMMM, yyyy - HH:mm", { locale: es })}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{a.mensaje}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsList;
