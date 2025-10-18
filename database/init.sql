-- Initialize database for AI Ticket Management Platform

-- Create database if it doesn't exist
-- (This is handled by the POSTGRES_DB environment variable in Docker)

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    technician_id VARCHAR(255) NOT NULL,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    tickets_resolved INTEGER DEFAULT 0,
    average_resolution_time INTERVAL,
    sla_compliance_rate DECIMAL(5,2),
    customer_satisfaction_score DECIMAL(3,2),
    utilization_rate DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SLA compliance tracking table
CREATE TABLE IF NOT EXISTS sla_compliance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id VARCHAR(255) NOT NULL,
    customer_id VARCHAR(255) NOT NULL,
    sla_deadline TIMESTAMP NOT NULL,
    actual_resolution TIMESTAMP,
    breach_occurred BOOLEAN DEFAULT FALSE,
    breach_duration INTERVAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ticket analytics table (denormalized for reporting)
CREATE TABLE IF NOT EXISTS ticket_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id VARCHAR(255) NOT NULL,
    customer_id VARCHAR(255) NOT NULL,
    technician_id VARCHAR(255),
    category VARCHAR(100),
    priority VARCHAR(50),
    status VARCHAR(50),
    created_at TIMESTAMP NOT NULL,
    first_response_at TIMESTAMP,
    resolved_at TIMESTAMP,
    response_time INTERVAL,
    resolution_time INTERVAL,
    sla_met BOOLEAN,
    ai_confidence_score DECIMAL(3,2),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_performance_metrics_technician_period 
ON performance_metrics(technician_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_sla_compliance_ticket 
ON sla_compliance(ticket_id);

CREATE INDEX IF NOT EXISTS idx_sla_compliance_customer_deadline 
ON sla_compliance(customer_id, sla_deadline);

CREATE INDEX IF NOT EXISTS idx_ticket_analytics_customer_created 
ON ticket_analytics(customer_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ticket_analytics_technician_status 
ON ticket_analytics(technician_id, status);

CREATE INDEX IF NOT EXISTS idx_ticket_analytics_category_priority 
ON ticket_analytics(category, priority);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_performance_metrics_updated_at 
    BEFORE UPDATE ON performance_metrics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticket_analytics_updated_at 
    BEFORE UPDATE ON ticket_analytics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();