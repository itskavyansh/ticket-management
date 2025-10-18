# Trend Analysis and Insights API

This document describes the advanced trend analysis and insights functionality implemented for the AI ticket management platform.

## Overview

The trend analysis system provides:
- Historical trend calculation algorithms
- Bottleneck detection and recommendation system
- Predictive analytics for capacity planning
- Correlation analysis between metrics
- Actionable insights generation

## API Endpoints

### 1. Trend Insights

**GET** `/api/analytics/trend-insights`

Generate comprehensive trend insights for multiple metrics with correlation analysis.

#### Query Parameters
- `metrics` (array): List of metrics to analyze (e.g., `ticket_volume`, `response_time`, `resolution_time`, `sla_compliance`)
- `startDate` (string): Start date in ISO format
- `endDate` (string): End date in ISO format
- `granularity` (string): Data granularity - `daily`, `weekly`, or `monthly` (default: `daily`)

#### Response
```json
{
  "success": true,
  "data": {
    "trends": [
      {
        "metric": "ticket_volume",
        "period": {
          "startDate": "2024-01-01T00:00:00.000Z",
          "endDate": "2024-01-31T23:59:59.999Z"
        },
        "dataPoints": [
          {
            "date": "2024-01-01T00:00:00.000Z",
            "value": 100
          }
        ],
        "trend": "increasing",
        "trendPercentage": 15.5,
        "seasonality": {
          "pattern": "weekly",
          "strength": 0.7
        },
        "forecast": [
          {
            "date": "2024-02-01T00:00:00.000Z",
            "predictedValue": 115,
            "confidence": 0.8
          }
        ]
      }
    ],
    "correlations": [
      {
        "metric1": "ticket_volume",
        "metric2": "response_time",
        "correlation": 0.75,
        "significance": "high"
      }
    ],
    "insights": [
      "Ticket volume is increasing by 15.5% - consider capacity planning",
      "Strong positive correlation between ticket_volume and response_time"
    ]
  }
}
```

### 2. Advanced Bottleneck Analysis

**GET** `/api/analytics/advanced-bottlenecks`

Detect performance bottlenecks with advanced analytics and prioritized action recommendations.

#### Query Parameters
- `startDate` (string): Start date in ISO format
- `endDate` (string): End date in ISO format

#### Response
```json
{
  "success": true,
  "data": {
    "bottlenecks": [
      {
        "type": "technician",
        "identifier": "tech-123",
        "description": "Technician John Doe is overloaded with 45 tickets and 35.2% SLA breach rate",
        "impact": "high",
        "metrics": {
          "affectedTickets": 45,
          "delayImpact": 180,
          "slaRisk": 35.2
        },
        "recommendations": [
          "Redistribute tickets to other team members",
          "Provide additional training or support"
        ],
        "detectedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "riskScore": 72.5,
    "prioritizedActions": [
      {
        "action": "Redistribute tickets to other team members",
        "priority": "high",
        "estimatedImpact": 45,
        "timeToImplement": "1 week"
      }
    ]
  }
}
```

### 3. Capacity Prediction with Scenarios

**GET** `/api/analytics/capacity-scenarios`

Generate capacity predictions with multiple scenario analysis for future planning.

#### Query Parameters
- `startDate` (string): Future period start date in ISO format
- `endDate` (string): Future period end date in ISO format

#### Response
```json
{
  "success": true,
  "data": {
    "basePrediction": {
      "period": {
        "startDate": "2024-02-01T00:00:00.000Z",
        "endDate": "2024-02-28T23:59:59.999Z"
      },
      "predictedTicketVolume": 150,
      "requiredTechnicianHours": 1200,
      "availableTechnicianHours": 1000,
      "capacityUtilization": 120,
      "staffingGap": 200,
      "recommendedActions": [
        {
          "action": "hire",
          "priority": "high",
          "description": "Hire 1 additional full-time technician to meet demand",
          "estimatedImpact": 160
        }
      ],
      "risks": [
        {
          "type": "sla_breach",
          "probability": 0.8,
          "impact": "high",
          "mitigation": [
            "Implement emergency staffing procedures",
            "Activate escalation protocols for critical tickets"
          ]
        }
      ],
      "confidence": 0.85,
      "generatedAt": "2024-01-15T10:30:00.000Z"
    },
    "scenarios": [
      {
        "name": "Optimistic",
        "description": "Lower than expected ticket volume",
        "prediction": {
          "predictedTicketVolume": 120,
          "capacityUtilization": 96
        },
        "probability": 0.2
      },
      {
        "name": "Pessimistic",
        "description": "Higher than expected ticket volume",
        "prediction": {
          "predictedTicketVolume": 195,
          "capacityUtilization": 156
        },
        "probability": 0.3
      }
    ],
    "recommendations": [
      {
        "scenario": "Optimistic",
        "actions": [
          "Use excess capacity for training and process improvement"
        ],
        "timeline": "Next 2 weeks"
      },
      {
        "scenario": "Pessimistic",
        "actions": [
          "Prepare emergency staffing plan",
          "Consider contractor support"
        ],
        "timeline": "Immediate"
      }
    ]
  }
}
```

