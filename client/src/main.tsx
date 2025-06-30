import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Adicionar logs para diagnóstico do problema de conectividade




const root = document.getElementById("root");

if (root) {
  createRoot(root).render(<App />);
} else {
  
}
