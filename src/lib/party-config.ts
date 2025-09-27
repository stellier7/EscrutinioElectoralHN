export interface PartyConfig {
  id: string;
  name: string;
  shortName: string;
  color: string;
  logoUrl?: string;
  description?: string;
}

export const PARTY_CONFIGS: Record<string, PartyConfig> = {
  'pdc': {
    id: 'pdc',
    name: 'Demócrata Cristiano',
    shortName: 'PDC',
    color: '#16a34a', // Verde
    logoUrl: '/logos/pdc-logo.svg',
    description: 'Partido Demócrata Cristiano de Honduras'
  },
  'libre': {
    id: 'libre',
    name: 'LIBRE',
    shortName: 'LIBRE',
    color: '#dc2626', // Rojo
    logoUrl: '/logos/libre-logo.svg',
    description: 'Partido Libertad y Refundación'
  },
  'pinu-sd': {
    id: 'pinu-sd',
    name: 'PINU',
    shortName: 'PINU',
    color: '#7c3aed', // Morado
    logoUrl: '/logos/pinu-logo.svg',
    description: 'Partido Innovación y Unidad Social Demócrata'
  },
  'liberal': {
    id: 'liberal',
    name: 'Partido Liberal',
    shortName: 'Liberal',
    color: '#ef4444', // Rojo claro
    logoUrl: '/logos/plh-logo.svg',
    description: 'Partido Liberal de Honduras'
  },
  'nacional': {
    id: 'nacional',
    name: 'Partido Nacional',
    shortName: 'Nacional',
    color: '#2563eb', // Azul
    logoUrl: '/logos/pnh-logo.svg',
    description: 'Partido Nacional de Honduras'
  }
};

// Función para convertir colores a versiones más transparentes
export function getTransparentColor(color: string, opacity: number = 0.15): string {
  // Si el color ya tiene transparencia, lo mantenemos
  if (color.includes('rgba') || color.includes('hsla')) {
    return color;
  }
  
  // Convertir hex a RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

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
