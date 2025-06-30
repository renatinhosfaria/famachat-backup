import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard as LucideLayoutDashboard,
  FileBarChart as LucideFileBarChart, 
  Calendar as LucideCalendar, 
  Users as LucideUsers,
  Settings as LucideSettings,
  UserCog as LucideUserCog,
  MessageSquare as LucideMessageSquare,
  Facebook as LucideFacebook,
  Home as LucideHome,
  LogOut as LucideLogOut,
  Timer as LucideTimer,
  UserPlus as LucideUserPlus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Department, Role } from "@shared/schema";
import { getInitials } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import UserProfile from "./user-profile";

type SidebarProps = {
  className?: string;
  collapsed?: boolean;
  horizontal?: boolean;
};

export default function Sidebar({ className, collapsed = false, horizontal = false }: SidebarProps) {
  const [location] = useLocation();
  const { currentUser, logout } = useAuth();
  
  // Função para obter os itens de navegação baseados no departamento
  const getNavItemsByDepartment = () => {
    const department = currentUser?.department;
    
    // Itens principais - disponíveis para todos
    const mainItems = [
      {
        name: "Dashboard",
        href: "/",
        icon: LucideLayoutDashboard,
      },
      {
        name: "Clientes",
        href: "/clientes",
        icon: LucideUsers,
      },
      {
        name: "Imóveis", 
        href: "/imoveis",
        icon: LucideHome,
      },
      {
        name: "Agenda",
        href: "/agenda",
        icon: LucideCalendar,
      },
    ];

    // Itens administrativos específicos para Gestão
    const adminItems = [
      {
        name: "Metas",
        href: "/metas",
        icon: LucideFileBarChart,
      },
      {
        name: "Leads",
        href: "/leads",
        icon: LucideUserPlus,
      },
      {
        name: "SLA Dashboard",
        href: "/sla-dashboard",
        icon: LucideTimer,
      },
      {
        name: "Usuários",
        href: "/admin/usuarios",
        icon: LucideUserCog,
      },
      {
        name: "WhatsApp",
        href: "/admin/whatsapp",
        icon: LucideMessageSquare,
      },
      {
        name: "Facebook",
        href: "/admin/facebook",
        icon: LucideFacebook,
      },
      {
        name: "Webhook",
        href: "/webhook",
        icon: LucideSettings,
      }
    ];

    switch (department) {
      case 'Gestão':
        return [...mainItems, ...adminItems];
      
      case 'Central de Atendimento':
      case 'Vendas':
      case 'Marketing':
      default:
        return mainItems;
    }
  };

  const navItems = getNavItemsByDepartment();

  // Tradução do cargo baseado no papel do usuário
  const getRoleDisplay = (role: string) => {
    switch(role) {
      case "Gestor": return "Gestor";
      case "Marketing": return "Marketing";
      case "Consultor de Atendimento": return "Consultor de Atendimento";
      case "Corretor": return "Corretor";
      default: return role;
    }
  };
  


  return (
    <div className={cn(
      horizontal 
        ? "flex flex-row h-auto bg-white p-2 justify-between items-center" 
        : "flex flex-col h-full bg-white", 
      className
    )}>
      {/* Logo e título - hidden no modo horizontal */}
      {!horizontal && (
        <div className="flex items-center justify-between p-4 border-b">
          {!collapsed && <span className="font-semibold text-lg">Sistema</span>}
        </div>
      )}
        
      {/* Menu de navegação */}
      <nav className={cn(
        horizontal 
          ? "flex justify-center flex-1" 
          : "flex-1 overflow-y-auto py-4"
      )}>
        <ul className={cn(
          horizontal 
            ? "flex space-x-4" 
            : "space-y-1"
        )}>
          {navItems.map((item) => (
            <li key={item.href}>
              {horizontal ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center justify-center p-3 rounded-md transition-colors",
                          location === item.href
                            ? "bg-primary text-white"
                            : "text-gray-600 hover:bg-gray-50"
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{item.name}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center px-4 py-2 text-sm font-medium rounded-md",
                    location === item.href
                      ? "bg-primary text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {!collapsed && <span className="ml-3">{item.name}</span>}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Informações do usuário - sempre visível quando há usuário */}
      {currentUser && (
        <div className={cn(
          horizontal 
            ? "flex items-center space-x-2" 
            : !collapsed ? "p-4 border-t" : "hidden"
        )}>
          {horizontal ? (
            /* Layout horizontal - compacto */
            <div className="flex items-center space-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-2 px-2 py-1 rounded-md bg-gray-50">
                      <div className="h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center text-xs">
                        {getInitials(currentUser.fullName)}
                      </div>
                      <span className="text-sm font-medium text-gray-700 hidden md:block">
                        {currentUser.username}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div>
                      <p className="font-medium">{currentUser.fullName}</p>
                      <p className="text-xs">{getRoleDisplay(currentUser.role)}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={logout}
                      className="p-2"
                    >
                      <LucideLogOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Sair</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : (
            /* Layout vertical - completo */
            <UserProfile />
          )}
        </div>
      )}
    </div>
  );
}
