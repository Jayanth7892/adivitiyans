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
                // Forced update timestamp: 2026-08-05T16:35:00
                BUILD_TIMESTAMP: '2026-08-05T16:35:00',
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
exports.AdvitiyansStack = AdvitiyansStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWR2aXRpeWFucy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFkdml0aXlhbnMtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBRW5DLDJDQUEyQztBQUMzQywyQ0FBMkM7QUFDM0MsaUVBQWlFO0FBQ2pFLG1EQUFtRDtBQUNuRCxpREFBaUQ7QUFDakQseURBQXlEO0FBQ3pELHlDQUF5QztBQUl6Qyw2QkFBNkI7QUFFN0IsTUFBYSxlQUFnQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzVDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsMkVBQTJFO1FBQzNFLFNBQVM7UUFDVCwyRUFBMkU7UUFDM0UsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDN0MsTUFBTSxFQUFFLENBQUM7WUFDVCxXQUFXLEVBQUUsQ0FBQyxFQUFFLCtDQUErQztZQUMvRCxtQkFBbUIsRUFBRTtnQkFDbkI7b0JBQ0UsUUFBUSxFQUFFLEVBQUU7b0JBQ1osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsTUFBTTtpQkFDbEM7Z0JBQ0Q7b0JBQ0UsUUFBUSxFQUFFLEVBQUU7b0JBQ1osSUFBSSxFQUFFLFVBQVU7b0JBQ2hCLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLGdCQUFnQjtpQkFDNUM7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILGlEQUFpRDtRQUNqRCxHQUFHLENBQUMsa0JBQWtCLENBQUMsWUFBWSxFQUFFO1lBQ25DLE9BQU8sRUFBRSxHQUFHLENBQUMsNEJBQTRCLENBQUMsRUFBRTtTQUM3QyxDQUFDLENBQUM7UUFFSCwyRUFBMkU7UUFDM0UscUJBQXFCO1FBQ3JCLDJFQUEyRTtRQUUz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YXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XHJcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcclxuaW1wb3J0ICogYXMgcmRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1yZHMnO1xyXG5pbXBvcnQgKiBhcyBzZWNyZXRzbWFuYWdlciBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc2VjcmV0c21hbmFnZXInO1xyXG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcclxuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xyXG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcclxuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcclxuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udCc7XHJcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XHJcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcclxuXHJcbmV4cG9ydCBjbGFzcyBBZHZpdGl5YW5zU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gMS4gVlBDXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIGNvbnN0IHZwYyA9IG5ldyBlYzIuVnBjKHRoaXMsICdBZHZpdGl5YW5zVnBjJywge1xyXG4gICAgICBtYXhBenM6IDIsXHJcbiAgICAgIG5hdEdhdGV3YXlzOiAwLCAvLyBDb3N0IG9wdGltaXplZDogYXZvaWQgTmF0R2F0ZXdheSBob3VybHkgY29zdFxyXG4gICAgICBzdWJuZXRDb25maWd1cmF0aW9uOiBbXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxyXG4gICAgICAgICAgbmFtZTogJ1B1YmxpYycsXHJcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QVUJMSUMsXHJcbiAgICAgICAgfSxcclxuICAgICAgICB7XHJcbiAgICAgICAgICBjaWRyTWFzazogMjQsXHJcbiAgICAgICAgICBuYW1lOiAnSXNvbGF0ZWQnLFxyXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9JU09MQVRFRCxcclxuICAgICAgICB9LFxyXG4gICAgICBdLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR2F0ZXdheSBFbmRwb2ludHMgZm9yIFMzIChmcmVlLCBubyBOQVQgbmVlZGVkKVxyXG4gICAgdnBjLmFkZEdhdGV3YXlFbmRwb2ludCgnUzNFbmRwb2ludCcsIHtcclxuICAgICAgc2VydmljZTogZWMyLkdhdGV3YXlWcGNFbmRwb2ludEF3c1NlcnZpY2UuUzMsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIDIuIFNlY3VyaXR5IEdyb3Vwc1xyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gICAgLy8gTGFtYmRhIFNlY3VyaXR5IEdyb3VwXHJcbiAgICBjb25zdCBsYW1iZGFTZyA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnTGFtYmRhU2VjdXJpdHlHcm91cCcsIHtcclxuICAgICAgdnBjLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBMYW1iZGEgZnVuY3Rpb25zJyxcclxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogZmFsc2UsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBSRFMgUHJveHkgU2VjdXJpdHkgR3JvdXBcclxuICAgIGNvbnN0IHByb3h5U2cgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ1Jkc1Byb3h5U2VjdXJpdHlHcm91cCcsIHtcclxuICAgICAgdnBjLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBSRFMgUHJveHknLFxyXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiBmYWxzZSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFJEUyBJbnN0YW5jZSBTZWN1cml0eSBHcm91cFxyXG4gICAgY29uc3QgZGJTZyA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnUmRzU2VjdXJpdHlHcm91cCcsIHtcclxuICAgICAgdnBjLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBSRFMgUG9zdGdyZVNRTCBpbnN0YW5jZScsXHJcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IGZhbHNlLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gVlBDIEVuZHBvaW50IFNlY3VyaXR5IEdyb3VwXHJcbiAgICBjb25zdCB2cGNlU2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnVnBjZVNlY3VyaXR5R3JvdXAnLCB7XHJcbiAgICAgIHZwYyxcclxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBncm91cCBmb3IgVlBDIEludGVyZmFjZSBFbmRwb2ludHMnLFxyXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiBmYWxzZSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC0tLSBTZWN1cml0eSBHcm91cCBSdWxlcyAtLS1cclxuICAgIC8vIExhbWJkYSDihpIgUkRTIFByb3h5IChwb3J0IDU0MzIpXHJcbiAgICBsYW1iZGFTZy5hZGRFZ3Jlc3NSdWxlKHByb3h5U2csIGVjMi5Qb3J0LnRjcCg1NDMyKSwgJ0xhbWJkYSB0byBSRFMgUHJveHknKTtcclxuICAgIHByb3h5U2cuYWRkSW5ncmVzc1J1bGUobGFtYmRhU2csIGVjMi5Qb3J0LnRjcCg1NDMyKSwgJ0FsbG93IExhbWJkYSB0byBSRFMgUHJveHknKTtcclxuXHJcbiAgICAvLyBSRFMgUHJveHkg4oaSIFJEUyAocG9ydCA1NDMyKVxyXG4gICAgcHJveHlTZy5hZGRFZ3Jlc3NSdWxlKGRiU2csIGVjMi5Qb3J0LnRjcCg1NDMyKSwgJ1JEUyBQcm94eSB0byBSRFMnKTtcclxuICAgIGRiU2cuYWRkSW5ncmVzc1J1bGUocHJveHlTZywgZWMyLlBvcnQudGNwKDU0MzIpLCAnQWxsb3cgUkRTIFByb3h5IHRvIFJEUycpO1xyXG5cclxuICAgIC8vIExhbWJkYSDihpIgVlBDIEVuZHBvaW50cyAocG9ydCA0NDMgZm9yIFNlY3JldHMgTWFuYWdlciwgZXRjLilcclxuICAgIGxhbWJkYVNnLmFkZEVncmVzc1J1bGUodnBjZVNlY3VyaXR5R3JvdXAsIGVjMi5Qb3J0LnRjcCg0NDMpLCAnTGFtYmRhIHRvIFZQQyBFbmRwb2ludHMnKTtcclxuICAgIHZwY2VTZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKGxhbWJkYVNnLCBlYzIuUG9ydC50Y3AoNDQzKSwgJ0FsbG93IExhbWJkYSB0byBWUEMgRW5kcG9pbnRzJyk7XHJcblxyXG4gICAgLy8gUkRTIFByb3h5IOKGkiBTZWNyZXRzIE1hbmFnZXIgVlBDIEVuZHBvaW50IChwb3J0IDQ0MylcclxuICAgIHByb3h5U2cuYWRkRWdyZXNzUnVsZSh2cGNlU2VjdXJpdHlHcm91cCwgZWMyLlBvcnQudGNwKDQ0MyksICdSRFMgUHJveHkgdG8gU2VjcmV0cyBNYW5hZ2VyJyk7XHJcbiAgICB2cGNlU2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShwcm94eVNnLCBlYzIuUG9ydC50Y3AoNDQzKSwgJ0FsbG93IFJEUyBQcm94eSB0byBTZWNyZXRzIE1hbmFnZXInKTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIDMuIFZQQyBJbnRlcmZhY2UgRW5kcG9pbnRzIChyZXF1aXJlZDogbm8gTkFUIEdhdGV3YXkpXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgICAvLyBTZWNyZXRzIE1hbmFnZXIgZW5kcG9pbnQg4oCUIG5lZWRlZCBieSBMYW1iZGEgYW5kIFJEUyBQcm94eVxyXG4gICAgdnBjLmFkZEludGVyZmFjZUVuZHBvaW50KCdTZWNyZXRzTWFuYWdlckVuZHBvaW50Jywge1xyXG4gICAgICBzZXJ2aWNlOiBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnRBd3NTZXJ2aWNlLlNFQ1JFVFNfTUFOQUdFUixcclxuICAgICAgc3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVEIH0sXHJcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbdnBjZVNlY3VyaXR5R3JvdXBdLFxyXG4gICAgICBwcml2YXRlRG5zRW5hYmxlZDogdHJ1ZSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFNUUyBlbmRwb2ludCDigJQgbmVlZGVkIGZvciBJQU0gYXV0aGVudGljYXRpb24gd2l0aCBSRFMgUHJveHlcclxuICAgIHZwYy5hZGRJbnRlcmZhY2VFbmRwb2ludCgnU3RzRW5kcG9pbnQnLCB7XHJcbiAgICAgIHNlcnZpY2U6IGVjMi5JbnRlcmZhY2VWcGNFbmRwb2ludEF3c1NlcnZpY2UuU1RTLFxyXG4gICAgICBzdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfSVNPTEFURUQgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFt2cGNlU2VjdXJpdHlHcm91cF0sXHJcbiAgICAgIHByaXZhdGVEbnNFbmFibGVkOiB0cnVlLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAvLyA0LiBEYXRhYmFzZSBTZWNyZXRzIE1hbmFnZXJcclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgY29uc3QgZGJTZWNyZXQgPSBuZXcgc2VjcmV0c21hbmFnZXIuU2VjcmV0KHRoaXMsICdBZHZpdGl5YW5zRGJTZWNyZXQnLCB7XHJcbiAgICAgIHNlY3JldE5hbWU6ICdhZHZpdGl5YW5zLWRiLWNyZWRlbnRpYWxzJyxcclxuICAgICAgZ2VuZXJhdGVTZWNyZXRTdHJpbmc6IHtcclxuICAgICAgICBzZWNyZXRTdHJpbmdUZW1wbGF0ZTogSlNPTi5zdHJpbmdpZnkoeyB1c2VybmFtZTogJ3Bvc3RncmVzJyB9KSxcclxuICAgICAgICBnZW5lcmF0ZVN0cmluZ0tleTogJ3Bhc3N3b3JkJyxcclxuICAgICAgICBleGNsdWRlUHVuY3R1YXRpb246IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIDUuIFJEUyBQb3N0Z3JlU1FMIEluc3RhbmNlIChkYi50NGcubWljcm8sIFNpbmdsZS1BWilcclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgY29uc3QgZGJJbnN0YW5jZSA9IG5ldyByZHMuRGF0YWJhc2VJbnN0YW5jZSh0aGlzLCAnQWR2aXRpeWFuc1JEUycsIHtcclxuICAgICAgZW5naW5lOiByZHMuRGF0YWJhc2VJbnN0YW5jZUVuZ2luZS5wb3N0Z3Jlcyh7XHJcbiAgICAgICAgdmVyc2lvbjogcmRzLlBvc3RncmVzRW5naW5lVmVyc2lvbi5WRVJfMTUsXHJcbiAgICAgIH0pLFxyXG4gICAgICBpbnN0YW5jZVR5cGU6IGVjMi5JbnN0YW5jZVR5cGUub2YoZWMyLkluc3RhbmNlQ2xhc3MuVDRHLCBlYzIuSW5zdGFuY2VTaXplLk1JQ1JPKSxcclxuICAgICAgdnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfSVNPTEFURUQgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtkYlNnXSxcclxuICAgICAgYWxsb2NhdGVkU3RvcmFnZTogMjAsXHJcbiAgICAgIG1heEFsbG9jYXRlZFN0b3JhZ2U6IDUwLFxyXG4gICAgICBjcmVkZW50aWFsczogcmRzLkNyZWRlbnRpYWxzLmZyb21TZWNyZXQoZGJTZWNyZXQpLFxyXG4gICAgICBkYXRhYmFzZU5hbWU6ICdhZHZpdGl5YW5zJyxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgYXV0b01pbm9yVmVyc2lvblVwZ3JhZGU6IHRydWUsXHJcbiAgICAgIHB1YmxpY2x5QWNjZXNzaWJsZTogZmFsc2UsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIDYuIFJEUyBQcm94eSAoQ29ubmVjdGlvbiBQb29saW5nIGZvciBMYW1iZGEpXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIGNvbnN0IHJkc1Byb3h5ID0gbmV3IHJkcy5EYXRhYmFzZVByb3h5KHRoaXMsICdBZHZpdGl5YW5zUmRzUHJveHknLCB7XHJcbiAgICAgIHByb3h5VGFyZ2V0OiByZHMuUHJveHlUYXJnZXQuZnJvbUluc3RhbmNlKGRiSW5zdGFuY2UpLFxyXG4gICAgICBzZWNyZXRzOiBbZGJTZWNyZXRdLFxyXG4gICAgICB2cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9JU09MQVRFRCB9LFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW3Byb3h5U2ddLFxyXG4gICAgICBkYlByb3h5TmFtZTogJ2Fkdml0aXlhbnMtcmRzLXByb3h5JyxcclxuICAgICAgcmVxdWlyZVRMUzogdHJ1ZSxcclxuICAgICAgaWRsZUNsaWVudFRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDMwKSxcclxuICAgICAgbWF4Q29ubmVjdGlvbnNQZXJjZW50OiA5MCxcclxuICAgICAgbWF4SWRsZUNvbm5lY3Rpb25zUGVyY2VudDogNTAsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIDcuIFByZSBTaWduLVVwIExhbWJkYSBUcmlnZ2VyXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIGNvbnN0IHByZVNpZ25VcExhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NvZ25pdG9QcmVTaWduVXBUcmlnZ2VyJywge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2hhbmRsZXJzL2NvZ25pdG8tcHJlLXNpZ251cC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kL2Rpc3QnKSksXHJcbiAgICAgIHZwYyxcclxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVEIH0sXHJcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbGFtYmRhU2ddLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIERCX0hPU1Q6IHJkc1Byb3h5LmVuZHBvaW50LFxyXG4gICAgICAgIERCX1BPUlQ6ICc1NDMyJyxcclxuICAgICAgICBEQl9OQU1FOiAnYWR2aXRpeWFucycsXHJcbiAgICAgICAgREJfVVNFUjogJ3Bvc3RncmVzJyxcclxuICAgICAgICBEQl9TRUNSRVRfQVJOOiBkYlNlY3JldC5zZWNyZXRBcm4sXHJcbiAgICAgICAgREJfU1NMOiAndHJ1ZScsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICAgIGRiU2VjcmV0LmdyYW50UmVhZChwcmVTaWduVXBMYW1iZGEpO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gOC4gQ29nbml0byBVc2VyIFBvb2xcclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgY29uc3QgdXNlclBvb2wgPSBuZXcgY29nbml0by5Vc2VyUG9vbCh0aGlzLCAnQWR2aXRpeWFuc1VzZXJQb29sJywge1xyXG4gICAgICB1c2VyUG9vbE5hbWU6ICdhZHZpdGl5YW5zLXVzZXItcG9vbCcsXHJcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxyXG4gICAgICBzaWduSW5BbGlhc2VzOiB7IGVtYWlsOiB0cnVlIH0sXHJcbiAgICAgIGF1dG9WZXJpZnk6IHsgZW1haWw6IHRydWUgfSxcclxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcclxuICAgICAgICBtaW5MZW5ndGg6IDgsXHJcbiAgICAgICAgcmVxdWlyZUxvd2VyY2FzZTogdHJ1ZSxcclxuICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiBmYWxzZSxcclxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxyXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiBmYWxzZSxcclxuICAgICAgfSxcclxuICAgICAgY3VzdG9tQXR0cmlidXRlczoge1xyXG4gICAgICAgIHJvbGU6IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7IG11dGFibGU6IHRydWUgfSksXHJcbiAgICAgICAgcmVnX25vOiBuZXcgY29nbml0by5TdHJpbmdBdHRyaWJ1dGUoeyBtdXRhYmxlOiB0cnVlIH0pLFxyXG4gICAgICAgIHllYXI6IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7IG11dGFibGU6IHRydWUgfSksXHJcbiAgICAgIH0sXHJcbiAgICAgIGxhbWJkYVRyaWdnZXJzOiB7XHJcbiAgICAgICAgcHJlU2lnblVwOiBwcmVTaWduVXBMYW1iZGEsXHJcbiAgICAgIH0sXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCB1c2VyUG9vbENsaWVudCA9IG5ldyBjb2duaXRvLlVzZXJQb29sQ2xpZW50KHRoaXMsICdBZHZpdGl5YW5zVXNlclBvb2xDbGllbnQnLCB7XHJcbiAgICAgIHVzZXJQb29sLFxyXG4gICAgICB1c2VyUG9vbENsaWVudE5hbWU6ICdhZHZpdGl5YW5zLXdlYi1jbGllbnQnLFxyXG4gICAgICBnZW5lcmF0ZVNlY3JldDogZmFsc2UsXHJcbiAgICAgIGF1dGhGbG93czoge1xyXG4gICAgICAgIHVzZXJTcnA6IHRydWUsXHJcbiAgICAgICAgY3VzdG9tOiB0cnVlLFxyXG4gICAgICAgIGFkbWluVXNlclBhc3N3b3JkOiB0cnVlLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAvLyA5LiBTMyBVcGxvYWRzIEJ1Y2tldCAoY3JlYXRlZCBiZWZvcmUgTGFtYmRhIHNvIGVudiB2YXIgY2FuIHJlZmVyZW5jZSBpdClcclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgY29uc3QgdXBsb2Fkc0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0Fkdml0aXlhbnNVcGxvYWRzQnVja2V0Jywge1xyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcclxuICAgICAgY29yczogW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbczMuSHR0cE1ldGhvZHMuR0VULCBzMy5IdHRwTWV0aG9kcy5QVVQsIHMzLkh0dHBNZXRob2RzLlBPU1RdLFxyXG4gICAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxyXG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIDEwLiBCYWNrZW5kIEFQSSBMYW1iZGEgRnVuY3Rpb24gKGluIFZQQywgY29ubmVjdHMgdmlhIFJEUyBQcm94eSlcclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgY29uc3QgYXBpTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQWR2aXRpeWFuc0FwaUhhbmRsZXInLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaGFuZGxlcnMvYXBpLmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdCcpKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTUpLFxyXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXHJcbiAgICAgIHZwYyxcclxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVEIH0sXHJcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbGFtYmRhU2ddLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIERCX0hPU1Q6IHJkc1Byb3h5LmVuZHBvaW50LFxyXG4gICAgICAgIERCX1BPUlQ6ICc1NDMyJyxcclxuICAgICAgICBEQl9OQU1FOiAnYWR2aXRpeWFucycsXHJcbiAgICAgICAgREJfVVNFUjogJ3Bvc3RncmVzJyxcclxuICAgICAgICBEQl9TRUNSRVRfQVJOOiBkYlNlY3JldC5zZWNyZXRBcm4sXHJcbiAgICAgICAgREJfU1NMOiAndHJ1ZScsXHJcbiAgICAgICAgQ09HTklUT19VU0VSX1BPT0xfSUQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXHJcbiAgICAgICAgVVBMT0FEU19CVUNLRVRfTkFNRTogdXBsb2Fkc0J1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICAgIFVTRV9NT0NLOiAnZmFsc2UnLFxyXG4gICAgICAgIC8vIEZvcmNlZCB1cGRhdGUgdGltZXN0YW1wOiAyMDI2LTA4LTA1VDE2OjM1OjAwXHJcbiAgICAgICAgQlVJTERfVElNRVNUQU1QOiAnMjAyNi0wOC0wNVQxNjozNTowMCcsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICAgIGRiU2VjcmV0LmdyYW50UmVhZChhcGlMYW1iZGEpO1xyXG4gICAgdXBsb2Fkc0J1Y2tldC5ncmFudFJlYWRXcml0ZShhcGlMYW1iZGEpO1xyXG5cclxuICAgIC8vIEdyYW50IExhbWJkYSBwZXJtaXNzaW9uIHRvIGNvbm5lY3QgdG8gUkRTIFByb3h5IHZpYSBJQU0gKG9wdGlvbmFsLCB1c2luZyBwYXNzd29yZCBhdXRoIGhlcmUpXHJcbiAgICByZHNQcm94eS5ncmFudENvbm5lY3QoYXBpTGFtYmRhLCAncG9zdGdyZXMnKTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIDExLiBBUEkgR2F0ZXdheSBSRVNUIEFQSSB3aXRoIENvZ25pdG8gQXV0aG9yaXplclxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdBZHZpdGl5YW5zUmVzdEFwaScsIHtcclxuICAgICAgcmVzdEFwaU5hbWU6ICdBZHZpdGl5YW5zIFBsYWNlbWVudCBSZWFkaW5lc3MgQVBJJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgZm9yIEFkdml0aXlhbnMgU3R1ZGVudCAzNjAgcGxhdGZvcm0gKHZpYSBSRFMgUHJveHkpJyxcclxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XHJcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXHJcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXHJcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbJ0F1dGhvcml6YXRpb24nLCAnQ29udGVudC1UeXBlJ10sXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcblxyXG4gICAgY29uc3QgbGFtYmRhSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcGlMYW1iZGEpO1xyXG5cclxuICAgIC8vIFJvb3QgR0VUIC8gbWV0aG9kIOKAlCBzZXJ2ZXMgdGhlIGZyb250ZW5kIGluZGV4Lmh0bWwgb3ZlciBIVFRQU1xyXG4gICAgYXBpLnJvb3QuYWRkTWV0aG9kKCdHRVQnLCBsYW1iZGFJbnRlZ3JhdGlvbiwge1xyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5OT05FLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgcHJveHlSZXNvdXJjZSA9IGFwaS5yb290LmFkZFByb3h5KHtcclxuICAgICAgZGVmYXVsdEludGVncmF0aW9uOiBsYW1iZGFJbnRlZ3JhdGlvbixcclxuICAgICAgZGVmYXVsdE1ldGhvZE9wdGlvbnM6IHtcclxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5OT05FLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gVW5hdXRoZW50aWNhdGVkIHB1YmxpYyByb3V0ZSBmb3IgaGVhbHRoICYgYXZhaWxhYmlsaXR5IGNoZWNrXHJcbiAgICBjb25zdCBhdXRoUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnYXV0aCcpO1xyXG4gICAgY29uc3QgY2hlY2tBdmFpbGFiaWxpdHlSZXNvdXJjZSA9IGF1dGhSZXNvdXJjZS5hZGRSZXNvdXJjZSgnY2hlY2stYXZhaWxhYmlsaXR5Jyk7XHJcbiAgICBjaGVja0F2YWlsYWJpbGl0eVJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbGFtYmRhSW50ZWdyYXRpb24sIHtcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuTk9ORSxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGhlYWx0aFJlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2hlYWx0aCcpO1xyXG4gICAgaGVhbHRoUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBsYW1iZGFJbnRlZ3JhdGlvbiwge1xyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5OT05FLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgZGJJbml0UmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnZGItaW5pdCcpO1xyXG4gICAgZGJJbml0UmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBsYW1iZGFJbnRlZ3JhdGlvbiwge1xyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5OT05FLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAvLyAxMi4gUzMgRnJvbnRlbmQgSG9zdGluZyBCdWNrZXQgKFdlYnNpdGUgSG9zdGluZylcclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgY29uc3QgZnJvbnRlbmRCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdBZHZpdGl5YW5zRnJvbnRlbmRCdWNrZXQnLCB7XHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxyXG4gICAgICBwdWJsaWNSZWFkQWNjZXNzOiB0cnVlLFxyXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogbmV3IHMzLkJsb2NrUHVibGljQWNjZXNzKHtcclxuICAgICAgICBibG9ja1B1YmxpY0FjbHM6IGZhbHNlLFxyXG4gICAgICAgIGJsb2NrUHVibGljUG9saWN5OiBmYWxzZSxcclxuICAgICAgICBpZ25vcmVQdWJsaWNBY2xzOiBmYWxzZSxcclxuICAgICAgICByZXN0cmljdFB1YmxpY0J1Y2tldHM6IGZhbHNlLFxyXG4gICAgICB9KSxcclxuICAgICAgd2Vic2l0ZUluZGV4RG9jdW1lbnQ6ICdpbmRleC5odG1sJyxcclxuICAgICAgd2Vic2l0ZUVycm9yRG9jdW1lbnQ6ICdpbmRleC5odG1sJyxcclxuICAgICAgY29yczogW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcclxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbczMuSHR0cE1ldGhvZHMuR0VULCBzMy5IdHRwTWV0aG9kcy5IRUFEXSxcclxuICAgICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcclxuICAgICAgICB9LFxyXG4gICAgICBdLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAvLyBTdGFjayBPdXRwdXRzXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlHYXRld2F5VXJsJywgeyB2YWx1ZTogYXBpLnVybCB9KTtcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbElkJywgeyB2YWx1ZTogdXNlclBvb2wudXNlclBvb2xJZCB9KTtcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbENsaWVudElkJywgeyB2YWx1ZTogdXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCB9KTtcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGcm9udGVuZFdlYnNpdGVVcmwnLCB7IHZhbHVlOiBmcm9udGVuZEJ1Y2tldC5idWNrZXRXZWJzaXRlVXJsIH0pO1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Zyb250ZW5kQnVja2V0TmFtZScsIHsgdmFsdWU6IGZyb250ZW5kQnVja2V0LmJ1Y2tldE5hbWUgfSk7XHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXBsb2Fkc0J1Y2tldE5hbWUnLCB7IHZhbHVlOiB1cGxvYWRzQnVja2V0LmJ1Y2tldE5hbWUgfSk7XHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUmRzUHJveHlFbmRwb2ludCcsIHsgdmFsdWU6IHJkc1Byb3h5LmVuZHBvaW50IH0pO1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Jkc0VuZHBvaW50JywgeyB2YWx1ZTogZGJJbnN0YW5jZS5kYkluc3RhbmNlRW5kcG9pbnRBZGRyZXNzIH0pO1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RiU2VjcmV0QXJuJywgeyB2YWx1ZTogZGJTZWNyZXQuc2VjcmV0QXJuIH0pO1xyXG4gIH1cclxufVxyXG4iXX0=