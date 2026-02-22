import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, DollarSign, Settings } from 'lucide-react';

export default function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Inicio' },
    { path: '/participantes', icon: Users, label: 'Participantes' },
    { path: '/pagos', icon: DollarSign, label: 'Pagos' },
    { path: '/configuracion', icon: Settings, label: 'Config' }
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* 🎨 GRADIENTE DE TRANSICIÓN - Desvanece el contenido hacia la barra */}
      <div 
        className="fixed left-0 right-0 pointer-events-none z-40"
        style={{
          bottom: '80px',
          height: '80px',
          background: 'linear-gradient(to top, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.8) 40%, rgba(255, 255, 255, 0) 100%)'
        }}
      />
      
      {/* 📱 BARRA DE NAVEGACIÓN */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white z-50">
        {/* Separador superior con gradiente */}
        <div className="relative h-1">
          <div 
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, #3b82f6 20%, #2563eb 50%, #3b82f6 80%, transparent 100%)',
              boxShadow: '0 -2px 10px rgba(59, 130, 246, 0.3)'
            }}
          />
        </div>
        
        {/* Contenido de la navegación */}
        <div className="max-w-7xl mx-auto px-4 pb-safe">
          <div className="flex items-center justify-around py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center justify-center gap-1 min-w-[70px] py-2 px-3 rounded-xl transition-all duration-300 ${
                    active
                      ? 'bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-500/30 scale-110 -translate-y-1'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-blue-600 hover:scale-105'
                  }`}
                >
                  <Icon className={`w-6 h-6 ${active ? 'drop-shadow-sm' : ''}`} />
                  <span className={`text-[10px] font-bold ${active ? 'drop-shadow-sm' : ''}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}