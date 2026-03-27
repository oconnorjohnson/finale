import type { FieldRegistry } from '@finalejs/core/portable';

export function mergeFieldRegistries(...registries: FieldRegistry[]): FieldRegistry {
  return Object.assign({}, ...registries);
}
