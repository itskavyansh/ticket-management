import { CreateTableInput } from 'aws-sdk/clients/dynamodb';

/**
 * DynamoDB table definitions for the AI Ticket Management Platform
 */

// Tickets table definition
export const ticketsTableDefinition: CreateTableInput = {
  TableName: process.env.TICKETS_TABLE_NAME || 'ai-ticket-management-tickets',
  KeySchema: [
    {
      AttributeName: 'customerId',
      KeyType: 'HASH' // Partition key
    },
    {
      AttributeName: 'ticketId',
      KeyType: 'RANGE' // Sort key
    }
  ],
  AttributeDefinitions: [
    {
      AttributeName: 'customerId',
      AttributeType: 'S'
    },
    {
      AttributeName: 'ticketId',
      AttributeType: 'S'
    },
    {
      AttributeName: 'status',
      AttributeType: 'S'
    },
    {
      AttributeName: 'assignedTechnicianId',
      AttributeType: 'S'
    },
    {
      AttributeName: 'priority',
      AttributeType: 'S'
    },
    {
      AttributeName: 'category',
      AttributeType: 'S'
    },
    {
      AttributeName: 'createdAt',
      AttributeType: 'S'
    },
    {
      AttributeName: 'slaDeadline',
      AttributeType: 'S'
    },
    {
      AttributeName: 'externalId',
      AttributeType: 'S'
    }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'StatusIndex',
      KeySchema: [
        {
          AttributeName: 'status',
          KeyType: 'HASH'
        },
        {
          AttributeName: 'createdAt',
          KeyType: 'RANGE'
        }
      ],
      Projection: {
        ProjectionType: 'ALL'
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    },
    {
      IndexName: 'TechnicianIndex',
      KeySchema: [
        {
          AttributeName: 'assignedTechnicianId',
          KeyType: 'HASH'
        },
        {
          AttributeName: 'createdAt',
          KeyType: 'RANGE'
        }
      ],
      Projection: {
        ProjectionType: 'ALL'
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    },
    {
      IndexName: 'PriorityIndex',
      KeySchema: [
        {
          AttributeName: 'priority',
          KeyType: 'HASH'
        },
        {
          AttributeName: 'slaDeadline',
          KeyType: 'RANGE'
        }
      ],
      Projection: {
        ProjectionType: 'ALL'
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    },
    {
      IndexName: 'CategoryIndex',
      KeySchema: [
        {
          AttributeName: 'category',
          KeyType: 'HASH'
        },
        {
          AttributeName: 'createdAt',
          KeyType: 'RANGE'
        }
      ],
      Projection: {
        ProjectionType: 'ALL'
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    },
    {
      IndexName: 'ExternalIdIndex',
      KeySchema: [
        {
          AttributeName: 'externalId',
          KeyType: 'HASH'
        }
      ],
      Projection: {
        ProjectionType: 'ALL'
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 10,
    WriteCapacityUnits: 10
  },
  BillingMode: 'PROVISIONED',
  StreamSpecification: {
    StreamEnabled: true,
    StreamViewType: 'NEW_AND_OLD_IMAGES'
  },
  Tags: [
    {
      Key: 'Environment',
      Value: process.env.NODE_ENV || 'development'
    },
    {
      Key: 'Application',
      Value: 'ai-ticket-management'
    }
  ]
};

// Technicians table definition
export const techniciansTableDefinition: CreateTableInput = {
  TableName: process.env.TECHNICIANS_TABLE_NAME || 'ai-ticket-management-technicians',
  KeySchema: [
    {
      AttributeName: 'technicianId',
      KeyType: 'HASH' // Partition key
    }
  ],
  AttributeDefinitions: [
    {
      AttributeName: 'technicianId',
      AttributeType: 'S'
    },
    {
      AttributeName: 'email',
      AttributeType: 'S'
    },
    {
      AttributeName: 'department',
      AttributeType: 'S'
    },
    {
      AttributeName: 'role',
      AttributeType: 'S'
    },
    {
      AttributeName: 'isActive',
      AttributeType: 'S'
    },
    {
      AttributeName: 'externalId',
      AttributeType: 'S'
    }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'EmailIndex',
      KeySchema: [
        {
          AttributeName: 'email',
          KeyType: 'HASH'
        }
      ],
      Projection: {
        ProjectionType: 'ALL'
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    },
    {
      IndexName: 'DepartmentIndex',
      KeySchema: [
        {
          AttributeName: 'department',
          KeyType: 'HASH'
        },
        {
          AttributeName: 'role',
          KeyType: 'RANGE'
        }
      ],
      Projection: {
        ProjectionType: 'ALL'
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    },
    {
      IndexName: 'ActiveTechniciansIndex',
      KeySchema: [
        {
          AttributeName: 'isActive',
          KeyType: 'HASH'
        },
        {
          AttributeName: 'department',
          KeyType: 'RANGE'
        }
      ],
      Projection: {
        ProjectionType: 'ALL'
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    },
    {
      IndexName: 'ExternalIdIndex',
      KeySchema: [
        {
          AttributeName: 'externalId',
          KeyType: 'HASH'
        }
      ],
      Projection: {
        ProjectionType: 'ALL'
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  },
  BillingMode: 'PROVISIONED',
  Tags: [
    {
      Key: 'Environment',
      Value: process.env.NODE_ENV || 'development'
    },
    {
      Key: 'Application',
      Value: 'ai-ticket-management'
    }
  ]
};

// Time tracking table definition
export const timeTrackingTableDefinition: CreateTableInput = {
  TableName: process.env.TIME_TRACKING_TABLE_NAME || 'ai-ticket-management-time-tracking',
  KeySchema: [
    {
      AttributeName: 'technicianId',
      KeyType: 'HASH' // Partition key
    },
    {
      AttributeName: 'timestamp',
      KeyType: 'RANGE' // Sort key
    }
  ],
  AttributeDefinitions: [
    {
      AttributeName: 'technicianId',
      AttributeType: 'S'
    },
    {
      AttributeName: 'timestamp',
      AttributeType: 'S'
    },
    {
      AttributeName: 'ticketId',
      AttributeType: 'S'
    },
    {
      AttributeName: 'date',
      AttributeType: 'S'
    }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'TicketTimeIndex',
      KeySchema: [
        {
          AttributeName: 'ticketId',
          KeyType: 'HASH'
        },
        {
          AttributeName: 'timestamp',
          KeyType: 'RANGE'
        }
      ],
      Projection: {
        ProjectionType: 'ALL'
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    },
    {
      IndexName: 'DateIndex',
      KeySchema: [
        {
          AttributeName: 'date',
          KeyType: 'HASH'
        },
        {
          AttributeName: 'timestamp',
          KeyType: 'RANGE'
        }
      ],
      Projection: {
        ProjectionType: 'ALL'
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  },
  BillingMode: 'PROVISIONED',
  Tags: [
    {
      Key: 'Environment',
      Value: process.env.NODE_ENV || 'development'
    },
    {
      Key: 'Application',
      Value: 'ai-ticket-management'
    }
  ]
};

// Customers table definition
export const customersTableDefinition: CreateTableInput = {
  TableName: process.env.CUSTOMERS_TABLE_NAME || 'ai-ticket-management-customers',
  KeySchema: [
    {
      AttributeName: 'customerId',
      KeyType: 'HASH' // Partition key
    }
  ],
  AttributeDefinitions: [
    {
      AttributeName: 'customerId',
      AttributeType: 'S'
    },
    {
      AttributeName: 'email',
      AttributeType: 'S'
    },
    {
      AttributeName: 'tier',
      AttributeType: 'S'
    },
    {
      AttributeName: 'isActive',
      AttributeType: 'S'
    },
    {
      AttributeName: 'externalId',
      AttributeType: 'S'
    }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'EmailIndex',
      KeySchema: [
        {
          AttributeName: 'email',
          KeyType: 'HASH'
        }
      ],
      Projection: {
        ProjectionType: 'ALL'
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    },
    {
      IndexName: 'TierIndex',
      KeySchema: [
        {
          AttributeName: 'tier',
          KeyType: 'HASH'
        },
        {
          AttributeName: 'isActive',
          KeyType: 'RANGE'
        }
      ],
      Projection: {
        ProjectionType: 'ALL'
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    },
    {
      IndexName: 'ExternalIdIndex',
      KeySchema: [
        {
          AttributeName: 'externalId',
          KeyType: 'HASH'
        }
      ],
      Projection: {
        ProjectionType: 'ALL'
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  },
  BillingMode: 'PROVISIONED',
  Tags: [
    {
      Key: 'Environment',
      Value: process.env.NODE_ENV || 'development'
    },
    {
      Key: 'Application',
      Value: 'ai-ticket-management'
    }
  ]
};

// Export all table definitions
export const allTableDefinitions = [
  ticketsTableDefinition,
  techniciansTableDefinition,
  timeTrackingTableDefinition,
  customersTableDefinition
];