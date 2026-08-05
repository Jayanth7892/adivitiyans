import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class AdvitiyansStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================================================
    // 1. VPC
    // ========================================================================
    const vpc = new ec2.Vpc(this, 'AdvitiyansVpc', {
      maxAzs: 2,
      natGateways: 0, // Cost optimized: avoid NatGateway hourly cost
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Gateway Endpoints for S3 (free, no NAT needed)
    vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // ========================================================================
    // 2. Security Groups
    // ========================================================================

    // Lambda Security Group
    const lambdaSg = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc,
      description: 'Security group for Lambda functions',
      allowAllOutbound: false,
    });

    // RDS Proxy Security Group
    const proxySg = new ec2.SecurityGroup(this, 'RdsProxySecurityGroup', {
      vpc,
      description: 'Security group for RDS Proxy',
      allowAllOutbound: false,
    });

    // RDS Instance Security Group
    const dbSg = new ec2.SecurityGroup(this, 'RdsSecurityGroup', {
      vpc,
      description: 'Security group for RDS PostgreSQL instance',
      allowAllOutbound: false,
    });

    // VPC Endpoint Security Group
    const vpceSecurityGroup = new ec2.SecurityGroup(this, 'VpceSecurityGroup', {
      vpc,
      description: 'Security group for VPC Interface Endpoints',
      allowAllOutbound: false,
    });

    // --- Security Group Rules ---
    // Lambda → RDS Proxy (port 5432)
    lambdaSg.addEgressRule(proxySg, ec2.Port.tcp(5432), 'Lambda to RDS Proxy');
    proxySg.addIngressRule(lambdaSg, ec2.Port.tcp(5432), 'Allow Lambda to RDS Proxy');

    // RDS Proxy → RDS (port 5432)
    proxySg.addEgressRule(dbSg, ec2.Port.tcp(5432), 'RDS Proxy to RDS');
    dbSg.addIngressRule(proxySg, ec2.Port.tcp(5432), 'Allow RDS Proxy to RDS');

    // Lambda → VPC Endpoints (port 443 for Secrets Manager, etc.)
    lambdaSg.addEgressRule(vpceSecurityGroup, ec2.Port.tcp(443), 'Lambda to VPC Endpoints');
    vpceSecurityGroup.addIngressRule(lambdaSg, ec2.Port.tcp(443), 'Allow Lambda to VPC Endpoints');

    // RDS Proxy → Secrets Manager VPC Endpoint (port 443)
    proxySg.addEgressRule(vpceSecurityGroup, ec2.Port.tcp(443), 'RDS Proxy to Secrets Manager');
    vpceSecurityGroup.addIngressRule(proxySg, ec2.Port.tcp(443), 'Allow RDS Proxy to Secrets Manager');

    // ========================================================================
    // 3. VPC Interface Endpoints (required: no NAT Gateway)
    // ========================================================================

    // Secrets Manager endpoint — needed by Lambda and RDS Proxy
    vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [vpceSecurityGroup],
      privateDnsEnabled: true,
    });

    // STS endpoint — needed for IAM authentication with RDS Proxy
    vpc.addInterfaceEndpoint('StsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.STS,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [vpceSecurityGroup],
      privateDnsEnabled: true,
    });

    // ========================================================================
    // 4. Database Secrets Manager
    // ========================================================================
    const dbSecret = new secretsmanager.Secret(this, 'AdvitiyansDbSecret', {
      secretName: 'advitiyans-db-credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludePunctuation: true,
      },
    });

    // ========================================================================
    // 5. RDS PostgreSQL Instance (db.t4g.micro, Single-AZ)
    // ========================================================================
    const dbInstance = new rds.DatabaseInstance(this, 'AdvitiyansRDS', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSg],
      allocatedStorage: 20,
      maxAllocatedStorage: 50,
      credentials: rds.Credentials.fromSecret(dbSecret),
      databaseName: 'advitiyans',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoMinorVersionUpgrade: true,
      publiclyAccessible: false,
    });

    // ========================================================================
    // 6. RDS Proxy (Connection Pooling for Lambda)
    // ========================================================================
    const rdsProxy = new rds.DatabaseProxy(this, 'AdvitiyansRdsProxy', {
      proxyTarget: rds.ProxyTarget.fromInstance(dbInstance),
      secrets: [dbSecret],
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [proxySg],
      dbProxyName: 'advitiyans-rds-proxy',
      requireTLS: true,
      idleClientTimeout: cdk.Duration.minutes(30),
      maxConnectionsPercent: 90,
      maxIdleConnectionsPercent: 50,
    });

    // ========================================================================
    // 7. Pre Sign-Up Lambda Trigger
    // ========================================================================
    const preSignUpLambda = new lambda.Function(this, 'CognitoPreSignUpTrigger', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handlers/cognito-pre-signup.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [lambdaSg],
      environment: {
        DB_HOST: rdsProxy.endpoint,
        DB_PORT: '5432',
        DB_NAME: 'advitiyans',
        DB_USER: 'postgres',
        DB_SECRET_ARN: dbSecret.secretArn,
        DB_SSL: 'true',
      },
    });
    dbSecret.grantRead(preSignUpLambda);

    // ========================================================================
    // 8. Cognito User Pool
    // ========================================================================
    const userPool = new cognito.UserPool(this, 'AdvitiyansUserPool', {
      userPoolName: 'advitiyans-user-pool',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: false,
      },
      customAttributes: {
        role: new cognito.StringAttribute({ mutable: true }),
        reg_no: new cognito.StringAttribute({ mutable: true }),
        year: new cognito.StringAttribute({ mutable: true }),
      },
      lambdaTriggers: {
        preSignUp: preSignUpLambda,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'AdvitiyansUserPoolClient', {
      userPool,
      userPoolClientName: 'advitiyans-web-client',
      generateSecret: false,
      authFlows: {
        userSrp: true,
        custom: true,
        adminUserPassword: true,
      },
    });

    // ========================================================================
    // 9. S3 Uploads Bucket (created before Lambda so env var can reference it)
    // ========================================================================
    const uploadsBucket = new s3.Bucket(this, 'AdvitiyansUploadsBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    // ========================================================================
    // 10. Backend API Lambda Function (in VPC, connects via RDS Proxy)
    // ========================================================================
    const apiLambda = new lambda.Function(this, 'AdvitiyansApiHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handlers/api.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [lambdaSg],
      environment: {
        DB_HOST: rdsProxy.endpoint,
        DB_PORT: '5432',
        DB_NAME: 'advitiyans',
        DB_USER: 'postgres',
        DB_SECRET_ARN: dbSecret.secretArn,
        DB_SSL: 'true',
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        UPLOADS_BUCKET_NAME: uploadsBucket.bucketName,
        USE_MOCK: 'false',
        // Forced update timestamp: 2026-08-05T14:48:00
        BUILD_TIMESTAMP: '2026-08-05T14:48:00',
      },
    });
    dbSecret.grantRead(apiLambda);
    uploadsBucket.grantReadWrite(apiLambda);

    // Grant Lambda permission to connect to RDS Proxy via IAM (optional, using password auth here)
    rdsProxy.grantConnect(apiLambda, 'postgres');

    // ========================================================================
    // 11. API Gateway REST API with Cognito Authorizer
    // ========================================================================
    const api = new apigateway.RestApi(this, 'AdvitiyansRestApi', {
      restApiName: 'Advitiyans Placement Readiness API',
      description: 'API for Advitiyans Student 360 platform (via RDS Proxy)',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Authorization', 'Content-Type'],
      },
    });


    const lambdaIntegration = new apigateway.LambdaIntegration(apiLambda);

    // Root GET / method — serves the frontend index.html over HTTPS
    api.root.addMethod('GET', lambdaIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
    });

    const proxyResource = api.root.addProxy({
      defaultIntegration: lambdaIntegration,
      defaultMethodOptions: {
        authorizationType: apigateway.AuthorizationType.NONE,
      },
    });

    // Unauthenticated public route for health & availability check
    const authResource = api.root.addResource('auth');
    const checkAvailabilityResource = authResource.addResource('check-availability');
    checkAvailabilityResource.addMethod('GET', lambdaIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
    });

    const healthResource = api.root.addResource('health');
    healthResource.addMethod('GET', lambdaIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
    });

    const dbInitResource = api.root.addResource('db-init');
    dbInitResource.addMethod('GET', lambdaIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
    });

    // ========================================================================
    // 12. S3 Frontend Hosting Bucket (Website Hosting)
    // ========================================================================
    const frontendBucket = new s3.Bucket(this, 'AdvitiyansFrontendBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
    });

    // ========================================================================
    // Stack Outputs
    // ========================================================================
    new cdk.CfnOutput(this, 'ApiGatewayUrl', { value: api.url });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'FrontendWebsiteUrl', { value: frontendBucket.bucketWebsiteUrl });
    new cdk.CfnOutput(this, 'FrontendBucketName', { value: frontendBucket.bucketName });
    new cdk.CfnOutput(this, 'UploadsBucketName', { value: uploadsBucket.bucketName });
    new cdk.CfnOutput(this, 'RdsProxyEndpoint', { value: rdsProxy.endpoint });
    new cdk.CfnOutput(this, 'RdsEndpoint', { value: dbInstance.dbInstanceEndpointAddress });
    new cdk.CfnOutput(this, 'DbSecretArn', { value: dbSecret.secretArn });
  }
}
