#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AiTicketManagementStack } from '../lib/ai-ticket-management-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

new AiTicketManagementStack(app, 'AiTicketManagementStack', {
  env,
  description: 'AI-powered ticket management platform infrastructure',
});