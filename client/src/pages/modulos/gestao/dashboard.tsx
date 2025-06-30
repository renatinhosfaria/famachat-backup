import { Role } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { 
  ManagerDashboard, 
  MarketingDashboard, 
  ConsultantDashboard, 
  BrokerDashboard 
} from "@/components/dashboard/role-dashboards";
import { Redirect } from "wouter";

export default function Dashboard() {
  const { currentUser } = useAuth();
  
  // Se o usuário não estiver logado, redirecione para a página de login
  if (!currentUser) {
    return <Redirect to="/login" />;
  }
  
  // Renderiza o dashboard específico baseado no papel do usuário
  switch (currentUser.role) {
    case Role.MANAGER:
      return <ManagerDashboard />;
    case Role.MARKETING:
      return <MarketingDashboard />;
    case Role.CONSULTANT:
      return <ConsultantDashboard />;
    case Role.BROKER_SENIOR:
    case Role.EXECUTIVE:
    case Role.BROKER_JUNIOR:
    case Role.BROKER_TRAINEE:
      return <BrokerDashboard />;
    default:
      return <ManagerDashboard />; // Fallback para o dashboard de gestor
  }
}
