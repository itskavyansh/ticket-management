import { v4 as uuidv4 } from 'uuid';

export abstract class BaseEntity {
  public id: string;
  public createdAt: Date;
  public updatedAt: Date;

  constructor() {
    this.id = uuidv4();
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Update the updatedAt timestamp
   */
  public touch(): void {
    this.updatedAt = new Date();
  }

  /**
   * Convert entity to plain object for JSON serialization
   */
  public toJSON(): Record<string, any> {
    const obj: Record<string, any> = {};
    
    // Get all enumerable properties
    for (const key in this) {
      if (this.hasOwnProperty(key)) {
        const value = this[key];
        
        // Handle Date objects
        if (value instanceof Date) {
          obj[key] = value.toISOString();
        }
        // Handle arrays
        else if (Array.isArray(value)) {
          obj[key] = value.map(item => 
            item && typeof (item as any).toJSON === 'function' ? (item as any).toJSON() : item
          );
        }
        // Handle nested objects with toJSON method
        else if (value && typeof (value as any).toJSON === 'function') {
          obj[key] = (value as any).toJSON();
        }
        // Handle primitive values
        else {
          obj[key] = value;
        }
      }
    }
    
    return obj;
  }

  /**
   * Create entity from plain object
   */
  public static fromJSON<T extends BaseEntity>(
    this: new () => T,
    data: Record<string, any>
  ): T {
    const entity = new this();
    
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined) {
        // Handle Date strings
        if (typeof data[key] === 'string' && 
            (key.includes('At') || key.includes('Date') || key.includes('Time'))) {
          const date = new Date(data[key]);
          if (!isNaN(date.getTime())) {
            (entity as any)[key] = date;
            return;
          }
        }
        
        (entity as any)[key] = data[key];
      }
    });
    
    return entity;
  }

  /**
   * Validate entity data
   */
  public abstract validate(): { isValid: boolean; errors: string[] };

  /**
   * Get entity type name
   */
  public getEntityType(): string {
    return this.constructor.name;
  }
}