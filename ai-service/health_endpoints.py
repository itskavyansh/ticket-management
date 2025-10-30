from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import PlainTextResponse
import time
import psutil
import asyncio
from datetime import datetime
from typing import Dict, Any, List
import logging
from .clients.gemini_client import GeminiClient
from .cache.redis_cache import RedisCache
from .services.triage_service import TriageService
from .services.sla_prediction_service import SLAPredictionService
from .services.resolution_service import ResolutionService

logger = logging.getLogger(__name__)

router = APIRouter()

class HealthChecker:
    def __init__(self):
        self.gemini_client = GeminiClient()
        self.redis_cache = RedisCache()
        self.triage_service = TriageService()
        self.sla_service = SLAPredictionService()
        self.resolution_service = ResolutionService()
        self.start_time = time.time()

    async def check_gemini_health(self) -> Dict[str, Any]:
        """Check Gemini API health"""
        try:
            start_time = time.time()
            # Simple API call to check connectivity
            models = await self.gemini_client.list_models()
            response_time = (time.time() - start_time) * 1000
            
            return {
                "status": "healthy",
                "response_time_ms": response_time,
                "models_available": len(models.get("data", [])),
                "last_check": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Gemini health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "last_check": datetime.utcnow().isoformat()
            }

    async def check_redis_health(self) -> Dict[str, Any]:
        """Check Redis cache health"""
        try:
            start_time = time.time()
            await self.redis_cache.ping()
            response_time = (time.time() - start_time) * 1000
            
            # Get Redis info
            info = await self.redis_cache.get_info()
            
            return {
                "status": "healthy",
                "response_time_ms": response_time,
                "connected_clients": info.get("connected_clients", 0),
                "used_memory": info.get("used_memory_human", "unknown"),
                "last_check": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "last_check": datetime.utcnow().isoformat()
            }

    async def check_ai_services_health(self) -> Dict[str, Any]:
        """Check AI services health"""
        services_health = {}
        
        # Check triage service
        try:
            start_time = time.time()
            test_result = await self.triage_service.health_check()
            response_time = (time.time() - start_time) * 1000
            
            services_health["triage"] = {
                "status": "healthy" if test_result else "unhealthy",
                "response_time_ms": response_time,
                "last_check": datetime.utcnow().isoformat()
            }
        except Exception as e:
            services_health["triage"] = {
                "status": "unhealthy",
                "error": str(e),
                "last_check": datetime.utcnow().isoformat()
            }

        # Check SLA prediction service
        try:
            start_time = time.time()
            test_result = await self.sla_service.health_check()
            response_time = (time.time() - start_time) * 1000
            
            services_health["sla_prediction"] = {
                "status": "healthy" if test_result else "unhealthy",
                "response_time_ms": response_time,
                "last_check": datetime.utcnow().isoformat()
            }
        except Exception as e:
            services_health["sla_prediction"] = {
                "status": "unhealthy",
                "error": str(e),
                "last_check": datetime.utcnow().isoformat()
            }

        # Check resolution service
        try:
            start_time = time.time()
            test_result = await self.resolution_service.health_check()
            response_time = (time.time() - start_time) * 1000
            
            services_health["resolution"] = {
                "status": "healthy" if test_result else "unhealthy",
                "response_time_ms": response_time,
                "last_check": datetime.utcnow().isoformat()
            }
        except Exception as e:
            services_health["resolution"] = {
                "status": "unhealthy",
                "error": str(e),
                "last_check": datetime.utcnow().isoformat()
            }

        return services_health

    def get_system_metrics(self) -> Dict[str, Any]:
        """Get system-level metrics"""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            return {
                "cpu_percent": cpu_percent,
                "memory": {
                    "total": memory.total,
                    "available": memory.available,
                    "percent": memory.percent,
                    "used": memory.used
                },
                "disk": {
                    "total": disk.total,
                    "used": disk.used,
                    "free": disk.free,
                    "percent": (disk.used / disk.total) * 100
                },
                "uptime_seconds": time.time() - self.start_time
            }
        except Exception as e:
            logger.error(f"Failed to get system metrics: {e}")
            return {"error": str(e)}

health_checker = HealthChecker()

@router.get("/health")
async def get_health():
    """Basic health check endpoint"""
    try:
        # Quick health check
        system_metrics = health_checker.get_system_metrics()
        
        # Determine overall status
        status = "healthy"
        if system_metrics.get("cpu_percent", 0) > 90:
            status = "degraded"
        if system_metrics.get("memory", {}).get("percent", 0) > 90:
            status = "degraded"
        
        return {
            "status": status,
            "timestamp": datetime.utcnow().isoformat(),
            "uptime": system_metrics.get("uptime_seconds", 0),
            "version": "1.0.0",
            "service": "ai-processing-service"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e)
        }

