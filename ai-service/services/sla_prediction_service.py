"""
SLA prediction service using machine learning models.
"""

import logging
import json
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
import asyncio
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, accuracy_score
import joblib
import os

from models.sla_models import (
    SLAPredictionRequest, 
    SLAPredictionResult, 
    SLARiskLevel,
    SLAModelFeatures,
    HistoricalTicketData,
    SLATrainingData,
    Priority,
    CustomerTier,
    TicketStatus
)
from cache.redis_cache import redis_cache

logger = logging.getLogger(__name__)


class SLAPredictionService:
    """Service for predicting SLA breach probability using machine learning."""
    
    def __init__(self):
        self.model = None
        self.scaler = None
        self.feature_names = []
        self.model_version = "1.0"
        self.model_path = "models/sla_prediction_model.joblib"
        self.scaler_path = "models/sla_scaler.joblib"
        self.is_trained = False
        
        # Risk thresholds
        self.risk_thresholds = {
            SLARiskLevel.LOW: 0.3,
            SLARiskLevel.MEDIUM: 0.6,
            SLARiskLevel.HIGH: 0.8,
            SLARiskLevel.CRITICAL: 0.9
        }
        
        # Category complexity scores (based on historical data)
        self.category_complexity = {
            "hardware": 0.8,
            "software": 0.6,
            "network": 0.9,
            "security": 0.95,
            "email": 0.4,
            "printer": 0.5,
            "phone": 0.3,
            "access": 0.7,
            "backup": 0.6,
            "other": 0.5
        }
        
        # Initialize model
        asyncio.create_task(self._initialize_model())
    
    async def _initialize_model(self):
        """Initialize or load the SLA prediction model."""
        try:
            if os.path.exists(self.model_path) and os.path.exists(self.scaler_path):
                # Load existing model
                self.model = joblib.load(self.model_path)
                self.scaler = joblib.load(self.scaler_path)
                self.is_trained = True
                logger.info("SLA prediction model loaded successfully")
            else:
                # Initialize new model with default parameters
                self.model = GradientBoostingRegressor(
                    n_estimators=100,
                    learning_rate=0.1,
                    max_depth=6,
                    random_state=42,
                    validation_fraction=0.1,
                    n_iter_no_change=10,
                    tol=1e-4
                )
                self.scaler = StandardScaler()
                logger.info("New SLA prediction model initialized")
                
                # Try to train with synthetic data if no real data available
                await self._train_with_synthetic_data()
                
        except Exception as e:
            logger.error(f"Failed to initialize SLA prediction model: {str(e)}")
            # Fallback to rule-based prediction
            self.model = None
            self.scaler = None
    
    async def predict_sla_breach(self, request: SLAPredictionRequest) -> SLAPredictionResult:
        """Predict SLA breach probability for a ticket."""
        try:
            # Extract features from request
            features = await self._extract_features(request)
            
            # Get prediction
            if self.is_trained and self.model is not None:
                breach_probability, confidence = await self._ml_prediction(features)
            else:
                # Fallback to rule-based prediction
                breach_probability, confidence = await self._rule_based_prediction(request)
            
            # Determine risk level
            risk_level = self._get_risk_level(breach_probability)
            
            # Calculate time predictions
            time_remaining = int((request.sla_deadline - request.current_time).total_seconds() / 60)
            estimated_completion, estimated_resolution = await self._estimate_completion_time(request, features)
            
            # Identify risk factors and recommendations
            risk_factors, risk_scores = await self._analyze_risk_factors(request, features)
            recommendations = await self._generate_recommendations(request, breach_probability, risk_factors)
            
            return SLAPredictionResult(
                ticket_id=request.ticket_id,
                breach_probability=breach_probability,
                risk_level=risk_level,
                confidence_score=confidence,
                estimated_completion_time=estimated_completion,
                time_remaining_minutes=max(0, time_remaining),
                estimated_resolution_minutes=estimated_resolution,
                primary_risk_factors=risk_factors[:3],  # Top 3 risk factors
                risk_factor_scores=risk_scores,
                recommended_actions=recommendations,
                escalation_recommended=breach_probability > 0.8,
                reassignment_recommended=breach_probability > 0.85 and request.technician_current_workload and request.technician_current_workload > 0.9
            )
            
        except Exception as e:
            logger.error(f"SLA prediction failed for ticket {request.ticket_id}: {str(e)}")
            # Return conservative high-risk prediction
            return SLAPredictionResult(
                ticket_id=request.ticket_id,
                breach_probability=0.7,
                risk_level=SLARiskLevel.HIGH,
                confidence_score=0.3,
                time_remaining_minutes=max(0, int((request.sla_deadline - request.current_time).total_seconds() / 60)),
                primary_risk_factors=["prediction_error"],
                recommended_actions=["Manual review required due to prediction error"]
            )
    
    async def _extract_features(self, request: SLAPredictionRequest) -> SLAModelFeatures:
        """Extract feature vector from prediction request."""
        current_time = request.current_time or datetime.utcnow()
        
        # Time-based features
        total_sla_time = (request.sla_deadline - request.created_at).total_seconds()
        elapsed_time = (current_time - request.created_at).total_seconds()
        remaining_time = (request.sla_deadline - current_time).total_seconds()
        
        time_remaining_ratio = max(0, remaining_time / total_sla_time) if total_sla_time > 0 else 0
        
        # Estimate total time needed based on similar tickets or defaults
        estimated_total_time = request.similar_tickets_avg_resolution or self._get_default_resolution_time(request.priority, request.category)
        progress_ratio = min(1.0, request.time_spent / estimated_total_time) if estimated_total_time > 0 else 0
        
        # Business hours calculation
        business_hours_remaining = self._calculate_business_hours_remaining(current_time, request.sla_deadline)
        
        # Priority and tier scores
        priority_scores = {Priority.LOW: 1, Priority.MEDIUM: 2, Priority.HIGH: 3, Priority.CRITICAL: 4}
        tier_scores = {CustomerTier.BASIC: 1, CustomerTier.PREMIUM: 2, CustomerTier.ENTERPRISE: 3}
        
        # Complexity features
        category_complexity = self.category_complexity.get(request.category or "other", 0.5)
        
        # Assignment features
        technician_skill_match = request.technician_skill_level or 5.0  # Default mid-level
        technician_workload = request.technician_current_workload or 0.5
        is_assigned = request.assigned_technician_id is not None
        
        # Temporal features
        is_business_hours = request.is_business_hours if request.is_business_hours is not None else self._is_business_hours(current_time)
        
        # Progress features
        hours_since_creation = elapsed_time / 3600
        time_since_last_update = hours_since_creation  # Simplified - would need actual last update time
        response_velocity = 1.0 / max(1, hours_since_creation)  # Simplified calculation
        
        return SLAModelFeatures(
            time_remaining_ratio=time_remaining_ratio,
            progress_ratio=progress_ratio,
            business_hours_remaining=business_hours_remaining,
            priority_score=priority_scores[request.priority],
            tier_score=tier_scores[request.customer_tier],
            description_length=len(request.description),
            title_length=len(request.title),
            category_complexity=category_complexity,
            technician_skill_match=technician_skill_match / 10.0,  # Normalize to 0-1
            technician_workload=technician_workload,
            is_assigned=is_assigned,
            similar_tickets_avg_time=request.similar_tickets_avg_resolution or estimated_total_time,
            customer_avg_response_time=request.customer_avg_response_time or 120.0,  # Default 2 hours
            technician_avg_resolution_time=estimated_total_time,
            hour_of_day=request.hour_of_day or current_time.hour,
            day_of_week=request.day_of_week or current_time.weekday(),
            is_business_hours=is_business_hours,
            escalation_level=request.escalation_level or 0,
            time_since_last_update=time_since_last_update,
            response_velocity=response_velocity
        )
    
    async def _ml_prediction(self, features: SLAModelFeatures) -> Tuple[float, float]:
        """Make ML-based prediction."""
        try:
            # Convert features to numpy array
            feature_vector = self._features_to_vector(features)
            
            # Scale features
            scaled_features = self.scaler.transform([feature_vector])
            
            # Make prediction
            prediction = self.model.predict(scaled_features)[0]
            
            # Clip to valid probability range
            breach_probability = max(0.0, min(1.0, prediction))
            
            # Calculate confidence based on model uncertainty (simplified)
            # In production, you might use prediction intervals or ensemble methods
            confidence = 0.8  # Default confidence for trained model
            
            return breach_probability, confidence
            
        except Exception as e:
            logger.error(f"ML prediction failed: {str(e)}")
            # Fallback to rule-based
            return 0.5, 0.3
    
    async def _rule_based_prediction(self, request: SLAPredictionRequest) -> Tuple[float, float]:
        """Fallback rule-based prediction when ML model is not available."""
        current_time = request.current_time or datetime.utcnow()
        
        # Calculate basic time progress
        total_time = (request.sla_deadline - request.created_at).total_seconds()
        elapsed_time = (current_time - request.created_at).total_seconds()
        progress_ratio = elapsed_time / total_time if total_time > 0 else 1.0
        
        # Base risk from time progress (exponential curve)
        base_risk = min(1.0, progress_ratio ** 1.5)
        
        # Adjust for priority
        priority_multipliers = {
            Priority.LOW: 0.8,
            Priority.MEDIUM: 1.0,
            Priority.HIGH: 1.2,
            Priority.CRITICAL: 1.4
        }
        base_risk *= priority_multipliers[request.priority]
        
        # Adjust for status
        status_multipliers = {
            TicketStatus.OPEN: 1.3,  # Higher risk if not assigned
            TicketStatus.IN_PROGRESS: 1.0,
            TicketStatus.PENDING_CUSTOMER: 0.7,  # Lower risk if waiting for customer
            TicketStatus.RESOLVED: 0.0,
            TicketStatus.CLOSED: 0.0
        }
        base_risk *= status_multipliers[request.status]
        
        # Adjust for escalation
        if request.escalation_level and request.escalation_level > 0:
            base_risk *= (1 + request.escalation_level * 0.2)
        
        # Adjust for technician workload
        if request.technician_current_workload and request.technician_current_workload > 0.8:
            base_risk *= 1.3
        
        # Clip to valid range
        breach_probability = max(0.0, min(1.0, base_risk))
        confidence = 0.6  # Lower confidence for rule-based prediction
        
        return breach_probability, confidence
    
    def _get_risk_level(self, breach_probability: float) -> SLARiskLevel:
        """Determine risk level from breach probability."""
        if breach_probability >= self.risk_thresholds[SLARiskLevel.CRITICAL]:
            return SLARiskLevel.CRITICAL
        elif breach_probability >= self.risk_thresholds[SLARiskLevel.HIGH]:
            return SLARiskLevel.HIGH
        elif breach_probability >= self.risk_thresholds[SLARiskLevel.MEDIUM]:
            return SLARiskLevel.MEDIUM
        else:
            return SLARiskLevel.LOW
    
    async def _estimate_completion_time(self, request: SLAPredictionRequest, features: SLAModelFeatures) -> Tuple[Optional[datetime], Optional[int]]:
        """Estimate when the ticket will be completed."""
        try:
            # Use similar tickets average or default estimation
            estimated_total_minutes = request.similar_tickets_avg_resolution or self._get_default_resolution_time(request.priority, request.category)
            
            # Adjust based on progress and complexity
            remaining_work_ratio = 1.0 - features.progress_ratio
            estimated_remaining_minutes = int(estimated_total_minutes * remaining_work_ratio)
            
            # Adjust for technician workload and skill
            if request.technician_current_workload:
                # Higher workload means slower progress
                workload_factor = 1.0 + (request.technician_current_workload - 0.5)
                estimated_remaining_minutes = int(estimated_remaining_minutes * workload_factor)
            
            if request.technician_skill_level:
                # Higher skill means faster resolution
                skill_factor = 1.0 - ((request.technician_skill_level - 5.0) / 10.0 * 0.3)
                estimated_remaining_minutes = int(estimated_remaining_minutes * skill_factor)
            
            # Calculate estimated completion time
            current_time = request.current_time or datetime.utcnow()
            estimated_completion = current_time + timedelta(minutes=estimated_remaining_minutes)
            
            return estimated_completion, estimated_remaining_minutes
            
        except Exception as e:
            logger.error(f"Failed to estimate completion time: {str(e)}")
            return None, None
    
    async def _analyze_risk_factors(self, request: SLAPredictionRequest, features: SLAModelFeatures) -> Tuple[List[str], Dict[str, float]]:
        """Analyze and rank risk factors."""
        risk_factors = []
        risk_scores = {}
        
        # Time-based risks
        if features.time_remaining_ratio < 0.2:
            risk_factors.append("Very little time remaining")
            risk_scores["time_remaining"] = 1.0 - features.time_remaining_ratio
        
        # Progress risks
        if features.progress_ratio < 0.3 and features.time_remaining_ratio < 0.5:
            risk_factors.append("Slow progress relative to time elapsed")
            risk_scores["slow_progress"] = 0.8
        
        # Assignment risks
        if not features.is_assigned:
            risk_factors.append("Ticket not yet assigned to technician")
            risk_scores["unassigned"] = 0.9
        
        # Workload risks
        if features.technician_workload > 0.8:
            risk_factors.append("Technician has high workload")
            risk_scores["high_workload"] = features.technician_workload
        
        # Complexity risks
        if features.category_complexity > 0.8:
            risk_factors.append("High complexity ticket category")
            risk_scores["complexity"] = features.category_complexity
        
        # Priority risks
        if features.priority_score >= 3:  # High or Critical
            risk_factors.append("High priority ticket")
            risk_scores["priority"] = features.priority_score / 4.0
        
        # Escalation risks
        if features.escalation_level > 0:
            risk_factors.append(f"Ticket escalated (level {features.escalation_level})")
            risk_scores["escalation"] = min(1.0, features.escalation_level / 3.0)
        
        # Business hours risks
        if not features.is_business_hours and features.business_hours_remaining < 8:
            risk_factors.append("Limited business hours remaining")
            risk_scores["business_hours"] = 0.7
        
        return risk_factors, risk_scores
    
    async def _generate_recommendations(self, request: SLAPredictionRequest, breach_probability: float, risk_factors: List[str]) -> List[str]:
        """Generate actionable recommendations based on risk analysis."""
        recommendations = []
        
        if breach_probability > 0.8:
            recommendations.append("Immediate escalation recommended")
            
        if breach_probability > 0.7 and not request.assigned_technician_id:
            recommendations.append("Assign to available technician immediately")
            
        if breach_probability > 0.6 and request.technician_current_workload and request.technician_current_workload > 0.9:
            recommendations.append("Consider reassigning to technician with lower workload")
            
        if "High complexity ticket category" in risk_factors:
            recommendations.append("Assign to senior technician with relevant expertise")
            
        if "Very little time remaining" in risk_factors:
            recommendations.append("Focus all available resources on this ticket")
            
        if breach_probability > 0.5 and request.priority in [Priority.HIGH, Priority.CRITICAL]:
            recommendations.append("Notify customer of potential delay and provide status update")
            
        if not recommendations:
            recommendations.append("Continue monitoring - no immediate action required")
            
        return recommendations
    
    def _get_default_resolution_time(self, priority: Priority, category: Optional[str]) -> float:
        """Get default estimated resolution time based on priority and category."""
        base_times = {
            Priority.CRITICAL: 60,   # 1 hour
            Priority.HIGH: 240,      # 4 hours
            Priority.MEDIUM: 480,    # 8 hours
            Priority.LOW: 1440       # 24 hours
        }
        
        base_time = base_times[priority]
        
        # Adjust for category complexity
        if category:
            complexity = self.category_complexity.get(category, 0.5)
            base_time *= (0.5 + complexity)
        
        return base_time
    
    def _calculate_business_hours_remaining(self, current_time: datetime, deadline: datetime) -> float:
        """Calculate business hours remaining until deadline."""
        # Simplified calculation - assumes 8 hours per business day, Mon-Fri
        total_hours = (deadline - current_time).total_seconds() / 3600
        
        # Rough approximation: 40 business hours per week
        business_hours_ratio = 40 / (7 * 24)  # ~0.238
        
        return total_hours * business_hours_ratio
    
    def _is_business_hours(self, timestamp: datetime) -> bool:
        """Check if timestamp is within business hours."""
        # Simplified: Monday-Friday, 9 AM - 5 PM UTC
        weekday = timestamp.weekday()  # 0 = Monday
        hour = timestamp.hour
        
        return weekday < 5 and 9 <= hour < 17
    
    def _features_to_vector(self, features: SLAModelFeatures) -> np.ndarray:
        """Convert features object to numpy vector."""
        return np.array([
            features.time_remaining_ratio,
            features.progress_ratio,
            features.business_hours_remaining,
            features.priority_score,
            features.tier_score,
            features.description_length,
            features.title_length,
            features.category_complexity,
            features.technician_skill_match,
            features.technician_workload,
            float(features.is_assigned),
            features.similar_tickets_avg_time,
            features.customer_avg_response_time,
            features.technician_avg_resolution_time,
            features.hour_of_day,
            features.day_of_week,
            float(features.is_business_hours),
            features.escalation_level,
            features.time_since_last_update,
            features.response_velocity
        ])
    
    async def _train_with_synthetic_data(self):
        """Train model with synthetic data for initial deployment."""
        try:
            logger.info("Training SLA prediction model with synthetic data")
            
            # Generate synthetic training data
            training_data = self._generate_synthetic_training_data(1000)
            
            if len(training_data) > 0:
                await self.train_model(training_data)
                logger.info("Model trained successfully with synthetic data")
            
        except Exception as e:
            logger.error(f"Failed to train with synthetic data: {str(e)}")
    
    def _generate_synthetic_training_data(self, num_samples: int) -> List[SLATrainingData]:
        """Generate synthetic training data for initial model training."""
        training_data = []
        
        for i in range(num_samples):
            # Random feature values
            time_remaining_ratio = np.random.uniform(0, 1)
            progress_ratio = np.random.uniform(0, 1)
            priority_score = np.random.randint(1, 5)
            tier_score = np.random.randint(1, 4)
            
            # Create synthetic features
            features = SLAModelFeatures(
                time_remaining_ratio=time_remaining_ratio,
                progress_ratio=progress_ratio,
                business_hours_remaining=np.random.uniform(0, 40),
                priority_score=priority_score,
                tier_score=tier_score,
                description_length=np.random.randint(50, 500),
                title_length=np.random.randint(10, 100),
                category_complexity=np.random.uniform(0.3, 0.9),
                technician_skill_match=np.random.uniform(0.3, 1.0),
                technician_workload=np.random.uniform(0.2, 1.0),
                is_assigned=np.random.choice([True, False]),
                similar_tickets_avg_time=np.random.uniform(60, 1440),
                customer_avg_response_time=np.random.uniform(30, 480),
                technician_avg_resolution_time=np.random.uniform(60, 1440),
                hour_of_day=np.random.randint(0, 24),
                day_of_week=np.random.randint(0, 7),
                is_business_hours=np.random.choice([True, False]),
                escalation_level=np.random.randint(0, 3),
                time_since_last_update=np.random.uniform(0, 48),
                response_velocity=np.random.uniform(0.1, 2.0)
            )
            
            # Calculate synthetic target based on logical rules
            breach_prob = self._calculate_synthetic_breach_probability(features)
            actual_outcome = breach_prob > 0.5
            
            training_data.append(SLATrainingData(
                features=features,
                target=breach_prob,
                actual_outcome=actual_outcome,
                ticket_metadata={"synthetic": True, "sample_id": i}
            ))
        
        return training_data
    
    def _calculate_synthetic_breach_probability(self, features: SLAModelFeatures) -> float:
        """Calculate synthetic breach probability based on logical rules."""
        # Base risk from time remaining
        base_risk = 1.0 - features.time_remaining_ratio
        
        # Adjust for progress
        if features.progress_ratio < features.time_remaining_ratio:
            base_risk *= 1.5  # Behind schedule
        else:
            base_risk *= 0.8  # On or ahead of schedule
        
        # Adjust for priority
        base_risk *= (features.priority_score / 4.0) * 1.2
        
        # Adjust for assignment and workload
        if not features.is_assigned:
            base_risk *= 1.4
        elif features.technician_workload > 0.8:
            base_risk *= 1.3
        
        # Adjust for complexity
        base_risk *= (0.7 + features.category_complexity * 0.6)
        
        # Add some noise
        noise = np.random.normal(0, 0.1)
        base_risk += noise
        
        return max(0.0, min(1.0, base_risk))
    
    async def train_model(self, training_data: List[SLATrainingData]):
        """Train the SLA prediction model with provided data."""
        try:
            if len(training_data) < 10:
                logger.warning("Insufficient training data for model training")
                return
            
            # Prepare feature matrix and target vector
            X = []
            y = []
            
            for data in training_data:
                feature_vector = self._features_to_vector(data.features)
                X.append(feature_vector)
                y.append(data.target)
            
            X = np.array(X)
            y = np.array(y)
            
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )
            
            # Scale features
            self.scaler = StandardScaler()
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_test_scaled = self.scaler.transform(X_test)
            
            # Train model
            self.model = GradientBoostingRegressor(
                n_estimators=100,
                learning_rate=0.1,
                max_depth=6,
                random_state=42
            )
            
            self.model.fit(X_train_scaled, y_train)
            
            # Evaluate model
            train_predictions = self.model.predict(X_train_scaled)
            test_predictions = self.model.predict(X_test_scaled)
            
            train_mse = mean_squared_error(y_train, train_predictions)
            test_mse = mean_squared_error(y_test, test_predictions)
            
            logger.info(f"Model training completed - Train MSE: {train_mse:.4f}, Test MSE: {test_mse:.4f}")
            
            # Save model
            os.makedirs("models", exist_ok=True)
            joblib.dump(self.model, self.model_path)
            joblib.dump(self.scaler, self.scaler_path)
            
            self.is_trained = True
            
        except Exception as e:
            logger.error(f"Model training failed: {str(e)}")
            raise


# Global service instance
sla_prediction_service = SLAPredictionService()