## Supported Metrics

The trend analysis system supports the following metrics:

- `ticket_volume`: Number of tickets created per period
- `response_time`: Average time to first response (in minutes)
- `resolution_time`: Average time to resolution (in minutes)
- `sla_compliance`: Percentage of tickets meeting SLA requirements
- `customer_satisfaction`: Average customer satisfaction score

## Trend Analysis Features

### 1. Trend Calculation
- Uses linear regression to determine trend direction and strength
- Calculates percentage change over the analysis period
- Classifies trends as `increasing`, `decreasing`, or `stable`

### 2. Seasonality Detection
- Detects weekly, monthly, or yearly patterns in data
- Uses autocorrelation analysis to identify cyclical behavior
- Provides seasonality strength score (0-1)

### 3. Forecasting
- Generates short-term predictions using exponential smoothing
- Includes confidence intervals for predictions
- Accounts for trend and seasonality in forecasts

### 4. Correlation Analysis
- Calculates Pearson correlation coefficients between metrics
- Identifies significant relationships between different KPIs
- Helps understand interdependencies in system performance

## Bottleneck Detection

The system detects bottlenecks across multiple dimensions:

### 1. Technician Bottlenecks
- Identifies overloaded technicians based on ticket volume and SLA performance
- Analyzes workload distribution and performance metrics
- Suggests workload rebalancing and capacity adjustments

### 2. Category Bottlenecks
- Detects ticket categories with poor performance
- Compares category metrics against overall averages
- Identifies areas needing specialized knowledge or resources

### 3. Customer Bottlenecks
- Identifies high-maintenance customers or problematic accounts
- Analyzes ticket volume, satisfaction, and SLA compliance by customer
- Suggests account management improvements

### 4. Process Bottlenecks
- Analyzes ticket lifecycle stages for inefficiencies
- Monitors response times, escalation rates, and resolution quality
- Identifies process improvement opportunities

## Capacity Planning

### 1. Predictive Modeling
- Uses historical data to predict future ticket volumes
- Accounts for trends, seasonality, and external factors
- Provides confidence intervals for predictions

### 2. Scenario Analysis
- Generates multiple scenarios (optimistic, realistic, pessimistic)
- Calculates capacity requirements for each scenario
- Provides probability-weighted recommendations

### 3. Risk Assessment
- Identifies potential capacity risks and their likelihood
- Suggests mitigation strategies for different risk levels
- Provides early warning for capacity constraints

## Authentication and Authorization

All trend analysis endpoints require:
- Valid JWT authentication token
- Analytics read permissions (`requireAnalyticsRead` middleware)
- Appropriate user role (Technician, Manager, or Admin)

## Error Handling

The API returns standard HTTP status codes:
- `200`: Success
- `400`: Bad Request (missing or invalid parameters)
- `401`: Unauthorized (invalid or missing token)
- `403`: Forbidden (insufficient permissions)
- `500`: Internal Server Error

Error responses include detailed error messages and request context for debugging.

## Performance Considerations

- Results are cached for 5 minutes to improve response times
- Large date ranges may take longer to process
- Consider using appropriate granularity for the analysis period
- Database queries are optimized with proper indexing

## Usage Examples

### Basic Trend Analysis
```bash
curl -X GET "http://localhost:3000/api/analytics/trend-insights?metrics=ticket_volume&metrics=response_time&startDate=2024-01-01&endDate=2024-01-31&granularity=daily" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Bottleneck Detection
```bash
curl -X GET "http://localhost:3000/api/analytics/advanced-bottlenecks?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Capacity Planning
```bash
curl -X GET "http://localhost:3000/api/analytics/capacity-scenarios?startDate=2024-02-01&endDate=2024-02-28" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```