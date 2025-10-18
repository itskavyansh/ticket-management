import { BaseEntity } from './BaseEntity';
import { Customer } from '../models';
import { validateCreateCustomer, validateUpdateCustomer } from '../validation';

export class CustomerEntity extends BaseEntity implements Customer {
  public externalId?: string;
  public name: string;
  public email: string;
  public phoneNumber?: string;
  public companyName: string;
  public tier: 'basic' | 'premium' | 'enterprise';
  
  // Contract and SLA information
  public contractStartDate: Date;
  public contractEndDate?: Date;
  public slaLevel: string;
  public responseTimeTarget: number;
  public resolutionTimeTarget: number;
  
  // Contact information
  public primaryContact: {
    name: string;
    email: string;
    phoneNumber?: string;
    role: string;
  };
  public technicalContacts: Array<{
    name: string;
    email: string;
    phoneNumber?: string;
    role: string;
  }>;
  
  // Business information
  public industry: string;
  public employeeCount?: number;
  public annualRevenue?: number;
  
  // Support preferences
  public preferredContactMethod: 'email' | 'phone' | 'chat' | 'portal';
  public businessHours: {
    timezone: string;
    workingDays: string[];
    startTime: string;
    endTime: string;
  };
  
  // Status and metrics
  public isActive: boolean;
  public satisfactionScore?: number;
  public totalTickets: number;
  public openTickets: number;
  
  // Billing and subscription
  public subscriptionPlan: string;
  public billingContact?: {
    name: string;
    email: string;
    phoneNumber?: string;
  };

  constructor(data?: Partial<Customer>) {
    super();
    
    // Initialize with defaults
    this.name = '';
    this.email = '';
    this.companyName = '';
    this.tier = 'basic';
    this.contractStartDate = new Date();
    this.slaLevel = 'standard';
    this.responseTimeTarget = 240; // 4 hours
    this.resolutionTimeTarget = 1440; // 24 hours
    this.primaryContact = {
      name: '',
      email: '',
      role: ''
    };
    this.technicalContacts = [];
    this.industry = '';
    this.preferredContactMethod = 'email';
    this.businessHours = {
      timezone: 'UTC',
      workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      startTime: '09:00',
      endTime: '17:00'
    };
    this.isActive = true;
    this.totalTickets = 0;
    this.openTickets = 0;
    this.subscriptionPlan = 'basic';
    
    // Apply provided data
    if (data) {
      Object.assign(this, data);
    }
  }

  /**
   * Get SLA response time based on tier and priority
   */
  public getSLAResponseTime(priority: string): number {
    let baseTime = this.responseTimeTarget;
    
    // Adjust based on customer tier
    switch (this.tier) {
      case 'enterprise':
        baseTime = Math.floor(baseTime * 0.5); // 50% faster
        break;
      case 'premium':
        baseTime = Math.floor(baseTime * 0.75); // 25% faster
        break;
      case 'basic':
        // Use base time
        break;
    }
    
    // Adjust based on priority
    switch (priority.toLowerCase()) {
      case 'critical':
        return Math.floor(baseTime * 0.25); // 15 minutes for enterprise critical
      case 'high':
        return Math.floor(baseTime * 0.5);
      case 'medium':
        return baseTime;
      case 'low':
        return baseTime * 2;
      default:
        return baseTime;
    }
  }

  /**
   * Get SLA resolution time based on tier and priority
   */
  public getSLAResolutionTime(priority: string): number {
    let baseTime = this.resolutionTimeTarget;
    
    // Adjust based on customer tier
    switch (this.tier) {
      case 'enterprise':
        baseTime = Math.floor(baseTime * 0.5);
        break;
      case 'premium':
        baseTime = Math.floor(baseTime * 0.75);
        break;
      case 'basic':
        // Use base time
        break;
    }
    
    // Adjust based on priority
    switch (priority.toLowerCase()) {
      case 'critical':
        return Math.floor(baseTime * 0.25); // 6 hours for enterprise critical
      case 'high':
        return Math.floor(baseTime * 0.5);
      case 'medium':
        return baseTime;
      case 'low':
        return baseTime * 2;
      default:
        return baseTime;
    }
  }

