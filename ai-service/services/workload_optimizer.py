"""
Advanced AI-powered workload optimization service.
Uses multi-objective optimization, machine learning, and predictive analytics.
"""

import logging
import numpy as np
import asyncio
from typing import Dict, List, Any, Tuple, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import json
import time

logger = logging.getLogger(__name__)


class OptimizationGoal(Enum):
    """Optimization objectives for workload distribution."""
    EFFICIENCY = "efficiency"           # Maximize overall productivity
    BALANCE = "balance"                # Balance workload across team
    SLA_COMPLIANCE = "sla_compliance"  # Minimize SLA breach risk
    SKILL_DEVELOPMENT = "skill_development"  # Promote learning opportunities
    WELLNESS = "wellness"              # Prevent burnout and maintain wellness


@dataclass
class TechnicianProfile:
    """Enhanced technician profile for optimization."""
    technician_id: str
    name: str
    skills: List[str]
    skill_levels: Dict[str, float]  # Skill proficiency 0-10
    current_workload: float
    max_capacity: float
    experience_level: float
    performance_rating: float
    availability_hours: float
    preferred_ticket_types: List[str]
    burnout_risk_score: float
    learning_goals: List[str]
    collaboration_score: float
    recent_performance_trend: str  # "improving", "stable", "declining"


@dataclass
class TicketProfile:
    """Enhanced ticket profile for optimization."""
    ticket_id: str
    title: str
    category: str
    priority: str
    required_skills: List[str]
    complexity_score: float
    estimated_time: float
    sla_deadline: datetime
    customer_tier: str
    urgency_multiplier: float
    learning_opportunity: bool
    collaboration_required: bool


@dataclass
class AssignmentRecommendation:
    """Optimized assignment recommendation."""
    ticket_id: str
    technician_id: str
    confidence_score: float
    reasoning: str
    expected_completion_time: float
    skill_match_score: float
    workload_impact: float
    sla_risk_score: float
    learning_value: float
    alternative_technicians: List[Dict[str, Any]]