@router.get("/health/detailed")
async def get_detailed_health():
    """Detailed health check with all dependencies"""
    try:
        # Get all health checks
        openai_health = await health_checker.check_openai_health()
        redis_health = await health_checker.check_redis_health()
        ai_services_health = await health_checker.check_ai_services_health()
        system_metrics = health_checker.get_system_metrics()
        
        # Determine overall status
        all_services = [openai_health, redis_health] + list(ai_services_health.values())
        unhealthy_services = [s for s in all_services if s.get("status") != "healthy"]
        
        if len(unhealthy_services) == 0:
            overall_status = "healthy"
        elif len(unhealthy_services) <= len(all_services) / 2:
            overall_status = "degraded"
        else:
            overall_status = "unhealthy"
        
        return {
            "status": overall_status,
            "timestamp": datetime.utcnow().isoformat(),
            "system": system_metrics,
            "dependencies": {
                "openai": openai_health,
                "redis": redis_health
            },
            "services": ai_services_health,
            "summary": {
                "total_services": len(all_services),
                "healthy_services": len(all_services) - len(unhealthy_services),
                "unhealthy_services": len(unhealthy_services)
            }
        }
    except Exception as e:
        logger.error(f"Detailed health check failed: {e}")
        return {
            "status": "error",
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e)
        }

@router.get("/health/ready")
async def get_readiness():
    """Kubernetes readiness probe"""
    try:
        checks = []
        failed_checks = []
        
        # Check OpenAI connectivity
        openai_health = await health_checker.check_openai_health()
        if openai_health["status"] == "healthy":
            checks.append({"name": "openai", "status": "pass"})
        else:
            checks.append({"name": "openai", "status": "fail", "details": openai_health.get("error")})
            failed_checks.append("openai")
        
        # Check Redis connectivity
        redis_health = await health_checker.check_redis_health()
        if redis_health["status"] == "healthy":
            checks.append({"name": "redis", "status": "pass"})
        else:
            checks.append({"name": "redis", "status": "fail", "details": redis_health.get("error")})
            failed_checks.append("redis")
        
        # Check AI services
        ai_services = await health_checker.check_ai_services_health()
        for service_name, service_health in ai_services.items():
            if service_health["status"] == "healthy":
                checks.append({"name": service_name, "status": "pass"})
            else:
                checks.append({"name": service_name, "status": "fail", "details": service_health.get("error")})
                failed_checks.append(service_name)
        
        ready = len(failed_checks) == 0
        status_code = 200 if ready else 503
        
        response = {
            "status": "ready" if ready else "not_ready",
            "timestamp": datetime.utcnow().isoformat(),
            "checks": checks
        }
        
        if failed_checks:
            response["failed_checks"] = failed_checks
        
        return response
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        raise HTTPException(status_code=503, detail="Readiness check failed")

@router.get("/health/live")
async def get_liveness():
    """Kubernetes liveness probe"""
    try:
        # Basic liveness checks
        system_metrics = health_checker.get_system_metrics()
        
        # Check if system is responsive
        if system_metrics.get("error"):
            raise HTTPException(status_code=503, detail="System metrics unavailable")
        
        # Check memory usage
        memory_percent = system_metrics.get("memory", {}).get("percent", 0)
        if memory_percent > 95:
            raise HTTPException(status_code=503, detail="Memory usage critical")
        
        # Check disk usage
        disk_percent = system_metrics.get("disk", {}).get("percent", 0)
        if disk_percent > 95:
            raise HTTPException(status_code=503, detail="Disk usage critical")
        
        return {
            "status": "alive",
            "timestamp": datetime.utcnow().isoformat(),
            "uptime": system_metrics.get("uptime_seconds", 0)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Liveness check failed: {e}")
        raise HTTPException(status_code=503, detail="Liveness check failed")

@router.get("/health/metrics")
async def get_metrics():
    """Application metrics endpoint"""
    try:
        system_metrics = health_checker.get_system_metrics()
        openai_health = await health_checker.check_openai_health()
        redis_health = await health_checker.check_redis_health()
        ai_services_health = await health_checker.check_ai_services_health()
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "system": system_metrics,
            "performance": {
                "openai_response_time": openai_health.get("response_time_ms", 0),
                "redis_response_time": redis_health.get("response_time_ms", 0),
                "ai_services": {
                    name: service.get("response_time_ms", 0)
                    for name, service in ai_services_health.items()
                }
            },
            "availability": {
                "openai": openai_health["status"] == "healthy",
                "redis": redis_health["status"] == "healthy",
                "ai_services": {
                    name: service["status"] == "healthy"
                    for name, service in ai_services_health.items()
                }
            }
        }
    except Exception as e:
        logger.error(f"Metrics collection failed: {e}")
        raise HTTPException(status_code=500, detail="Metrics collection failed")

