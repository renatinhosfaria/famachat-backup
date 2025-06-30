import { useLocation } from "wouter";
import { Separator } from "@/components/ui/separator";

export default function Footer() {
  const [, setLocation] = useLocation();

  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="container mx-auto px-4 py-6">
        <Separator className="mb-4" />
        
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-sm text-gray-600">
            © {new Date().getFullYear()} Fama Negócios Imobiliários. Todos os direitos reservados.
          </div>
          
          <div className="flex space-x-6 text-sm">
            <button
              onClick={() => setLocation('/privacy')}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Política de Privacidade
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => setLocation('/terms')}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Termos de Uso
            </button>
            <span className="text-gray-300">|</span>
            <span className="text-gray-600">
              LGPD
            </span>
          </div>
        </div>
        
        <div className="mt-4 text-xs text-gray-500 text-center md:text-left">
          <p>
            Sistema em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)
          </p>
        </div>
      </div>
    </footer>
  );
}
