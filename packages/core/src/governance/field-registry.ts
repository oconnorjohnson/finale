import type { FieldDefinition, FieldRegistry } from '../types/index.js';

export function defineFields<T extends FieldRegistry>(fields: T): T {
  return fields;
}

export class FieldRegistryStore {
  private readonly fields: FieldRegistry;

  constructor(fields: FieldRegistry) {
    this.fields = { ...fields };
  }

  has(key: string): boolean {
    return key in this.fields;
  }

  get(key: string): FieldDefinition | undefined {
    return this.fields[key];
  }

  keys(): string[] {
    return Object.keys(this.fields);
  }

  queryNamespace(namespace: string): Array<[string, FieldDefinition]> {
    const normalized = namespace.endsWith('.*') ? namespace.slice(0, -2) : namespace;
    const prefix = `${normalized}.`;
    return Object.entries(this.fields).filter(([key]) => key.startsWith(prefix));
  }

  toObject(): FieldRegistry {
    return { ...this.fields };
  }
}
