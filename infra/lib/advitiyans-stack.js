"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvitiyansStack = void 0;
const cdk = require("aws-cdk-lib");
const ec2 = require("aws-cdk-lib/aws-ec2");
const rds = require("aws-cdk-lib/aws-rds");
const secretsmanager = require("aws-cdk-lib/aws-secretsmanager");
const cognito = require("aws-cdk-lib/aws-cognito");
const lambda = require("aws-cdk-lib/aws-lambda");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const s3 = require("aws-cdk-lib/aws-s3");
const cloudfront = require("aws-cdk-lib/aws-cloudfront");
const origins = require("aws-cdk-lib/aws-cloudfront-origins");
const path = require("path");
class AdvitiyansStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        // 3. VPC Interface Endpoints (Temporarily removed to stop hourly VPC charges)
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
                // Forced update timestamp to ensure CDK redeploys Lambda with latest code
                BUILD_TIMESTAMP: '2026-08-09T22:45:00',
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
            cors: [
                {
                    allowedOrigins: ['*'],
                    allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
                    allowedHeaders: ['*'],
                },
            ],
        });
        // ========================================================================
        // 13. CloudFront Distribution for HTTPS & CDN Acceleration
        // ========================================================================
        const cfDistribution = new cloudfront.Distribution(this, 'AdvitiyansCloudFront', {
            defaultBehavior: {
                origin: new origins.S3StaticWebsiteOrigin(frontendBucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
            defaultRootObject: 'index.html',
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                    ttl: cdk.Duration.seconds(0),
                },
                {
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                    ttl: cdk.Duration.seconds(0),
                },
            ],
        });
        // ========================================================================
        // Stack Outputs
        // ========================================================================
        new cdk.CfnOutput(this, 'ApiGatewayUrl', { value: api.url });
        new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
        new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
        new cdk.CfnOutput(this, 'FrontendWebsiteUrl', { value: frontendBucket.bucketWebsiteUrl });
        new cdk.CfnOutput(this, 'CloudFrontUrl', { value: `https://${cfDistribution.distributionDomainName}` });
        new cdk.CfnOutput(this, 'FrontendBucketName', { value: frontendBucket.bucketName });
        new cdk.CfnOutput(this, 'UploadsBucketName', { value: uploadsBucket.bucketName });
        new cdk.CfnOutput(this, 'RdsProxyEndpoint', { value: rdsProxy.endpoint });
        new cdk.CfnOutput(this, 'RdsEndpoint', { value: dbInstance.dbInstanceEndpointAddress });
        new cdk.CfnOutput(this, 'DbSecretArn', { value: dbSecret.secretArn });
    }
}
exports.AdvitiyansStack = AdvitiyansStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWR2aXRpeWFucy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFkdml0aXlhbnMtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBRW5DLDJDQUEyQztBQUMzQywyQ0FBMkM7QUFDM0MsaUVBQWlFO0FBQ2pFLG1EQUFtRDtBQUNuRCxpREFBaUQ7QUFDakQseURBQXlEO0FBQ3pELHlDQUF5QztBQUN6Qyx5REFBeUQ7QUFDekQsOERBQThEO0FBRTlELDZCQUE2QjtBQUU3QixNQUFhLGVBQWdCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDNUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QiwyRUFBMkU7UUFDM0UsU0FBUztRQUNULDJFQUEyRTtRQUMzRSxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUM3QyxNQUFNLEVBQUUsQ0FBQztZQUNULFdBQVcsRUFBRSxDQUFDLEVBQUUsK0NBQStDO1lBQy9ELG1CQUFtQixFQUFFO2dCQUNuQjtvQkFDRSxRQUFRLEVBQUUsRUFBRTtvQkFDWixJQUFJLEVBQUUsUUFBUTtvQkFDZCxVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNO2lCQUNsQztnQkFDRDtvQkFDRSxRQUFRLEVBQUUsRUFBRTtvQkFDWixJQUFJLEVBQUUsVUFBVTtvQkFDaEIsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCO2lCQUM1QzthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsaURBQWlEO1FBQ2pELEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxZQUFZLEVBQUU7WUFDbkMsT0FBTyxFQUFFLEdBQUcsQ0FBQyw0QkFBNEIsQ0FBQyxFQUFFO1NBQzdDLENBQUMsQ0FBQztRQUVILDJFQUEyRTtRQUMz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LEtBQUssRUFBRSxjQUFjLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDO1FBQzFGLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFLEVBQUUsS0FBSyxFQUFFLFdBQVcsY0FBYyxDQUFDLHNCQUFzQixFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ3hHLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUUsRUFBRSxLQUFLLEVBQUUsY0FBYyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7UUFDcEYsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRSxFQUFFLEtBQUssRUFBRSxhQUFhLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztRQUNsRixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQzFFLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFLEVBQUUsS0FBSyxFQUFFLFVBQVUsQ0FBQyx5QkFBeUIsRUFBRSxDQUFDLENBQUM7UUFDeEYsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUUsRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUM7SUFDeEUsQ0FBQztDQUNGO0FBdldELDBDQXVXQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xyXG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XHJcbmltcG9ydCAqIGFzIHJkcyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtcmRzJztcclxuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcclxuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XHJcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcclxuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XHJcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XHJcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xyXG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xyXG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XHJcblxyXG5leHBvcnQgY2xhc3MgQWR2aXRpeWFuc1N0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcclxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIDEuIFZQQ1xyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICBjb25zdCB2cGMgPSBuZXcgZWMyLlZwYyh0aGlzLCAnQWR2aXRpeWFuc1ZwYycsIHtcclxuICAgICAgbWF4QXpzOiAyLFxyXG4gICAgICBuYXRHYXRld2F5czogMCwgLy8gQ29zdCBvcHRpbWl6ZWQ6IGF2b2lkIE5hdEdhdGV3YXkgaG91cmx5IGNvc3RcclxuICAgICAgc3VibmV0Q29uZmlndXJhdGlvbjogW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgIGNpZHJNYXNrOiAyNCxcclxuICAgICAgICAgIG5hbWU6ICdQdWJsaWMnLFxyXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFVCTElDLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxyXG4gICAgICAgICAgbmFtZTogJ0lzb2xhdGVkJyxcclxuICAgICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfSVNPTEFURUQsXHJcbiAgICAgICAgfSxcclxuICAgICAgXSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdhdGV3YXkgRW5kcG9pbnRzIGZvciBTMyAoZnJlZSwgbm8gTkFUIG5lZWRlZClcclxuICAgIHZwYy5hZGRHYXRld2F5RW5kcG9pbnQoJ1MzRW5kcG9pbnQnLCB7XHJcbiAgICAgIHNlcnZpY2U6IGVjMi5HYXRld2F5VnBjRW5kcG9pbnRBd3NTZXJ2aWNlLlMzLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAvLyAyLiBTZWN1cml0eSBHcm91cHNcclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAgIC8vIExhbWJkYSBTZWN1cml0eSBHcm91cFxyXG4gICAgY29uc3QgbGFtYmRhU2cgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ0xhbWJkYVNlY3VyaXR5R3JvdXAnLCB7XHJcbiAgICAgIHZwYyxcclxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBncm91cCBmb3IgTGFtYmRhIGZ1bmN0aW9ucycsXHJcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IGZhbHNlLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gUkRTIFByb3h5IFNlY3VyaXR5IEdyb3VwXHJcbiAgICBjb25zdCBwcm94eVNnID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdSZHNQcm94eVNlY3VyaXR5R3JvdXAnLCB7XHJcbiAgICAgIHZwYyxcclxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBncm91cCBmb3IgUkRTIFByb3h5JyxcclxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogZmFsc2UsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBSRFMgSW5zdGFuY2UgU2VjdXJpdHkgR3JvdXBcclxuICAgIGNvbnN0IGRiU2cgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ1Jkc1NlY3VyaXR5R3JvdXAnLCB7XHJcbiAgICAgIHZwYyxcclxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBncm91cCBmb3IgUkRTIFBvc3RncmVTUUwgaW5zdGFuY2UnLFxyXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiBmYWxzZSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFZQQyBFbmRwb2ludCBTZWN1cml0eSBHcm91cFxyXG4gICAgY29uc3QgdnBjZVNlY3VyaXR5R3JvdXAgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ1ZwY2VTZWN1cml0eUdyb3VwJywge1xyXG4gICAgICB2cGMsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgZ3JvdXAgZm9yIFZQQyBJbnRlcmZhY2UgRW5kcG9pbnRzJyxcclxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogZmFsc2UsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAtLS0gU2VjdXJpdHkgR3JvdXAgUnVsZXMgLS0tXHJcbiAgICAvLyBMYW1iZGEg4oaSIFJEUyBQcm94eSAocG9ydCA1NDMyKVxyXG4gICAgbGFtYmRhU2cuYWRkRWdyZXNzUnVsZShwcm94eVNnLCBlYzIuUG9ydC50Y3AoNTQzMiksICdMYW1iZGEgdG8gUkRTIFByb3h5Jyk7XHJcbiAgICBwcm94eVNnLmFkZEluZ3Jlc3NSdWxlKGxhbWJkYVNnLCBlYzIuUG9ydC50Y3AoNTQzMiksICdBbGxvdyBMYW1iZGEgdG8gUkRTIFByb3h5Jyk7XHJcblxyXG4gICAgLy8gUkRTIFByb3h5IOKGkiBSRFMgKHBvcnQgNTQzMilcclxuICAgIHByb3h5U2cuYWRkRWdyZXNzUnVsZShkYlNnLCBlYzIuUG9ydC50Y3AoNTQzMiksICdSRFMgUHJveHkgdG8gUkRTJyk7XHJcbiAgICBkYlNnLmFkZEluZ3Jlc3NSdWxlKHByb3h5U2csIGVjMi5Qb3J0LnRjcCg1NDMyKSwgJ0FsbG93IFJEUyBQcm94eSB0byBSRFMnKTtcclxuXHJcbiAgICAvLyBMYW1iZGEg4oaSIFZQQyBFbmRwb2ludHMgKHBvcnQgNDQzIGZvciBTZWNyZXRzIE1hbmFnZXIsIGV0Yy4pXHJcbiAgICBsYW1iZGFTZy5hZGRFZ3Jlc3NSdWxlKHZwY2VTZWN1cml0eUdyb3VwLCBlYzIuUG9ydC50Y3AoNDQzKSwgJ0xhbWJkYSB0byBWUEMgRW5kcG9pbnRzJyk7XHJcbiAgICB2cGNlU2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShsYW1iZGFTZywgZWMyLlBvcnQudGNwKDQ0MyksICdBbGxvdyBMYW1iZGEgdG8gVlBDIEVuZHBvaW50cycpO1xyXG5cclxuICAgIC8vIFJEUyBQcm94eSDihpIgU2VjcmV0cyBNYW5hZ2VyIFZQQyBFbmRwb2ludCAocG9ydCA0NDMpXHJcbiAgICBwcm94eVNnLmFkZEVncmVzc1J1bGUodnBjZVNlY3VyaXR5R3JvdXAsIGVjMi5Qb3J0LnRjcCg0NDMpLCAnUkRTIFByb3h5IHRvIFNlY3JldHMgTWFuYWdlcicpO1xyXG4gICAgdnBjZVNlY3VyaXR5R3JvdXAuYWRkSW5ncmVzc1J1bGUocHJveHlTZywgZWMyLlBvcnQudGNwKDQ0MyksICdBbGxvdyBSRFMgUHJveHkgdG8gU2VjcmV0cyBNYW5hZ2VyJyk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAvLyAzLiBWUEMgSW50ZXJmYWNlIEVuZHBvaW50cyAoVGVtcG9yYXJpbHkgcmVtb3ZlZCB0byBzdG9wIGhvdXJseSBWUEMgY2hhcmdlcylcclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAgIC8vIFNlY3JldHMgTWFuYWdlciBlbmRwb2ludCDigJQgbmVlZGVkIGJ5IExhbWJkYSBhbmQgUkRTIFByb3h5XHJcbiAgICB2cGMuYWRkSW50ZXJmYWNlRW5kcG9pbnQoJ1NlY3JldHNNYW5hZ2VyRW5kcG9pbnQnLCB7XHJcbiAgICAgIHNlcnZpY2U6IGVjMi5JbnRlcmZhY2VWcGNFbmRwb2ludEF3c1NlcnZpY2UuU0VDUkVUU19NQU5BR0VSLFxyXG4gICAgICBzdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfSVNPTEFURUQgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFt2cGNlU2VjdXJpdHlHcm91cF0sXHJcbiAgICAgIHByaXZhdGVEbnNFbmFibGVkOiB0cnVlLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gU1RTIGVuZHBvaW50IOKAlCBuZWVkZWQgZm9yIElBTSBhdXRoZW50aWNhdGlvbiB3aXRoIFJEUyBQcm94eVxyXG4gICAgdnBjLmFkZEludGVyZmFjZUVuZHBvaW50KCdTdHNFbmRwb2ludCcsIHtcclxuICAgICAgc2VydmljZTogZWMyLkludGVyZmFjZVZwY0VuZHBvaW50QXdzU2VydmljZS5TVFMsXHJcbiAgICAgIHN1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9JU09MQVRFRCB9LFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW3ZwY2VTZWN1cml0eUdyb3VwXSxcclxuICAgICAgcHJpdmF0ZURuc0VuYWJsZWQ6IHRydWUsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIDQuIERhdGFiYXNlIFNlY3JldHMgTWFuYWdlclxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICBjb25zdCBkYlNlY3JldCA9IG5ldyBzZWNyZXRzbWFuYWdlci5TZWNyZXQodGhpcywgJ0Fkdml0aXlhbnNEYlNlY3JldCcsIHtcclxuICAgICAgc2VjcmV0TmFtZTogJ2Fkdml0aXlhbnMtZGItY3JlZGVudGlhbHMnLFxyXG4gICAgICBnZW5lcmF0ZVNlY3JldFN0cmluZzoge1xyXG4gICAgICAgIHNlY3JldFN0cmluZ1RlbXBsYXRlOiBKU09OLnN0cmluZ2lmeSh7IHVzZXJuYW1lOiAncG9zdGdyZXMnIH0pLFxyXG4gICAgICAgIGdlbmVyYXRlU3RyaW5nS2V5OiAncGFzc3dvcmQnLFxyXG4gICAgICAgIGV4Y2x1ZGVQdW5jdHVhdGlvbjogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gNS4gUkRTIFBvc3RncmVTUUwgSW5zdGFuY2UgKGRiLnQ0Zy5taWNybywgU2luZ2xlLUFaKVxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICBjb25zdCBkYkluc3RhbmNlID0gbmV3IHJkcy5EYXRhYmFzZUluc3RhbmNlKHRoaXMsICdBZHZpdGl5YW5zUkRTJywge1xyXG4gICAgICBlbmdpbmU6IHJkcy5EYXRhYmFzZUluc3RhbmNlRW5naW5lLnBvc3RncmVzKHtcclxuICAgICAgICB2ZXJzaW9uOiByZHMuUG9zdGdyZXNFbmdpbmVWZXJzaW9uLlZFUl8xNSxcclxuICAgICAgfSksXHJcbiAgICAgIGluc3RhbmNlVHlwZTogZWMyLkluc3RhbmNlVHlwZS5vZihlYzIuSW5zdGFuY2VDbGFzcy5UNEcsIGVjMi5JbnN0YW5jZVNpemUuTUlDUk8pLFxyXG4gICAgICB2cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9JU09MQVRFRCB9LFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW2RiU2ddLFxyXG4gICAgICBhbGxvY2F0ZWRTdG9yYWdlOiAyMCxcclxuICAgICAgbWF4QWxsb2NhdGVkU3RvcmFnZTogNTAsXHJcbiAgICAgIGNyZWRlbnRpYWxzOiByZHMuQ3JlZGVudGlhbHMuZnJvbVNlY3JldChkYlNlY3JldCksXHJcbiAgICAgIGRhdGFiYXNlTmFtZTogJ2Fkdml0aXlhbnMnLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgICBhdXRvTWlub3JWZXJzaW9uVXBncmFkZTogdHJ1ZSxcclxuICAgICAgcHVibGljbHlBY2Nlc3NpYmxlOiBmYWxzZSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gNi4gUkRTIFByb3h5IChDb25uZWN0aW9uIFBvb2xpbmcgZm9yIExhbWJkYSlcclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgY29uc3QgcmRzUHJveHkgPSBuZXcgcmRzLkRhdGFiYXNlUHJveHkodGhpcywgJ0Fkdml0aXlhbnNSZHNQcm94eScsIHtcclxuICAgICAgcHJveHlUYXJnZXQ6IHJkcy5Qcm94eVRhcmdldC5mcm9tSW5zdGFuY2UoZGJJbnN0YW5jZSksXHJcbiAgICAgIHNlY3JldHM6IFtkYlNlY3JldF0sXHJcbiAgICAgIHZwYyxcclxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVEIH0sXHJcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbcHJveHlTZ10sXHJcbiAgICAgIGRiUHJveHlOYW1lOiAnYWR2aXRpeWFucy1yZHMtcHJveHknLFxyXG4gICAgICByZXF1aXJlVExTOiB0cnVlLFxyXG4gICAgICBpZGxlQ2xpZW50VGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMzApLFxyXG4gICAgICBtYXhDb25uZWN0aW9uc1BlcmNlbnQ6IDkwLFxyXG4gICAgICBtYXhJZGxlQ29ubmVjdGlvbnNQZXJjZW50OiA1MCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gNy4gUHJlIFNpZ24tVXAgTGFtYmRhIFRyaWdnZXJcclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgY29uc3QgcHJlU2lnblVwTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ29nbml0b1ByZVNpZ25VcFRyaWdnZXInLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaGFuZGxlcnMvY29nbml0by1wcmUtc2lnbnVwLmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcclxuICAgICAgdnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfSVNPTEFURUQgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTZ10sXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgREJfSE9TVDogcmRzUHJveHkuZW5kcG9pbnQsXHJcbiAgICAgICAgREJfUE9SVDogJzU0MzInLFxyXG4gICAgICAgIERCX05BTUU6ICdhZHZpdGl5YW5zJyxcclxuICAgICAgICBEQl9VU0VSOiAncG9zdGdyZXMnLFxyXG4gICAgICAgIERCX1NFQ1JFVF9BUk46IGRiU2VjcmV0LnNlY3JldEFybixcclxuICAgICAgICBEQl9TU0w6ICd0cnVlJyxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gICAgZGJTZWNyZXQuZ3JhbnRSZWFkKHByZVNpZ25VcExhbWJkYSk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAvLyA4LiBDb2duaXRvIFVzZXIgUG9vbFxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICBjb25zdCB1c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsICdBZHZpdGl5YW5zVXNlclBvb2wnLCB7XHJcbiAgICAgIHVzZXJQb29sTmFtZTogJ2Fkdml0aXlhbnMtdXNlci1wb29sJyxcclxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IHRydWUsXHJcbiAgICAgIHNpZ25JbkFsaWFzZXM6IHsgZW1haWw6IHRydWUgfSxcclxuICAgICAgYXV0b1ZlcmlmeTogeyBlbWFpbDogdHJ1ZSB9LFxyXG4gICAgICBwYXNzd29yZFBvbGljeToge1xyXG4gICAgICAgIG1pbkxlbmd0aDogOCxcclxuICAgICAgICByZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxyXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IGZhbHNlLFxyXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXHJcbiAgICAgICAgcmVxdWlyZVN5bWJvbHM6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgICBjdXN0b21BdHRyaWJ1dGVzOiB7XHJcbiAgICAgICAgcm9sZTogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHsgbXV0YWJsZTogdHJ1ZSB9KSxcclxuICAgICAgICByZWdfbm86IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7IG11dGFibGU6IHRydWUgfSksXHJcbiAgICAgICAgeWVhcjogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHsgbXV0YWJsZTogdHJ1ZSB9KSxcclxuICAgICAgfSxcclxuICAgICAgbGFtYmRhVHJpZ2dlcnM6IHtcclxuICAgICAgICBwcmVTaWduVXA6IHByZVNpZ25VcExhbWJkYSxcclxuICAgICAgfSxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHVzZXJQb29sQ2xpZW50ID0gbmV3IGNvZ25pdG8uVXNlclBvb2xDbGllbnQodGhpcywgJ0Fkdml0aXlhbnNVc2VyUG9vbENsaWVudCcsIHtcclxuICAgICAgdXNlclBvb2wsXHJcbiAgICAgIHVzZXJQb29sQ2xpZW50TmFtZTogJ2Fkdml0aXlhbnMtd2ViLWNsaWVudCcsXHJcbiAgICAgIGdlbmVyYXRlU2VjcmV0OiBmYWxzZSxcclxuICAgICAgYXV0aEZsb3dzOiB7XHJcbiAgICAgICAgdXNlclNycDogdHJ1ZSxcclxuICAgICAgICBjdXN0b206IHRydWUsXHJcbiAgICAgICAgYWRtaW5Vc2VyUGFzc3dvcmQ6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIDkuIFMzIFVwbG9hZHMgQnVja2V0IChjcmVhdGVkIGJlZm9yZSBMYW1iZGEgc28gZW52IHZhciBjYW4gcmVmZXJlbmNlIGl0KVxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICBjb25zdCB1cGxvYWRzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnQWR2aXRpeWFuc1VwbG9hZHNCdWNrZXQnLCB7XHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxyXG4gICAgICBjb3JzOiBbXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtzMy5IdHRwTWV0aG9kcy5HRVQsIHMzLkh0dHBNZXRob2RzLlBVVCwgczMuSHR0cE1ldGhvZHMuUE9TVF0sXHJcbiAgICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXHJcbiAgICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXHJcbiAgICAgICAgfSxcclxuICAgICAgXSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gMTAuIEJhY2tlbmQgQVBJIExhbWJkYSBGdW5jdGlvbiAoaW4gVlBDLCBjb25uZWN0cyB2aWEgUkRTIFByb3h5KVxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICBjb25zdCBhcGlMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBZHZpdGl5YW5zQXBpSGFuZGxlcicsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdoYW5kbGVycy9hcGkuaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxNSksXHJcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcclxuICAgICAgdnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfSVNPTEFURUQgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTZ10sXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgREJfSE9TVDogcmRzUHJveHkuZW5kcG9pbnQsXHJcbiAgICAgICAgREJfUE9SVDogJzU0MzInLFxyXG4gICAgICAgIERCX05BTUU6ICdhZHZpdGl5YW5zJyxcclxuICAgICAgICBEQl9VU0VSOiAncG9zdGdyZXMnLFxyXG4gICAgICAgIERCX1NFQ1JFVF9BUk46IGRiU2VjcmV0LnNlY3JldEFybixcclxuICAgICAgICBEQl9TU0w6ICd0cnVlJyxcclxuICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogdXNlclBvb2wudXNlclBvb2xJZCxcclxuICAgICAgICBVUExPQURTX0JVQ0tFVF9OQU1FOiB1cGxvYWRzQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgICAgVVNFX01PQ0s6ICdmYWxzZScsXHJcbiAgICAgICAgLy8gRm9yY2VkIHVwZGF0ZSB0aW1lc3RhbXAgdG8gZW5zdXJlIENESyByZWRlcGxveXMgTGFtYmRhIHdpdGggbGF0ZXN0IGNvZGVcclxuICAgICAgICBCVUlMRF9USU1FU1RBTVA6ICcyMDI2LTA4LTA5VDIyOjQ1OjAwJyxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gICAgZGJTZWNyZXQuZ3JhbnRSZWFkKGFwaUxhbWJkYSk7XHJcbiAgICB1cGxvYWRzQnVja2V0LmdyYW50UmVhZFdyaXRlKGFwaUxhbWJkYSk7XHJcblxyXG4gICAgLy8gR3JhbnQgTGFtYmRhIHBlcm1pc3Npb24gdG8gY29ubmVjdCB0byBSRFMgUHJveHkgdmlhIElBTSAob3B0aW9uYWwsIHVzaW5nIHBhc3N3b3JkIGF1dGggaGVyZSlcclxuICAgIHJkc1Byb3h5LmdyYW50Q29ubmVjdChhcGlMYW1iZGEsICdwb3N0Z3JlcycpO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gMTEuIEFQSSBHYXRld2F5IFJFU1QgQVBJIHdpdGggQ29nbml0byBBdXRob3JpemVyXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ0Fkdml0aXlhbnNSZXN0QXBpJywge1xyXG4gICAgICByZXN0QXBpTmFtZTogJ0Fkdml0aXlhbnMgUGxhY2VtZW50IFJlYWRpbmVzcyBBUEknLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBmb3IgQWR2aXRpeWFucyBTdHVkZW50IDM2MCBwbGF0Zm9ybSAodmlhIFJEUyBQcm94eSknLFxyXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcclxuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcclxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcclxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQXV0aG9yaXphdGlvbicsICdDb250ZW50LVR5cGUnXSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuXHJcbiAgICBjb25zdCBsYW1iZGFJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFwaUxhbWJkYSk7XHJcblxyXG4gICAgLy8gUm9vdCBHRVQgLyBtZXRob2Qg4oCUIHNlcnZlcyB0aGUgZnJvbnRlbmQgaW5kZXguaHRtbCBvdmVyIEhUVFBTXHJcbiAgICBhcGkucm9vdC5hZGRNZXRob2QoJ0dFVCcsIGxhbWJkYUludGVncmF0aW9uLCB7XHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLk5PTkUsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBwcm94eVJlc291cmNlID0gYXBpLnJvb3QuYWRkUHJveHkoe1xyXG4gICAgICBkZWZhdWx0SW50ZWdyYXRpb246IGxhbWJkYUludGVncmF0aW9uLFxyXG4gICAgICBkZWZhdWx0TWV0aG9kT3B0aW9uczoge1xyXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLk5PTkUsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBVbmF1dGhlbnRpY2F0ZWQgcHVibGljIHJvdXRlIGZvciBoZWFsdGggJiBhdmFpbGFiaWxpdHkgY2hlY2tcclxuICAgIGNvbnN0IGF1dGhSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKCdhdXRoJyk7XHJcbiAgICBjb25zdCBjaGVja0F2YWlsYWJpbGl0eVJlc291cmNlID0gYXV0aFJlc291cmNlLmFkZFJlc291cmNlKCdjaGVjay1hdmFpbGFiaWxpdHknKTtcclxuICAgIGNoZWNrQXZhaWxhYmlsaXR5UmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBsYW1iZGFJbnRlZ3JhdGlvbiwge1xyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5OT05FLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgaGVhbHRoUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnaGVhbHRoJyk7XHJcbiAgICBoZWFsdGhSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIGxhbWJkYUludGVncmF0aW9uLCB7XHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLk5PTkUsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBkYkluaXRSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKCdkYi1pbml0Jyk7XHJcbiAgICBkYkluaXRSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIGxhbWJkYUludGVncmF0aW9uLCB7XHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLk5PTkUsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIDEyLiBTMyBGcm9udGVuZCBIb3N0aW5nIEJ1Y2tldCAoV2Vic2l0ZSBIb3N0aW5nKVxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICBjb25zdCBmcm9udGVuZEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0Fkdml0aXlhbnNGcm9udGVuZEJ1Y2tldCcsIHtcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXHJcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6IHRydWUsXHJcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBuZXcgczMuQmxvY2tQdWJsaWNBY2Nlc3Moe1xyXG4gICAgICAgIGJsb2NrUHVibGljQWNsczogZmFsc2UsXHJcbiAgICAgICAgYmxvY2tQdWJsaWNQb2xpY3k6IGZhbHNlLFxyXG4gICAgICAgIGlnbm9yZVB1YmxpY0FjbHM6IGZhbHNlLFxyXG4gICAgICAgIHJlc3RyaWN0UHVibGljQnVja2V0czogZmFsc2UsXHJcbiAgICAgIH0pLFxyXG4gICAgICB3ZWJzaXRlSW5kZXhEb2N1bWVudDogJ2luZGV4Lmh0bWwnLFxyXG4gICAgICB3ZWJzaXRlRXJyb3JEb2N1bWVudDogJ2luZGV4Lmh0bWwnLFxyXG4gICAgICBjb3JzOiBbXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxyXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtzMy5IdHRwTWV0aG9kcy5HRVQsIHMzLkh0dHBNZXRob2RzLkhFQURdLFxyXG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIDEzLiBDbG91ZEZyb250IERpc3RyaWJ1dGlvbiBmb3IgSFRUUFMgJiBDRE4gQWNjZWxlcmF0aW9uXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIGNvbnN0IGNmRGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKHRoaXMsICdBZHZpdGl5YW5zQ2xvdWRGcm9udCcsIHtcclxuICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XHJcbiAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5TM1N0YXRpY1dlYnNpdGVPcmlnaW4oZnJvbnRlbmRCdWNrZXQpLFxyXG4gICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxyXG4gICAgICB9LFxyXG4gICAgICBkZWZhdWx0Um9vdE9iamVjdDogJ2luZGV4Lmh0bWwnLFxyXG4gICAgICBlcnJvclJlc3BvbnNlczogW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgIGh0dHBTdGF0dXM6IDQwNCxcclxuICAgICAgICAgIHJlc3BvbnNlSHR0cFN0YXR1czogMjAwLFxyXG4gICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcclxuICAgICAgICAgIHR0bDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMCksXHJcbiAgICAgICAgfSxcclxuICAgICAgICB7XHJcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDMsXHJcbiAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcclxuICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsXHJcbiAgICAgICAgICB0dGw6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDApLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIFN0YWNrIE91dHB1dHNcclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaUdhdGV3YXlVcmwnLCB7IHZhbHVlOiBhcGkudXJsIH0pO1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sSWQnLCB7IHZhbHVlOiB1c2VyUG9vbC51c2VyUG9vbElkIH0pO1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sQ2xpZW50SWQnLCB7IHZhbHVlOiB1c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkIH0pO1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Zyb250ZW5kV2Vic2l0ZVVybCcsIHsgdmFsdWU6IGZyb250ZW5kQnVja2V0LmJ1Y2tldFdlYnNpdGVVcmwgfSk7XHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udFVybCcsIHsgdmFsdWU6IGBodHRwczovLyR7Y2ZEaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZX1gIH0pO1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Zyb250ZW5kQnVja2V0TmFtZScsIHsgdmFsdWU6IGZyb250ZW5kQnVja2V0LmJ1Y2tldE5hbWUgfSk7XHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXBsb2Fkc0J1Y2tldE5hbWUnLCB7IHZhbHVlOiB1cGxvYWRzQnVja2V0LmJ1Y2tldE5hbWUgfSk7XHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUmRzUHJveHlFbmRwb2ludCcsIHsgdmFsdWU6IHJkc1Byb3h5LmVuZHBvaW50IH0pO1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Jkc0VuZHBvaW50JywgeyB2YWx1ZTogZGJJbnN0YW5jZS5kYkluc3RhbmNlRW5kcG9pbnRBZGRyZXNzIH0pO1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RiU2VjcmV0QXJuJywgeyB2YWx1ZTogZGJTZWNyZXQuc2VjcmV0QXJuIH0pO1xyXG4gIH1cclxufVxyXG4iXX0=