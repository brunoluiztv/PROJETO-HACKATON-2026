import type { Profile } from './model';
export const profiles: Profile[] = [{
  id: 'signal-demo',
  version: 1,
  label: 'Sinal demonstrativo',
  description: 'Série numérica em percentual. Não corresponde a um sensor escolhido.',
  kind: 'numeric',
  unit: '%',
  decimals: 1,
  domain: [0, 100]
}, {
  id: 'temperature-demo',
  version: 1,
  label: 'Temperatura demonstrativa',
  description: 'Exemplo de outra unidade e escala, incluindo valores negativos.',
  kind: 'numeric',
  unit: '°C',
  decimals: 1,
  domain: [-10, 40]
}, {
  id: 'class-demo',
  version: 1,
  label: 'Classificação demonstrativa',
  description: 'Categorias de exemplo, sem interpretação de qualidade da água.',
  kind: 'categorical',
  choices: {
    a: {
      label: 'Classe A',
      symbol: '●'
    },
    b: {
      label: 'Classe B',
      symbol: '◆'
    },
    c: {
      label: 'Classe C',
      symbol: '▲'
    }
  }
}, {
  id: 'event-demo',
  version: 1,
  label: 'Detecção demonstrativa',
  description: 'Exemplo de resultado lógico. Não representa um analito definido.',
  kind: 'boolean',
  labels: {
    yes: 'Evento detectado',
    no: 'Evento não detectado'
  }
}];
