import { LocationSchema, type Location } from '@civicmerge/contracts';

const EARTH_RADIUS_METERS = 6_371_000;

export function distanceMeters(from: Location, to: Location): number {
  const a = LocationSchema.parse(from);
  const b = LocationSchema.parse(to);
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const h = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
}
