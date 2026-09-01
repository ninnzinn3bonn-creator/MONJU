import type { LocationPoint } from "./types";

const EARTH_RADIUS_M = 6_371_008.8;
const TO_RADIANS = Math.PI / 180;

export function haversineDistanceM(
  a: Pick<LocationPoint, "latitude" | "longitude">,
  b: Pick<LocationPoint, "latitude" | "longitude">,
): number {
  const latitudeDelta = (b.latitude - a.latitude) * TO_RADIANS;
  const longitudeDelta = (b.longitude - a.longitude) * TO_RADIANS;
  const latitudeA = a.latitude * TO_RADIANS;
  const latitudeB = b.latitude * TO_RADIANS;

  const chord =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(chord));
}

export function geographicCentroid(
  points: readonly LocationPoint[],
): Pick<LocationPoint, "latitude" | "longitude"> {
  if (points.length === 0) {
    throw new Error("Cannot calculate a centroid without points");
  }

  let x = 0;
  let y = 0;
  let z = 0;

  for (const point of points) {
    const latitude = point.latitude * TO_RADIANS;
    const longitude = point.longitude * TO_RADIANS;
    x += Math.cos(latitude) * Math.cos(longitude);
    y += Math.cos(latitude) * Math.sin(longitude);
    z += Math.sin(latitude);
  }

  x /= points.length;
  y /= points.length;
  z /= points.length;

  const longitude = Math.atan2(y, x);
  const hypotenuse = Math.sqrt(x * x + y * y);
  const latitude = Math.atan2(z, hypotenuse);

  return {
    latitude: latitude / TO_RADIANS,
    longitude: longitude / TO_RADIANS,
  };
}
