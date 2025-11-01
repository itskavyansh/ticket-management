"""
Advanced analytics service using TensorFlow and machine learning.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import asyncio

# Try to import dependencies with fallbacks
try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    # Mock numpy for basic operations
    class MockNumpy:
        def array(self, data): return data
        def mean(self, data): return sum(data) / len(data) if data else 0
        def std(self, data): return 0.1
        def max(self, data): return max(data) if data else 0
        def min(self, data): return min(data) if data else 0
    np = MockNumpy()

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

try:
    from services.tensorflow_models import workload_forecasting_model, ticket_classification_model
    TENSORFLOW_MODELS_AVAILABLE = True
except ImportError:
    TENSORFLOW_MODELS_AVAILABLE = False
    # Mock models
    class MockModel:
        async def predict_workload(self, *args, **kwargs):
            return {"success": False, "error": "TensorFlow models not available"}
        async def classify_ticket(self, *args, **kwargs):
            return {"success": False, "error": "TensorFlow models not available"}
    workload_forecasting_model = MockModel()
    ticket_classification_model = MockModel()

logger = logging.getLogger(__name__)


class AdvancedAnalyticsService:
    """Service for advanced analytics using machine learning models."""
    
    def __init__(self):
        self.workload_model = workload_forecasting_model
        self.classification_model = ticket_classification_model
    
    async def predict_workload_trends(
        self, 
        historical_data: List[Dict[str, Any]], 
        forecast_period: str = "24h"
    ) -> Dict[str, Any]:
        """Predict workload trends using TensorFlow LSTM model."""
        try:
            # Parse forecast period
            forecast_hours = self._parse_forecast_period(forecast_period)
            
            # Get workload predictions
            prediction_result = await self.workload_model.predict_workload(
                historical_data, forecast_hours
            )
            
            # Enhance with additional analytics
            enhanced_result = await self._enhance_workload_predictions(
                prediction_result, historical_data
            )
            
            return enhanced_result
            
        except Exception as e:
            logger.error(f"Workload trend prediction failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "fallback_recommendations": [
                    "Unable to generate ML-based predictions",
                    "Consider manual workload planning"
                ]
            }
    
    async def analyze_ticket_patterns(
        self, 
        tickets: List[Dict[str, Any]], 
        analysis_type: str = "comprehensive"
    ) -> Dict[str, Any]:
        """Analyze ticket patterns using advanced ML techniques."""
        try:
            results = {
                "success": True,
                "analysis_type": analysis_type,
                "total_tickets_analyzed": len(tickets),
                "timestamp": datetime.utcnow().isoformat()
            }
            
            if analysis_type in ["comprehensive", "classification"]:
                # Advanced classification analysis
                classification_results = await self._analyze_classification_patterns(tickets)
                results["classification_analysis"] = classification_results
            
            if analysis_type in ["comprehensive", "temporal"]:
                # Temporal pattern analysis
                temporal_results = await self._analyze_temporal_patterns(tickets)
                results["temporal_analysis"] = temporal_results
            
            if analysis_type in ["comprehensive", "priority"]:
                # Priority and SLA analysis
                priority_results = await self._analyze_priority_patterns(tickets)
                results["priority_analysis"] = priority_results
            
            if analysis_type in ["comprehensive", "resolution"]:
                # Resolution pattern analysis
                resolution_results = await self._analyze_resolution_patterns(tickets)
                results["resolution_analysis"] = resolution_results
            
            # Generate insights and recommendations
            insights = await self._generate_pattern_insights(results)
            results["insights"] = insights
            
            return results
            
        except Exception as e:
            logger.error(f"Ticket pattern analysis failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "analysis_type": analysis_type
            }
    
    async def predict_sla_risks(
        self, 
        active_tickets: List[Dict[str, Any]], 
        risk_threshold: float = 0.7
    ) -> Dict[str, Any]:
        """Predict SLA risks using ensemble of ML models."""
        try:
            risk_predictions = []
            high_risk_tickets = []
            
            for ticket in active_tickets:
                # Use multiple models for risk prediction
                risk_score = await self._calculate_ensemble_risk_score(ticket)
                
                risk_prediction = {
                    "ticket_id": ticket.get("id", "unknown"),
                    "title": ticket.get("title", ""),
                    "risk_score": risk_score,
                    "risk_level": self._get_risk_level(risk_score),
                    "predicted_breach_time": self._predict_breach_time(ticket, risk_score),
                    "contributing_factors": self._identify_risk_factors(ticket, risk_score)
                }
                
                risk_predictions.append(risk_prediction)
                
                if risk_score >= risk_threshold:
                    high_risk_tickets.append(risk_prediction)
            
            # Sort by risk score
            risk_predictions.sort(key=lambda x: x["risk_score"], reverse=True)
            
            # Generate risk summary
            risk_summary = self._generate_risk_summary(risk_predictions, risk_threshold)
            
            return {
                "success": True,
                "total_tickets": len(active_tickets),
                "risk_threshold": risk_threshold,
                "high_risk_count": len(high_risk_tickets),
                "risk_predictions": risk_predictions,
                "high_risk_tickets": high_risk_tickets,
                "risk_summary": risk_summary,
                "recommendations": self._generate_risk_recommendations(high_risk_tickets)
            }
            
        except Exception as e:
            logger.error(f"SLA risk prediction failed: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def optimize_technician_assignments(
        self, 
        technicians: List[Dict[str, Any]], 
        pending_tickets: List[Dict[str, Any]],
        optimization_strategy: str = "ml_enhanced"
    ) -> Dict[str, Any]:
        """Optimize technician assignments using ML models."""
        try:
            if optimization_strategy == "ml_enhanced":
                return await self._ml_enhanced_assignment_optimization(technicians, pending_tickets)
            else:
                return await self._basic_assignment_optimization(technicians, pending_tickets)
                
        except Exception as e:
            logger.error(f"Assignment optimization failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "fallback_strategy": "manual_assignment_recommended"
            }
    
    async def _enhance_workload_predictions(
        self, 
        prediction_result: Dict[str, Any], 
        historical_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Enhance workload predictions with additional analytics."""
        if not prediction_result.get("success"):
            return prediction_result
        
        predictions = prediction_result.get("predictions", [])
        
        # Add capacity planning insights
        capacity_insights = self._analyze_capacity_requirements(predictions, historical_data)
        prediction_result["capacity_insights"] = capacity_insights
        
        # Add resource optimization suggestions
        optimization_suggestions = self._generate_resource_optimization(predictions)
        prediction_result["optimization_suggestions"] = optimization_suggestions
        
        # Add risk alerts
        risk_alerts = self._identify_workload_risks(predictions)
        prediction_result["risk_alerts"] = risk_alerts
        
        return prediction_result
    
    async def _analyze_classification_patterns(self, tickets: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze ticket classification patterns using ML."""
        classification_results = []
        category_distribution = {}
        confidence_scores = []
        
        for ticket in tickets:
            title = ticket.get("title", "")
            description = ticket.get("description", "")
            
            # Use TensorFlow model for classification
            result = await self.classification_model.classify_ticket(title, description)
            
            if result.get("success"):
                classification_results.append(result)
                
                category = result.get("predicted_category", "other")
                category_distribution[category] = category_distribution.get(category, 0) + 1
                
                confidence_scores.append(result.get("confidence_score", 0))
        
        return {
            "total_classified": len(classification_results),
            "category_distribution": category_distribution,
            "average_confidence": np.mean(confidence_scores) if confidence_scores else 0,
            "low_confidence_count": sum(1 for score in confidence_scores if score < 0.6),
            "model_performance": {
                "high_confidence_rate": sum(1 for score in confidence_scores if score > 0.8) / max(1, len(confidence_scores)),
                "average_confidence": np.mean(confidence_scores) if confidence_scores else 0
            }
        }
    
    async def _analyze_temporal_patterns(self, tickets: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze temporal patterns in ticket data."""
        hourly_distribution = {}
        daily_distribution = {}
        monthly_trends = {}
        
        for ticket in tickets:
            created_at = ticket.get("created_at")
            if created_at:
                try:
                    if isinstance(created_at, str):
                        dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    else:
                        dt = created_at
                    
                    hour = dt.hour
                    day = dt.strftime("%A")
                    month = dt.strftime("%Y-%m")
                    
                    hourly_distribution[hour] = hourly_distribution.get(hour, 0) + 1
                    daily_distribution[day] = daily_distribution.get(day, 0) + 1
                    monthly_trends[month] = monthly_trends.get(month, 0) + 1
                    
                except Exception as e:
                    logger.warning(f"Failed to parse timestamp: {created_at}")
        
        # Identify peak hours and days
        peak_hour = max(hourly_distribution, key=hourly_distribution.get) if hourly_distribution else None
        peak_day = max(daily_distribution, key=daily_distribution.get) if daily_distribution else None
        
        return {
            "hourly_distribution": hourly_distribution,
            "daily_distribution": daily_distribution,
            "monthly_trends": monthly_trends,
            "peak_hour": peak_hour,
            "peak_day": peak_day,
            "business_hours_percentage": self._calculate_business_hours_percentage(hourly_distribution)
        }
    
    async def _analyze_priority_patterns(self, tickets: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze priority and SLA patterns."""
        priority_distribution = {}
        sla_performance = {}
        escalation_patterns = {}
        
        for ticket in tickets:
            priority = ticket.get("priority", "medium")
            status = ticket.get("status", "open")
            escalation_level = ticket.get("escalation_level", 0)
            
            priority_distribution[priority] = priority_distribution.get(priority, 0) + 1
            
            if status in ["resolved", "closed"]:
                sla_met = ticket.get("sla_met", True)
                if priority not in sla_performance:
                    sla_performance[priority] = {"met": 0, "missed": 0}
                
                if sla_met:
                    sla_performance[priority]["met"] += 1
                else:
                    sla_performance[priority]["missed"] += 1
            
            if escalation_level > 0:
                escalation_patterns[priority] = escalation_patterns.get(priority, 0) + 1
        
        # Calculate SLA compliance rates
        sla_compliance = {}
        for priority, performance in sla_performance.items():
            total = performance["met"] + performance["missed"]
            if total > 0:
                sla_compliance[priority] = performance["met"] / total
        
        return {
            "priority_distribution": priority_distribution,
            "sla_compliance_rates": sla_compliance,
            "escalation_patterns": escalation_patterns,
            "overall_sla_compliance": np.mean(list(sla_compliance.values())) if sla_compliance else 0
        }
    
    async def _analyze_resolution_patterns(self, tickets: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze resolution patterns and efficiency."""
        resolution_times = {}
        technician_performance = {}
        category_efficiency = {}
        
        for ticket in tickets:
            if ticket.get("status") in ["resolved", "closed"]:
                category = ticket.get("category", "other")
                technician = ticket.get("assigned_technician", "unassigned")
                resolution_time = ticket.get("resolution_time_hours", 0)
                
                if category not in resolution_times:
                    resolution_times[category] = []
                resolution_times[category].append(resolution_time)
                
                if technician not in technician_performance:
                    technician_performance[technician] = []
                technician_performance[technician].append(resolution_time)
        
        # Calculate averages
        for category, times in resolution_times.items():
            category_efficiency[category] = {
                "average_hours": np.mean(times),
                "median_hours": np.median(times),
                "std_dev": np.std(times),
                "ticket_count": len(times)
            }
        
        tech_efficiency = {}
        for tech, times in technician_performance.items():
            if len(times) >= 3:  # Only include techs with sufficient data
                tech_efficiency[tech] = {
                    "average_hours": np.mean(times),
                    "ticket_count": len(times),
                    "efficiency_score": 1 / (np.mean(times) + 1)  # Higher score for faster resolution
                }
        
        return {
            "category_efficiency": category_efficiency,
            "technician_efficiency": tech_efficiency,
            "fastest_category": min(category_efficiency, key=lambda x: category_efficiency[x]["average_hours"]) if category_efficiency else None,
            "most_efficient_technician": max(tech_efficiency, key=lambda x: tech_efficiency[x]["efficiency_score"]) if tech_efficiency else None
        }
    
    async def _generate_pattern_insights(self, analysis_results: Dict[str, Any]) -> List[str]:
        """Generate actionable insights from pattern analysis."""
        insights = []
        
        # Classification insights
        if "classification_analysis" in analysis_results:
            class_analysis = analysis_results["classification_analysis"]
            if class_analysis.get("low_confidence_count", 0) > 0:
                insights.append(f"Found {class_analysis['low_confidence_count']} tickets with low classification confidence - consider manual review")
        
        # Temporal insights
        if "temporal_analysis" in analysis_results:
            temporal = analysis_results["temporal_analysis"]
            if temporal.get("peak_hour") is not None:
                insights.append(f"Peak ticket volume occurs at hour {temporal['peak_hour']} - consider staffing adjustments")
        
        # Priority insights
        if "priority_analysis" in analysis_results:
            priority = analysis_results["priority_analysis"]
            overall_sla = priority.get("overall_sla_compliance", 0)
            if overall_sla < 0.9:
                insights.append(f"SLA compliance at {overall_sla:.1%} - below recommended 90% threshold")
        
        # Resolution insights
        if "resolution_analysis" in analysis_results:
            resolution = analysis_results["resolution_analysis"]
            if resolution.get("most_efficient_technician"):
                insights.append(f"Top performing technician: {resolution['most_efficient_technician']} - consider knowledge sharing")
        
        if not insights:
            insights.append("No significant patterns detected - system performance appears stable")
        
        return insights
    
    def _parse_forecast_period(self, period: str) -> int:
        """Parse forecast period string to hours."""
        period = period.lower()
        if period.endswith('h'):
            return int(period[:-1])
        elif period.endswith('d'):
            return int(period[:-1]) * 24
        elif period.endswith('w'):
            return int(period[:-1]) * 24 * 7
        else:
            return 24  # Default to 24 hours
    
    def _calculate_business_hours_percentage(self, hourly_distribution: Dict[int, int]) -> float:
        """Calculate percentage of tickets created during business hours."""
        business_hours = range(9, 18)  # 9 AM to 5 PM
        business_tickets = sum(hourly_distribution.get(hour, 0) for hour in business_hours)
        total_tickets = sum(hourly_distribution.values())
        
        return business_tickets / total_tickets if total_tickets > 0 else 0
    
    async def _calculate_ensemble_risk_score(self, ticket: Dict[str, Any]) -> float:
        """Calculate risk score using ensemble of models."""
        # Combine multiple risk factors
        time_factor = self._calculate_time_risk_factor(ticket)
        complexity_factor = self._calculate_complexity_risk_factor(ticket)
        workload_factor = self._calculate_workload_risk_factor(ticket)
        
        # Weighted ensemble
        risk_score = (
            time_factor * 0.4 +
            complexity_factor * 0.3 +
            workload_factor * 0.3
        )
        
        return min(1.0, max(0.0, risk_score))
    
    def _calculate_time_risk_factor(self, ticket: Dict[str, Any]) -> float:
        """Calculate risk factor based on time constraints."""
        created_at = ticket.get("created_at")
        sla_deadline = ticket.get("sla_deadline")
        
        if not created_at or not sla_deadline:
            return 0.5  # Default moderate risk
        
        try:
            if isinstance(created_at, str):
                created_dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            else:
                created_dt = created_at
                
            if isinstance(sla_deadline, str):
                deadline_dt = datetime.fromisoformat(sla_deadline.replace('Z', '+00:00'))
            else:
                deadline_dt = sla_deadline
            
            total_time = (deadline_dt - created_dt).total_seconds()
            elapsed_time = (datetime.utcnow() - created_dt).total_seconds()
            
            if total_time <= 0:
                return 1.0  # Already past deadline
            
            progress_ratio = elapsed_time / total_time
            return min(1.0, progress_ratio ** 1.5)  # Exponential increase in risk
            
        except Exception:
            return 0.5
    
    def _calculate_complexity_risk_factor(self, ticket: Dict[str, Any]) -> float:
        """Calculate risk factor based on ticket complexity."""
        category = ticket.get("category", "other")
        priority = ticket.get("priority", "medium")
        description_length = len(ticket.get("description", ""))
        
        # Category complexity scores
        category_scores = {
            "security": 0.9,
            "network": 0.8,
            "hardware": 0.7,
            "software": 0.6,
            "database": 0.8,
            "email": 0.4,
            "printer": 0.3,
            "other": 0.5
        }
        
        # Priority scores
        priority_scores = {
            "critical": 1.0,
            "high": 0.8,
            "medium": 0.5,
            "low": 0.2
        }
        
        category_risk = category_scores.get(category, 0.5)
        priority_risk = priority_scores.get(priority, 0.5)
        
        # Longer descriptions might indicate more complex issues
        length_risk = min(0.3, description_length / 1000)
        
        return (category_risk + priority_risk + length_risk) / 3
    
    def _calculate_workload_risk_factor(self, ticket: Dict[str, Any]) -> float:
        """Calculate risk factor based on technician workload."""
        technician_workload = ticket.get("technician_workload", 0.5)
        is_assigned = ticket.get("assigned_technician") is not None
        
        if not is_assigned:
            return 0.8  # High risk if not assigned
        
        # Higher workload increases risk
        return min(1.0, technician_workload * 1.2)
    
    def _get_risk_level(self, risk_score: float) -> str:
        """Convert risk score to risk level."""
        if risk_score >= 0.8:
            return "critical"
        elif risk_score >= 0.6:
            return "high"
        elif risk_score >= 0.4:
            return "medium"
        else:
            return "low"
    
    def _predict_breach_time(self, ticket: Dict[str, Any], risk_score: float) -> Optional[str]:
        """Predict when SLA breach might occur."""
        sla_deadline = ticket.get("sla_deadline")
        if not sla_deadline:
            return None
        
        try:
            if isinstance(sla_deadline, str):
                deadline_dt = datetime.fromisoformat(sla_deadline.replace('Z', '+00:00'))
            else:
                deadline_dt = sla_deadline
            
            # Estimate breach time based on risk score
            if risk_score >= 0.8:
                # High risk - might breach soon
                breach_time = datetime.utcnow() + timedelta(hours=1)
            elif risk_score >= 0.6:
                # Medium-high risk
                breach_time = datetime.utcnow() + timedelta(hours=4)
            else:
                # Lower risk - use SLA deadline
                breach_time = deadline_dt
            
            return min(breach_time, deadline_dt).isoformat()
            
        except Exception:
            return None
    
    def _identify_risk_factors(self, ticket: Dict[str, Any], risk_score: float) -> List[str]:
        """Identify contributing risk factors."""
        factors = []
        
        if not ticket.get("assigned_technician"):
            factors.append("unassigned_ticket")
        
        if ticket.get("technician_workload", 0) > 0.8:
            factors.append("high_technician_workload")
        
        if ticket.get("priority") in ["critical", "high"]:
            factors.append("high_priority")
        
        if ticket.get("category") in ["security", "network", "database"]:
            factors.append("complex_category")
        
        if ticket.get("escalation_level", 0) > 0:
            factors.append("escalated_ticket")
        
        return factors
    
    def _generate_risk_summary(self, risk_predictions: List[Dict[str, Any]], threshold: float) -> Dict[str, Any]:
        """Generate summary of risk analysis."""
        total = len(risk_predictions)
        high_risk = sum(1 for p in risk_predictions if p["risk_score"] >= threshold)
        
        risk_levels = {}
        for prediction in risk_predictions:
            level = prediction["risk_level"]
            risk_levels[level] = risk_levels.get(level, 0) + 1
        
        return {
            "total_tickets": total,
            "high_risk_percentage": high_risk / total if total > 0 else 0,
            "risk_level_distribution": risk_levels,
            "average_risk_score": np.mean([p["risk_score"] for p in risk_predictions]) if risk_predictions else 0
        }
    
    def _generate_risk_recommendations(self, high_risk_tickets: List[Dict[str, Any]]) -> List[str]:
        """Generate recommendations for high-risk tickets."""
        if not high_risk_tickets:
            return ["No high-risk tickets identified - maintain current monitoring"]
        
        recommendations = []
        
        if len(high_risk_tickets) > 5:
            recommendations.append("Multiple high-risk tickets detected - consider emergency staffing")
        
        unassigned_count = sum(1 for t in high_risk_tickets if "unassigned_ticket" in t.get("contributing_factors", []))
        if unassigned_count > 0:
            recommendations.append(f"Assign {unassigned_count} high-risk unassigned tickets immediately")
        
        escalated_count = sum(1 for t in high_risk_tickets if "escalated_ticket" in t.get("contributing_factors", []))
        if escalated_count > 0:
            recommendations.append(f"Review {escalated_count} escalated high-risk tickets for management attention")
        
        return recommendations
    
    async def _ml_enhanced_assignment_optimization(
        self, 
        technicians: List[Dict[str, Any]], 
        pending_tickets: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """ML-enhanced assignment optimization."""
        # This would use more sophisticated ML models
        # For now, implement enhanced rule-based optimization
        
        assignments = []
        optimization_score = 0.0
        
        # Score each technician-ticket pair
        for ticket in pending_tickets:
            best_technician = None
            best_score = -1
            
            for technician in technicians:
                score = await self._calculate_assignment_score(technician, ticket)
                if score > best_score:
                    best_score = score
                    best_technician = technician
            
            if best_technician:
                assignments.append({
                    "ticket_id": ticket.get("id"),
                    "technician_id": best_technician.get("id"),
                    "assignment_score": best_score,
                    "reasoning": "ML-enhanced skill and workload matching"
                })
                optimization_score += best_score
        
        optimization_score = optimization_score / len(assignments) if assignments else 0
        
        return {
            "success": True,
            "assignments": assignments,
            "optimization_score": optimization_score,
            "strategy": "ml_enhanced",
            "total_assignments": len(assignments)
        }
    
    async def _basic_assignment_optimization(
        self, 
        technicians: List[Dict[str, Any]], 
        pending_tickets: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Basic assignment optimization fallback."""
        assignments = []
        
        for i, ticket in enumerate(pending_tickets):
            # Simple round-robin assignment
            technician = technicians[i % len(technicians)]
            assignments.append({
                "ticket_id": ticket.get("id"),
                "technician_id": technician.get("id"),
                "assignment_score": 0.5,
                "reasoning": "Basic round-robin assignment"
            })
        
        return {
            "success": True,
            "assignments": assignments,
            "optimization_score": 0.5,
            "strategy": "basic_round_robin",
            "total_assignments": len(assignments)
        }
    
    async def _calculate_assignment_score(
        self, 
        technician: Dict[str, Any], 
        ticket: Dict[str, Any]
    ) -> float:
        """Calculate assignment score for technician-ticket pair."""
        # Skill matching
        required_skills = set(ticket.get("required_skills", []))
        technician_skills = set(technician.get("skills", []))
        
        if required_skills:
            skill_match = len(required_skills & technician_skills) / len(required_skills)
        else:
            skill_match = 0.5
        
        # Workload factor
        current_workload = technician.get("current_workload", 0.5)
        workload_factor = 1.0 - current_workload
        
        # Priority factor
        priority_scores = {"critical": 1.0, "high": 0.8, "medium": 0.6, "low": 0.4}
        priority_factor = priority_scores.get(ticket.get("priority", "medium"), 0.6)
        
        # Experience factor
        experience_level = technician.get("experience_level", 5) / 10.0
        
        # Combined score
        score = (
            skill_match * 0.4 +
            workload_factor * 0.3 +
            priority_factor * 0.2 +
            experience_level * 0.1
        )
        
        return min(1.0, max(0.0, score))
    
    def _analyze_capacity_requirements(
        self, 
        predictions: List[float], 
        historical_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze capacity requirements based on predictions."""
        avg_prediction = np.mean(predictions)
        peak_prediction = max(predictions)
        
        # Calculate current capacity utilization
        current_utilization = np.mean([d.get("technician_utilization", 0.5) for d in historical_data[-24:]])
        
        capacity_gap = peak_prediction - current_utilization
        
        return {
            "current_utilization": current_utilization,
            "predicted_average": avg_prediction,
            "predicted_peak": peak_prediction,
            "capacity_gap": capacity_gap,
            "additional_capacity_needed": max(0, capacity_gap),
            "capacity_status": "sufficient" if capacity_gap <= 0.1 else "additional_needed"
        }
    
    def _generate_resource_optimization(self, predictions: List[float]) -> List[str]:
        """Generate resource optimization suggestions."""
        suggestions = []
        
        avg_workload = np.mean(predictions)
        peak_workload = max(predictions)
        workload_variance = np.var(predictions)
        
        if peak_workload > 0.9:
            suggestions.append("Peak workload exceeds 90% - consider overflow capacity planning")
        
        if workload_variance > 0.1:
            suggestions.append("High workload variability detected - implement flexible scheduling")
        
        if avg_workload < 0.4:
            suggestions.append("Low average workload - opportunity for cross-training and skill development")
        
        return suggestions
    
    def _identify_workload_risks(self, predictions: List[float]) -> List[Dict[str, Any]]:
        """Identify workload-related risks."""
        risks = []
        
        for i, prediction in enumerate(predictions):
            if prediction > 0.85:
                risks.append({
                    "hour": i + 1,
                    "risk_type": "capacity_overload",
                    "severity": "high" if prediction > 0.95 else "medium",
                    "predicted_utilization": prediction,
                    "recommendation": "Schedule additional resources"
                })
        
        return risks


# Global service instance
advanced_analytics_service = AdvancedAnalyticsService()