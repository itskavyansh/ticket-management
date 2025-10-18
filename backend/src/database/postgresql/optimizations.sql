-- Additional Performance Optimizations for AI Ticket Management Platform
-- This file contains advanced indexing strategies and query optimizations

-- ============================================================================
-- ADVANCED INDEXING STRATEGIES
-- ============================================================================

-- Covering indexes for frequently accessed columns together
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_analytics_covering_dashboard
ON ticket_analytics (status, priority, created_at)
INCLUDE (customer_id, technician_id, category, sla_deadline, sla_risk_score);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_covering_summary
ON performance_metrics (technician_id, period_end_date)
INCLUDE (tickets_resolved, average_resolution_time_minutes, sla_compliance_rate, utilization_rate);

-- Functional indexes for computed values
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_analytics_overdue
ON ticket_analytics ((CASE WHEN sla_deadline < CURRENT_TIMESTAMP AND status NOT IN ('resolved', 'closed') THEN 1 ELSE 0 END))
WHERE sla_deadline < CURRENT_TIMESTAMP AND status NOT IN ('resolved', 'closed');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_analytics_response_time_bucket
ON ticket_analytics ((
  CASE 
    WHEN response_time_minutes <= 15 THEN 'fast'
    WHEN response_time_minutes <= 60 THEN 'medium'
    WHEN response_time_minutes <= 240 THEN 'slow'
    ELSE 'very_slow'
  END
));

-- Partial indexes for active/recent data optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_analytics_active_high_priority
ON ticket_analytics (created_at DESC, sla_deadline)
WHERE status IN ('open', 'in_progress', 'pending_customer') 
AND priority IN ('critical', 'high')
AND created_at > CURRENT_DATE - INTERVAL '7 days';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sla_compliance_recent_breaches
ON sla_compliance (created_at DESC, priority, breach_reason)
WHERE (response_sla_met = FALSE OR resolution_sla_met = FALSE)
AND created_at > CURRENT_DATE - INTERVAL '30 days';

-- Expression indexes for JSON data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_metrics_category_breakdown
ON customer_metrics USING GIN ((tickets_by_category));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_metrics_priority_breakdown
ON customer_metrics USING GIN ((tickets_by_priority));

-- Multi-column indexes for complex queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_tracking_analytics_billable_summary
ON time_tracking_analytics (technician_id, session_start::date, is_billable)
WHERE is_billable = TRUE AND session_end IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workload_predictions_accuracy_analysis
ON workload_predictions (technician_id, prediction_date, confidence_score)
WHERE actual_ticket_count IS NOT NULL AND actual_workload_hours IS NOT NULL;

-- ============================================================================
-- MATERIALIZED VIEWS FOR COMPLEX AGGREGATIONS
-- ============================================================================

-- Real-time dashboard metrics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_metrics AS
SELECT 
  CURRENT_DATE as snapshot_date,
  COUNT(*) FILTER (WHERE status = 'open') as open_tickets,
  COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tickets,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved_today,
  COUNT(*) FILTER (WHERE sla_deadline < CURRENT_TIMESTAMP AND status NOT IN ('resolved', 'closed')) as overdue_tickets,
  COUNT(*) FILTER (WHERE priority = 'critical' AND status NOT IN ('resolved', 'closed')) as critical_open,
  AVG(response_time_minutes) FILTER (WHERE response_time_minutes IS NOT NULL) as avg_response_time,
  AVG(resolution_time_minutes) FILTER (WHERE resolution_time_minutes IS NOT NULL AND status = 'resolved') as avg_resolution_time,
  COUNT(DISTINCT technician_id) FILTER (WHERE technician_id IS NOT NULL) as active_technicians,
  AVG(sla_risk_score) FILTER (WHERE sla_risk_score IS NOT NULL AND status NOT IN ('resolved', 'closed')) as avg_sla_risk
