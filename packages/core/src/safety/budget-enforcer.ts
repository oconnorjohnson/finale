import type { FieldRegistry, LimitsConfig, SubEvent } from '../types/index.js';

export interface BudgetEnforcerOptions {
  limits?: LimitsConfig;
  fieldRegistry?: FieldRegistry;
}

export interface BudgetResult {
  fields: Record<string, unknown>;
  subEvents?: SubEvent[];
  droppedFields: string[];
  dropReason?: string;
}

const DEFAULT_MAX_TOTAL_SIZE = 64 * 1024;

function estimateSize(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value));
}

export class BudgetEnforcer {
  private readonly maxTotalSize: number;
  private readonly fieldRegistry: FieldRegistry | undefined;

  constructor(options: BudgetEnforcerOptions = {}) {
    this.maxTotalSize = options.limits?.maxTotalSize ?? DEFAULT_MAX_TOTAL_SIZE;
    this.fieldRegistry = options.fieldRegistry;
  }

  enforce(fields: Record<string, unknown>, subEvents?: SubEvent[]): BudgetResult {
    const mutableFields: Record<string, unknown> = { ...fields };
    const droppedFields = new Set<string>();
    const mutableSubEvents = subEvents ? [...subEvents] : undefined;

    const budgetObject = () => ({ fields: mutableFields, subEvents: mutableSubEvents });
    if (estimateSize(budgetObject()) <= this.maxTotalSize) {
      return {
        fields: mutableFields,
        ...(mutableSubEvents ? { subEvents: mutableSubEvents } : {}),
        droppedFields: [],
      };
    }

    const priorities: Array<'drop-first' | 'optional' | 'important'> = ['drop-first', 'optional', 'important'];
    for (const priority of priorities) {
      const keysAtPriority = Object.keys(mutableFields).filter((key) => this.fieldRegistry?.[key]?.priority === priority);
      for (const key of keysAtPriority) {
        delete mutableFields[key];
        droppedFields.add(key);
        if (estimateSize(budgetObject()) <= this.maxTotalSize) {
          return {
            fields: mutableFields,
            ...(mutableSubEvents ? { subEvents: mutableSubEvents } : {}),
            droppedFields: [...droppedFields],
            dropReason: 'budget_exceeded',
          };
        }
      }
    }

    if (mutableSubEvents && mutableSubEvents.length > 0) {
      while (mutableSubEvents.length > 0 && estimateSize(budgetObject()) > this.maxTotalSize) {
        mutableSubEvents.pop();
      }
    }

    return {
      fields: mutableFields,
      ...(mutableSubEvents ? { subEvents: mutableSubEvents } : {}),
      droppedFields: [...droppedFields],
      ...(estimateSize(budgetObject()) > this.maxTotalSize ? { dropReason: 'budget_exceeded' } : {}),
    };
  }
}
