import { useState } from "react";
import { Bell, Menu, AlignJustify } from "lucide-react";

type HeaderProps = {
  title: string;
  onToggleSidebar: () => void;
  sidebarCollapsed?: boolean;
};

export default function Header({ title, onToggleSidebar, sidebarCollapsed = false }: HeaderProps) {
  return (
    <header className="bg-white shadow-sm z-10">
      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={onToggleSidebar}
              className="md:hidden mr-4 text-dark"
              aria-label="Toggle sidebar"
            >
              <AlignJustify className="h-6 w-6" />
            </button>
            <div className="md:hidden">
              <h1 className="text-lg font-bold text-primary">
                FamaChat
              </h1>
            </div>
            {title && (
              <h1 className={`hidden md:block text-xl font-semibold text-dark ${sidebarCollapsed ? 'ml-2' : ''}`}>
                {title}
              </h1>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Bell className="h-6 w-6 text-dark" />
              <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500"></span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