  /**
   * Check if customer is currently in business hours
   */
  public isInBusinessHours(date: Date = new Date()): boolean {
    const dayOfWeek = date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      timeZone: this.businessHours.timezone 
    }).toLowerCase();
    
    if (!this.businessHours.workingDays.includes(dayOfWeek)) {
      return false;
    }
    
    const currentTime = date.toLocaleTimeString('en-US', { 
      hour12: false, 
      timeZone: this.businessHours.timezone,
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return currentTime >= this.businessHours.startTime && 
           currentTime <= this.businessHours.endTime;
  }

  /**
   * Add technical contact
   */
  public addTechnicalContact(contact: {
    name: string;
    email: string;
    phoneNumber?: string;
    role: string;
  }): void {
    this.technicalContacts.push(contact);
    this.touch();
  }

  /**
   * Remove technical contact
   */
  public removeTechnicalContact(email: string): void {
    this.technicalContacts = this.technicalContacts.filter(
      contact => contact.email !== email
    );
    this.touch();
  }

  /**
   * Update satisfaction score
   */
  public updateSatisfactionScore(score: number): void {
    if (score >= 1 && score <= 5) {
      this.satisfactionScore = score;
      this.touch();
    }
  }

  /**
   * Increment ticket counters
   */
  public incrementTicketCount(): void {
    this.totalTickets += 1;
    this.openTickets += 1;
    this.touch();
  }

  /**
   * Decrement open ticket counter (when ticket is resolved/closed)
   */
  public decrementOpenTicketCount(): void {
    this.openTickets = Math.max(0, this.openTickets - 1);
    this.touch();
  }

  /**
   * Update contract information
   */
  public updateContract(
    startDate: Date, 
    endDate: Date, 
    slaLevel: string
  ): void {
    this.contractStartDate = startDate;
    this.contractEndDate = endDate;
    this.slaLevel = slaLevel;
    this.touch();
  }

  /**
   * Check if contract is active
   */
  public isContractActive(): boolean {
    const now = new Date();
    
    if (now < this.contractStartDate) {
      return false; // Contract hasn't started yet
    }
    
    if (this.contractEndDate && now > this.contractEndDate) {
      return false; // Contract has expired
    }
    
    return true;
  }

  /**
   * Get contract days remaining
   */
  public getContractDaysRemaining(): number | null {
    if (!this.contractEndDate) {
      return null; // No end date (ongoing contract)
    }
    
    const now = new Date();
    const diffTime = this.contractEndDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }

  /**
   * Get customer priority based on tier and metrics
   */
  public getCustomerPriority(): 'low' | 'medium' | 'high' | 'critical' {
    // Base priority on tier
    let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    
    switch (this.tier) {
      case 'enterprise':
        priority = 'high';
        break;
      case 'premium':
        priority = 'medium';
        break;
      case 'basic':
        priority = 'low';
        break;
    }
    
    // Escalate if satisfaction is low
    if (this.satisfactionScore && this.satisfactionScore < 3) {
      priority = priority === 'low' ? 'medium' : 
                 priority === 'medium' ? 'high' : 'critical';
    }
    
    // Escalate if many open tickets
    if (this.openTickets > 10) {
      priority = priority === 'low' ? 'medium' : 
                 priority === 'medium' ? 'high' : 'critical';
    }
    
    return priority;
  }

  /**
   * Get all contact emails for notifications
   */
  public getAllContactEmails(): string[] {
    const emails = [this.email, this.primaryContact.email];
    
    this.technicalContacts.forEach(contact => {
      if (!emails.includes(contact.email)) {
        emails.push(contact.email);
      }
    });
    
    if (this.billingContact && !emails.includes(this.billingContact.email)) {
      emails.push(this.billingContact.email);
    }
    
    return emails.filter(email => email && email.trim() !== '');
  }

  /**
   * Validate customer data
   */
  public validate(): { isValid: boolean; errors: string[] } {
    const validation = validateCreateCustomer({
      name: this.name,
      email: this.email,
      companyName: this.companyName,
      tier: this.tier,
      slaLevel: this.slaLevel,
      responseTimeTarget: this.responseTimeTarget,
      resolutionTimeTarget: this.resolutionTimeTarget,
      primaryContact: this.primaryContact,
      phoneNumber: this.phoneNumber,
      industry: this.industry,
      preferredContactMethod: this.preferredContactMethod,
      businessHours: this.businessHours,
      subscriptionPlan: this.subscriptionPlan
    });

    return {
      isValid: !validation.error,
      errors: validation.error ? validation.error.details.map(d => d.message) : []
    };
  }

  /**
   * Deactivate customer
   */
  public deactivate(): void {
    this.isActive = false;
    this.touch();
  }

  /**
   * Reactivate customer
   */
  public reactivate(): void {
    this.isActive = true;
    this.touch();
  }
}