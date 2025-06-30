import { Link, useLocation } from "wouter";
import { LucideLayoutDashboard, LucideUsers, LucideCalendar, LucideHome } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MobileNavigation() {
  const [location] = useLocation();
  
  const navItems = [
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

  return (
    <nav className="md:hidden bg-white border-t border-gray-200 fixed bottom-0 left-0 right-0 z-20">
      <div className="grid grid-cols-4 h-14 xs:h-16">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center px-1 xs:px-2",
              location === item.href ? "text-primary" : "text-gray-500"
            )}
          >
            <item.icon className="h-4 w-4 xs:h-5 xs:w-5" />
            <span className="text-xs xs:text-xs mt-1 truncate">{item.name}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
