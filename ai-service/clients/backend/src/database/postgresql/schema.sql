-- AI Ticket Management Platform - PostgreSQL Analytics Schema
-- This schema is designed for analytics, reporting, and performance metrics

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Performance metrics table for technicians
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    technician_id UUID NOT NULL,
    period_start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    tickets_resolved INTEGER NOT NULL DEFAULT 0,
    average_resolution_time_minutes INTEGER NOT NULL DEFAULT 0,
    sla_compliance_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (sla_compliance_rate >= 0 AND sla_compliance_rate <= 100),
    customer_satisfaction_score DECIMAL(3,2) NOT NULL DEFAULT 0.00 CHECK (customer_satisfaction_score >= 1 AND customer_satisfaction_score <= 5),
    utilization_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (utilization_rate >= 0 AND utilization_rate <= 100),
    first_call_resolution_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (first_call_resolution_rate >= 0 AND first_call_resolution_rate <= 100),
    total_time_spent_minutes INTEGER NOT NULL DEFAULT 0,
    billable_time_minutes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SLA compliance tracking table
CREATE TABLE IF NOT EXISTS sla_compliance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    technician_id UUID,
    priority VARCHAR(20) NOT NULL,
    category VARCHAR(50) NOT NULL,
    sla_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    response_time_minutes INTEGER,
    resolution_time_minutes INTEGER,
    response_sla_met BOOLEAN DEFAULT FALSE,
    resolution_sla_met BOOLEAN DEFAULT FALSE,
    breach_reason TEXT,
    escalation_level INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ticket analytics denormalized table for fast reporting
CREATE TABLE IF NOT EXISTS ticket_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL,
    external_ticket_id VARCHAR(100),
    customer_id UUID NOT NULL,
    customer_name VARCHAR(200) NOT NULL,
    customer_tier VARCHAR(20) NOT NULL,
    technician_id UUID,
    technician_name VARCHAR(200),
    department VARCHAR(100),
    title VARCHAR(500) NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE,
    first_response_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    sla_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    response_time_minutes INTEGER,
    resolution_time_minutes INTEGER,
    time_spent_minutes INTEGER DEFAULT 0,
    billable_time_minutes INTEGER DEFAULT 0,
    escalation_level INTEGER DEFAULT 0,
    customer_satisfaction_score INTEGER CHECK (customer_satisfaction_score >= 1 AND customer_satisfaction_score <= 5),
    tags TEXT[],
    ai_confidence_score DECIMAL(3,2) CHECK (ai_confidence_score >= 0 AND ai_confidence_score <= 1),
    sla_risk_score DECIMAL(3,2) CHECK (sla_risk_score >= 0 AND sla_risk_score <= 1),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Customer metrics aggregation table
CREATE TABLE IF NOT EXISTS customer_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL,
    customer_name VARCHAR(200) NOT NULL,
    customer_tier VARCHAR(20) NOT NULL,
    period_start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    total_tickets INTEGER NOT NULL DEFAULT 0,
    resolved_tickets INTEGER NOT NULL DEFAULT 0,
    average_response_time_minutes INTEGER NOT NULL DEFAULT 0,
    average_resolution_time_minutes INTEGER NOT NULL DEFAULT 0,
    sla_compliance_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    satisfaction_score DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    escalation_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    first_call_resolution_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    tickets_by_category JSONB,
    tickets_by_priority JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Daily KPI snapshots for trend analysis
CREATE TABLE IF NOT EXISTS daily_kpis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    total_tickets INTEGER NOT NULL DEFAULT 0,
    open_tickets INTEGER NOT NULL DEFAULT 0,
    resolved_tickets INTEGER NOT NULL DEFAULT 0,
    average_response_time_minutes INTEGER NOT NULL DEFAULT 0,
    average_resolution_time_minutes INTEGER NOT NULL DEFAULT 0,
    sla_compliance_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    customer_satisfaction_score DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    technician_utilization_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    active_technicians INTEGER NOT NULL DEFAULT 0,
    sla_risk_tickets INTEGER NOT NULL DEFAULT 0,
    overdue_tickets INTEGER NOT NULL DEFAULT 0,
    escalated_tickets INTEGER NOT NULL DEFAULT 0,
    first_call_resolution_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Time tracking entries for detailed analysis
CREATE TABLE IF NOT EXISTS time_tracking_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    technician_id UUID NOT NULL,
    ticket_id UUID NOT NULL,
    session_start TIMESTAMP WITH TIME ZONE NOT NULL,
    session_end TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    is_billable BOOLEAN DEFAULT TRUE,
    activity_type VARCHAR(50) DEFAULT 'work',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workload predictions table
