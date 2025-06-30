import { create } from "zustand";
import { PeriodType } from "@/lib/utils";

export type DashboardMetrics = {
  newClientes: number;
  appointments: number;
  visits: number;
  sales: number;
  conversionRates: {
    appointmentsToClientes: number;
    visitsToAppointments: number;
    salesToVisits: number;
  };
  monthlyConversionRates?: {
    appointmentsToClientes: number[];
    visitsToAppointments: number[];
    salesToVisits: number[];
  };
  teamAverages: {
    newClientes: number;
    appointments: number;
    visits: number;
    sales: number;
  };
  performance: number[]; // 7 days performance data
  teamPerformance: number[]; // 7 days team average performance data
};

export type Cliente = {
  id: number;
  fullName: string;
  phone: string;
  interest: string;
  interestType: string;
  location?: string;
  date: string;
  status: string;
};

export type Appointment = {
  id: number;
  date: string;
  monthAbbr: string;
  day: string;
  title: string;
  time: string;
  clientName: string;
  location: string;
  address?: string;
  brokerName?: string; // Corretor responsável pela visita
};

interface DashboardState {
  currentPeriod: PeriodType;
  setPeriod: (period: PeriodType) => void;
  metrics: DashboardMetrics;
  setMetrics: (metrics: DashboardMetrics) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  recentClientes: Cliente[];
  setRecentClientes: (clientes: Cliente[]) => void;
  upcomingAppointments: Appointment[];
  setUpcomingAppointments: (appointments: Appointment[]) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  currentPeriod: "month", // Período padrão definido como "Mês"
  setPeriod: (period) => set({ currentPeriod: period }),
  
  // Valores iniciais vazios para as métricas
  metrics: {
    newClientes: 0,
    appointments: 0,
    visits: 0,
    sales: 0,
    conversionRates: {
      appointmentsToClientes: 0,
      visitsToAppointments: 0,
      salesToVisits: 0,
    },
    teamAverages: {
      newClientes: 0,
      appointments: 0,
      visits: 0,
      sales: 0,
    },
    performance: [0, 0, 0, 0, 0, 0, 0],
    teamPerformance: [0, 0, 0, 0, 0, 0, 0],
  },
  setMetrics: (metrics) => set({ metrics }),
  
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),
  
  recentClientes: [],
  setRecentClientes: (clientes) => set({ recentClientes: clientes }),
  
  upcomingAppointments: [],
  setUpcomingAppointments: (appointments) => set({ upcomingAppointments: appointments }),
}));