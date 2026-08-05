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
exports.AdvitiyansStack = AdvitiyansStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWR2aXRpeWFucy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFkdml0aXlhbnMtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBRW5DLDJDQUEyQztBQUMzQywyQ0FBMkM7QUFDM0MsaUVBQWlFO0FBQ2pFLG1EQUFtRDtBQUNuRCxpREFBaUQ7QUFDakQseURBQXlEO0FBQ3pELHlDQUF5QztBQUl6Qyw2QkFBNkI7QUFFN0IsTUFBYSxlQUFnQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzVDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsMkVBQTJFO1FBQzNFLFNBQVM7UUFDVCwyRUFBMkU7UUFDM0UsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDN0MsTUFBTSxFQUFFLENBQUM7WUFDVCxXQUFXLEVBQUUsQ0FBQyxFQUFFLCtDQUErQztZQUMvRCxtQkFBbUIsRUFBRTtnQkFDbkI7b0JBQ0UsUUFBUSxFQUFFLEVBQUU7b0JBQ1osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsTUFBTTtpQkFDbEM7Z0JBQ0Q7b0JBQ0UsUUFBUSxFQUFFLEVBQUU7b0JBQ1osSUFBSSxFQUFFLFVBQVU7b0JBQ2hCLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLGdCQUFnQjtpQkFDNUM7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILGlEQUFpRDtRQUNqRCxHQUFHLENBQUMsa0JBQWtCLENBQUMsWUFBWSxFQUFFO1lBQ25DLE9BQU8sRUFBRSxHQUFHLENBQUMsNEJBQTRCLENBQUMsRUFBRTtTQUM3QyxDQUFDLENBQUM7UUFFSCwyRUFBMkU7UUFDM0UscUJBQXFCO1FBQ3JCLDJFQUEyRTtRQUUz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LEVBQUUsY0FBYyxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQztRQUN4RixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFLEVBQUUsS0FBSyxFQUFFLGNBQWMsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUM7UUFDMUYsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRSxFQUFFLEtBQUssRUFBRSxjQUFjLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztRQUNwRixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFLEVBQUUsS0FBSyxFQUFFLGFBQWEsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO1FBQ2xGLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDMUUsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUUsRUFBRSxLQUFLLEVBQUUsVUFBVSxDQUFDLHlCQUF5QixFQUFFLENBQUMsQ0FBQztRQUN4RixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRSxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQztJQUN4RSxDQUFDO0NBQ0Y7QUFwVUQsMENBb1VDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMgcmRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1yZHMnO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udCc7XG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuZXhwb3J0IGNsYXNzIEFkdml0aXlhbnNTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIDEuIFZQQ1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGNvbnN0IHZwYyA9IG5ldyBlYzIuVnBjKHRoaXMsICdBZHZpdGl5YW5zVnBjJywge1xuICAgICAgbWF4QXpzOiAyLFxuICAgICAgbmF0R2F0ZXdheXM6IDAsIC8vIENvc3Qgb3B0aW1pemVkOiBhdm9pZCBOYXRHYXRld2F5IGhvdXJseSBjb3N0XG4gICAgICBzdWJuZXRDb25maWd1cmF0aW9uOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBjaWRyTWFzazogMjQsXG4gICAgICAgICAgbmFtZTogJ1B1YmxpYycsXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFVCTElDLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICAgIG5hbWU6ICdJc29sYXRlZCcsXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9JU09MQVRFRCxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBHYXRld2F5IEVuZHBvaW50cyBmb3IgUzMgKGZyZWUsIG5vIE5BVCBuZWVkZWQpXG4gICAgdnBjLmFkZEdhdGV3YXlFbmRwb2ludCgnUzNFbmRwb2ludCcsIHtcbiAgICAgIHNlcnZpY2U6IGVjMi5HYXRld2F5VnBjRW5kcG9pbnRBd3NTZXJ2aWNlLlMzLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gMi4gU2VjdXJpdHkgR3JvdXBzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBMYW1iZGEgU2VjdXJpdHkgR3JvdXBcbiAgICBjb25zdCBsYW1iZGFTZyA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnTGFtYmRhU2VjdXJpdHlHcm91cCcsIHtcbiAgICAgIHZwYyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgZ3JvdXAgZm9yIExhbWJkYSBmdW5jdGlvbnMnLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogZmFsc2UsXG4gICAgfSk7XG5cbiAgICAvLyBSRFMgUHJveHkgU2VjdXJpdHkgR3JvdXBcbiAgICBjb25zdCBwcm94eVNnID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdSZHNQcm94eVNlY3VyaXR5R3JvdXAnLCB7XG4gICAgICB2cGMsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBSRFMgUHJveHknLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogZmFsc2UsXG4gICAgfSk7XG5cbiAgICAvLyBSRFMgSW5zdGFuY2UgU2VjdXJpdHkgR3JvdXBcbiAgICBjb25zdCBkYlNnID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdSZHNTZWN1cml0eUdyb3VwJywge1xuICAgICAgdnBjLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBncm91cCBmb3IgUkRTIFBvc3RncmVTUUwgaW5zdGFuY2UnLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogZmFsc2UsXG4gICAgfSk7XG5cbiAgICAvLyBWUEMgRW5kcG9pbnQgU2VjdXJpdHkgR3JvdXBcbiAgICBjb25zdCB2cGNlU2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnVnBjZVNlY3VyaXR5R3JvdXAnLCB7XG4gICAgICB2cGMsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBWUEMgSW50ZXJmYWNlIEVuZHBvaW50cycsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiBmYWxzZSxcbiAgICB9KTtcblxuICAgIC8vIC0tLSBTZWN1cml0eSBHcm91cCBSdWxlcyAtLS1cbiAgICAvLyBMYW1iZGEg4oaSIFJEUyBQcm94eSAocG9ydCA1NDMyKVxuICAgIGxhbWJkYVNnLmFkZEVncmVzc1J1bGUocHJveHlTZywgZWMyLlBvcnQudGNwKDU0MzIpLCAnTGFtYmRhIHRvIFJEUyBQcm94eScpO1xuICAgIHByb3h5U2cuYWRkSW5ncmVzc1J1bGUobGFtYmRhU2csIGVjMi5Qb3J0LnRjcCg1NDMyKSwgJ0FsbG93IExhbWJkYSB0byBSRFMgUHJveHknKTtcblxuICAgIC8vIFJEUyBQcm94eSDihpIgUkRTIChwb3J0IDU0MzIpXG4gICAgcHJveHlTZy5hZGRFZ3Jlc3NSdWxlKGRiU2csIGVjMi5Qb3J0LnRjcCg1NDMyKSwgJ1JEUyBQcm94eSB0byBSRFMnKTtcbiAgICBkYlNnLmFkZEluZ3Jlc3NSdWxlKHByb3h5U2csIGVjMi5Qb3J0LnRjcCg1NDMyKSwgJ0FsbG93IFJEUyBQcm94eSB0byBSRFMnKTtcblxuICAgIC8vIExhbWJkYSDihpIgVlBDIEVuZHBvaW50cyAocG9ydCA0NDMgZm9yIFNlY3JldHMgTWFuYWdlciwgZXRjLilcbiAgICBsYW1iZGFTZy5hZGRFZ3Jlc3NSdWxlKHZwY2VTZWN1cml0eUdyb3VwLCBlYzIuUG9ydC50Y3AoNDQzKSwgJ0xhbWJkYSB0byBWUEMgRW5kcG9pbnRzJyk7XG4gICAgdnBjZVNlY3VyaXR5R3JvdXAuYWRkSW5ncmVzc1J1bGUobGFtYmRhU2csIGVjMi5Qb3J0LnRjcCg0NDMpLCAnQWxsb3cgTGFtYmRhIHRvIFZQQyBFbmRwb2ludHMnKTtcblxuICAgIC8vIFJEUyBQcm94eSDihpIgU2VjcmV0cyBNYW5hZ2VyIFZQQyBFbmRwb2ludCAocG9ydCA0NDMpXG4gICAgcHJveHlTZy5hZGRFZ3Jlc3NSdWxlKHZwY2VTZWN1cml0eUdyb3VwLCBlYzIuUG9ydC50Y3AoNDQzKSwgJ1JEUyBQcm94eSB0byBTZWNyZXRzIE1hbmFnZXInKTtcbiAgICB2cGNlU2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShwcm94eVNnLCBlYzIuUG9ydC50Y3AoNDQzKSwgJ0FsbG93IFJEUyBQcm94eSB0byBTZWNyZXRzIE1hbmFnZXInKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIDMuIFZQQyBJbnRlcmZhY2UgRW5kcG9pbnRzIChyZXF1aXJlZDogbm8gTkFUIEdhdGV3YXkpXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBTZWNyZXRzIE1hbmFnZXIgZW5kcG9pbnQg4oCUIG5lZWRlZCBieSBMYW1iZGEgYW5kIFJEUyBQcm94eVxuICAgIHZwYy5hZGRJbnRlcmZhY2VFbmRwb2ludCgnU2VjcmV0c01hbmFnZXJFbmRwb2ludCcsIHtcbiAgICAgIHNlcnZpY2U6IGVjMi5JbnRlcmZhY2VWcGNFbmRwb2ludEF3c1NlcnZpY2UuU0VDUkVUU19NQU5BR0VSLFxuICAgICAgc3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVEIH0sXG4gICAgICBzZWN1cml0eUdyb3VwczogW3ZwY2VTZWN1cml0eUdyb3VwXSxcbiAgICAgIHByaXZhdGVEbnNFbmFibGVkOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gU1RTIGVuZHBvaW50IOKAlCBuZWVkZWQgZm9yIElBTSBhdXRoZW50aWNhdGlvbiB3aXRoIFJEUyBQcm94eVxuICAgIHZwYy5hZGRJbnRlcmZhY2VFbmRwb2ludCgnU3RzRW5kcG9pbnQnLCB7XG4gICAgICBzZXJ2aWNlOiBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnRBd3NTZXJ2aWNlLlNUUyxcbiAgICAgIHN1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9JU09MQVRFRCB9LFxuICAgICAgc2VjdXJpdHlHcm91cHM6IFt2cGNlU2VjdXJpdHlHcm91cF0sXG4gICAgICBwcml2YXRlRG5zRW5hYmxlZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIDQuIERhdGFiYXNlIFNlY3JldHMgTWFuYWdlclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGNvbnN0IGRiU2VjcmV0ID0gbmV3IHNlY3JldHNtYW5hZ2VyLlNlY3JldCh0aGlzLCAnQWR2aXRpeWFuc0RiU2VjcmV0Jywge1xuICAgICAgc2VjcmV0TmFtZTogJ2Fkdml0aXlhbnMtZGItY3JlZGVudGlhbHMnLFxuICAgICAgZ2VuZXJhdGVTZWNyZXRTdHJpbmc6IHtcbiAgICAgICAgc2VjcmV0U3RyaW5nVGVtcGxhdGU6IEpTT04uc3RyaW5naWZ5KHsgdXNlcm5hbWU6ICdwb3N0Z3JlcycgfSksXG4gICAgICAgIGdlbmVyYXRlU3RyaW5nS2V5OiAncGFzc3dvcmQnLFxuICAgICAgICBleGNsdWRlUHVuY3R1YXRpb246IHRydWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gNS4gUkRTIFBvc3RncmVTUUwgSW5zdGFuY2UgKGRiLnQ0Zy5taWNybywgU2luZ2xlLUFaKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGNvbnN0IGRiSW5zdGFuY2UgPSBuZXcgcmRzLkRhdGFiYXNlSW5zdGFuY2UodGhpcywgJ0Fkdml0aXlhbnNSRFMnLCB7XG4gICAgICBlbmdpbmU6IHJkcy5EYXRhYmFzZUluc3RhbmNlRW5naW5lLnBvc3RncmVzKHtcbiAgICAgICAgdmVyc2lvbjogcmRzLlBvc3RncmVzRW5naW5lVmVyc2lvbi5WRVJfMTUsXG4gICAgICB9KSxcbiAgICAgIGluc3RhbmNlVHlwZTogZWMyLkluc3RhbmNlVHlwZS5vZihlYzIuSW5zdGFuY2VDbGFzcy5UNEcsIGVjMi5JbnN0YW5jZVNpemUuTUlDUk8pLFxuICAgICAgdnBjLFxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVEIH0sXG4gICAgICBzZWN1cml0eUdyb3VwczogW2RiU2ddLFxuICAgICAgYWxsb2NhdGVkU3RvcmFnZTogMjAsXG4gICAgICBtYXhBbGxvY2F0ZWRTdG9yYWdlOiA1MCxcbiAgICAgIGNyZWRlbnRpYWxzOiByZHMuQ3JlZGVudGlhbHMuZnJvbVNlY3JldChkYlNlY3JldCksXG4gICAgICBkYXRhYmFzZU5hbWU6ICdhZHZpdGl5YW5zJyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvTWlub3JWZXJzaW9uVXBncmFkZTogdHJ1ZSxcbiAgICAgIHB1YmxpY2x5QWNjZXNzaWJsZTogZmFsc2UsXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyA2LiBSRFMgUHJveHkgKENvbm5lY3Rpb24gUG9vbGluZyBmb3IgTGFtYmRhKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGNvbnN0IHJkc1Byb3h5ID0gbmV3IHJkcy5EYXRhYmFzZVByb3h5KHRoaXMsICdBZHZpdGl5YW5zUmRzUHJveHknLCB7XG4gICAgICBwcm94eVRhcmdldDogcmRzLlByb3h5VGFyZ2V0LmZyb21JbnN0YW5jZShkYkluc3RhbmNlKSxcbiAgICAgIHNlY3JldHM6IFtkYlNlY3JldF0sXG4gICAgICB2cGMsXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfSVNPTEFURUQgfSxcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbcHJveHlTZ10sXG4gICAgICBkYlByb3h5TmFtZTogJ2Fkdml0aXlhbnMtcmRzLXByb3h5JyxcbiAgICAgIHJlcXVpcmVUTFM6IHRydWUsXG4gICAgICBpZGxlQ2xpZW50VGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMzApLFxuICAgICAgbWF4Q29ubmVjdGlvbnNQZXJjZW50OiA5MCxcbiAgICAgIG1heElkbGVDb25uZWN0aW9uc1BlcmNlbnQ6IDUwLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gNy4gUHJlIFNpZ24tVXAgTGFtYmRhIFRyaWdnZXJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBjb25zdCBwcmVTaWduVXBMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDb2duaXRvUHJlU2lnblVwVHJpZ2dlcicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2hhbmRsZXJzL2NvZ25pdG8tcHJlLXNpZ251cC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxuICAgICAgdnBjLFxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVEIH0sXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNnXSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIERCX0hPU1Q6IHJkc1Byb3h5LmVuZHBvaW50LFxuICAgICAgICBEQl9QT1JUOiAnNTQzMicsXG4gICAgICAgIERCX05BTUU6ICdhZHZpdGl5YW5zJyxcbiAgICAgICAgREJfVVNFUjogJ3Bvc3RncmVzJyxcbiAgICAgICAgREJfU0VDUkVUX0FSTjogZGJTZWNyZXQuc2VjcmV0QXJuLFxuICAgICAgICBEQl9TU0w6ICd0cnVlJyxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgZGJTZWNyZXQuZ3JhbnRSZWFkKHByZVNpZ25VcExhbWJkYSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyA4LiBDb2duaXRvIFVzZXIgUG9vbFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGNvbnN0IHVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ0Fkdml0aXlhbnNVc2VyUG9vbCcsIHtcbiAgICAgIHVzZXJQb29sTmFtZTogJ2Fkdml0aXlhbnMtdXNlci1wb29sJyxcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxuICAgICAgc2lnbkluQWxpYXNlczogeyBlbWFpbDogdHJ1ZSB9LFxuICAgICAgYXV0b1ZlcmlmeTogeyBlbWFpbDogdHJ1ZSB9LFxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcbiAgICAgICAgbWluTGVuZ3RoOiA4LFxuICAgICAgICByZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiBmYWxzZSxcbiAgICAgICAgcmVxdWlyZURpZ2l0czogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZVN5bWJvbHM6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIGN1c3RvbUF0dHJpYnV0ZXM6IHtcbiAgICAgICAgcm9sZTogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHsgbXV0YWJsZTogdHJ1ZSB9KSxcbiAgICAgICAgcmVnX25vOiBuZXcgY29nbml0by5TdHJpbmdBdHRyaWJ1dGUoeyBtdXRhYmxlOiB0cnVlIH0pLFxuICAgICAgICB5ZWFyOiBuZXcgY29nbml0by5TdHJpbmdBdHRyaWJ1dGUoeyBtdXRhYmxlOiB0cnVlIH0pLFxuICAgICAgfSxcbiAgICAgIGxhbWJkYVRyaWdnZXJzOiB7XG4gICAgICAgIHByZVNpZ25VcDogcHJlU2lnblVwTGFtYmRhLFxuICAgICAgfSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICBjb25zdCB1c2VyUG9vbENsaWVudCA9IG5ldyBjb2duaXRvLlVzZXJQb29sQ2xpZW50KHRoaXMsICdBZHZpdGl5YW5zVXNlclBvb2xDbGllbnQnLCB7XG4gICAgICB1c2VyUG9vbCxcbiAgICAgIHVzZXJQb29sQ2xpZW50TmFtZTogJ2Fkdml0aXlhbnMtd2ViLWNsaWVudCcsXG4gICAgICBnZW5lcmF0ZVNlY3JldDogZmFsc2UsXG4gICAgICBhdXRoRmxvd3M6IHtcbiAgICAgICAgdXNlclNycDogdHJ1ZSxcbiAgICAgICAgY3VzdG9tOiB0cnVlLFxuICAgICAgICBhZG1pblVzZXJQYXNzd29yZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyA5LiBTMyBVcGxvYWRzIEJ1Y2tldCAoY3JlYXRlZCBiZWZvcmUgTGFtYmRhIHNvIGVudiB2YXIgY2FuIHJlZmVyZW5jZSBpdClcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBjb25zdCB1cGxvYWRzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnQWR2aXRpeWFuc1VwbG9hZHNCdWNrZXQnLCB7XG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXG4gICAgICBjb3JzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogW3MzLkh0dHBNZXRob2RzLkdFVCwgczMuSHR0cE1ldGhvZHMuUFVULCBzMy5IdHRwTWV0aG9kcy5QT1NUXSxcbiAgICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIDEwLiBCYWNrZW5kIEFQSSBMYW1iZGEgRnVuY3Rpb24gKGluIFZQQywgY29ubmVjdHMgdmlhIFJEUyBQcm94eSlcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBjb25zdCBhcGlMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBZHZpdGl5YW5zQXBpSGFuZGxlcicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2hhbmRsZXJzL2FwaS5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vYmFja2VuZC9kaXN0JykpLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTUpLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdnBjLFxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVEIH0sXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNnXSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIERCX0hPU1Q6IHJkc1Byb3h5LmVuZHBvaW50LFxuICAgICAgICBEQl9QT1JUOiAnNTQzMicsXG4gICAgICAgIERCX05BTUU6ICdhZHZpdGl5YW5zJyxcbiAgICAgICAgREJfVVNFUjogJ3Bvc3RncmVzJyxcbiAgICAgICAgREJfU0VDUkVUX0FSTjogZGJTZWNyZXQuc2VjcmV0QXJuLFxuICAgICAgICBEQl9TU0w6ICd0cnVlJyxcbiAgICAgICAgQ09HTklUT19VU0VSX1BPT0xfSUQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgIFVQTE9BRFNfQlVDS0VUX05BTUU6IHVwbG9hZHNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgVVNFX01PQ0s6ICdmYWxzZScsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIGRiU2VjcmV0LmdyYW50UmVhZChhcGlMYW1iZGEpO1xuICAgIHVwbG9hZHNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoYXBpTGFtYmRhKTtcblxuICAgIC8vIEdyYW50IExhbWJkYSBwZXJtaXNzaW9uIHRvIGNvbm5lY3QgdG8gUkRTIFByb3h5IHZpYSBJQU0gKG9wdGlvbmFsLCB1c2luZyBwYXNzd29yZCBhdXRoIGhlcmUpXG4gICAgcmRzUHJveHkuZ3JhbnRDb25uZWN0KGFwaUxhbWJkYSwgJ3Bvc3RncmVzJyk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyAxMS4gQVBJIEdhdGV3YXkgUkVTVCBBUEkgd2l0aCBDb2duaXRvIEF1dGhvcml6ZXJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdBZHZpdGl5YW5zUmVzdEFwaScsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiAnQWR2aXRpeWFucyBQbGFjZW1lbnQgUmVhZGluZXNzIEFQSScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBmb3IgQWR2aXRpeWFucyBTdHVkZW50IDM2MCBwbGF0Zm9ybSAodmlhIFJEUyBQcm94eSknLFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLFxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbJ0F1dGhvcml6YXRpb24nLCAnQ29udGVudC1UeXBlJ10sXG4gICAgICB9LFxuICAgIH0pO1xuXG5cbiAgICBjb25zdCBsYW1iZGFJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFwaUxhbWJkYSk7XG5cbiAgICAvLyBSb290IEdFVCAvIG1ldGhvZCDigJQgc2VydmVzIHRoZSBmcm9udGVuZCBpbmRleC5odG1sIG92ZXIgSFRUUFNcbiAgICBhcGkucm9vdC5hZGRNZXRob2QoJ0dFVCcsIGxhbWJkYUludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5OT05FLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcHJveHlSZXNvdXJjZSA9IGFwaS5yb290LmFkZFByb3h5KHtcbiAgICAgIGRlZmF1bHRJbnRlZ3JhdGlvbjogbGFtYmRhSW50ZWdyYXRpb24sXG4gICAgICBkZWZhdWx0TWV0aG9kT3B0aW9uczoge1xuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5OT05FLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFVuYXV0aGVudGljYXRlZCBwdWJsaWMgcm91dGUgZm9yIGhlYWx0aCAmIGF2YWlsYWJpbGl0eSBjaGVja1xuICAgIGNvbnN0IGF1dGhSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKCdhdXRoJyk7XG4gICAgY29uc3QgY2hlY2tBdmFpbGFiaWxpdHlSZXNvdXJjZSA9IGF1dGhSZXNvdXJjZS5hZGRSZXNvdXJjZSgnY2hlY2stYXZhaWxhYmlsaXR5Jyk7XG4gICAgY2hlY2tBdmFpbGFiaWxpdHlSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIGxhbWJkYUludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5OT05FLFxuICAgIH0pO1xuXG4gICAgY29uc3QgaGVhbHRoUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnaGVhbHRoJyk7XG4gICAgaGVhbHRoUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBsYW1iZGFJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuTk9ORSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGRiSW5pdFJlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2RiLWluaXQnKTtcbiAgICBkYkluaXRSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIGxhbWJkYUludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5OT05FLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gMTIuIFMzIEZyb250ZW5kIEhvc3RpbmcgQnVja2V0IChXZWJzaXRlIEhvc3RpbmcpXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgY29uc3QgZnJvbnRlbmRCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdBZHZpdGl5YW5zRnJvbnRlbmRCdWNrZXQnLCB7XG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXG4gICAgICBwdWJsaWNSZWFkQWNjZXNzOiB0cnVlLFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IG5ldyBzMy5CbG9ja1B1YmxpY0FjY2Vzcyh7XG4gICAgICAgIGJsb2NrUHVibGljQWNsczogZmFsc2UsXG4gICAgICAgIGJsb2NrUHVibGljUG9saWN5OiBmYWxzZSxcbiAgICAgICAgaWdub3JlUHVibGljQWNsczogZmFsc2UsXG4gICAgICAgIHJlc3RyaWN0UHVibGljQnVja2V0czogZmFsc2UsXG4gICAgICB9KSxcbiAgICAgIHdlYnNpdGVJbmRleERvY3VtZW50OiAnaW5kZXguaHRtbCcsXG4gICAgICB3ZWJzaXRlRXJyb3JEb2N1bWVudDogJ2luZGV4Lmh0bWwnLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gU3RhY2sgT3V0cHV0c1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlHYXRld2F5VXJsJywgeyB2YWx1ZTogYXBpLnVybCB9KTtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xJZCcsIHsgdmFsdWU6IHVzZXJQb29sLnVzZXJQb29sSWQgfSk7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sQ2xpZW50SWQnLCB7IHZhbHVlOiB1c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGcm9udGVuZFdlYnNpdGVVcmwnLCB7IHZhbHVlOiBmcm9udGVuZEJ1Y2tldC5idWNrZXRXZWJzaXRlVXJsIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGcm9udGVuZEJ1Y2tldE5hbWUnLCB7IHZhbHVlOiBmcm9udGVuZEJ1Y2tldC5idWNrZXROYW1lIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVcGxvYWRzQnVja2V0TmFtZScsIHsgdmFsdWU6IHVwbG9hZHNCdWNrZXQuYnVja2V0TmFtZSB9KTtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUmRzUHJveHlFbmRwb2ludCcsIHsgdmFsdWU6IHJkc1Byb3h5LmVuZHBvaW50IH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdSZHNFbmRwb2ludCcsIHsgdmFsdWU6IGRiSW5zdGFuY2UuZGJJbnN0YW5jZUVuZHBvaW50QWRkcmVzcyB9KTtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGJTZWNyZXRBcm4nLCB7IHZhbHVlOiBkYlNlY3JldC5zZWNyZXRBcm4gfSk7XG4gIH1cbn1cbiJdfQ==