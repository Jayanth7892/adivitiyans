#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AdvitiyansStack } from '../lib/advitiyans-stack';

const app = new cdk.App();
new AdvitiyansStack(app, 'AdvitiyansStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || '071340280897',
    region: process.env.CDK_DEFAULT_REGION || 'ap-south-1',
  },
});