FROM ticket_analytics
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Technician performance summary materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_technician_performance AS
SELECT 
  technician_id,
  technician_name,
  department,
  COUNT(*) as total_tickets,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved_tickets,
  AVG(resolution_time_minutes) FILTER (WHERE resolution_time_minutes IS NOT NULL) as avg_resolution_time,
  SUM(time_spent_minutes) as total_time_spent,
  AVG(customer_satisfaction_score) FILTER (WHERE customer_satisfaction_score IS NOT NULL) as avg_satisfaction,
  COUNT(*) FILTER (WHERE response_time_minutes <= 15) * 100.0 / NULLIF(COUNT(*), 0) as fast_response_rate,
  COUNT(*) FILTER (WHERE sla_deadline >= resolved_at) * 100.0 / NULLIF(COUNT(*) FILTER (WHERE resolved_at IS NOT NULL), 0) as sla_compliance_rate
FROM ticket_analytics
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
  AND technician_id IS NOT NULL
GROUP BY technician_id, technician_name, department;

-- Customer satisfaction trends materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_customer_satisfaction_trends AS
SELECT 
  customer_id,
  customer_name,
  customer_tier,
  DATE_TRUNC('week', created_at) as week_start,
  COUNT(*) as tickets_count,
  AVG(customer_satisfaction_score) as avg_satisfaction,
  AVG(resolution_time_minutes) as avg_resolution_time,
  COUNT(*) FILTER (WHERE sla_deadline >= resolved_at) * 100.0 / NULLIF(COUNT(*) FILTER (WHERE resolved_at IS NOT NULL), 0) as sla_compliance_rate
FROM ticket_analytics
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
  AND customer_satisfaction_score IS NOT NULL
GROUP BY customer_id, customer_name, customer_tier, DATE_TRUNC('week', created_at);

-- Create indexes on materialized views
CREATE INDEX IF NOT EXISTS idx_mv_dashboard_metrics_date ON mv_dashboard_metrics (snapshot_date);
CREATE INDEX IF NOT EXISTS idx_mv_technician_performance_id ON mv_technician_performance (technician_id);
CREATE INDEX IF NOT EXISTS idx_mv_customer_satisfaction_customer_week ON mv_customer_satisfaction_trends (customer_id, week_start);

-- ============================================================================
-- QUERY OPTIMIZATION FUNCTIONS
-- ============================================================================

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_dashboard_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_technician_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_satisfaction_trends;
  
  -- Log the refresh
  INSERT INTO alert_history (alert_type, severity, message, created_at)
  VALUES ('system', 'info', 'Materialized views refreshed successfully', CURRENT_TIMESTAMP);
  
EXCEPTION WHEN OTHERS THEN
  -- Log the error
  INSERT INTO alert_history (alert_type, severity, message, created_at)
  VALUES ('system', 'error', 'Failed to refresh materialized views: ' || SQLERRM, CURRENT_TIMESTAMP);
  
  RAISE;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze query performance
CREATE OR REPLACE FUNCTION analyze_slow_queries()
RETURNS TABLE (
  query_text text,
  calls bigint,
  total_time double precision,
  mean_time double precision,
  max_time double precision
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pg_stat_statements.query,
    pg_stat_statements.calls,
    pg_stat_statements.total_exec_time,
    pg_stat_statements.mean_exec_time,
    pg_stat_statements.max_exec_time
  FROM pg_stat_statements
  WHERE pg_stat_statements.mean_exec_time > 100 -- queries taking more than 100ms on average
  ORDER BY pg_stat_statements.mean_exec_time DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Function to get table statistics
CREATE OR REPLACE FUNCTION get_table_statistics()
RETURNS TABLE (
  table_name text,
  row_count bigint,
  table_size text,
  index_size text,
  total_size text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    schemaname||'.'||tablename as table_name,
    n_tup_ins - n_tup_del as row_count,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) + pg_indexes_size(schemaname||'.'||tablename)) as total_size
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUTOMATED MAINTENANCE PROCEDURES
-- ============================================================================

