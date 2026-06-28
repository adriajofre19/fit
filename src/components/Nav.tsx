import { createSupabaseBrowserClient } from '../lib/supabase/client';
import { cn } from '../lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Inicio', icon: '🏠' },
  { href: '/dieta', label: 'Dieta', icon: '🍽️' },
  { href: '/gimnasio', label: 'Gimnasio', icon: '🏋️' },
  { href: '/entrenos', label: 'Entrenos', icon: '🏃' },
  { href: '/pasos', label: 'Pasos', icon: '🚶' },
  { href: '/peso', label: 'Peso', icon: '⚖️' },
];

interface NavProps {
  currentPath: string;
}

export function Nav({ currentPath }: NavProps) {
  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <>
      <aside className="hidden lg:flex lg:flex-col lg:w-56 lg:fixed lg:inset-y-0 lg:border-r lg:border-border lg:bg-background lg:p-6">
        <div className="mb-8">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Mi Rutina</h1>
          <p className="text-xs text-muted-foreground mt-1">Tu diario fitness</p>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = currentPath === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </a>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-auto text-sm text-muted-foreground hover:text-foreground transition-colors pt-6 text-left"
        >
          Cerrar sesión
        </button>
      </aside>

      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
        <div className="flex overflow-x-auto px-1 py-2 gap-0.5 scrollbar-none">
          {NAV_ITEMS.map((item) => {
            const active = currentPath === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-2 py-1.5 min-w-[52px] shrink-0 rounded-md transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </a>
            );
          })}
        </div>
      </nav>
    </>
  );
}
