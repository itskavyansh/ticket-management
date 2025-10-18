/**
 * Test Data Generator for Load Testing
 * Generates realistic test data for performance testing scenarios
 */

import { v4 as uuidv4 } from 'uuid';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'technician' | 'readonly';
  token?: string;
}

export interface TestTicket {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  customerId: string;
  assignedTechnicianId?: string;
  createdAt: string;
  slaDeadline: string;
}

export interface TestCustomer {
  id: string;
  name: string;
  email: string;
  tier: 'enterprise' | 'business' | 'standard';
  slaHours: number;
}

export interface TestTechnician {
  id: string;
  name: string;
  email: string;
  skills: string[];
  maxCapacity: number;
  currentWorkload: number;
}

export class TestDataGenerator {
  private static readonly TICKET_CATEGORIES = [
    'hardware', 'software', 'network', 'security', 'email', 'database', 'backup'
  ];

  private static readonly TICKET_TITLES = [
    'Server not responding',
    'Email delivery issues',
    'Network connectivity problems',
    'Database performance degradation',
    'Security alert investigation',
    'Backup failure notification',
    'Application crash report',
    'User access issues',
    'System maintenance request',
    'Performance optimization needed'
  ];

  private static readonly CUSTOMER_NAMES = [
    'Acme Corporation', 'TechStart Inc', 'Global Solutions Ltd', 'Innovation Hub',
    'Digital Dynamics', 'Future Systems', 'Smart Solutions', 'Enterprise Plus',
    'Business Central', 'Tech Innovators', 'Data Systems Inc', 'Cloud First Ltd'
  ];

  private static readonly TECHNICIAN_NAMES = [
    'John Smith', 'Sarah Johnson', 'Mike Chen', 'Emily Davis', 'David Wilson',
    'Lisa Anderson', 'Chris Brown', 'Amanda Taylor', 'Robert Garcia', 'Jennifer Lee'
  ];

  private static readonly SKILLS = [
    'Windows Server', 'Linux Administration', 'Network Security', 'Database Management',
    'Cloud Computing', 'Virtualization', 'Backup Systems', 'Email Systems',
    'Firewall Management', 'Active Directory', 'VMware', 'AWS', 'Azure'
  ];

  static generateUsers(count: number): TestUser[] {
    const users: TestUser[] = [];
    const roles: TestUser['role'][] = ['admin', 'manager', 'technician', 'readonly'];

    for (let i = 0; i < count; i++) {
      users.push({
        id: uuidv4(),
        email: `user${i}@testcompany.com`,
        name: `Test User ${i}`,
        role: roles[i % roles.length],
      });
    }

    return users;
  }

  static generateCustomers(count: number): TestCustomer[] {
    const customers: TestCustomer[] = [];
    const tiers: TestCustomer['tier'][] = ['enterprise', 'business', 'standard'];
    const slaHours = { enterprise: 4, business: 8, standard: 24 };

    for (let i = 0; i < count; i++) {
      const tier = tiers[i % tiers.length];
      customers.push({
        id: uuidv4(),
        name: this.CUSTOMER_NAMES[i % this.CUSTOMER_NAMES.length] + ` ${Math.floor(i / this.CUSTOMER_NAMES.length) + 1}`,
        email: `contact${i}@customer${i}.com`,
        tier,
        slaHours: slaHours[tier],
      });
    }

    return customers;
  }

  static generateTechnicians(count: number): TestTechnician[] {
    const technicians: TestTechnician[] = [];

    for (let i = 0; i < count; i++) {
      const skillCount = Math.floor(Math.random() * 5) + 3; // 3-7 skills per technician
      const technicianSkills = this.getRandomItems(this.SKILLS, skillCount);

      technicians.push({
        id: uuidv4(),
        name: this.TECHNICIAN_NAMES[i % this.TECHNICIAN_NAMES.length] + ` ${Math.floor(i / this.TECHNICIAN_NAMES.length) + 1}`,
        email: `tech${i}@company.com`,
        skills: technicianSkills,
        maxCapacity: Math.floor(Math.random() * 10) + 15, // 15-25 tickets max
        currentWorkload: Math.floor(Math.random() * 10), // 0-10 current tickets
      });
    }

    return technicians;
  }