CREATE TABLE IF NOT EXISTS workload_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    technician_id UUID NOT NULL,
    prediction_date DATE NOT NULL,
    predicted_ticket_count INTEGER NOT NULL DEFAULT 0,
    predicted_workload_hours DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    actual_ticket_count INTEGER,
    actual_workload_hours DECIMAL(5,2),
    prediction_accuracy DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Alert history for tracking notification effectiveness
CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    ticket_id UUID,
    technician_id UUID,
    customer_id UUID,
    message TEXT NOT NULL,
    channels_sent TEXT[],
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by UUID,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization

-- Performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_performance_metrics_technician_period 
ON performance_metrics(technician_id, period_start_date, period_end_date);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_period 
ON performance_metrics(period_start_date, period_end_date);

-- SLA compliance indexes
CREATE INDEX IF NOT EXISTS idx_sla_compliance_ticket 
ON sla_compliance(ticket_id);

CREATE INDEX IF NOT EXISTS idx_sla_compliance_customer_period 
ON sla_compliance(customer_id, created_at);

CREATE INDEX IF NOT EXISTS idx_sla_compliance_technician_period 
ON sla_compliance(technician_id, created_at) WHERE technician_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sla_compliance_priority_deadline 
ON sla_compliance(priority, sla_deadline);

-- Ticket analytics indexes
CREATE INDEX IF NOT EXISTS idx_ticket_analytics_customer_period 
ON ticket_analytics(customer_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ticket_analytics_technician_period 
ON ticket_analytics(technician_id, created_at) WHERE technician_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_analytics_status_priority 
ON ticket_analytics(status, priority);

CREATE INDEX IF NOT EXISTS idx_ticket_analytics_category_period 
ON ticket_analytics(category, created_at);

CREATE INDEX IF NOT EXISTS idx_ticket_analytics_external_id 
ON ticket_analytics(external_ticket_id) WHERE external_ticket_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_analytics_sla_risk 
ON ticket_analytics(sla_risk_score DESC, sla_deadline) WHERE sla_risk_score > 0.5;

-- Customer metrics indexes
CREATE INDEX IF NOT EXISTS idx_customer_metrics_customer_period 
ON customer_metrics(customer_id, period_start_date, period_end_date);

CREATE INDEX IF NOT EXISTS idx_customer_metrics_tier_period 
ON customer_metrics(customer_tier, period_start_date, period_end_date);

-- Daily KPIs indexes
CREATE INDEX IF NOT EXISTS idx_daily_kpis_date 
ON daily_kpis(date);

CREATE INDEX IF NOT EXISTS idx_daily_kpis_date_desc 
ON daily_kpis(date DESC);

-- Time tracking analytics indexes
CREATE INDEX IF NOT EXISTS idx_time_tracking_technician_date 
ON time_tracking_analytics(technician_id, session_start);

CREATE INDEX IF NOT EXISTS idx_time_tracking_ticket_date 
ON time_tracking_analytics(ticket_id, session_start);

CREATE INDEX IF NOT EXISTS idx_time_tracking_billable 
ON time_tracking_analytics(is_billable, session_start) WHERE is_billable = TRUE;

-- Workload predictions indexes
CREATE INDEX IF NOT EXISTS idx_workload_predictions_technician_date 
ON workload_predictions(technician_id, prediction_date);

CREATE INDEX IF NOT EXISTS idx_workload_predictions_date 
ON workload_predictions(prediction_date);

-- Alert history indexes
CREATE INDEX IF NOT EXISTS idx_alert_history_type_created 
ON alert_history(alert_type, created_at);

CREATE INDEX IF NOT EXISTS idx_alert_history_ticket 
ON alert_history(ticket_id) WHERE ticket_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alert_history_technician 
ON alert_history(technician_id) WHERE technician_id IS NOT NULL;

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_ticket_analytics_customer_status_period 
ON ticket_analytics(customer_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_ticket_analytics_technician_status_period 
ON ticket_analytics(technician_id, status, created_at) WHERE technician_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sla_compliance_breach_analysis 
ON sla_compliance(response_sla_met, resolution_sla_met, priority, created_at);

-- Partial indexes for active/recent data
CREATE INDEX IF NOT EXISTS idx_ticket_analytics_recent_open 
ON ticket_analytics(created_at DESC) 
WHERE status IN ('open', 'in_progress', 'pending_customer') 
AND created_at > CURRENT_DATE - INTERVAL '30 days';

CREATE INDEX IF NOT EXISTS idx_performance_metrics_recent 
ON performance_metrics(period_end_date DESC, technician_id) 
WHERE period_end_date > CURRENT_DATE - INTERVAL '90 days';

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_performance_metrics_updated_at 
    BEFORE UPDATE ON performance_metrics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_metrics_updated_at 
    BEFORE UPDATE ON customer_metrics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticket_analytics_updated_at 
    BEFORE UPDATE ON ticket_analytics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workload_predictions_updated_at 
    BEFORE UPDATE ON workload_predictions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();