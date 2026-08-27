import { Lang } from './translations';

export function specTypeLabel(name: string | undefined | null, lang: Lang): string {
  if (!name) return '';
  if (lang !== 'en') return name;
  const n = name.toLowerCase();
  if (n.includes('malzeme')) return 'Plant Supplies';
  if (n.includes('kaktüs')) return 'Cacti';
  if (n.includes('sukulent')) return 'Succulents';
  if (n.includes('palmiye')) return 'Palms';
  if (n.includes('yaprak')) return 'Foliage Plants';
  if (n.includes('çiçek')) return 'Flowering Plants';
  if (n.includes('dış') || n.includes('fidan')) return 'Outdoor Plants';
  return name;
}