  static generateTickets(count: number, customers: TestCustomer[], technicians: TestTechnician[]): TestTicket[] {
    const tickets: TestTicket[] = [];
    const priorities: TestTicket['priority'][] = ['critical', 'high', 'medium', 'low'];
    const statuses: TestTicket['status'][] = ['open', 'in_progress', 'resolved', 'closed'];

    for (let i = 0; i < count; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      const priority = priorities[Math.floor(Math.random() * priorities.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const category = this.TICKET_CATEGORIES[Math.floor(Math.random() * this.TICKET_CATEGORIES.length)];
      
      const createdAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Last 30 days
      const slaDeadline = new Date(createdAt.getTime() + customer.slaHours * 60 * 60 * 1000);

      let assignedTechnicianId: string | undefined;
      if (status === 'in_progress' || status === 'resolved') {
        assignedTechnicianId = technicians[Math.floor(Math.random() * technicians.length)].id;
      }

      tickets.push({
        id: uuidv4(),
        title: this.TICKET_TITLES[Math.floor(Math.random() * this.TICKET_TITLES.length)],
        description: this.generateTicketDescription(category),
        category,
        priority,
        status,
        customerId: customer.id,
        assignedTechnicianId,
        createdAt: createdAt.toISOString(),
        slaDeadline: slaDeadline.toISOString(),
      });
    }

    return tickets;
  }

  private static generateTicketDescription(category: string): string {
    const descriptions = {
      hardware: [
        'Server hardware failure detected in production environment',
        'Workstation experiencing random shutdowns and blue screens',
        'Network switch showing intermittent connectivity issues',
        'Printer not responding to print jobs from multiple users'
      ],
      software: [
        'Application crashes when processing large datasets',
        'Software license expiration causing access issues',
        'Database application showing performance degradation',
        'Email client not synchronizing with server properly'
      ],
      network: [
        'Internet connectivity issues affecting entire office',
        'VPN connection dropping frequently for remote users',
        'Network latency causing application timeouts',
        'Firewall blocking legitimate business applications'
      ],
      security: [
        'Suspicious login attempts detected from unknown IP addresses',
        'Antivirus software reporting potential malware infection',
        'User account showing signs of unauthorized access',
        'Security certificate expiration causing browser warnings'
      ],
      email: [
        'Email delivery delays affecting business communications',
        'Spam filter blocking legitimate business emails',
        'Email server storage capacity reaching critical levels',
        'Outlook synchronization issues with mobile devices'
      ],
      database: [
        'Database query performance significantly slower than normal',
        'Database backup process failing with timeout errors',
        'Data integrity issues detected during routine maintenance',
        'Database connection pool exhaustion during peak hours'
      ],
      backup: [
        'Scheduled backup job failing with unknown error codes',
        'Backup storage capacity approaching maximum limits',
        'Backup restoration test revealing data corruption issues',
        'Backup verification process taking longer than expected'
      ]
    };

    const categoryDescriptions = descriptions[category as keyof typeof descriptions] || descriptions.software;
    return categoryDescriptions[Math.floor(Math.random() * categoryDescriptions.length)];
  }

  private static getRandomItems<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  static generateRealisticWorkload(): {
    morningRush: number;
    businessHours: number;
    afternoonPeak: number;
    eveningWind: number;
    nightMinimal: number;
  } {
    return {
      morningRush: Math.floor(Math.random() * 20) + 30, // 30-50 requests/min
      businessHours: Math.floor(Math.random() * 15) + 40, // 40-55 requests/min
      afternoonPeak: Math.floor(Math.random() * 25) + 45, // 45-70 requests/min
      eveningWind: Math.floor(Math.random() * 10) + 15, // 15-25 requests/min
      nightMinimal: Math.floor(Math.random() * 5) + 2, // 2-7 requests/min
    };
  }
}