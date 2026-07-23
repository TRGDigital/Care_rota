const EARTH_RADIUS_M = 6_371_000

export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.asin(Math.sqrt(a))
}

export type GeofenceCheckResult =
  | { allowed: true; distanceMetres: number }
  | { allowed: false; distanceMetres: number; reason: 'outside_geofence' | 'poor_gps' | 'no_geofence' }

export function checkGeofence(opts: {
  homeLat: number | null
  homeLon: number | null
  radiusMetres: number
  staffLat: number
  staffLon: number
  gpsAccuracyMetres: number
}): GeofenceCheckResult {
  const { homeLat, homeLon, radiusMetres, staffLat, staffLon, gpsAccuracyMetres } = opts

  if (homeLat === null || homeLon === null) {
    return { allowed: false, distanceMetres: 0, reason: 'no_geofence' }
  }

  if (gpsAccuracyMetres > 50) {
    const distance = haversineDistance(homeLat, homeLon, staffLat, staffLon)
    return { allowed: false, distanceMetres: Math.round(distance), reason: 'poor_gps' }
  }

  const distance = haversineDistance(homeLat, homeLon, staffLat, staffLon)
  if (distance > radiusMetres) {
    return { allowed: false, distanceMetres: Math.round(distance), reason: 'outside_geofence' }
  }

  return { allowed: true, distanceMetres: Math.round(distance) }
}
