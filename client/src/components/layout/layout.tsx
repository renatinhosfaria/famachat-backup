import { useState, ReactNode } from "react";
import { useLocation } from "wouter";
import Sidebar from "./sidebar";
import Header from "./header";
import Footer from "./footer";
import MobileNavigation from "./mobile-navigation";

type LayoutProps = {
  children: ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  
  const pageTitles: Record<string, string> = {
    "/": "",
    "/reports": "",
    "/agenda": "",
    "/leads": "",
  };
  
  const toggleMobileSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile sidebar */}
      <div
        className={`sidebar md:hidden fixed z-40 inset-y-0 left-0 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar collapsed={false} />
      </div>
      
      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={toggleMobileSidebar}
        />
      )}
      
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Sidebar horizontal - sempre visível em telas SM+ */}
        <div className="bg-white border-b border-gray-200 hidden sm:block">
          <Sidebar className="horizontal" collapsed={false} horizontal={true} />
        </div>
        
        {/* Header - visível apenas em mobile */}
        <div className="sm:hidden">
          <Header 
            title={pageTitles[location] || ""} 
            onToggleSidebar={toggleMobileSidebar} 
            sidebarCollapsed={false}
          />
        </div>
        
        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background-light">
          <div className="container min-h-full flex flex-col">
            <div className="flex-1 pb-20 md:pb-8">
              {children}
            </div>
            <Footer />
          </div>
        </main>
        
        {/* Mobile navigation */}
        <MobileNavigation />
      </div>
    </div>
  );
}
