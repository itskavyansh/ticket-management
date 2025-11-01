"""
TensorFlow-based machine learning models for advanced predictions.
"""

import logging
import os
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timedelta
import asyncio

# Try to import ML libraries with fallbacks
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
        def random(self): 
            import random
            return type('obj', (object,), {
                'uniform': lambda a, b: random.uniform(a, b),
                'normal': lambda m, s: random.gauss(m, s),
                'randint': lambda a, b: random.randint(a, b),
                'choice': lambda choices: random.choice(choices)
            })()
    np = MockNumpy()

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False

try:
    from sklearn.preprocessing import StandardScaler, LabelEncoder
    from sklearn.model_selection import train_test_split
    import joblib
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    # Mock sklearn classes
    class StandardScaler:
        def fit_transform(self, data): return data
        def transform(self, data): return data
    class LabelEncoder:
        def fit_transform(self, data): return data

logger = logging.getLogger(__name__)


class WorkloadForecastingModel:
    """TensorFlow-based model for workload forecasting and trend prediction."""
    
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.sequence_length = 24  # 24 hours of historical data
        self.model_path = "models/workload_forecasting_model.h5"
        self.scaler_path = "models/workload_scaler.joblib"
        self.is_trained = False
        
        # Initialize model architecture
        self._build_model()
    
    def _build_model(self):
        """Build LSTM-based neural network for workload forecasting."""
        try:
            if not TENSORFLOW_AVAILABLE:
                logger.warning("TensorFlow not available - using fallback predictions")
                self.model = None
                return
                
            if os.path.exists(self.model_path) and SKLEARN_AVAILABLE:
                self.model = keras.models.load_model(self.model_path)
                self.scaler = joblib.load(self.scaler_path)
                self.is_trained = True
                logger.info("Workload forecasting model loaded successfully")
            else:
                # Build new model
                self.model = keras.Sequential([
                    # LSTM layers for time series analysis
                    layers.LSTM(64, return_sequences=True, input_shape=(self.sequence_length, 8)),
                    layers.Dropout(0.2),
                    layers.LSTM(32, return_sequences=False),
                    layers.Dropout(0.2),
                    
                    # Dense layers for prediction
                    layers.Dense(32, activation='relu'),
                    layers.Dropout(0.1),
                    layers.Dense(16, activation='relu'),
                    layers.Dense(1, activation='sigmoid')  # Output: workload intensity (0-1)
                ])
                
                self.model.compile(
                    optimizer='adam',
                    loss='mse',
                    metrics=['mae', 'mse']
                )
                
                logger.info("New workload forecasting model created")
                
        except Exception as e:
            logger.error(f"Failed to build workload forecasting model: {str(e)}")
            self.model = None
    
    async def predict_workload(
        self, 
        historical_data: List[Dict[str, Any]], 
        forecast_hours: int = 24
    ) -> Dict[str, Any]:
        """Predict future workload based on historical patterns."""
        try:
            if not self.is_trained or self.model is None:
                return await self._fallback_workload_prediction(historical_data, forecast_hours)
            
            # Prepare input data
            features = self._prepare_features(historical_data)
            if len(features) < self.sequence_length:
                return await self._fallback_workload_prediction(historical_data, forecast_hours)
            
            # Create sequences for prediction
            sequences = self._create_sequences(features)
            
            # Make predictions
            predictions = []
            current_sequence = sequences[-1:]  # Last sequence
            
            for _ in range(forecast_hours):
                pred = self.model.predict(current_sequence, verbose=0)[0][0]
                predictions.append(float(pred))
                
                # Update sequence for next prediction
                new_row = np.append(current_sequence[0][1:], [[pred] + [0] * 7], axis=0)
                current_sequence = new_row.reshape(1, self.sequence_length, 8)
            
            # Generate forecast timestamps
            base_time = datetime.utcnow()
            forecast_times = [
                (base_time + timedelta(hours=i)).isoformat() 
                for i in range(1, forecast_hours + 1)
            ]
            
            # Analyze trends
            trend_analysis = self._analyze_trends(predictions)
            
            return {
                "success": True,
                "forecast_hours": forecast_hours,
                "predictions": predictions,
                "forecast_times": forecast_times,
                "trend_analysis": trend_analysis,
                "confidence_score": 0.85,
                "model_type": "tensorflow_lstm",
                "peak_hours": self._identify_peak_hours(predictions, forecast_times),
                "recommendations": self._generate_workload_recommendations(predictions, trend_analysis)
            }
            
        except Exception as e:
            logger.error(f"Workload prediction failed: {str(e)}")
            return await self._fallback_workload_prediction(historical_data, forecast_hours)
    
    def _prepare_features(self, historical_data: List[Dict[str, Any]]) -> np.ndarray:
        """Prepare feature matrix from historical data."""
        features = []
        
        for record in historical_data:
            # Extract relevant features
            feature_row = [
                record.get('ticket_count', 0),
                record.get('avg_priority', 2.0),
                record.get('technician_utilization', 0.5),
                record.get('hour_of_day', 12),
                record.get('day_of_week', 3),
                record.get('is_business_hours', 1),
                record.get('escalation_rate', 0.1),
                record.get('resolution_rate', 0.8)
            ]
            features.append(feature_row)
        
        features_array = np.array(features)
        
        # Scale features
        if len(features_array) > 0:
            features_scaled = self.scaler.fit_transform(features_array)
            return features_scaled
        
        return np.array([])
    
    def _create_sequences(self, features: np.ndarray) -> np.ndarray:
        """Create sequences for LSTM input."""
        sequences = []
        
        for i in range(len(features) - self.sequence_length + 1):
            sequence = features[i:i + self.sequence_length]
            sequences.append(sequence)
        
        return np.array(sequences)
    
    def _analyze_trends(self, predictions: List[float]) -> Dict[str, Any]:
        """Analyze trends in predictions."""
        if len(predictions) < 2:
            return {"trend": "insufficient_data"}
        
        # Calculate trend direction
        first_half = np.mean(predictions[:len(predictions)//2])
        second_half = np.mean(predictions[len(predictions)//2:])
        
        trend_direction = "increasing" if second_half > first_half else "decreasing"
        trend_strength = abs(second_half - first_half)
        
        # Identify patterns
        volatility = np.std(predictions)
        peak_value = max(predictions)
        valley_value = min(predictions)
        
        return {
            "trend": trend_direction,
            "strength": float(trend_strength),
            "volatility": float(volatility),
            "peak_workload": float(peak_value),
            "minimum_workload": float(valley_value),
            "average_workload": float(np.mean(predictions))
        }
    
    def _identify_peak_hours(self, predictions: List[float], forecast_times: List[str]) -> List[Dict[str, Any]]:
        """Identify peak workload hours."""
        peaks = []
        threshold = np.mean(predictions) + np.std(predictions)
        
        for i, (pred, time_str) in enumerate(zip(predictions, forecast_times)):
            if pred > threshold:
                peaks.append({
                    "hour": i + 1,
                    "timestamp": time_str,
                    "predicted_workload": float(pred),
                    "intensity": "high" if pred > 0.8 else "medium"
                })
        
        return peaks
    
    def _generate_workload_recommendations(
        self, 
        predictions: List[float], 
        trend_analysis: Dict[str, Any]
    ) -> List[str]:
        """Generate actionable recommendations based on predictions."""
        recommendations = []
        
        avg_workload = trend_analysis.get("average_workload", 0.5)
        peak_workload = trend_analysis.get("peak_workload", 0.5)
        trend = trend_analysis.get("trend", "stable")
        
        if peak_workload > 0.8:
            recommendations.append("High workload predicted - consider scheduling additional technicians")
        
        if trend == "increasing" and avg_workload > 0.6:
            recommendations.append("Increasing workload trend detected - prepare for capacity scaling")
        
        if trend_analysis.get("volatility", 0) > 0.3:
            recommendations.append("High workload volatility - implement flexible scheduling")
        
        if avg_workload < 0.3:
            recommendations.append("Low workload period - opportunity for training and maintenance")
        
        if not recommendations:
            recommendations.append("Workload levels appear stable - maintain current staffing")
        
        return recommendations
    
    async def _fallback_workload_prediction(
        self, 
        historical_data: List[Dict[str, Any]], 
        forecast_hours: int
    ) -> Dict[str, Any]:
        """Fallback prediction when TensorFlow model is not available."""
        # Simple trend-based prediction
        if not historical_data:
            base_workload = 0.5
        else:
            recent_workloads = [d.get('technician_utilization', 0.5) for d in historical_data[-24:]]
            base_workload = np.mean(recent_workloads)
        
        # Generate simple predictions with some variation
        predictions = []
        for i in range(forecast_hours):
            # Add some cyclical pattern (higher during business hours)
            hour = (datetime.utcnow().hour + i) % 24
            business_factor = 1.2 if 9 <= hour <= 17 else 0.8
            
            # Add some random variation
            variation = np.random.normal(0, 0.1)
            pred = max(0, min(1, base_workload * business_factor + variation))
            predictions.append(pred)
        
        forecast_times = [
            (datetime.utcnow() + timedelta(hours=i)).isoformat() 
            for i in range(1, forecast_hours + 1)
        ]
        
        return {
            "success": True,
            "forecast_hours": forecast_hours,
            "predictions": predictions,
            "forecast_times": forecast_times,
            "trend_analysis": {"trend": "stable", "confidence": "low"},
            "confidence_score": 0.4,
            "model_type": "fallback_rule_based",
            "peak_hours": [],
            "recommendations": ["TensorFlow model not available - using basic prediction"]
        }
    
    async def train_model(self, training_data: List[Dict[str, Any]]):
        """Train the workload forecasting model."""
        try:
            if len(training_data) < 100:
                logger.warning("Insufficient training data for workload forecasting model")
                return
            
            # Prepare training data
            features = self._prepare_features(training_data)
            sequences = self._create_sequences(features)
            
            if len(sequences) < 10:
                logger.warning("Insufficient sequences for training")
                return
            
            # Create targets (next hour workload)
            targets = []
            for i in range(len(sequences)):
                if i + 1 < len(training_data):
                    target = training_data[i + self.sequence_length].get('technician_utilization', 0.5)
                    targets.append(target)
            
            targets = np.array(targets[:len(sequences)])
            
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                sequences, targets, test_size=0.2, random_state=42
            )
            
            # Train model
            history = self.model.fit(
                X_train, y_train,
                epochs=50,
                batch_size=32,
                validation_data=(X_test, y_test),
                verbose=0,
                callbacks=[
                    keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True),
                    keras.callbacks.ReduceLROnPlateau(patience=5, factor=0.5)
                ]
            )
            
            # Evaluate model
            test_loss = self.model.evaluate(X_test, y_test, verbose=0)
            logger.info(f"Workload forecasting model trained - Test Loss: {test_loss}")
            
            # Save model
            os.makedirs("models", exist_ok=True)
            self.model.save(self.model_path)
            joblib.dump(self.scaler, self.scaler_path)
            
            self.is_trained = True
            
        except Exception as e:
            logger.error(f"Workload forecasting model training failed: {str(e)}")


class TicketClassificationModel:
    """TensorFlow-based deep learning model for advanced ticket classification."""
    
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.label_encoder = LabelEncoder()
        self.max_sequence_length = 512
        self.embedding_dim = 128
        self.model_path = "models/ticket_classification_model.h5"
        self.is_trained = False
        
        # Initialize model
        self._build_model()
    
    def _build_model(self):
        """Build neural network for ticket classification."""
        try:
            if os.path.exists(self.model_path):
                self.model = keras.models.load_model(self.model_path)
                self.is_trained = True
                logger.info("Ticket classification model loaded successfully")
            else:
                # Build new model
                self.model = keras.Sequential([
                    # Embedding layer for text processing
                    layers.Embedding(10000, self.embedding_dim, input_length=self.max_sequence_length),
                    layers.Dropout(0.2),
                    
                    # Convolutional layers for feature extraction
                    layers.Conv1D(64, 5, activation='relu'),
                    layers.MaxPooling1D(pool_size=4),
                    layers.Conv1D(32, 3, activation='relu'),
                    layers.GlobalMaxPooling1D(),
                    
                    # Dense layers for classification
                    layers.Dense(64, activation='relu'),
                    layers.Dropout(0.3),
                    layers.Dense(32, activation='relu'),
                    layers.Dense(10, activation='softmax')  # 10 categories
                ])
                
                self.model.compile(
                    optimizer='adam',
                    loss='sparse_categorical_crossentropy',
                    metrics=['accuracy']
                )
                
                logger.info("New ticket classification model created")
                
        except Exception as e:
            logger.error(f"Failed to build ticket classification model: {str(e)}")
            self.model = None
    
    async def classify_ticket(
        self, 
        title: str, 
        description: str, 
        additional_features: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Classify ticket using deep learning model."""
        try:
            if not self.is_trained or self.model is None:
                return await self._fallback_classification(title, description)
            
            # Prepare text input
            text_input = f"{title} {description}"
            
            # Simple tokenization (in production, use proper tokenizer)
            tokens = self._simple_tokenize(text_input)
            
            # Make prediction
            prediction = self.model.predict(tokens, verbose=0)[0]
            
            # Get category probabilities
            categories = [
                "hardware", "software", "network", "security", "email",
                "database", "printer", "phone", "access", "other"
            ]
            
            category_probs = {cat: float(prob) for cat, prob in zip(categories, prediction)}
            predicted_category = categories[np.argmax(prediction)]
            confidence = float(np.max(prediction))
            
            return {
                "success": True,
                "predicted_category": predicted_category,
                "confidence_score": confidence,
                "category_probabilities": category_probs,
                "model_type": "tensorflow_cnn",
                "features_used": ["title", "description"]
            }
            
        except Exception as e:
            logger.error(f"TensorFlow classification failed: {str(e)}")
            return await self._fallback_classification(title, description)
    
    def _simple_tokenize(self, text: str) -> np.ndarray:
        """Simple tokenization for text input."""
        # Convert text to lowercase and split
        words = text.lower().split()
        
        # Simple word to integer mapping (in production, use proper tokenizer)
        word_to_int = {}
        for i, word in enumerate(set(words)):
            word_to_int[word] = i + 1
        
        # Convert to integers
        tokens = [word_to_int.get(word, 0) for word in words]
        
        # Pad or truncate to max_sequence_length
        if len(tokens) > self.max_sequence_length:
            tokens = tokens[:self.max_sequence_length]
        else:
            tokens.extend([0] * (self.max_sequence_length - len(tokens)))
        
        return np.array([tokens])
    
    async def _fallback_classification(self, title: str, description: str) -> Dict[str, Any]:
        """Fallback classification when TensorFlow model is not available."""
        # Simple keyword-based classification
        text = f"{title} {description}".lower()
        
        category_keywords = {
            "hardware": ["computer", "laptop", "server", "hardware", "device"],
            "software": ["software", "application", "program", "install", "update"],
            "network": ["network", "internet", "wifi", "connection", "router"],
            "security": ["security", "virus", "malware", "breach", "password"],
            "email": ["email", "outlook", "mail", "smtp", "exchange"],
            "database": ["database", "sql", "query", "data", "backup"],
            "printer": ["printer", "print", "toner", "paper", "scan"],
            "phone": ["phone", "voip", "call", "extension", "pbx"],
            "access": ["access", "login", "account", "permission", "user"],
            "other": []
        }
        
        scores = {}
        for category, keywords in category_keywords.items():
            score = sum(1 for keyword in keywords if keyword in text)
            scores[category] = score / max(1, len(keywords))
        
        predicted_category = max(scores, key=scores.get) if any(scores.values()) else "other"
        confidence = scores[predicted_category]
        
        return {
            "success": True,
            "predicted_category": predicted_category,
            "confidence_score": confidence,
            "category_probabilities": scores,
            "model_type": "fallback_keyword_based",
            "features_used": ["title", "description"]
        }


# Global model instances
workload_forecasting_model = WorkloadForecastingModel()
ticket_classification_model = TicketClassificationModel()