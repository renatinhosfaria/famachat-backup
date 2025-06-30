import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Settings, Shield } from "lucide-react";
import { useLocation } from "wouter";

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
}

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [, setLocation] = useLocation();
  
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true, // Sempre verdadeiro - cookies essenciais não podem ser desabilitados
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    // Verificar se o usuário já deu consentimento para cookies
    const cookieConsent = localStorage.getItem('cookieConsent');
    if (!cookieConsent) {
      setIsVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    const allAccepted = {
      essential: true,
      analytics: true,
      marketing: true,
    };
    
    setPreferences(allAccepted);
    saveCookiePreferences(allAccepted);
    setIsVisible(false);
  };

  const handleAcceptSelected = () => {
    saveCookiePreferences(preferences);
    setIsVisible(false);
  };

  const handleRejectNonEssential = () => {
    const essentialOnly = {
      essential: true,
      analytics: false,
      marketing: false,
    };
    
    setPreferences(essentialOnly);
    saveCookiePreferences(essentialOnly);
    setIsVisible(false);
  };

  const saveCookiePreferences = (prefs: CookiePreferences) => {
    const consentData = {
      preferences: prefs,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    
    localStorage.setItem('cookieConsent', JSON.stringify(consentData));
    
    // Aqui você pode implementar a lógica para aplicar as preferências
    // Por exemplo, inicializar/desabilitar Google Analytics, pixels de marketing, etc.
    if (prefs.analytics) {
      // Inicializar Google Analytics
      console.log('Analytics cookies enabled');
    }
    
    if (prefs.marketing) {
      // Inicializar pixels de marketing
      console.log('Marketing cookies enabled');
    }
  };

  const handlePreferenceChange = (type: keyof CookiePreferences, value: boolean) => {
    if (type === 'essential') return; // Cookies essenciais não podem ser desabilitados
    
    setPreferences(prev => ({
      ...prev,
      [type]: value
    }));
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <Card className="bg-white shadow-lg border border-gray-200">
        <CardContent className="p-6">
          {!showPreferences ? (
            <div className="flex flex-col space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <Shield className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Utilizamos cookies para melhorar sua experiência
                    </h3>
                    <p className="text-sm text-gray-700 mb-4">
                      Utilizamos cookies e tecnologias similares para personalizar conteúdo, 
                      analisar nosso tráfego e melhorar nossos serviços. Alguns cookies são 
                      essenciais para o funcionamento do site. Você pode escolher quais categorias 
                      aceitar clicando em "Personalizar" ou aceitar todos clicando em "Aceitar todos".
                    </p>
                    <p className="text-sm text-gray-600">
                      Para mais informações, consulte nossa{" "}
                      <button
                        onClick={() => setLocation('/privacy')}
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        Política de Privacidade
                      </button>
                      .
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRejectNonEssential()}
                  className="ml-2 flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowPreferences(true)}
                  className="flex items-center"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Personalizar
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRejectNonEssential}
                >
                  Apenas essenciais
                </Button>
                <Button
                  onClick={handleAcceptAll}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Aceitar todos
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Personalizar cookies
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreferences(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">Cookies Essenciais</h4>
                      <p className="text-sm text-gray-600">
                        Necessários para o funcionamento básico do site. Sempre ativos.
                      </p>
                    </div>
                    <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                      Sempre ativo
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Incluem cookies de autenticação, segurança e preferências básicas.
                  </p>
                </div>
                
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">Cookies de Análise</h4>
                      <p className="text-sm text-gray-600">
                        Nos ajudam a entender como você usa nosso site para melhorias.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.analytics}
                        onChange={(e) => handlePreferenceChange('analytics', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">
                    Google Analytics, métricas de desempenho e estatísticas de uso.
                  </p>
                </div>
                
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">Cookies de Marketing</h4>
                      <p className="text-sm text-gray-600">
                        Personalizam anúncios e medem a eficácia de campanhas.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.marketing}
                        onChange={(e) => handlePreferenceChange('marketing', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">
                    Facebook Pixel, Google Ads, pixels de remarketing e análise de conversões.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowPreferences(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAcceptSelected}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Salvar preferências
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
