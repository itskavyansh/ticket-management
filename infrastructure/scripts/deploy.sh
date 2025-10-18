#!/bin/bash

# Blue-Green Deployment Script for AI Ticket Management Platform
# This script implements blue-green deployment strategy with automated rollback

set -e

# Configuration
STACK_NAME="ai-ticket-platform"
REGION="us-east-1"
BLUE_STACK="${STACK_NAME}-blue"
GREEN_STACK="${STACK_NAME}-green"
ROUTER_STACK="${STACK_NAME}-router"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Function to get current active environment
get_active_environment() {
    aws cloudformation describe-stacks \
        --stack-name $ROUTER_STACK \
        --region $REGION \
        --query 'Stacks[0].Parameters[?ParameterKey==`ActiveEnvironment`].ParameterValue' \
        --output text 2>/dev/null || echo "blue"
}

# Function to get inactive environment
get_inactive_environment() {
    local active=$(get_active_environment)
    if [ "$active" = "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

# Function to check stack exists
stack_exists() {
    aws cloudformation describe-stacks --stack-name $1 --region $REGION >/dev/null 2>&1
}

# Function to wait for stack operation to complete
wait_for_stack() {
    local stack_name=$1
    local operation=$2
    
    log "Waiting for $operation to complete on $stack_name..."
    
    aws cloudformation wait stack-${operation}-complete \
        --stack-name $stack_name \
        --region $REGION
    
    if [ $? -eq 0 ]; then
        log "$operation completed successfully for $stack_name"
    else
        error "$operation failed for $stack_name"
        return 1
    fi
}

# Function to deploy to inactive environment
deploy_to_inactive() {
    local inactive_env=$(get_inactive_environment)
    local stack_name="${STACK_NAME}-${inactive_env}"
    
    log "Deploying to inactive environment: $inactive_env"
    
    # Deploy the application stack
    cdk deploy $stack_name \
        --require-approval never \
        --parameters Environment=$inactive_env \
        --parameters Version=$BUILD_VERSION \
        --context environment=$inactive_env
    
    if [ $? -ne 0 ]; then
        error "Failed to deploy to $inactive_env environment"
        return 1
    fi
    
    log "Successfully deployed to $inactive_env environment"
    return 0
}

# Function to run health checks
run_health_checks() {
    local environment=$1
    local stack_name="${STACK_NAME}-${environment}"
    
    log "Running health checks for $environment environment..."
    
    # Get API Gateway URL from stack outputs
    local api_url=$(aws cloudformation describe-stacks \
        --stack-name $stack_name \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
        --output text)
    
    if [ -z "$api_url" ]; then
        error "Could not retrieve API Gateway URL for $environment"
        return 1
    fi
    
    # Health check endpoints
    local endpoints=(
        "/health"
        "/api/tickets/health"
        "/api/analytics/health"
        "/ai/health"
    )
    
    for endpoint in "${endpoints[@]}"; do
        log "Checking health endpoint: $endpoint"
        
        local response=$(curl -s -o /dev/null -w "%{http_code}" "${api_url}${endpoint}" || echo "000")
        
        if [ "$response" != "200" ]; then
            error "Health check failed for $endpoint (HTTP $response)"
            return 1
        fi
        
        log "Health check passed for $endpoint"
    done
    
    # Run smoke tests
    log "Running smoke tests..."
    npm run test:smoke -- --env=$environment
    
    if [ $? -ne 0 ]; then
        error "Smoke tests failed for $environment"
        return 1
    fi
    
    log "All health checks passed for $environment"
    return 0
}

# Function to switch traffic to new environment
switch_traffic() {
    local new_active_env=$1
    
    log "Switching traffic to $new_active_env environment..."
    
    # Update router stack to point to new environment
    cdk deploy $ROUTER_STACK \
        --require-approval never \
        --parameters ActiveEnvironment=$new_active_env
    
    if [ $? -ne 0 ]; then
        error "Failed to switch traffic to $new_active_env"
        return 1
    fi
    
    # Wait for DNS propagation
    log "Waiting for DNS propagation..."
    sleep 30
    
    # Verify traffic switch
    log "Verifying traffic switch..."
    run_health_checks "production"
    
    if [ $? -ne 0 ]; then
        error "Health checks failed after traffic switch"
        return 1
    fi
    
    log "Traffic successfully switched to $new_active_env"
    return 0
}

# Function to rollback deployment
rollback() {
    local current_active=$(get_active_environment)
    local rollback_to=$(get_inactive_environment)
    
    warn "Initiating rollback from $current_active to $rollback_to..."
    
    # Switch traffic back
    switch_traffic $rollback_to
    
    if [ $? -eq 0 ]; then
        log "Rollback completed successfully"
        
        # Send rollback notification
        aws sns publish \
            --topic-arn $SNS_TOPIC_ARN \
            --message "Deployment rollback completed. Traffic switched from $current_active to $rollback_to" \
            --subject "AI Ticket Platform - Rollback Completed"
    else
        error "Rollback failed"
        return 1
    fi
}

# Main deployment function
main() {
    local command=${1:-deploy}
    
    case $command in
        "deploy")
            log "Starting blue-green deployment..."
            
            # Get current state
            local active_env=$(get_active_environment)
            local inactive_env=$(get_inactive_environment)
            
            log "Current active environment: $active_env"
            log "Deploying to inactive environment: $inactive_env"
            
            # Deploy to inactive environment
            if ! deploy_to_inactive; then
                error "Deployment failed"
                exit 1
            fi
            
            # Run health checks on new deployment
            if ! run_health_checks $inactive_env; then
                error "Health checks failed, aborting deployment"
                exit 1
            fi
            
            # Switch traffic to new environment
            if ! switch_traffic $inactive_env; then
                error "Traffic switch failed, initiating rollback"
                rollback
                exit 1
            fi
            
            log "Blue-green deployment completed successfully!"
            log "New active environment: $inactive_env"
            
            # Send success notification
            aws sns publish \
                --topic-arn $SNS_TOPIC_ARN \
                --message "Blue-green deployment completed successfully. New active environment: $inactive_env" \
                --subject "AI Ticket Platform - Deployment Success"
            ;;
            
        "rollback")
            rollback
            ;;
            
        "status")
            local active_env=$(get_active_environment)
            log "Current active environment: $active_env"
            ;;
            
        *)
            echo "Usage: $0 {deploy|rollback|status}"
            exit 1
            ;;
    esac
}

# Set required environment variables
export BUILD_VERSION=${BUILD_VERSION:-$(git rev-parse --short HEAD)}
export SNS_TOPIC_ARN=${SNS_TOPIC_ARN:-"arn:aws:sns:us-east-1:123456789012:ai-ticket-platform-alerts"}

# Run main function
main "$@"