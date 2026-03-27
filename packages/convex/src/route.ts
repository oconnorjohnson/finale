import type { ConvexRouteDescriptor } from './types.js';

export function createConvexRoutePattern(route: ConvexRouteDescriptor): string {
  if (route.path) {
    return route.path;
  }

  if (route.pathPrefix) {
    return `${route.pathPrefix}*`;
  }

  return '/';
}
