import { create } from "zustand";
import { PeriodType } from "@/lib/utils";

interface ReportsState {
  currentReport: "clientes" | "production" | "appointments" | "visits" | "sales";
  setCurrentReport: (report: "clientes" | "production" | "appointments" | "visits" | "sales") => void;
  currentPeriod: PeriodType;
  setPeriod: (period: PeriodType) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  reportData: any;
  setReportData: (data: any) => void;
}

export const useReportsStore = create<ReportsState>((set) => ({
  currentReport: "clientes",
  setCurrentReport: (report) => set({ currentReport: report }),
  currentPeriod: "today", // Período padrão definido como "Hoje"
  setPeriod: (period) => set({ currentPeriod: period }),
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),
  reportData: null,
  setReportData: (data) => set({ reportData: data }),
}));
