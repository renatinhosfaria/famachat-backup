import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function TermsOfService() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Termos de Uso
          </h1>
          <p className="text-gray-600">
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Aceitação dos Termos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">
                Ao acessar e usar os serviços da Fama Negócios Imobiliários, você concorda em cumprir 
                e estar vinculado a estes Termos de Uso. Se você não concordar com qualquer parte 
                destes termos, não deverá usar nossos serviços.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Descrição dos Serviços</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 mb-4">
                A Fama Negócios Imobiliários oferece serviços de:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                <li>Intermediação de compra, venda e locação de imóveis</li>
                <li>Consultoria imobiliária</li>
                <li>Avaliação de imóveis</li>
                <li>Gestão patrimonial</li>
                <li>Plataforma digital para gestão de leads e clientes</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Cadastro e Conta do Usuário</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Para utilizar nossos serviços, você deve criar uma conta fornecendo informações 
                precisas e atualizadas. Você é responsável por:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                <li>Manter a confidencialidade de sua senha</li>
                <li>Todas as atividades que ocorram em sua conta</li>
                <li>Notificar-nos imediatamente sobre qualquer uso não autorizado</li>
                <li>Fornecer informações verdadeiras e atualizadas</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Uso Aceitável</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">Você concorda em não usar nossos serviços para:</p>
              <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                <li>Atividades ilegais ou não autorizadas</li>
                <li>Transmitir conteúdo ofensivo, difamatório ou prejudicial</li>
                <li>Interferir no funcionamento dos serviços</li>
                <li>Tentar acessar contas de outros usuários</li>
                <li>Usar informações dos serviços para spam ou marketing não autorizado</li>
                <li>Violar direitos de propriedade intelectual</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Propriedade Intelectual</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">
                Todos os direitos de propriedade intelectual relacionados aos nossos serviços, 
                incluindo mas não limitado a textos, gráficos, logos, ícones, imagens, clipes 
                de áudio e software, são propriedade da Fama Negócios Imobiliários ou de seus 
                licenciadores e são protegidos pelas leis de direitos autorais e marcas registradas.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>6. Privacidade e Proteção de Dados</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">
                O tratamento de seus dados pessoais é regido por nossa{" "}
                <button
                  onClick={() => setLocation('/privacy')}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Política de Privacidade
                </button>
                , que está em conformidade com a Lei Geral de Proteção de Dados (LGPD).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>7. Limitação de Responsabilidade</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">
                Em nenhuma circunstância a Fama Negócios Imobiliários será responsável por danos 
                indiretos, incidentais, especiais, consequenciais ou punitivos, incluindo perda 
                de lucros, dados ou uso, decorrentes do uso ou impossibilidade de uso de nossos serviços.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>8. Modificações dos Termos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">
                Reservamo-nos o direito de modificar estes termos a qualquer momento. 
                As alterações serão comunicadas através de nosso site ou por e-mail. 
                O uso continuado dos serviços após as modificações constitui aceitação dos novos termos.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>9. Suspensão e Encerramento</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">
                Podemos suspender ou encerrar sua conta e acesso aos serviços a qualquer momento, 
                com ou sem causa, com ou sem aviso prévio, incluindo caso você viole estes Termos de Uso.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>10. Lei Aplicável</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">
                Estes Termos de Uso são regidos pelas leis brasileiras. Qualquer disputa 
                decorrente destes termos será resolvida nos tribunais competentes do Brasil.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>11. Contato</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">
                Para questões relacionadas a estes Termos de Uso, entre em contato conosco:
              </p>
              <div className="mt-4 space-y-1 text-gray-700">
                <p><strong>E-mail:</strong> contato@famanegocios.com.br</p>
                <p><strong>Telefone:</strong> (11) 9999-9999</p>
                <p><strong>Endereço:</strong> Rua Example, 123 - São Paulo/SP</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-sm text-gray-500 mt-8">
          <p>
            © {new Date().getFullYear()} Fama Negócios Imobiliários. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
