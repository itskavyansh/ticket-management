#!/usr/bin/env python3
"""
AWS Deployment Script for AI Ticket Management Platform
Optimized for $100 AWS credits budget
"""

import os
import json
import subprocess
import sys
from pathlib import Path

class AWSDeployer:
    def __init__(self, budget_mode=True):
        self.budget_mode = budget_mode
        self.region = "us-east-1"  # Cheapest region
        self.project_name = "ai-ticket-mgmt"
        
    def check_prerequisites(self):
        """Check if AWS CLI and required tools are installed"""
        print("🔍 Checking prerequisites...")
        
        # Check AWS CLI
        try:
            result = subprocess.run(['aws', '--version'], capture_output=True, text=True)
            print(f"✅ AWS CLI: {result.stdout.strip()}")
        except FileNotFoundError:
            print("❌ AWS CLI not found. Install it first:")
            print("   https://aws.amazon.com/cli/")
            return False
            
        # Check Docker
        try:
            result = subprocess.run(['docker', '--version'], capture_output=True, text=True)
            print(f"✅ Docker: {result.stdout.strip()}")
        except FileNotFoundError:
            print("❌ Docker not found. Install Docker Desktop first.")
            return False
            
        return True
    
    def setup_aws_credentials(self):
        """Guide user through AWS credentials setup"""
        print("\n🔑 Setting up AWS credentials...")
        
        # Check if credentials exist
        try:
            result = subprocess.run(['aws', 'sts', 'get-caller-identity'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                identity = json.loads(result.stdout)
                print(f"✅ AWS credentials configured for: {identity.get('Arn', 'Unknown')}")
                return True
        except:
            pass
            
        print("❌ AWS credentials not configured.")
        print("\n📋 To configure AWS credentials:")
        print("1. Go to AWS Console → IAM → Users → Your User → Security Credentials")
        print("2. Create Access Key")
        print("3. Run: aws configure")
        print("4. Enter your Access Key ID and Secret Access Key")
        print(f"5. Set region to: {self.region}")
        print("6. Set output format to: json")
        
        return False
    
    def create_infrastructure(self):
        """Create AWS infrastructure using CloudFormation"""
        print("\n🏗️ Creating AWS infrastructure...")
        
        # Create CloudFormation template
        template = self.generate_cloudformation_template()
        
        # Write template to file
        template_path = "aws-infrastructure.yaml"
        with open(template_path, 'w') as f:
            f.write(template)
        
        print(f"📄 CloudFormation template created: {template_path}")
        
        # Deploy stack
        stack_name = f"{self.project_name}-stack"
        cmd = [
            'aws', 'cloudformation', 'deploy',
            '--template-file', template_path,
            '--stack-name', stack_name,
            '--capabilities', 'CAPABILITY_IAM',
            '--region', self.region,
            '--parameter-overrides',
            f'ProjectName={self.project_name}',
            f'Environment=hackathon'
        ]
        
        print(f"🚀 Deploying stack: {stack_name}")
        print("This may take 10-15 minutes...")
        
        try:
            result = subprocess.run(cmd, check=True, capture_output=True, text=True)
            print("✅ Infrastructure deployed successfully!")
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ Deployment failed: {e.stderr}")
            return False
    
    def generate_cloudformation_template(self):
        """Generate optimized CloudFormation template for hackathon demo with monitoring"""
        return """
AWSTemplateFormatVersion: '2010-09-09'
Description: 'AI Ticket Management Platform - Hackathon Demo with Monitoring'

Parameters:
  ProjectName:
    Type: String
    Default: ai-ticket-mgmt
  Environment:
    Type: String
    Default: hackathon

Resources:
  # VPC and Networking (Free)
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub '${ProjectName}-vpc'
        - Key: Environment
          Value: !Ref Environment

  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub '${ProjectName}-public-1'

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.2.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub '${ProjectName}-public-2'

  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Properties:
      Tags:
        - Key: Name
          Value: !Sub '${ProjectName}-igw'

  AttachGateway:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref VPC
      InternetGatewayId: !Ref InternetGateway

  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC
      Tags:
        - Key: Name
          Value: !Sub '${ProjectName}-public-rt'

  PublicRoute:
    Type: AWS::EC2::Route
    DependsOn: AttachGateway
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway

  PublicSubnetRouteTableAssociation1:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnet1
      RouteTableId: !Ref PublicRouteTable

  PublicSubnetRouteTableAssociation2:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnet2
      RouteTableId: !Ref PublicRouteTable

  # Security Groups
  WebSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for web servers
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
          Description: HTTP access
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0
          Description: HTTPS access
        - IpProtocol: tcp
          FromPort: 3000
          ToPort: 3001
          CidrIp: 0.0.0.0/0
          Description: Application ports
        - IpProtocol: tcp
          FromPort: 8001
          ToPort: 8001
          CidrIp: 0.0.0.0/0
          Description: AI service port
        - IpProtocol: tcp
          FromPort: 22
          ToPort: 22
          CidrIp: 0.0.0.0/0
          Description: SSH access

  # IAM Role for EC2 CloudWatch access
  EC2CloudWatchRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ec2.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy
        - arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
      Policies:
        - PolicyName: CustomMetricsPolicy
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - cloudwatch:PutMetricData
                  - cloudwatch:GetMetricStatistics
                  - cloudwatch:ListMetrics
                  - logs:CreateLogGroup
                  - logs:CreateLogStream
                  - logs:PutLogEvents
                Resource: '*'

  EC2InstanceProfile:
    Type: AWS::IAM::InstanceProfile
    Properties:
      Roles:
        - !Ref EC2CloudWatchRole

  # EC2 Instance with monitoring
  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: ami-0c02fb55956c7d316  # Amazon Linux 2
      InstanceType: t3.micro  # Free tier eligible
      KeyName: !Ref KeyPair
      IamInstanceProfile: !Ref EC2InstanceProfile
      SecurityGroupIds:
        - !Ref WebSecurityGroup
      SubnetId: !Ref PublicSubnet1
      UserData:
        Fn::Base64: !Sub |
          #!/bin/bash
          yum update -y
          yum install -y docker git amazon-cloudwatch-agent
          
          # Start Docker
          service docker start
          usermod -a -G docker ec2-user
          
          # Install Docker Compose
          curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
          chmod +x /usr/local/bin/docker-compose
          
          # Install Node.js
          curl -sL https://rpm.nodesource.com/setup_18.x | bash -
          yum install -y nodejs
          
          # Install Python 3.9
          yum install -y python3 python3-pip
          
          # Configure CloudWatch Agent
          cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'EOF'
          {
            "metrics": {
              "namespace": "AI-Ticket-Platform",
              "metrics_collected": {
                "cpu": {
                  "measurement": ["cpu_usage_idle", "cpu_usage_iowait", "cpu_usage_user", "cpu_usage_system"],
                  "metrics_collection_interval": 60
                },
                "disk": {
                  "measurement": ["used_percent"],
                  "metrics_collection_interval": 60,
                  "resources": ["*"]
                },
                "mem": {
                  "measurement": ["mem_used_percent"],
                  "metrics_collection_interval": 60
                },
                "netstat": {
                  "measurement": ["tcp_established", "tcp_time_wait"],
                  "metrics_collection_interval": 60
                }
              }
            },
            "logs": {
              "logs_collected": {
                "files": {
                  "collect_list": [
                    {
                      "file_path": "/var/log/messages",
                      "log_group_name": "/aws/ec2/ai-ticket-platform/system",
                      "log_stream_name": "{instance_id}/messages"
                    },
                    {
                      "file_path": "/home/ec2-user/ai-ticket-platform/logs/application.log",
                      "log_group_name": "/aws/ec2/ai-ticket-platform/application",
                      "log_stream_name": "{instance_id}/application"
                    }
                  ]
                }
              }
            }
          }
          EOF
          
          # Start CloudWatch Agent
          /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s
          
          # Create application directory
          mkdir -p /home/ec2-user/ai-ticket-platform/logs
          chown -R ec2-user:ec2-user /home/ec2-user/ai-ticket-platform
          
          # Install monitoring script
          cat > /home/ec2-user/monitor_app.sh << 'EOF'
          #!/bin/bash
          # Application monitoring script
          
          while true; do
            # Check if services are running
            BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "000")
            FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 || echo "000")
            AI_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/health || echo "000")
            
            # Send custom metrics to CloudWatch
            aws cloudwatch put-metric-data --namespace "AI-Ticket-Platform/Health" --metric-data MetricName=BackendHealth,Value=$([[ "$BACKEND_STATUS" == "200" ]] && echo 1 || echo 0),Unit=Count
            aws cloudwatch put-metric-data --namespace "AI-Ticket-Platform/Health" --metric-data MetricName=FrontendHealth,Value=$([[ "$FRONTEND_STATUS" == "200" ]] && echo 1 || echo 0),Unit=Count
            aws cloudwatch put-metric-data --namespace "AI-Ticket-Platform/Health" --metric-data MetricName=AIServiceHealth,Value=$([[ "$AI_STATUS" == "200" ]] && echo 1 || echo 0),Unit=Count
            
            sleep 60
          done
          EOF
          
          chmod +x /home/ec2-user/monitor_app.sh
          chown ec2-user:ec2-user /home/ec2-user/monitor_app.sh
          
          # Start monitoring in background
          nohup sudo -u ec2-user /home/ec2-user/monitor_app.sh > /dev/null 2>&1 &
          
      Tags:
        - Key: Name
          Value: !Sub '${ProjectName}-web-server'
        - Key: Environment
          Value: !Ref Environment
        - Key: Monitoring
          Value: enabled

  # Key Pair for EC2 access
  KeyPair:
    Type: AWS::EC2::KeyPair
    Properties:
      KeyName: !Sub '${ProjectName}-keypair'

  # ElastiCache Redis (Smallest instance)
  CacheSubnetGroup:
    Type: AWS::ElastiCache::SubnetGroup
    Properties:
      Description: Subnet group for ElastiCache
      SubnetIds:
        - !Ref PublicSubnet1
        - !Ref PublicSubnet2

  CacheSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for ElastiCache
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 6379
          ToPort: 6379
          SourceSecurityGroupId: !Ref WebSecurityGroup

  RedisCache:
    Type: AWS::ElastiCache::CacheCluster
    Properties:
      CacheNodeType: cache.t3.micro
      Engine: redis
      NumCacheNodes: 1
      VpcSecurityGroupIds:
        - !Ref CacheSecurityGroup
      CacheSubnetGroupName: !Ref CacheSubnetGroup
      Tags:
        - Key: Name
          Value: !Sub '${ProjectName}-redis'

  # CloudWatch Alarms
  HighCPUAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub '${ProjectName}-high-cpu'
      AlarmDescription: 'High CPU utilization'
      MetricName: CPUUtilization
      Namespace: AWS/EC2
      Statistic: Average
      Period: 300
      EvaluationPeriods: 2
      Threshold: 80
      ComparisonOperator: GreaterThanThreshold
      Dimensions:
        - Name: InstanceId
          Value: !Ref WebServer
      AlarmActions:
        - !Ref SNSAlarmTopic

  HighMemoryAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub '${ProjectName}-high-memory'
      AlarmDescription: 'High memory utilization'
      MetricName: mem_used_percent
      Namespace: AI-Ticket-Platform
      Statistic: Average
      Period: 300
      EvaluationPeriods: 2
      Threshold: 85
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Ref SNSAlarmTopic

  ApplicationHealthAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub '${ProjectName}-app-unhealthy'
      AlarmDescription: 'Application health check failed'
      MetricName: BackendHealth
      Namespace: AI-Ticket-Platform/Health
      Statistic: Average
      Period: 300
      EvaluationPeriods: 2
      Threshold: 1
      ComparisonOperator: LessThanThreshold
      AlarmActions:
        - !Ref SNSAlarmTopic

  # SNS Topic for Alarms
  SNSAlarmTopic:
    Type: AWS::SNS::Topic
    Properties:
      TopicName: !Sub '${ProjectName}-alarms'
      DisplayName: 'AI Ticket Platform Alarms'

  # CloudWatch Dashboard
  MonitoringDashboard:
    Type: AWS::CloudWatch::Dashboard
    Properties:
      DashboardName: !Sub '${ProjectName}-monitoring'
      DashboardBody: !Sub |
        {
          "widgets": [
            {
              "type": "metric",
              "x": 0,
              "y": 0,
              "width": 12,
              "height": 6,
              "properties": {
                "metrics": [
                  [ "AWS/EC2", "CPUUtilization", "InstanceId", "${WebServer}" ],
                  [ "AI-Ticket-Platform", "mem_used_percent", "InstanceId", "${WebServer}" ]
                ],
                "period": 300,
                "stat": "Average",
                "region": "${AWS::Region}",
                "title": "System Resources"
              }
            },
            {
              "type": "metric",
              "x": 12,
              "y": 0,
              "width": 12,
              "height": 6,
              "properties": {
                "metrics": [
                  [ "AI-Ticket-Platform/Health", "BackendHealth" ],
                  [ ".", "FrontendHealth" ],
                  [ ".", "AIServiceHealth" ]
                ],
                "period": 300,
                "stat": "Average",
                "region": "${AWS::Region}",
                "title": "Application Health"
              }
            }
          ]
        }

Outputs:
  WebServerPublicIP:
    Description: Public IP of the web server
    Value: !GetAtt WebServer.PublicIp
    Export:
      Name: !Sub '${ProjectName}-web-server-ip'
  
  ApplicationURL:
    Description: Application URL
    Value: !Sub 'http://${WebServer.PublicIp}:3001'
    Export:
      Name: !Sub '${ProjectName}-app-url'
  
  APIEndpoint:
    Description: API Endpoint
    Value: !Sub 'http://${WebServer.PublicIp}:3000'
    Export:
      Name: !Sub '${ProjectName}-api-endpoint'
  
  AIServiceEndpoint:
    Description: AI Service Endpoint
    Value: !Sub 'http://${WebServer.PublicIp}:8001'
    Export:
      Name: !Sub '${ProjectName}-ai-endpoint'
  
  RedisEndpoint:
    Description: ElastiCache Redis endpoint
    Value: !GetAtt RedisCache.RedisEndpoint.Address
    Export:
      Name: !Sub '${ProjectName}-redis-endpoint'
  
  MonitoringDashboard:
    Description: CloudWatch Dashboard URL
    Value: !Sub 'https://${AWS::Region}.console.aws.amazon.com/cloudwatch/home?region=${AWS::Region}#dashboards:name=${ProjectName}-monitoring'
    Export:
      Name: !Sub '${ProjectName}-dashboard-url'
  
  SNSAlarmTopic:
    Description: SNS Topic for Alarms
    Value: !Ref SNSAlarmTopic
    Export:
      Name: !Sub '${ProjectName}-alarm-topic'
"""

    def deploy_application(self):
        """Deploy the application to EC2"""
        print("\n🚀 Deploying application...")
        
        # Get EC2 instance IP
        try:
            result = subprocess.run([
                'aws', 'cloudformation', 'describe-stacks',
                '--stack-name', f'{self.project_name}-stack',
                '--query', 'Stacks[0].Outputs[?OutputKey==`WebServerPublicIP`].OutputValue',
                '--output', 'text',
                '--region', self.region
            ], capture_output=True, text=True, check=True)
            
            server_ip = result.stdout.strip()
            print(f"📍 Server IP: {server_ip}")
            
            # Create deployment script
            self.create_deployment_script(server_ip)
            
            return True
            
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to get server IP: {e.stderr}")
            return False
    
    def create_deployment_script(self, server_ip):
        """Create script to deploy application to EC2"""
        script_content = f"""#!/bin/bash
# Deployment script for AI Ticket Management Platform

SERVER_IP="{server_ip}"
KEY_FILE="{self.project_name}-keypair.pem"

echo "🚀 Deploying to AWS EC2: $SERVER_IP"

# Create environment files with AWS endpoints
echo "📝 Creating production environment files..."

# Get AWS resource endpoints
DB_ENDPOINT=$(aws cloudformation describe-stacks \\
    --stack-name {self.project_name}-stack \\
    --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \\
    --output text --region {self.region})

REDIS_ENDPOINT=$(aws cloudformation describe-stacks \\
    --stack-name {self.project_name}-stack \\
    --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpoint`].OutputValue' \\
    --output text --region {self.region})

# Create production .env files
cat > backend/.env.production << EOF
NODE_ENV=production
PORT=3000
FRONTEND_URL=http://$SERVER_IP:3001

# AWS Database
MONGODB_URI=postgresql://postgres:{self.project_name}Password123!@$DB_ENDPOINT:5432/ai_ticket_management
REDIS_HOST=$REDIS_ENDPOINT
REDIS_PORT=6379

# Your SuperOps API Key (update this!)
SUPEROPS_API_KEY=YOUR_ACTUAL_SUPEROPS_API_KEY
SUPEROPS_BASE_URL=https://api.superops.com

# AI Service
AI_SERVICE_URL=http://localhost:8001
GEMINI_API_KEY=$(cat ai-service/.env | grep GEMINI_API_KEY | cut -d'=' -f2)

# Security (generate new keys for production!)
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# AWS Configuration
AWS_REGION={self.region}
EOF

# Copy files to server
echo "📦 Copying files to server..."
scp -i $KEY_FILE -r . ec2-user@$SERVER_IP:/home/ec2-user/ai-ticket-platform/

# Setup and start services
echo "🔧 Setting up services on server..."
ssh -i $KEY_FILE ec2-user@$SERVER_IP << 'ENDSSH'
cd /home/ec2-user/ai-ticket-platform

# Copy production environment
cp backend/.env.production backend/.env
cp ai-service/.env ai-service/.env.production

# Build and start services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Wait for services to start
sleep 30

# Check service status
docker-compose ps
ENDSSH

echo "✅ Deployment complete!"
echo "🌐 Application URL: http://$SERVER_IP:3001"
echo "🔧 API URL: http://$SERVER_IP:3000"
echo "🤖 AI Service URL: http://$SERVER_IP:8001"
"""
        
        with open("deploy_app.sh", "w") as f:
            f.write(script_content)
        
        os.chmod("deploy_app.sh", 0o755)
        print("📄 Deployment script created: deploy_app.sh")
    
    def create_production_compose(self):
        """Create production docker-compose override"""
        prod_compose = """
version: '3.8'

services:
  backend:
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    
  frontend:
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    
  ai-service:
    restart: unless-stopped
    
  # Remove local databases - use AWS RDS and ElastiCache
  mongodb:
    profiles: ["local-only"]
    
  redis:
    profiles: ["local-only"]
"""
        
        with open("docker-compose.prod.yml", "w") as f:
            f.write(prod_compose)
        
        print("📄 Production compose file created: docker-compose.prod.yml")
    
    def setup_monitoring(self):
        """Setup basic monitoring and health checks"""
        print("\n📊 Setting up monitoring...")
        
        # Create health check script
        health_script = """#!/bin/bash
# Health check script for AI Ticket Management Platform

echo "🏥 Health Check Report - $(date)"
echo "=================================="

# Check services
services=("backend:3000" "frontend:3001" "ai-service:8001")

for service in "${services[@]}"; do
    name=$(echo $service | cut -d':' -f1)
    port=$(echo $service | cut -d':' -f2)
    
    if curl -s -f "http://localhost:$port/health" > /dev/null 2>&1; then
        echo "✅ $name (port $port): Healthy"
    else
        echo "❌ $name (port $port): Unhealthy"
    fi
done

# Check disk space
echo ""
echo "💾 Disk Usage:"
df -h / | tail -1

# Check memory
echo ""
echo "🧠 Memory Usage:"
free -h

# Check Docker containers
echo ""
echo "🐳 Docker Containers:"
docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"
"""
        
        with open("health_check.sh", "w") as f:
            f.write(health_script)
        
        os.chmod("health_check.sh", 0o755)
        print("📄 Health check script created: health_check.sh")
    
    def print_success_message(self):
        """Print success message with next steps"""
        print("\n🎉 AWS Deployment Setup Complete!")
        print("=" * 50)
        print("\n📋 Next Steps:")
        print("1. Update your SuperOps API key in backend/.env.production")
        print("2. Run: ./deploy_app.sh")
        print("3. Test your application")
        print("4. Setup domain name (optional)")
        print("\n💰 Estimated Monthly Cost: ~$43")
        print("📊 Your $100 credit will last ~2.3 months")
        print("\n🏆 You're ready for the hackathon demo!")

def main():
    """Main deployment function"""
    print("🚀 AI Ticket Management Platform - AWS Deployment")
    print("=" * 55)
    
    deployer = AWSDeployer(budget_mode=True)
    
    # Check prerequisites
    if not deployer.check_prerequisites():
        sys.exit(1)
    
    # Setup AWS credentials
    if not deployer.setup_aws_credentials():
        print("\n⚠️  Please configure AWS credentials and run again.")
        sys.exit(1)
    
    # Create production files
    deployer.create_production_compose()
    deployer.setup_monitoring()
    
    # Deploy infrastructure
    if deployer.create_infrastructure():
        # Deploy application
        if deployer.deploy_application():
            deployer.print_success_message()
        else:
            print("❌ Application deployment failed")
            sys.exit(1)
    else:
        print("❌ Infrastructure deployment failed")
        sys.exit(1)

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Deploy AI Ticket Management Platform to AWS')
    parser.add_argument('--budget-mode', action='store_true', 
                       help='Use budget-optimized configuration')
    
    args = parser.parse_args()
    
    if args.budget_mode:
        print("💰 Budget mode enabled - optimizing for $100 AWS credits")
    
    main()