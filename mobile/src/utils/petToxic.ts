// Evcil hayvanlara (kedi/köpek) zararlı yaygın bitkiler.
// Bitkinin adı veya türü bu kelimelerden birini içeriyorsa uyarı gösterilir.
export const PET_TOXIC_KEYWORDS = [
  'monstera', 'zamioculcas', 'lavanta', 'ficus', 'difenbahya', 'dieffenbachia',
  'filodendron', 'philodendron', 'sarmaşık', 'aloe', 'zambak', 'zakkum', 'oleander', 'sagu',
];

export function isPetToxic(p: { name?: string | null; species_name?: string | null }): boolean {
  const text = `${p.name ?? ''} ${p.species_name ?? ''}`.toLowerCase();
  return PET_TOXIC_KEYWORDS.some((k) => text.includes(k));
}
