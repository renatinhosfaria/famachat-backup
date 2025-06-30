import axios from 'axios';

// Em aplicações Vite, usamos import.meta.env ao invés de process.env
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

interface GeocodingResult {
  zona: string;
  bairro: string;
  cidade: string;
  estado: string;
}

interface ZonaMapeamento {
  bairros: string[];
  nome: string;
}

// Mapeamento de bairros por zona
const ZONAS_MAPEAMENTO: ZonaMapeamento[] = [
  {
    nome: 'norte',
    bairros: [
      'Jardim da Penha',
      'Mata da Praia',
      'Goiabeiras',
      'República',
      'Boa Vista',
      'Morada de Camburi',
      'Jardim Camburi',
      'Praia do Canto'
    ]
  },
  {
    nome: 'sul',
    bairros: [
      'Bento Ferreira',
      'Praia do Suá',
      'Jesus de Nazareth',
      'Ilha do Frade',
      'Ilha do Boi',
      'Enseada do Suá',
      'Santa Helena'
    ]
  },
  {
    nome: 'leste',
    bairros: [
      'Praia do Canto',
      'Santa Lúcia',
      'Barro Vermelho',
      'Santa Luíza',
      'Praia do Suá',
      'Santa Helena'
    ]
  },
  {
    nome: 'oeste',
    bairros: [
      'Santo Antônio',
      'São Pedro',
      'Ilha do Príncipe',
      'Caratoíra',
      'Inhanguetá',
      'Grande Vitória'
    ]
  },
  {
    nome: 'centro',
    bairros: [
      'Centro',
      'Parque Moscoso',
      'Vila Rubim',
      'Santa Clara',
      'Fonte Grande',
      'Piedade'
    ]
  }
];

export function getZonaDaCidade(bairro: string): string {
  if (!bairro) return 'centro';
  
  const bairroNormalizado = bairro.toLowerCase().trim();
  
  const zonaEncontrada = ZONAS_MAPEAMENTO.find(zona =>
    zona.bairros.some(b => b.toLowerCase() === bairroNormalizado)
  );
  
  return zonaEncontrada?.nome || 'centro';
}

// Função para buscar e atualizar a zona de todos os imóveis
export function atualizarZonasImoveisEmLote(imoveis: any[]): any[] {
  return imoveis.map((imovel) => ({
    ...imovel,
    // Preserva o valor do banco de dados se já existir, caso contrário calcula a zona
    zona_empreendimento: imovel.zona_empreendimento || getZonaDaCidade(imovel.bairro_empreendimento)
  }));
} 