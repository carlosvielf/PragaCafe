// Exact dataset identifiers verified through Roboflow projects_get (Doencas).
// Never infer disease names from visual prompts or an unverified class_id order.
export const diseaseNames = new Map([
  ['bicho_mineirorotation', 'Bicho-mineiro'],
  ['cercosporarotation', 'Cercosporiose'],
  ['ferrugemrotation', 'Ferrugem do cafeeiro'],
  ['phomarotation', 'Mancha de Phoma'],
]);
export function resolveClass(label) {
  const hasLabel = typeof label === 'string' && label.trim().length > 0;
  if (hasLabel) return {className:label,name:diseaseNames.get(label) ?? label,sourceClass:label};
  throw new Error('PREDICTION_PROCESSING_ERROR');
}
