import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface RouterStackProps extends cdk.StackProps {
  domainName: string;
  hostedZoneId: string;
  certificateArn: string;
  activeEnvironment: string;
  blueApiGatewayId: string;
  greenApiGatewayId: string;
}

export class RouterStack extends cdk.Stack {
  public readonly domainName: string;
  public readonly distribution: apigateway.DomainName;

  constructor(scope: Construct, id: string, props: RouterStackProps) {
    super(scope, id, props);

    // Create parameter for active environment
    const activeEnvironmentParam = new cdk.CfnParameter(this, 'ActiveEnvironment', {
      type: 'String',
   