@router.get("/health/metrics/prometheus", response_class=PlainTextResponse)
async def get_prometheus_metrics():
    """Prometheus-compatible metrics endpoint"""
    try:
        system_metrics = health_checker.get_system_metrics()
        openai_health = await health_checker.check_openai_health()
        redis_health = await health_checker.check_redis_health()
        ai_services_health = await health_checker.check_ai_services_health()
        
        metrics_output = []
        
        # System metrics
        metrics_output.append("# HELP ai_service_uptime_seconds Service uptime in seconds")
        metrics_output.append("# TYPE ai_service_uptime_seconds gauge")
        metrics_output.append(f"ai_service_uptime_seconds {system_metrics.get('uptime_seconds', 0)}")
        
        metrics_output.append("# HELP ai_service_cpu_percent CPU usage percentage")
        metrics_output.append("# TYPE ai_service_cpu_percent gauge")
        metrics_output.append(f"ai_service_cpu_percent {system_metrics.get('cpu_percent', 0)}")
        
        metrics_output.append("# HELP ai_service_memory_percent Memory usage percentage")
        metrics_output.append("# TYPE ai_service_memory_percent gauge")
        memory_percent = system_metrics.get("memory", {}).get("percent", 0)
        metrics_output.append(f"ai_service_memory_percent {memory_percent}")
        
        # Service availability
        metrics_output.append("# HELP ai_service_dependency_up Dependency availability (1=up, 0=down)")
        metrics_output.append("# TYPE ai_service_dependency_up gauge")
        
        openai_up = 1 if openai_health["status"] == "healthy" else 0
        metrics_output.append(f'ai_service_dependency_up{{dependency="openai"}} {openai_up}')
        
        redis_up = 1 if redis_health["status"] == "healthy" else 0
        metrics_output.append(f'ai_service_dependency_up{{dependency="redis"}} {redis_up}')
        
        # AI service availability
        for service_name, service_health in ai_services_health.items():
            service_up = 1 if service_health["status"] == "healthy" else 0
            metrics_output.append(f'ai_service_dependency_up{{dependency="{service_name}"}} {service_up}')
        
        # Response times
        metrics_output.append("# HELP ai_service_response_time_ms Response time in milliseconds")
        metrics_output.append("# TYPE ai_service_response_time_ms gauge")
        
        openai_time = openai_health.get("response_time_ms", 0)
        metrics_output.append(f'ai_service_response_time_ms{{service="openai"}} {openai_time}')
        
        redis_time = redis_health.get("response_time_ms", 0)
        metrics_output.append(f'ai_service_response_time_ms{{service="redis"}} {redis_time}')
        
        for service_name, service_health in ai_services_health.items():
            service_time = service_health.get("response_time_ms", 0)
            metrics_output.append(f'ai_service_response_time_ms{{service="{service_name}"}} {service_time}')
        
        return "\n".join(metrics_output) + "\n"
    except Exception as e:
        logger.error(f"Prometheus metrics collection failed: {e}")
        return "# Metrics collection failed\n"

@router.get("/health/service/{service_name}")
async def get_service_health(service_name: str):
    """Service-specific health check"""
    try:
        if service_name == "openai":
            health = await health_checker.check_openai_health()
        elif service_name == "redis":
            health = await health_checker.check_redis_health()
        elif service_name in ["triage", "sla_prediction", "resolution"]:
            ai_services = await health_checker.check_ai_services_health()
            health = ai_services.get(service_name)
            if not health:
                raise HTTPException(status_code=404, detail=f"Service '{service_name}' not found")
        else:
            raise HTTPException(status_code=404, detail=f"Service '{service_name}' not found")
        
        status_code = 200 if health["status"] == "healthy" else 503
        
        return {
            "service": service_name,
            "status": health["status"],
            "timestamp": datetime.utcnow().isoformat(),
            "details": health
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Service health check failed for {service_name}: {e}")
        raise HTTPException(status_code=500, detail="Service health check failed")

# Add health check methods to service classes
async def add_health_check_methods():
    """Add health check methods to AI service classes"""
    
    # Add to TriageService
    async def triage_health_check(self) -> bool:
        try:
            # Simple test classification
            test_ticket = {
                "title": "Health check test",
                "description": "This is a test ticket for health checking"
            }
            result = await self.classify_ticket(test_ticket)
            return result is not None and "category" in result
        except Exception:
            return False
    
    TriageService.health_check = triage_health_check
    
    # Add to SLAPredictionService
    async def sla_health_check(self) -> bool:
        try:
            # Simple test prediction
            test_data = {
                "priority": "Medium",
                "category": "General",
                "technician_workload": 0.5
            }
            result = await self.predict_sla_breach(test_data)
            return result is not None and "breach_probability" in result
        except Exception:
            return False
    
    SLAPredictionService.health_check = sla_health_check
    
    # Add to ResolutionService
    async def resolution_health_check(self) -> bool:
        try:
            # Simple test suggestion
            test_ticket = {
                "title": "Test issue",
                "description": "Test description for health check"
            }
            result = await self.get_suggestions(test_ticket)
            return result is not None and "suggestions" in result
        except Exception:
            return False
    
    ResolutionService.health_check = resolution_health_check

# Initialize health check methods
asyncio.create_task(add_health_check_methods())