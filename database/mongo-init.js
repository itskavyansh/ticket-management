// MongoDB initialization script
db = db.getSiblingDB('ai_ticket_management');

// Create collections with validation
db.createCollection('tickets', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'title', 'description', 'customerId'],
      properties: {
        id: { bsonType: 'string' },
        title: { bsonType: 'string' },
        description: { bsonType: 'string' },
        status: { enum: ['open', 'in_progress', 'resolved', 'closed'] },
        priority: { enum: ['low', 'medium', 'high', 'critical'] },
        customerId: { bsonType: 'string' }
      }
    }
  }
});

db.createCollection('technicians', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'name', 'email'],
      properties: {
        id: { bsonType: 'string' },
        name: { bsonType: 'string' },
        email: { bsonType: 'string' },
        role: { enum: ['technician', 'senior_technician', 'team_lead', 'manager'] }
      }
    }
  }
});

db.createCollection('customers', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'name', 'email', 'company'],
      properties: {
        id: { bsonType: 'string' },
        name: { bsonType: 'string' },
        email: { bsonType: 'string' },
        company: { bsonType: 'string' },
        tier: { enum: ['basic', 'standard', 'premium', 'enterprise'] }
      }
    }
  }
});

// Create indexes
db.tickets.createIndex({ id: 1 }, { unique: true });
db.tickets.createIndex({ status: 1 });
db.tickets.createIndex({ priority: 1 });
db.tickets.createIndex({ customerId: 1 });
db.tickets.createIndex({ assignedTechnicianId: 1 });
db.tickets.createIndex({ createdAt: -1 });

db.technicians.createIndex({ id: 1 }, { unique: true });
db.technicians.createIndex({ email: 1 }, { unique: true });
db.technicians.createIndex({ isActive: 1 });

db.customers.createIndex({ id: 1 }, { unique: true });
db.customers.createIndex({ email: 1 });
db.customers.createIndex({ tier: 1 });

// Insert sample data
db.customers.insertMany([
  {
    id: 'cust-001',
    name: 'John Smith',
    email: 'john.smith@acmecorp.com',
    company: 'Acme Corporation',
    tier: 'enterprise',
    contactInfo: {
      phone: '+1-555-0123',
      primaryContact: 'John Smith'
    },
    slaAgreement: {
      responseTime: 15,
      resolutionTime: 4,
      businessHours: {
        start: '09:00',
        end: '17:00',
        timezone: 'UTC'
      },
      supportLevel: '24x7'
    },
    preferences: {
      communicationChannel: 'email',
      language: 'en',
      notificationFrequency: 'immediate'
    },
    statistics: {
      totalTickets: 0,
      openTickets: 0,
      averageResolutionTime: 0,
      satisfactionScore: 0
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'cust-002',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@techstart.com',
    company: 'TechStart Inc',
    tier: 'premium',
    contactInfo: {
      phone: '+1-555-0456',
      primaryContact: 'Sarah Johnson'
    },
    slaAgreement: {
      responseTime: 30,
      resolutionTime: 8,
      businessHours: {
        start: '08:00',
        end: '18:00',
        timezone: 'UTC'
      },
      supportLevel: 'business_hours'
    },
    preferences: {
      communicationChannel: 'slack',
      language: 'en',
      notificationFrequency: 'hourly'
    },
    statistics: {
      totalTickets: 0,
      openTickets: 0,
      averageResolutionTime: 0,
      satisfactionScore: 0
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

db.technicians.insertMany([
  {
    id: 'tech-001',
    name: 'Mike Wilson',
    email: 'mike.wilson@company.com',
    role: 'senior_technician',
    skills: ['networking', 'security', 'troubleshooting'],
    specializations: ['cisco', 'firewall_management'],
    isActive: true,
    currentWorkload: {
      activeTickets: 0,
      totalHoursThisWeek: 0,
      utilizationPercentage: 0
    },
    performance: {
      averageResolutionTime: 0,
      ticketsResolvedThisMonth: 0,
      customerSatisfactionScore: 0,
      slaComplianceRate: 0
    },
    availability: {
      schedule: [
        { day: 'monday', startTime: '09:00', endTime: '17:00' },
        { day: 'tuesday', startTime: '09:00', endTime: '17:00' },
        { day: 'wednesday', startTime: '09:00', endTime: '17:00' },
        { day: 'thursday', startTime: '09:00', endTime: '17:00' },
        { day: 'friday', startTime: '09:00', endTime: '17:00' }
      ],
      timeZone: 'UTC',
      isOnline: false,
      lastSeen: new Date()
    },
    preferences: {
      maxConcurrentTickets: 5,
      preferredCategories: ['network', 'security'],
      notificationSettings: {
        email: true,
        slack: true,
        teams: false
      }
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'tech-002',
    name: 'Lisa Chen',
    email: 'lisa.chen@company.com',
    role: 'technician',
    skills: ['software_support', 'troubleshooting', 'customer_service'],
    specializations: ['microsoft_office', 'email_systems'],
    isActive: true,
    currentWorkload: {
      activeTickets: 0,
      totalHoursThisWeek: 0,
      utilizationPercentage: 0
    },
    performance: {
      averageResolutionTime: 0,
      ticketsResolvedThisMonth: 0,
      customerSatisfactionScore: 0,
      slaComplianceRate: 0
    },
    availability: {
      schedule: [
        { day: 'monday', startTime: '08:00', endTime: '16:00' },
        { day: 'tuesday', startTime: '08:00', endTime: '16:00' },
        { day: 'wednesday', startTime: '08:00', endTime: '16:00' },
        { day: 'thursday', startTime: '08:00', endTime: '16:00' },
        { day: 'friday', startTime: '08:00', endTime: '16:00' }
      ],
      timeZone: 'UTC',
      isOnline: false,
      lastSeen: new Date()
    },
    preferences: {
      maxConcurrentTickets: 3,
      preferredCategories: ['software', 'email'],
      notificationSettings: {
        email: true,
        slack: false,
        teams: true
      }
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

print('MongoDB initialization completed successfully!');