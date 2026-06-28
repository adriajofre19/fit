import { useState } from 'react';
import { createSupabaseBrowserClient } from '../lib/supabase/client';
import { cn } from '../lib/utils';

const PRIMARY_NAV = [
  { href: '/', label: 'Inicio', icon: '🏠' },
  { href: '/dieta', label: 'Dieta', icon: '🍽️' },
  { href: '/gimnasio', label: 'Gym', icon: '🏋️' },
  { href: '/entrenos', label: 'Cardio', icon: '🏃' },
];

const MORE_NAV = [
  { href: '/pasos', label: 'Pasos', icon: '🚶' },
  { href: '/peso', label: 'Peso', icon: '⚖️' },
];

interface NavProps {
  currentPath: string;
}

export function Nav({ currentPath }: NavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = MORE_NAV.some((item) => item.href === currentPath);

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
          {[...PRIMARY_NAV, ...MORE_NAV].map((item) => {
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

      {/* Mobile bottom nav — 5 items fijos */}
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 h-16 max-w-lg mx-auto">
          {PRIMARY_NAV.map((item) => {
            const active = currentPath === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                <span className="text-xl leading-none">{item.icon}</span>
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </a>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 transition-colors',
              isMoreActive || moreOpen ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <span className="text-xl leading-none">⋯</span>
            <span className="text-[10px] font-medium leading-none">Más</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMoreOpen(false)}
            aria-label="Cerrar menú"
          />
          <div className="absolute bottom-0 inset-x-0 rounded-t-2xl border border-border bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] animate-slide-up">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 px-1">
              Más opciones
            </p>
            <div className="space-y-1">
              {MORE_NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium',
                    currentPath === item.href ? 'bg-secondary' : 'hover:bg-accent',
                  )}
                  onClick={() => setMoreOpen(false)}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </a>
              ))}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground text-left"
              >
                <span>🚪</span>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
