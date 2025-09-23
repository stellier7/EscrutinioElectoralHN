export interface PartyConfig {
  id: string;
  name: string;
  shortName: string;
  color: string;
  logoUrl?: string;
  description?: string;
}

export const PARTY_CONFIGS: Record<string, PartyConfig> = {
  'PDC': {
    id: 'PDC',
    name: 'Demócrata Cristiano',
    shortName: 'PDC',
    color: '#16a34a', // Verde
    logoUrl: '/logos/pdc-logo.svg',
    description: 'Partido Demócrata Cristiano de Honduras'
  },
  'LIBRE': {
    id: 'LIBRE',
    name: 'Libre',
    shortName: 'LIBRE',
    color: '#dc2626', // Rojo
    logoUrl: '/logos/libre-logo.svg',
    description: 'Partido Libertad y Refundación'
  },
  'PINU-SD': {
    id: 'PINU-SD',
    name: 'PINU-SD',
    shortName: 'PINU',
    color: '#7c3aed', // Púrpura
    logoUrl: '/logos/pinu-logo.svg',
    description: 'Partido Innovación y Unidad Social Demócrata'
  },
  'PLH': {
    id: 'PLH',
    name: 'Liberal',
    shortName: 'Liberal',
    color: '#ef4444', // Rojo claro
    logoUrl: '/logos/plh-logo.svg',
    description: 'Partido Liberal de Honduras'
  },
  'PNH': {
    id: 'PNH',
    name: 'Nacional',
    shortName: 'Nacional',
    color: '#1e40af', // Azul oscuro
    logoUrl: '/logos/pnh-logo.svg',
    description: 'Partido Nacional de Honduras'
  }
};

export function getPartyConfig(partyId: string): PartyConfig {
  return PARTY_CONFIGS[partyId] || {
    id: partyId,
    name: partyId,
    shortName: partyId,
    color: '#6b7280', // Gris por defecto
    description: 'Partido político'
  };
}

export function getPartyColor(partyId: string): string {
  return getPartyConfig(partyId).color;
}

export function getPartyName(partyId: string): string {
  return getPartyConfig(partyId).name;
}