-- Function to cleanup old data
CREATE OR REPLACE FUNCTION cleanup_old_analytics_data()
RETURNS void AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Clean up old time tracking entries (older than 1 year)
  DELETE FROM time_tracking_analytics 
  WHERE session_start < CURRENT_DATE - INTERVAL '1 year';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Clean up old alert history (older than 6 months)
  DELETE FROM alert_history 
  WHERE created_at < CURRENT_DATE - INTERVAL '6 months';
  
  -- Clean up old workload predictions (older than 3 months)
  DELETE FROM workload_predictions 
  WHERE prediction_date < CURRENT_DATE - INTERVAL '3 months';
  
  -- Log cleanup activity
  INSERT INTO alert_history (alert_type, severity, message, created_at)
  VALUES ('maintenance', 'info', 
    'Cleanup completed. Deleted ' || deleted_count || ' old time tracking entries', 
    CURRENT_TIMESTAMP);
    
END;
$$ LANGUAGE plpgsql;

-- Function to update table statistics
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS void AS $$
DECLARE
  table_record record;
BEGIN
  FOR table_record IN 
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE 'ANALYZE ' || table_record.tablename;
  END LOOP;
  
  -- Log statistics update
  INSERT INTO alert_history (alert_type, severity, message, created_at)
  VALUES ('maintenance', 'info', 'Table statistics updated', CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PERFORMANCE MONITORING VIEWS
-- ============================================================================

-- View for monitoring index usage
CREATE OR REPLACE VIEW v_index_usage AS
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch,
  idx_scan,
  CASE 
    WHEN idx_scan = 0 THEN 'Never used'
    WHEN idx_scan < 100 THEN 'Rarely used'
    WHEN idx_scan < 1000 THEN 'Moderately used'
    ELSE 'Frequently used'
  END as usage_category
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- View for monitoring table bloat
CREATE OR REPLACE VIEW v_table_bloat AS
SELECT 
  schemaname,
  tablename,
  n_dead_tup,
  n_live_tup,
  CASE 
    WHEN n_live_tup > 0 THEN (n_dead_tup::float / n_live_tup::float) * 100
    ELSE 0
  END as bloat_percentage,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE n_live_tup > 0
ORDER BY (n_dead_tup::float / n_live_tup::float) DESC;

-- ============================================================================
-- SCHEDULED MAINTENANCE SETUP
-- ============================================================================

-- Note: These would typically be set up as cron jobs or scheduled tasks
-- Example cron entries (to be added to system cron):
-- 
-- # Refresh materialized views every 15 minutes
-- */15 * * * * psql -d ai_ticket_management -c "SELECT refresh_dashboard_materialized_views();"
-- 
-- # Update table statistics daily at 2 AM
-- 0 2 * * * psql -d ai_ticket_management -c "SELECT update_table_statistics();"
-- 
-- # Cleanup old data weekly on Sunday at 3 AM
-- 0 3 * * 0 psql -d ai_ticket_management -c "SELECT cleanup_old_analytics_data();"

-- ============================================================================
-- QUERY HINTS AND OPTIMIZATION SETTINGS
-- ============================================================================

-- Recommended PostgreSQL configuration settings for this workload
-- (These should be added to postgresql.conf)

/*
# Memory settings
shared_buffers = 256MB                    # 25% of RAM for dedicated server
effective_cache_size = 1GB                # 75% of RAM
work_mem = 4MB                           # Per-operation memory
maintenance_work_mem = 64MB              # For maintenance operations

# Query planner settings
random_page_cost = 1.1                   # For SSD storage
effective_io_concurrency = 200           # For SSD storage
default_statistics_target = 100          # More detailed statistics

# Write-ahead logging
wal_buffers = 16MB
checkpoint_completion_target = 0.9
wal_writer_delay = 200ms

# Connection settings
max_connections = 100
shared_preload_libraries = 'pg_stat_statements'

# Logging for query analysis
log_min_duration_statement = 1000        # Log queries taking > 1 second
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
*/