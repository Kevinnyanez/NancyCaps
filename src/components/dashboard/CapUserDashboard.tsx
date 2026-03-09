import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LogOut,
  Users,
  FileText,
  Bell,
  Archive,
  Menu,
  Pill,
  MessageCircle,
} from 'lucide-react';
import PacientesList from './PacientesList';
import NotificationsList from './NotificationsList.tsx';
import Entregas from './Entregas.tsx';
import CapInventory from './CapInventory';
import ChatSection from './ChatSection';
import ChatBubble from './ChatBubble';
import { useChatUnread } from '@/hooks/useChatUnread';
import { useMigrationPending } from '@/hooks/useMigrationPending';

const NAV_ITEMS = [
  { key: 'pacientes', label: 'Pacientes', icon: Users },
  { key: 'inventario', label: 'Inventario', icon: Archive },
  { key: 'entregas', label: 'Entregas', icon: FileText },
  { key: 'notifs', label: 'Notificaciones', icon: Bell },
  { key: 'chat', label: 'Mensajes', icon: MessageCircle },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]['key'];

const CapUserDashboard = () => {
  const { signOut, profile } = useAuth();
  const { unread: chatUnread } = useChatUnread();
  const { pending: migrationPending, recheck: recheckMigration } = useMigrationPending();
  const [capInfo, setCapInfo] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<NavKey>('pacientes');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (profile?.cap_number) {
      fetchCapInfo();
    }
  }, [profile?.cap_number]);

  const fetchCapInfo = async () => {
    if (!profile?.cap_number) return;
    try {
      const { data } = await supabase
        .from('caps')
        .select('*')
        .eq('numero', profile.cap_number)
        .single();
      setCapInfo(data);
    } catch (error) {
      console.error('Error fetching CAP info:', error);
    }
  };

  const handleNav = (key: NavKey) => {
    setActiveSection(key);
    setSidebarOpen(false);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'pacientes':
        return <PacientesList capNumber={profile?.cap_number} />;
      case 'entregas':
        return <Entregas />;
      case 'inventario':
        return <CapInventory />;
      case 'notifs':
        return <NotificationsList onPendingChange={() => recheckMigration()} />;
      case 'chat':
        return <ChatSection />;
      default:
        return null;
    }
  };

  const currentNav = NAV_ITEMS.find((n) => n.key === activeSection);
  const title = capInfo?.nombre || `CAP ${profile?.cap_number}`;

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Overlay para mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-card shadow-lg transition-transform duration-200 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo / título */}
        <div className="flex items-center gap-3 border-b px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Pill className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold leading-tight">{title}</h1>
            <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.key;
            const chatBadge = item.key === 'chat' && chatUnread > 0 ? chatUnread : 0;
            const notifBadge = item.key === 'notifs' && migrationPending ? 1 : 0;
            const badge = chatBadge || notifBadge;
            return (
              <button
                key={item.key}
                onClick={() => handleNav(item.key)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {badge > 0 && (
                  <span className={cn(
                    'flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                    isActive
                      ? 'bg-primary-foreground text-primary'
                      : 'bg-red-500 text-white',
                  )}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Cerrar sesión */}
        <div className="border-t p-3">
          <Button
            onClick={signOut}
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar mobile */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-card px-4 py-3 shadow-sm lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            {currentNav && <currentNav.icon className="h-5 w-5 text-primary" />}
            <h2 className="text-lg font-semibold">{currentNav?.label || 'Dashboard'}</h2>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {renderContent()}
        </main>
      </div>

      <ChatBubble
        isActive={activeSection === 'chat'}
        onNavigateChat={() => handleNav('chat')}
      />
    </div>
  );
};

export default CapUserDashboard;
