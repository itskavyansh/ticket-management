import { BaseEntity } from './BaseEntity';
import { 
  Technician, 
  UserRole, 
  TechnicianSkill, 
  AvailabilitySchedule, 
  TechnicianPreferences, 
  PerformanceMetrics 
} from '../models';
import { validateCreateTechnician, validateUpdateTechnician } from '../validation';

export class TechnicianEntity extends BaseEntity implements Technician {
  public externalId?: string;
  public name: string;
  public email: string;
  public role: UserRole;
  public skills: TechnicianSkill[];
  public currentWorkload: number;
  public maxCapacity: number;
  public performanceMetrics?: PerformanceMetrics;
  public availability: AvailabilitySchedule;
  public preferences: TechnicianPreferences;
  
  // Profile information
  public phoneNumber?: string;
  public department: string;
  public manager?: string;
  public hireDate: Date;
  
  // Status tracking
  public isActive: boolean;
  public lastLoginAt?: Date;
  public currentStatus: 'available' | 'busy' | 'away' | 'offline';
  public statusMessage?: string;
  
  // Location and timezone
  public timezone: string;
  public location?: string;
  
  // Certification and training
  public certifications: string[];
  public trainingCompleted: string[];

  constructor(data?: Partial<Technician>) {
    super();
    
    // Initialize with defaults
    this.name = '';
    this.email = '';
    this.role = UserRole.TECHNICIAN;
    this.skills = [];
    this.currentWorkload = 0;
    this.maxCapacity = 10;
    this.availability = this.getDefaultAvailability();
    this.preferences = this.getDefaultPreferences();
    this.department = '';
    this.hireDate = new Date();
    this.isActive = true;
    this.currentStatus = 'offline';
    this.timezone = 'UTC';
    this.certifications = [];
    this.trainingCompleted = [];
    
    // Apply provided data
    if (data) {
      Object.assign(this, data);
    }
  }

  /**
   * Get default availability schedule (Monday-Friday, 9-5)
   */
  private getDefaultAvailability(): AvailabilitySchedule {
    const defaultHours = {
      start: '09:00',
      end: '17:00',
      available: true
    };
    
    return {
      timezone: 'UTC',
      workingHours: {
        monday: defaultHours,
        tuesday: defaultHours,
        wednesday: defaultHours,
        thursday: defaultHours,
        friday: defaultHours,
        saturday: { start: '09:00', end: '17:00', available: false },
        sunday: { start: '09:00', end: '17:00', available: false }
      },
      holidays: [],
      timeOff: []
    };
  }

  /**
   * Get default preferences
   */
  private getDefaultPreferences(): TechnicianPreferences {
    return {
      preferredCategories: [],
      maxConcurrentTickets: 5,
      notificationChannels: ['email'],
      workloadThreshold: 80
    };
  }

  /**
   * Calculate current utilization rate
   */
  public getUtilizationRate(): number {
    return Math.min(100, (this.currentWorkload / this.maxCapacity) * 100);
  }

  /**
   * Check if technician is available for new assignments
   */
  public isAvailableForAssignment(): boolean {
    if (!this.isActive || this.currentStatus === 'offline' || this.currentStatus === 'away') {
      return false;
    }
    
    return this.currentWorkload < this.maxCapacity;
  }

  /**
   * Check if technician is currently working (within business hours)
   */
  public isCurrentlyWorking(): boolean {
    const now = new Date();
    const dayOfWeek = now.toLocaleDateString('en-US', { 
      weekday: 'long', 
      timeZone: this.timezone 
    }).toLowerCase();
    
    const workingHours = this.availability.workingHours[dayOfWeek];
    if (!workingHours || !workingHours.available) {
      return false;
    }
    
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      timeZone: this.timezone,
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return currentTime >= workingHours.start && currentTime <= workingHours.end;
  }

  /**
   * Get skill proficiency for a specific category
   */
  public getSkillProficiency(category: string): number {
    const skill = this.skills.find(s => 
      s.category.toLowerCase() === category.toLowerCase()
    );
    return skill ? skill.proficiencyLevel : 0;
  }

