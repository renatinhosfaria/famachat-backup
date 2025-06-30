import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, MapPin } from "lucide-react";
import { useLocation } from "wouter";

export default function Privacy() {
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
            Política de Privacidade
          </h1>
          <p className="text-gray-600">
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>

        <div className="space-y-6">
          {/* Introdução */}
          <Card>
            <CardHeader>
              <CardTitle>1. Introdução</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                A <strong>Fama Negócios Imobiliários</strong> ("nós", "nosso" ou "empresa") está comprometida em proteger 
                a privacidade e os dados pessoais de nossos usuários, clientes e visitantes ("você" ou "titular dos dados"). 
                Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações 
                pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018) e demais 
                legislações aplicáveis.
              </p>
              <p className="text-gray-700">
                Ao utilizar nossos serviços, você concorda com as práticas descritas nesta política. 
                Se você não concordar com algum aspecto desta política, recomendamos que não utilize nossos serviços.
              </p>
            </CardContent>
          </Card>

          {/* Definições */}
          <Card>
            <CardHeader>
              <CardTitle>2. Definições</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <strong className="text-gray-900">Dados Pessoais:</strong>
                <span className="text-gray-700 ml-2">
                  Informação relacionada a pessoa natural identificada ou identificável.
                </span>
              </div>
              <div>
                <strong className="text-gray-900">Dados Sensíveis:</strong>
                <span className="text-gray-700 ml-2">
                  Dados pessoais sobre origem racial ou étnica, convicção religiosa, opinião política, 
                  filiação a sindicato ou organização de caráter religioso, filosófico ou político, 
                  dados referentes à saúde ou à vida sexual, dados genéticos ou biométricos.
                </span>
              </div>
              <div>
                <strong className="text-gray-900">Controlador:</strong>
                <span className="text-gray-700 ml-2">
                  Fama Negócios Imobiliários, responsável pelas decisões referentes ao tratamento de dados pessoais.
                </span>
              </div>
              <div>
                <strong className="text-gray-900">Operador:</strong>
                <span className="text-gray-700 ml-2">
                  Pessoa natural ou jurídica que realiza o tratamento de dados pessoais em nome do controlador.
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Dados Coletados */}
          <Card>
            <CardHeader>
              <CardTitle>3. Dados Pessoais Coletados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">3.1 Dados fornecidos diretamente por você:</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                  <li>Nome completo</li>
                  <li>Documento de identidade (CPF, RG)</li>
                  <li>Endereço de e-mail</li>
                  <li>Número de telefone</li>
                  <li>Endereço residencial</li>
                  <li>Data de nascimento</li>
                  <li>Estado civil</li>
                  <li>Profissão e renda</li>
                  <li>Informações sobre imóveis de interesse</li>
                  <li>Preferências de comunicação</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">3.2 Dados coletados automaticamente:</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                  <li>Endereço IP</li>
                  <li>Informações do dispositivo (tipo, sistema operacional, navegador)</li>
                  <li>Dados de navegação (páginas visitadas, tempo de permanência)</li>
                  <li>Localização geográfica (quando autorizada)</li>
                  <li>Cookies e tecnologias similares</li>
                  <li>Logs de acesso e uso do sistema</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">3.3 Dados de terceiros:</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                  <li>Informações de redes sociais (quando autorizada a integração)</li>
                  <li>Dados de bureaus de crédito (quando necessário para análise creditícia)</li>
                  <li>Informações de parceiros comerciais</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Finalidades */}
          <Card>
            <CardHeader>
              <CardTitle>4. Finalidades do Tratamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Utilizamos seus dados pessoais exclusivamente para as seguintes finalidades:
              </p>
              
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-gray-900">4.1 Prestação de serviços imobiliários:</h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                    <li>Intermediação de compra, venda e locação de imóveis</li>
                    <li>Consultoria imobiliária</li>
                    <li>Avaliação de imóveis</li>
                    <li>Gestão de contratos</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900">4.2 Comunicação:</h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                    <li>Envio de informações sobre imóveis compatíveis com seu perfil</li>
                    <li>Atendimento ao cliente</li>
                    <li>Resposta a dúvidas e solicitações</li>
                    <li>Comunicação sobre alterações nos serviços</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900">4.3 Marketing e publicidade:</h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                    <li>Envio de newsletters e materiais promocionais</li>
                    <li>Personalização de ofertas</li>
                    <li>Pesquisas de satisfação</li>
                    <li>Campanhas publicitárias direcionadas</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900">4.4 Obrigações legais:</h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                    <li>Cumprimento de decisões judiciais</li>
                    <li>Atendimento a requisições de órgãos reguladores</li>
                    <li>Prevenção à lavagem de dinheiro</li>
                    <li>Verificação de identidade</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Base Legal */}
          <Card>
            <CardHeader>
              <CardTitle>5. Base Legal para o Tratamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <strong className="text-gray-900">Consentimento:</strong>
                <span className="text-gray-700 ml-2">
                  Para atividades de marketing e comunicações promocionais.
                </span>
              </div>
              <div>
                <strong className="text-gray-900">Execução de contrato:</strong>
                <span className="text-gray-700 ml-2">
                  Para prestação dos serviços imobiliários contratados.
                </span>
              </div>
              <div>
                <strong className="text-gray-900">Legítimo interesse:</strong>
                <span className="text-gray-700 ml-2">
                  Para melhoria dos serviços, segurança e prevenção de fraudes.
                </span>
              </div>
              <div>
                <strong className="text-gray-900">Cumprimento de obrigação legal:</strong>
                <span className="text-gray-700 ml-2">
                  Para atendimento às exigências legais e regulamentares.
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Compartilhamento */}
          <Card>
            <CardHeader>
              <CardTitle>6. Compartilhamento de Dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Seus dados pessoais podem ser compartilhados nas seguintes situações:
              </p>
              
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-gray-900">6.1 Prestadores de serviços:</h4>
                  <p className="text-gray-700 ml-4">
                    Empresas que nos auxiliam na prestação dos serviços (plataformas de pagamento, 
                    serviços de marketing, provedores de tecnologia).
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900">6.2 Parceiros comerciais:</h4>
                  <p className="text-gray-700 ml-4">
                    Imobiliárias parceiras, construtoras e incorporadoras (apenas quando necessário 
                    para a prestação do serviço).
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900">6.3 Autoridades competentes:</h4>
                  <p className="text-gray-700 ml-4">
                    Quando exigido por lei ou determinação judicial.
                  </p>
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-blue-800">
                  <strong>Importante:</strong> Nunca vendemos ou alugamos seus dados pessoais para terceiros 
                  para fins comerciais.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Segurança */}
          <Card>
            <CardHeader>
              <CardTitle>7. Segurança dos Dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados pessoais:
              </p>
              
              <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                <li>Criptografia de dados em trânsito e em repouso</li>
                <li>Controle de acesso baseado em funções</li>
                <li>Monitoramento contínuo de segurança</li>
                <li>Backups regulares e seguros</li>
                <li>Treinamento de funcionários sobre proteção de dados</li>
                <li>Auditorias periódicas de segurança</li>
                <li>Políticas internas de proteção de dados</li>
              </ul>
              
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-yellow-800">
                  <strong>Atenção:</strong> Apesar de todos os esforços, nenhum sistema é 100% seguro. 
                  Recomendamos que você também adote boas práticas de segurança.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Retenção */}
          <Card>
            <CardHeader>
              <CardTitle>8. Retenção de Dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Mantemos seus dados pessoais pelo tempo necessário para cumprir as finalidades para as quais foram coletados:
              </p>
              
              <div className="space-y-3">
                <div>
                  <strong className="text-gray-900">Dados de clientes ativos:</strong>
                  <span className="text-gray-700 ml-2">
                    Durante o período de relacionamento comercial.
                  </span>
                </div>
                <div>
                  <strong className="text-gray-900">Dados contratuais:</strong>
                  <span className="text-gray-700 ml-2">
                    Por até 10 anos após o encerramento do contrato (conforme Código Civil).
                  </span>
                </div>
                <div>
                  <strong className="text-gray-900">Dados para marketing:</strong>
                  <span className="text-gray-700 ml-2">
                    Até a revogação do consentimento ou por até 2 anos sem interação.
                  </span>
                </div>
                <div>
                  <strong className="text-gray-900">Logs de acesso:</strong>
                  <span className="text-gray-700 ml-2">
                    Por até 6 meses (conforme Marco Civil da Internet).
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Direitos do Titular */}
          <Card>
            <CardHeader>
              <CardTitle>9. Seus Direitos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Como titular dos dados, você possui os seguintes direitos:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div>
                    <strong className="text-gray-900">Confirmação:</strong>
                    <p className="text-sm text-gray-700">
                      Confirmar a existência de tratamento de seus dados.
                    </p>
                  </div>
                  <div>
                    <strong className="text-gray-900">Acesso:</strong>
                    <p className="text-sm text-gray-700">
                      Acessar seus dados pessoais.
                    </p>
                  </div>
                  <div>
                    <strong className="text-gray-900">Correção:</strong>
                    <p className="text-sm text-gray-700">
                      Corrigir dados incompletos, inexatos ou desatualizados.
                    </p>
                  </div>
                  <div>
                    <strong className="text-gray-900">Anonimização:</strong>
                    <p className="text-sm text-gray-700">
                      Solicitar anonimização ou bloqueio de dados.
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <strong className="text-gray-900">Eliminação:</strong>
                    <p className="text-sm text-gray-700">
                      Solicitar eliminação de dados desnecessários.
                    </p>
                  </div>
                  <div>
                    <strong className="text-gray-900">Portabilidade:</strong>
                    <p className="text-sm text-gray-700">
                      Solicitar portabilidade dos dados.
                    </p>
                  </div>
                  <div>
                    <strong className="text-gray-900">Informação:</strong>
                    <p className="text-sm text-gray-700">
                      Obter informações sobre compartilhamento.
                    </p>
                  </div>
                  <div>
                    <strong className="text-gray-900">Revogação:</strong>
                    <p className="text-sm text-gray-700">
                      Revogar consentimento a qualquer momento.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cookies */}
          <Card>
            <CardHeader>
              <CardTitle>10. Cookies e Tecnologias Similares</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Utilizamos cookies e tecnologias similares para melhorar sua experiência:
              </p>
              
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-gray-900">Cookies essenciais:</h4>
                  <p className="text-gray-700 ml-4">
                    Necessários para o funcionamento básico do site (autenticação, segurança).
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900">Cookies de desempenho:</h4>
                  <p className="text-gray-700 ml-4">
                    Coletam informações sobre como você usa nosso site para melhorias.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900">Cookies de marketing:</h4>
                  <p className="text-gray-700 ml-4">
                    Utilizados para personalizar anúncios e medir eficácia de campanhas.
                  </p>
                </div>
              </div>
              
              <p className="text-gray-700">
                Você pode gerenciar suas preferências de cookies através das configurações do seu navegador.
              </p>
            </CardContent>
          </Card>

          {/* Menores */}
          <Card>
            <CardHeader>
              <CardTitle>11. Dados de Menores de Idade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Nossos serviços são direcionados a pessoas maiores de 18 anos. Não coletamos 
                conscientemente dados pessoais de menores de 16 anos sem o consentimento dos pais ou responsáveis.
              </p>
              
              <p className="text-gray-700">
                Para menores entre 16 e 18 anos, exigimos autorização dos pais ou responsáveis legais 
                antes do tratamento de dados pessoais.
              </p>
              
              <p className="text-gray-700">
                Se tomarmos conhecimento de que coletamos dados de um menor sem a devida autorização, 
                tomaremos medidas imediatas para eliminar essas informações.
              </p>
            </CardContent>
          </Card>

          {/* Transferência Internacional */}
          <Card>
            <CardHeader>
              <CardTitle>12. Transferência Internacional de Dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Alguns de nossos prestadores de serviços podem estar localizados fora do Brasil. 
                Nestes casos, garantimos que:
              </p>
              
              <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                <li>A transferência ocorre apenas para países com nível de proteção adequado</li>
                <li>São implementadas garantias contratuais específicas</li>
                <li>Você é informado sobre tais transferências</li>
                <li>São adotadas medidas técnicas de proteção adicionais</li>
              </ul>
            </CardContent>
          </Card>

          {/* Alterações */}
          <Card>
            <CardHeader>
              <CardTitle>13. Alterações nesta Política</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Esta Política de Privacidade pode ser atualizada periodicamente para refletir 
                mudanças em nossas práticas, na legislação ou em nossos serviços.
              </p>
              
              <p className="text-gray-700">
                Alterações significativas serão comunicadas através de:
              </p>
              
              <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                <li>E-mail para os endereços cadastrados</li>
                <li>Aviso destacado em nosso site</li>
                <li>Notificação em nosso sistema</li>
              </ul>
              
              <p className="text-gray-700">
                Recomendamos que você revise esta política regularmente para se manter informado 
                sobre como protegemos seus dados.
              </p>
            </CardContent>
          </Card>

          {/* Contato */}
          <Card>
            <CardHeader>
              <CardTitle>14. Contato e Encarregado de Dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Para exercer seus direitos, esclarecer dúvidas ou reportar incidentes relacionados 
                aos seus dados pessoais, entre em contato conosco:
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">E-mail do Encarregado de Dados:</p>
                    <p className="text-gray-700">dpo@famanegocios.com.br</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <Phone className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">Telefone:</p>
                    <p className="text-gray-700">(11) 9999-9999</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">Endereço:</p>
                    <p className="text-gray-700">
                      Rua Example, 123<br />
                      Bairro Example - São Paulo/SP<br />
                      CEP: 00000-000
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-green-800">
                  <strong>Prazo de resposta:</strong> Responderemos sua solicitação em até 15 dias corridos, 
                  podendo ser prorrogado por mais 15 dias mediante justificativa.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Órgãos de Controle */}
          <Card>
            <CardHeader>
              <CardTitle>15. Autoridade Nacional de Proteção de Dados (ANPD)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Caso não fique satisfeito com nossas respostas, você pode contatar a Autoridade Nacional 
                de Proteção de Dados (ANPD):
              </p>
              
              <div className="space-y-2">
                <p className="text-gray-700">
                  <strong>Site:</strong> https://www.gov.br/anpd/pt-br
                </p>
                <p className="text-gray-700">
                  <strong>E-mail:</strong> comunicacao@anpd.gov.br
                </p>
                <p className="text-gray-700">
                  <strong>Telefone:</strong> (61) 2027-6300
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Separator className="my-8" />
        
        <div className="text-center text-sm text-gray-500">
          <p>
            © {new Date().getFullYear()} Fama Negócios Imobiliários. Todos os direitos reservados.
          </p>
          <p className="mt-2">
            Esta política está em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
          </p>
        </div>
      </div>
    </div>
  );
}
