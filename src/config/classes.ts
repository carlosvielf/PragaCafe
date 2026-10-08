export const classStyles: Record<string, { color: string; name: string; shortName: string }> = {
  bicho_mineirorotation: { color: '#F59E0B', name: 'Bicho-mineiro', shortName: 'Bicho-mineiro' },
  cercosporarotation: { color: '#8B5CF6', name: 'Cercosporiose', shortName: 'Cercosporiose' },
  ferrugemrotation: { color: '#EF4444', name: 'Ferrugem do cafeeiro', shortName: 'Ferrugem' },
  phomarotation: { color: '#3B82F6', name: 'Mancha de Phoma', shortName: 'Phoma' },
};
export function getClassStyle(className: string, name: string) {
  return classStyles[className] ?? { color: '#64748B', name, shortName: name };
}