  /**
   * Add or update a skill
   */
  public updateSkill(skill: TechnicianSkill): void {
    const existingIndex = this.skills.findIndex(s => 
      s.category.toLowerCase() === skill.category.toLowerCase()
    );
    
    if (existingIndex >= 0) {
      this.skills[existingIndex] = skill;
    } else {
      this.skills.push(skill);
    }
    
    this.touch();
  }

  /**
   * Add certification
   */
  public addCertification(certification: string): void {
    if (!this.certifications.includes(certification)) {
      this.certifications.push(certification);
      this.touch();
    }
  }

  /**
   * Complete training
   */
  public completeTraining(training: string): void {
    if (!this.trainingCompleted.includes(training)) {
      this.trainingCompleted.push(training);
      this.touch();
    }
  }

  /**
   * Update status
   */
  public updateStatus(
    status: 'available' | 'busy' | 'away' | 'offline', 
    message?: string
  ): void {
    this.currentStatus = status;
    this.statusMessage = message;
    this.touch();
  }

  /**
   * Update workload
   */
  public updateWorkload(ticketCount: number): void {
    this.currentWorkload = Math.max(0, ticketCount);
    this.touch();
  }

  /**
   * Check if technician is overloaded
   */
  public isOverloaded(): boolean {
    return this.getUtilizationRate() > this.preferences.workloadThreshold;
  }

  /**
   * Get available capacity
   */
  public getAvailableCapacity(): number {
    return Math.max(0, this.maxCapacity - this.currentWorkload);
  }

  /**
   * Calculate skill match score for a ticket category
   */
  public calculateSkillMatch(requiredCategories: string[]): number {
    if (requiredCategories.length === 0) {
      return 50; // Neutral score if no specific skills required
    }
    
    let totalScore = 0;
    let matchedSkills = 0;
    
    for (const category of requiredCategories) {
      const proficiency = this.getSkillProficiency(category);
      if (proficiency > 0) {
        totalScore += proficiency * 10; // Convert 1-10 scale to percentage
        matchedSkills++;
      }
    }
    
    if (matchedSkills === 0) {
      return 0; // No matching skills
    }
    
    return Math.min(100, totalScore / matchedSkills);
  }

  /**
   * Update performance metrics
   */
  public updatePerformanceMetrics(metrics: PerformanceMetrics): void {
    this.performanceMetrics = metrics;
    this.touch();
  }

  /**
   * Set time off period
   */
  public setTimeOff(startDate: Date, endDate: Date): void {
    this.availability.timeOff.push({ startDate, endDate });
    this.touch();
  }

  /**
   * Check if technician is on time off
   */
  public isOnTimeOff(date: Date = new Date()): boolean {
    return this.availability.timeOff.some(timeOff => 
      date >= timeOff.startDate && date <= timeOff.endDate
    );
  }

  /**
   * Validate technician data
   */
  public validate(): { isValid: boolean; errors: string[] } {
    const validation = validateCreateTechnician({
      name: this.name,
      email: this.email,
      role: this.role,
      department: this.department,
      timezone: this.timezone,
      phoneNumber: this.phoneNumber,
      manager: this.manager,
      hireDate: this.hireDate,
      skills: this.skills,
      maxCapacity: this.maxCapacity,
      location: this.location
    });

    return {
      isValid: !validation.error,
      errors: validation.error ? validation.error.details.map(d => d.message) : []
    };
  }

  /**
   * Get years of experience
   */
  public getYearsOfExperience(): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this.hireDate.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365));
  }

  /**
   * Get overall skill level (average of all skills)
   */
  public getOverallSkillLevel(): number {
    if (this.skills.length === 0) {
      return 0;
    }
    
    const totalProficiency = this.skills.reduce(
      (sum, skill) => sum + skill.proficiencyLevel, 
      0
    );
    
    return Math.round(totalProficiency / this.skills.length);
  }
}