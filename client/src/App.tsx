import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import Layout from "@/components/layout/layout";
import CookieBanner from "@/components/cookie-banner";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import Reports from "@/pages/reports";

// Módulo Gestão
import GestaoClientes from "@/pages/modulos/gestao/clientes";
import GestaoDashboard from "@/pages/modulos/gestao/dashboard";
import GestaoFacebook from "@/pages/modulos/gestao/facebook";
import GestaoLeads from "@/pages/modulos/gestao/leads";
import GestaoMetas from "@/pages/modulos/gestao/Metas";
import GestaoProfileTab from "@/pages/modulos/gestao/profile-tab";
import GestaoUsuarios from "@/pages/modulos/gestao/usuarios";
import GestaoWebhookImplementation from "@/pages/modulos/gestao/webhook-implementation";
import GestaoWhatsapp from "@/pages/modulos/gestao/whatsapp";
import GestaoSLADashboard from "@/pages/modulos/gestao/sla-dashboard";

// Módulo Central de Atendimento
import CentralDashboard from "@/pages/modulos/central de atendimento/dashboard-central";
import CentralClientes from "@/pages/modulos/central de atendimento/clientes-central";

// Módulo Marketing
import MarketingDashboard from "@/pages/modulos/marketing/dashboard-marketing";
import MarketingClientes from "@/pages/modulos/marketing/clientes-marketing";

// Módulo Vendas
import VendasDashboard from "@/pages/modulos/vendas/dashboard-vendas";
import VendasClientes from "@/pages/modulos/vendas/clientes-vendas";

// Módulo Shared (disponível para todos)
import SharedAgenda from "@/pages/modulos/shared/agenda";
import SharedClienteDetails from "@/pages/modulos/shared/cliente-details";
import SharedEmpreendimentos from "@/pages/modulos/shared/empreendimentos";
import SharedImoveis from "@/pages/modulos/shared/Imoveis";
import SharedProprietarios from "@/pages/modulos/shared/proprietarios";
import SharedEmpreendimentoDetalhes from "@/pages/modulos/shared/[id]";
import Privacy from "@/pages/privacy";
import PrivacySettings from "@/pages/privacy-settings";
import Terms from "@/pages/terms";

function Router() {
  const { currentUser } = useAuth();
  const [location] = useLocation();
  
  // Rotas públicas que não precisam de autenticação
  const publicRoutes = ['/login', '/empreendimento', '/privacy', '/terms'];
  const isPublicRoute = publicRoutes.some(route => 
    location.startsWith(route) || location === '/login'
  );
  
  // Se não estiver autenticado e não estiver em uma rota pública, renderize apenas o componente Login
  if (!currentUser && !isPublicRoute) {
    return <Login />;
  }
  
  // Se não estiver autenticado, mas estiver na página de login, renderize o Login sem o layout
  if (!currentUser && location === '/login') {
    return <Login />;
  }
  
  // Se não estiver autenticado mas estiver em uma página de empreendimento, renderize apenas a página
  if (!currentUser && location.startsWith('/empreendimento/')) {
    return (
      <Switch>
        <Route path="/empreendimento/publico/:id" component={SharedEmpreendimentoDetalhes} />
        <Route path="/empreendimento/:id" component={SharedEmpreendimentoDetalhes} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Se não estiver autenticado mas estiver na página de privacidade, renderize apenas a página
  if (!currentUser && location === '/privacy') {
    return <Privacy />;
  }

  // Se não estiver autenticado mas estiver na página de termos, renderize apenas a página
  if (!currentUser && location === '/terms') {
    return <Terms />;
  }

  // Função para renderizar rotas baseadas no departamento
  const renderDepartmentRoutes = () => {
    const department = currentUser?.department;
    
    switch (department) {
      case 'Gestão':
        return (
          <>
            <Route path="/" component={GestaoDashboard} />
            <Route path="/dashboard" component={GestaoDashboard} />
            <Route path="/clientes" component={GestaoClientes} />
            <Route path="/leads" component={GestaoLeads} />
            <Route path="/sla-dashboard" component={GestaoSLADashboard} />
            <Route path="/admin/usuarios" component={GestaoUsuarios} />
            <Route path="/admin/whatsapp" component={GestaoWhatsapp} />
            <Route path="/admin/facebook" component={GestaoFacebook} />
            <Route path="/metas" component={GestaoMetas} />
            <Route path="/profile" component={() => <div>Perfil (Em desenvolvimento)</div>} />
            <Route path="/webhook" component={GestaoWebhookImplementation} />
          </>
        );
      
      case 'Central de Atendimento':
        return (
          <>
            <Route path="/" component={CentralDashboard} />
            <Route path="/dashboard" component={CentralDashboard} />
            <Route path="/clientes" component={CentralClientes} />
          </>
        );
      
      case 'Vendas':
        return (
          <>
            <Route path="/" component={VendasDashboard} />
            <Route path="/dashboard" component={VendasDashboard} />
            <Route path="/clientes" component={VendasClientes} />
          </>
        );
      
      case 'Marketing':
        return (
          <>
            <Route path="/" component={MarketingDashboard} />
            <Route path="/dashboard" component={MarketingDashboard} />
            <Route path="/clientes" component={MarketingClientes} />
          </>
        );
      
      default:
        return (
          <>
            <Route path="/" component={GestaoDashboard} />
            <Route path="/dashboard" component={GestaoDashboard} />
          </>
        );
    }
  };
  
  // Usuário autenticado - renderize o layout com as rotas protegidas
  return (
    <Layout>
      <Switch>
        {/* Rotas específicas do departamento */}
        {renderDepartmentRoutes()}
        
        {/* Rotas compartilhadas (shared) - disponíveis para todos os departamentos */}
        <Route path="/clientes/:id" component={SharedClienteDetails} />
        <Route path="/agenda" component={SharedAgenda} />
        <Route path="/imoveis" component={SharedImoveis} />
        <Route path="/imoveis/:empreendimentoId/:tipoImovel" component={SharedImoveis} />
        <Route path="/proprietarios" component={SharedProprietarios} />
        <Route path="/empreendimentos" component={SharedEmpreendimentos} />
        <Route path="/empreendimento/publico/:id" component={SharedEmpreendimentoDetalhes} />
        <Route path="/empreendimento/:id" component={SharedEmpreendimentoDetalhes} />
        
        {/* Rotas globais */}
        <Route path="/privacy" component={Privacy} />
        <Route path="/privacy-settings" component={PrivacySettings} />
        <Route path="/terms" component={Terms} />
        <Route path="/reports" component={Reports} />
        <Route path="/login" component={Login} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
        <CookieBanner />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
