/**
 * Calcula la distancia entre dos puntos geográficos usando la fórmula Haversine
 * @param lat1 Latitud del punto 1
 * @param lon1 Longitud del punto 1
 * @param lat2 Latitud del punto 2
 * @param lon2 Longitud del punto 2
 * @returns Distancia en kilómetros
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radio de la Tierra en km

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calcula el puntaje basado en la distancia para preguntas de mapa
 * @param distance Distancia en km entre la respuesta y el punto correcto
 * @returns Puntaje (0-100)
 */
export function calculateMapScore(distance: number): number {
  if (distance < 50) return 100;
  if (distance < 100) return 90;
  if (distance < 200) return 75;
  if (distance < 500) return 50;
  if (distance < 1000) return 25;
  if (distance < 2000) return 10;
  return 0;
}