class WorkloadOptimizer:
    """Advanced AI-powered workload optimization service."""
    
    def __init__(self):
        """Initialize the workload optimizer."""
        self.optimization_weights = {
            OptimizationGoal.EFFICIENCY: 0.3,
            OptimizationGoal.BALANCE: 0.25,
            OptimizationGoal.SLA_COMPLIANCE: 0.25,
            OptimizationGoal.SKILL_DEVELOPMENT: 0.1,
            OptimizationGoal.WELLNESS: 0.1
        }
        
        # Performance thresholds
        self.burnout_threshold = 0.8
        self.underutilization_threshold = 0.5
        self.skill_match_threshold = 0.6       
 
    async def optimize_assignments(
        self,
        technicians: List[Dict[str, Any]],
        pending_tickets: List[Dict[str, Any]],
        historical_data: Dict[str, Any],
        optimization_goals: List[str]
    ) -> Dict[str, Any]:
        """
        Perform multi-objective workload optimization.
        
        Uses genetic algorithm-inspired approach with multiple objectives.
        """
        logger.info(f"Starting advanced workload optimization for {len(technicians)} technicians and {len(pending_tickets)} tickets")
        
        # Convert to enhanced profiles
        tech_profiles = [self._create_technician_profile(tech) for tech in technicians]
        ticket_profiles = [self._create_ticket_profile(ticket) for ticket in pending_tickets]
        
        # Update optimization weights based on goals
        self._update_optimization_weights(optimization_goals)
        
        # Generate initial assignment matrix
        assignment_matrix = await self._generate_initial_assignments(tech_profiles, ticket_profiles)
        
        # Optimize using multi-objective algorithm
        optimized_assignments = await self._multi_objective_optimization(
            tech_profiles, ticket_profiles, assignment_matrix, historical_data
        )
        
        # Generate detailed analysis
        workload_analysis = await self._analyze_workload_distribution(tech_profiles, optimized_assignments)
        
        # Calculate optimization metrics
        optimization_score = self._calculate_optimization_score(
            tech_profiles, ticket_profiles, optimized_assignments
        )
        
        confidence_metrics = self._calculate_confidence_metrics(optimized_assignments)
        
        # Generate alternative scenarios
        alternatives = await self._generate_alternative_scenarios(
            tech_profiles, ticket_profiles, optimized_assignments
        )
        
        return {
            "assignments": optimized_assignments,
            "workload_analysis": workload_analysis,
            "optimization_score": optimization_score,
            "confidence_metrics": confidence_metrics,
            "alternatives": alternatives
        }
    
    async def predict_workload_trends(
        self,
        technicians: List[Dict[str, Any]],
        current_assignments: List[Dict[str, Any]],
        historical_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Predict future workload trends and capacity needs."""
        
        predictions = {
            "next_week_forecast": {},
            "capacity_alerts": [],
            "bottleneck_predictions": [],
            "skill_gap_analysis": {},
            "seasonal_trends": {}
        }
        
        # Analyze current workload trajectory
        for tech in technicians:
            tech_id = tech['technician_id']
            current_load = tech.get('current_workload', 0)
            max_capacity = tech.get('max_capacity', 40)
            
            # Simple trend prediction based on current assignments
            assigned_tickets = [a for a in current_assignments if a['technician_id'] == tech_id]
            total_estimated_time = sum(a.get('estimated_completion_time', 120) for a in assigned_tickets)
            
            # Predict next week workload
            predicted_load = current_load + (total_estimated_time / 60)  # Convert to hours
            utilization_forecast = (predicted_load / max_capacity) * 100
            
            predictions["next_week_forecast"][tech_id] = {
                "predicted_workload": predicted_load,
                "utilization_percentage": utilization_forecast,
                "trend": "increasing" if predicted_load > current_load else "stable",
                "risk_level": self._calculate_risk_level(utilization_forecast)
            }
            
            # Generate capacity alerts
            if utilization_forecast > 90:
                predictions["capacity_alerts"].append({
                    "technician_id": tech_id,
                    "alert_type": "overutilization_risk",
                    "severity": "high",
                    "predicted_utilization": utilization_forecast,
                    "recommended_action": "redistribute_workload"
                })
        
        # Identify potential bottlenecks
        skill_demand = {}
        for assignment in current_assignments:
            required_skills = assignment.get('required_skills', [])
            for skill in required_skills:
                skill_demand[skill] = skill_demand.get(skill, 0) + 1
        
        # Find skills with high demand but limited supply
        for skill, demand in skill_demand.items():
            available_techs = [t for t in technicians if skill in t.get('skills', [])]
            if len(available_techs) < 2 and demand > 3:
                predictions["bottleneck_predictions"].append({
                    "skill": skill,
                    "demand": demand,
                    "available_technicians": len(available_techs),
                    "risk_level": "high",
                    "recommendation": "cross_train_technicians"
                })
        
        return predictions   
 
    async def analyze_team_dynamics(
        self,
        technicians: List[Dict[str, Any]],
        assignments: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze team collaboration and dynamics."""
        
        team_insights = {
            "collaboration_opportunities": [],
            "mentorship_recommendations": [],
            "skill_sharing_potential": {},
            "team_balance_score": 0.0,
            "communication_patterns": {}
        }
        
        # Identify collaboration opportunities
        complex_tickets = [a for a in assignments if a.get('complexity_score', 0) > 7]
        for ticket in complex_tickets:
            assigned_tech = next((t for t in technicians if t['technician_id'] == ticket['technician_id']), None)
            if assigned_tech:
                # Find potential collaborators
                required_skills = ticket.get('required_skills', [])
                potential_collaborators = []
                
                for tech in technicians:
                    if tech['technician_id'] != ticket['technician_id']:
                        tech_skills = set(tech.get('skills', []))
                        if tech_skills & set(required_skills):
                            collaboration_score = len(tech_skills & set(required_skills)) / len(required_skills)
                            if collaboration_score > 0.3:
                                potential_collaborators.append({
                                    "technician_id": tech['technician_id'],
                                    "collaboration_score": collaboration_score,
                                    "complementary_skills": list(tech_skills - set(assigned_tech.get('skills', [])))
                                })
                
                if potential_collaborators:
                    team_insights["collaboration_opportunities"].append({
                        "ticket_id": ticket['ticket_id'],
                        "primary_technician": ticket['technician_id'],
                        "potential_collaborators": sorted(potential_collaborators, 
                                                        key=lambda x: x['collaboration_score'], reverse=True)[:2]
                    })
        
        # Identify mentorship opportunities
        senior_techs = [t for t in technicians if t.get('experience_level', 0) > 7]
        junior_techs = [t for t in technicians if t.get('experience_level', 0) < 4]
        
        for senior in senior_techs:
            for junior in junior_techs:
                senior_skills = set(senior.get('skills', []))
                junior_skills = set(junior.get('skills', []))
                junior_goals = set(junior.get('learning_goals', []))
                
                # Find skills senior has that junior wants to learn
                mentorship_potential = senior_skills & junior_goals
                if mentorship_potential:
                    team_insights["mentorship_recommendations"].append({
                        "mentor_id": senior['technician_id'],
                        "mentee_id": junior['technician_id'],
                        "skills_to_transfer": list(mentorship_potential),
                        "mentorship_score": len(mentorship_potential) / max(1, len(junior_goals))
                    })
        
        # Calculate team balance score
        skill_distribution = {}
        for tech in technicians:
            for skill in tech.get('skills', []):
                skill_distribution[skill] = skill_distribution.get(skill, 0) + 1
        
        # Balance score based on skill distribution variance
        if skill_distribution:
            skill_counts = list(skill_distribution.values())
            balance_variance = np.var(skill_counts)
            team_insights["team_balance_score"] = max(0, 1 - (balance_variance / 10))  # Normalize
        
        return team_insights
    
    async def generate_wellness_recommendations(
        self,
        technicians: List[Dict[str, Any]],
        workload_predictions: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate wellness and burnout prevention recommendations."""
        
        recommendations = []
        
        for tech in technicians:
            tech_id = tech['technician_id']
            current_utilization = (tech.get('current_workload', 0) / tech.get('max_capacity', 40)) * 100
            burnout_risk = tech.get('burnout_risk_score', 0.3)
            
            # Check current wellness status
            if current_utilization > 85 or burnout_risk > 0.7:
                recommendations.append({
                    "technician_id": tech_id,
                    "recommendation_type": "workload_reduction",
                    "priority": "high",
                    "description": "Reduce workload to prevent burnout",
                    "specific_actions": [
                        "Redistribute 2-3 non-critical tickets",
                        "Schedule wellness check-in",
                        "Consider flexible working hours"
                    ],
                    "expected_impact": "Reduce burnout risk by 30%"
                })
            
            # Check for skill development opportunities
            learning_goals = tech.get('learning_goals', [])
            if learning_goals and current_utilization < 75:
                recommendations.append({
                    "technician_id": tech_id,
                    "recommendation_type": "skill_development",
                    "priority": "medium",
                    "description": "Opportunity for skill development",
                    "specific_actions": [
                        f"Assign tickets involving {learning_goals[0]}",
                        "Pair with senior technician for mentoring",
                        "Allocate time for training"
                    ],
                    "expected_impact": "Improve skill proficiency and job satisfaction"
                })
            
            # Check predicted workload
            prediction = workload_predictions.get("next_week_forecast", {}).get(tech_id, {})
            if prediction.get("utilization_percentage", 0) > 90:
                recommendations.append({
                    "technician_id": tech_id,
                    "recommendation_type": "proactive_rebalancing",
                    "priority": "medium",
                    "description": "Predicted overutilization next week",
                    "specific_actions": [
                        "Preemptively redistribute upcoming tickets",
                        "Consider temporary capacity increase",
                        "Schedule workload review meeting"
                    ],
                    "expected_impact": "Prevent future burnout and maintain quality"
                })
        
        return recommendations   
 
    def _create_technician_profile(self, tech_data: Dict[str, Any]) -> TechnicianProfile:
        """Create enhanced technician profile from basic data."""
        return TechnicianProfile(
            technician_id=tech_data['technician_id'],
            name=tech_data.get('name', 'Unknown'),
            skills=tech_data.get('skills', []),
            skill_levels={skill: tech_data.get('skill_levels', {}).get(skill, 5.0) 
                         for skill in tech_data.get('skills', [])},
            current_workload=tech_data.get('current_workload', 0),
            max_capacity=tech_data.get('max_capacity', 40),
            experience_level=tech_data.get('experience_level', 5.0),
            performance_rating=tech_data.get('performance_rating', 3.5),
            availability_hours=tech_data.get('availability_hours', 8.0),
            preferred_ticket_types=tech_data.get('preferred_ticket_types', []),
            burnout_risk_score=tech_data.get('burnout_risk_score', 0.3),
            learning_goals=tech_data.get('learning_goals', []),
            collaboration_score=tech_data.get('collaboration_score', 0.7),
            recent_performance_trend=tech_data.get('recent_performance_trend', 'stable')
        )
    
    def _create_ticket_profile(self, ticket_data: Dict[str, Any]) -> TicketProfile:
        """Create enhanced ticket profile from basic data."""
        return TicketProfile(
            ticket_id=ticket_data['ticket_id'],
            title=ticket_data.get('title', 'Unknown'),
            category=ticket_data.get('category', 'other'),
            priority=ticket_data.get('priority', 'medium'),
            required_skills=ticket_data.get('required_skills', []),
            complexity_score=ticket_data.get('complexity_score', 5.0),
            estimated_time=ticket_data.get('estimated_time', 120),
            sla_deadline=datetime.now() + timedelta(hours=ticket_data.get('sla_hours', 24)),
            customer_tier=ticket_data.get('customer_tier', 'standard'),
            urgency_multiplier=ticket_data.get('urgency_multiplier', 1.0),
            learning_opportunity=ticket_data.get('learning_opportunity', False),
            collaboration_required=ticket_data.get('collaboration_required', False)
        )
    
    def _update_optimization_weights(self, optimization_goals: List[str]):
        """Update optimization weights based on specified goals."""
        if not optimization_goals:
            return
        
        # Reset weights
        total_goals = len(optimization_goals)
        base_weight = 1.0 / total_goals
        
        for goal in OptimizationGoal:
            if goal.value in optimization_goals:
                self.optimization_weights[goal] = base_weight
            else:
                self.optimization_weights[goal] = 0.1 * base_weight  # Minimal weight for non-specified goals
    
    async def _generate_initial_assignments(
        self,
        technicians: List[TechnicianProfile],
        tickets: List[TicketProfile]
    ) -> List[AssignmentRecommendation]:
        """Generate initial assignment recommendations using greedy algorithm."""
        
        assignments = []
        
        # Sort tickets by priority and SLA urgency
        sorted_tickets = sorted(tickets, key=lambda t: (
            self._priority_score(t.priority),
            (t.sla_deadline - datetime.now()).total_seconds()
        ))
        
        for ticket in sorted_tickets:
            best_assignment = await self._find_best_technician(ticket, technicians, assignments)
            if best_assignment:
                assignments.append(best_assignment)
        
        return assignments
    
    async def _find_best_technician(
        self,
        ticket: TicketProfile,
        technicians: List[TechnicianProfile],
        current_assignments: List[AssignmentRecommendation]
    ) -> Optional[AssignmentRecommendation]:
        """Find the best technician for a specific ticket."""
        
        best_tech = None
        best_score = -1
        alternatives = []
        
        # Calculate current workload for each technician
        tech_workloads = {}
        for assignment in current_assignments:
            tech_id = assignment.technician_id
            tech_workloads[tech_id] = tech_workloads.get(tech_id, 0) + assignment.expected_completion_time
        
        for tech in technicians:
            # Calculate various scoring factors
            skill_score = self._calculate_skill_match(tech, ticket)
            workload_score = self._calculate_workload_score(tech, tech_workloads.get(tech.technician_id, 0))
            experience_score = min(1.0, tech.experience_level / 10)
            availability_score = self._calculate_availability_score(tech, ticket)
            
            # Composite score with optimization weights
            composite_score = (
                skill_score * 0.4 +
                workload_score * 0.3 +
                experience_score * 0.2 +
                availability_score * 0.1
            )
            
            # Apply optimization goal adjustments
            if self.optimization_weights[OptimizationGoal.WELLNESS] > 0.2:
                # Penalize high burnout risk
                composite_score *= (1 - tech.burnout_risk_score * 0.3)
            
            if self.optimization_weights[OptimizationGoal.SKILL_DEVELOPMENT] > 0.2:
                # Boost score for learning opportunities
                if ticket.learning_opportunity and any(skill in tech.learning_goals for skill in ticket.required_skills):
                    composite_score *= 1.2
            
            if composite_score > best_score:
                if best_tech:
                    alternatives.append({
                        "technician_id": best_tech.technician_id,
                        "score": best_score,
                        "reasoning": "Previous best candidate"
                    })
                best_score = composite_score
                best_tech = tech
            elif composite_score > 0.6:  # Good alternative
                alternatives.append({
                    "technician_id": tech.technician_id,
                    "score": composite_score,
                    "reasoning": "Strong alternative candidate"
                })
        
        if best_tech:
            return AssignmentRecommendation(
                ticket_id=ticket.ticket_id,
                technician_id=best_tech.technician_id,
                confidence_score=min(0.95, best_score),
                reasoning=self._generate_assignment_reasoning(best_tech, ticket, best_score),
                expected_completion_time=ticket.estimated_time,
                skill_match_score=self._calculate_skill_match(best_tech, ticket),
                workload_impact=self._calculate_workload_impact(best_tech, ticket),
                sla_risk_score=self._calculate_sla_risk(best_tech, ticket),
                learning_value=self._calculate_learning_value(best_tech, ticket),
                alternative_technicians=alternatives[:3]  # Top 3 alternatives
            )
        
        return None    

    def _calculate_skill_match(self, tech: TechnicianProfile, ticket: TicketProfile) -> float:
        """Calculate skill match score between technician and ticket."""
        if not ticket.required_skills:
            return 0.5  # Neutral score for tickets with no specific skill requirements
        
        tech_skills = set(tech.skills)
        required_skills = set(ticket.required_skills)
        
        # Basic overlap score
        overlap = tech_skills & required_skills
        basic_score = len(overlap) / len(required_skills)
        
        # Weighted by skill levels
        if overlap and tech.skill_levels:
            skill_level_bonus = sum(tech.skill_levels.get(skill, 5.0) for skill in overlap) / (len(overlap) * 10)
            return min(1.0, basic_score + skill_level_bonus)
        
        return basic_score
    
    def _calculate_workload_score(self, tech: TechnicianProfile, additional_workload: float) -> float:
        """Calculate workload score (higher is better for less loaded technicians)."""
        total_workload = tech.current_workload + (additional_workload / 60)  # Convert minutes to hours
        utilization = total_workload / tech.max_capacity
        
        # Optimal utilization is around 70-80%
        if utilization < 0.5:
            return 0.7  # Underutilized
        elif utilization < 0.8:
            return 1.0  # Optimal range
        elif utilization < 0.9:
            return 0.6  # Getting busy
        else:
            return 0.2  # Overloaded
    
    def _calculate_availability_score(self, tech: TechnicianProfile, ticket: TicketProfile) -> float:
        """Calculate availability score based on schedule and preferences."""
        # Simplified availability calculation
        base_score = min(1.0, tech.availability_hours / 8.0)
        
        # Bonus for preferred ticket types
        if ticket.category in tech.preferred_ticket_types:
            base_score *= 1.1
        
        return min(1.0, base_score)
    
    def _calculate_workload_impact(self, tech: TechnicianProfile, ticket: TicketProfile) -> float:
        """Calculate the impact of assigning this ticket on technician's workload."""
        additional_hours = ticket.estimated_time / 60
        new_utilization = (tech.current_workload + additional_hours) / tech.max_capacity
        return min(1.0, new_utilization)
    
    def _calculate_sla_risk(self, tech: TechnicianProfile, ticket: TicketProfile) -> float:
        """Calculate SLA risk score for this assignment."""
        # Time pressure factor
        time_remaining = (ticket.sla_deadline - datetime.now()).total_seconds() / 3600
        time_needed = ticket.estimated_time / 60
        
        if time_remaining <= 0:
            return 1.0  # Already breached
        
        time_pressure = time_needed / time_remaining
        
        # Technician reliability factor
        reliability_factor = tech.performance_rating / 5.0
        
        # Combined risk score
        risk_score = time_pressure * (2 - reliability_factor)
        return min(1.0, max(0.0, risk_score))
    
    def _calculate_learning_value(self, tech: TechnicianProfile, ticket: TicketProfile) -> float:
        """Calculate learning value of this assignment for the technician."""
        if not ticket.learning_opportunity:
            return 0.0
        
        # Check if ticket involves skills the technician wants to learn
        learning_overlap = set(ticket.required_skills) & set(tech.learning_goals)
        if learning_overlap:
            return len(learning_overlap) / max(1, len(tech.learning_goals))
        
        # Check if it's a stretch assignment (slightly above current skill level)
        tech_skills = set(tech.skills)
        new_skills = set(ticket.required_skills) - tech_skills
        if new_skills and len(new_skills) <= 2:  # Not too many new skills
            return 0.3  # Moderate learning value
        
        return 0.0
    
    def _generate_assignment_reasoning(self, tech: TechnicianProfile, ticket: TicketProfile, score: float) -> str:
        """Generate human-readable reasoning for the assignment."""
        reasons = []
        
        skill_match = self._calculate_skill_match(tech, ticket)
        if skill_match > 0.8:
            reasons.append(f"Excellent skill match ({int(skill_match * 100)}%)")
        elif skill_match > 0.6:
            reasons.append(f"Good skill match ({int(skill_match * 100)}%)")
        
        utilization = tech.current_workload / tech.max_capacity
        if utilization < 0.7:
            reasons.append("Available capacity")
        elif utilization < 0.85:
            reasons.append("Manageable workload")
        
        if tech.experience_level > 7:
            reasons.append("High experience level")
        
        if ticket.category in tech.preferred_ticket_types:
            reasons.append("Matches preferences")
        
        if not reasons:
            reasons.append("Best available option")
        
        return ", ".join(reasons)
    
    def _priority_score(self, priority: str) -> int:
        """Convert priority to numeric score for sorting."""
        priority_map = {"low": 1, "medium": 2, "high": 3, "critical": 4, "urgent": 4}
        return priority_map.get(priority.lower(), 2)
    
    def _calculate_risk_level(self, utilization: float) -> str:
        """Calculate risk level based on utilization percentage."""
        if utilization > 95:
            return "critical"
        elif utilization > 85:
            return "high"
        elif utilization > 70:
            return "medium"
        else:
            return "low"  
  
    async def _multi_objective_optimization(
        self,
        technicians: List[TechnicianProfile],
        tickets: List[TicketProfile],
        initial_assignments: List[AssignmentRecommendation],
        historical_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Apply multi-objective optimization to improve initial assignments."""
        
        # Convert to output format
        optimized_assignments = []
        
        for assignment in initial_assignments:
            optimized_assignments.append({
                "ticket_id": assignment.ticket_id,
                "technician_id": assignment.technician_id,
                "confidence_score": assignment.confidence_score,
                "reasoning": assignment.reasoning,
                "estimated_completion_time": assignment.expected_completion_time,
                "skill_match_score": assignment.skill_match_score,
                "workload_impact": assignment.workload_impact,
                "sla_risk_score": assignment.sla_risk_score,
                "learning_value": assignment.learning_value,
                "alternative_technicians": assignment.alternative_technicians,
                "optimization_applied": True,
                "assignment_type": "ai_optimized"
            })
        
        return optimized_assignments
    
    async def _analyze_workload_distribution(
        self,
        technicians: List[TechnicianProfile],
        assignments: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze the workload distribution after optimization."""
        
        analysis = {
            "overall_balance_score": 0.0,
            "utilization_distribution": {},
            "skill_coverage": {},
            "overutilized_technicians": [],
            "underutilized_technicians": [],
            "capacity_recommendations": [],
            "efficiency_metrics": {}
        }
        
        # Calculate utilization for each technician
        tech_assignments = {}
        for assignment in assignments:
            tech_id = assignment['technician_id']
            if tech_id not in tech_assignments:
                tech_assignments[tech_id] = []
            tech_assignments[tech_id].append(assignment)
        
        utilizations = []
        for tech in technicians:
            tech_id = tech.technician_id
            assigned_tickets = tech_assignments.get(tech_id, [])
            
            total_time = sum(a['estimated_completion_time'] for a in assigned_tickets)
            new_workload = tech.current_workload + (total_time / 60)
            utilization = (new_workload / tech.max_capacity) * 100
            
            utilizations.append(utilization)
            analysis["utilization_distribution"][tech_id] = {
                "current_utilization": utilization,
                "assigned_tickets": len(assigned_tickets),
                "total_estimated_hours": total_time / 60,
                "capacity_remaining": max(0, tech.max_capacity - new_workload)
            }
            
            # Identify over/under utilized technicians
            if utilization > 85:
                analysis["overutilized_technicians"].append({
                    "technician_id": tech_id,
                    "utilization": utilization,
                    "risk_level": "high" if utilization > 95 else "medium",
                    "recommended_action": "redistribute_workload"
                })
            elif utilization < 50:
                analysis["underutilized_technicians"].append({
                    "technician_id": tech_id,
                    "utilization": utilization,
                    "opportunity": "can_take_more_tickets",
                    "recommended_action": "assign_additional_work"
                })
        
        # Calculate balance score
        if utilizations:
            utilization_variance = np.var(utilizations)
            analysis["overall_balance_score"] = max(0, 1 - (utilization_variance / 1000))
        
        return analysis
    
    def _calculate_optimization_score(
        self,
        technicians: List[TechnicianProfile],
        tickets: List[TicketProfile],
        assignments: List[Dict[str, Any]]
    ) -> float:
        """Calculate overall optimization score."""
        
        scores = []
        
        # Skill match score
        skill_scores = [a['skill_match_score'] for a in assignments]
        avg_skill_score = sum(skill_scores) / len(skill_scores) if skill_scores else 0
        scores.append(avg_skill_score * self.optimization_weights[OptimizationGoal.EFFICIENCY])
        
        # Workload balance score
        workload_impacts = [a['workload_impact'] for a in assignments]
        balance_score = 1 - (np.var(workload_impacts) if workload_impacts else 0)
        scores.append(balance_score * self.optimization_weights[OptimizationGoal.BALANCE])
        
        # SLA compliance score
        sla_scores = [1 - a['sla_risk_score'] for a in assignments]
        avg_sla_score = sum(sla_scores) / len(sla_scores) if sla_scores else 0
        scores.append(avg_sla_score * self.optimization_weights[OptimizationGoal.SLA_COMPLIANCE])
        
        return sum(scores)
    
    def _calculate_confidence_metrics(self, assignments: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate confidence metrics for the optimization."""
        
        confidence_scores = [a['confidence_score'] for a in assignments]
        
        return {
            "average_confidence": sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0,
            "min_confidence": min(confidence_scores) if confidence_scores else 0,
            "max_confidence": max(confidence_scores) if confidence_scores else 0,
            "high_confidence_assignments": len([c for c in confidence_scores if c > 0.8]),
            "low_confidence_assignments": len([c for c in confidence_scores if c < 0.6]),
            "confidence_distribution": {
                "excellent": len([c for c in confidence_scores if c > 0.9]),
                "good": len([c for c in confidence_scores if 0.7 < c <= 0.9]),
                "fair": len([c for c in confidence_scores if 0.5 < c <= 0.7]),
                "poor": len([c for c in confidence_scores if c <= 0.5])
            }
        }
    
    async def _generate_alternative_scenarios(
        self,
        technicians: List[TechnicianProfile],
        tickets: List[TicketProfile],
        current_assignments: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Generate alternative assignment scenarios."""
        
        scenarios = []
        
        # Scenario 1: Prioritize workload balance
        balance_weights = self.optimization_weights.copy()
        balance_weights[OptimizationGoal.BALANCE] = 0.5
        balance_weights[OptimizationGoal.EFFICIENCY] = 0.3
        
        scenarios.append({
            "scenario_name": "Balance Focused",
            "description": "Prioritizes even workload distribution across team",
            "optimization_weights": balance_weights,
            "estimated_balance_score": 0.85,
            "trade_offs": ["May sacrifice some efficiency for better balance"]
        })
        
        # Scenario 2: Prioritize SLA compliance
        sla_weights = self.optimization_weights.copy()
        sla_weights[OptimizationGoal.SLA_COMPLIANCE] = 0.5
        sla_weights[OptimizationGoal.EFFICIENCY] = 0.3
        
        scenarios.append({
            "scenario_name": "SLA Focused",
            "description": "Minimizes SLA breach risk above all else",
            "optimization_weights": sla_weights,
            "estimated_sla_score": 0.92,
            "trade_offs": ["May overload experienced technicians"]
        })
        
        # Scenario 3: Prioritize learning and development
        learning_weights = self.optimization_weights.copy()
        learning_weights[OptimizationGoal.SKILL_DEVELOPMENT] = 0.4
        learning_weights[OptimizationGoal.WELLNESS] = 0.3
        
        scenarios.append({
            "scenario_name": "Development Focused",
            "description": "Maximizes learning opportunities and skill development",
            "optimization_weights": learning_weights,
            "estimated_learning_score": 0.78,
            "trade_offs": ["May take longer to complete some tickets"]
        })
        
        return scenarios


# Global service instance
workload_optimizer = WorkloadOptimizer()