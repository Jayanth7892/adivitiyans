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
import * as path from 'path';

export class AdvitiyansStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. VPC
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

    // Gateway Endpoints for S3 to keep costs minimal without NAT Gateway
    vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // 2. Database Secrets Manager
    const dbSecret = new secretsmanager.Secret(this, 'AdvitiyansDbSecret', {
      secretName: 'advitiyans-db-credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludePunctuation: true,
      },
    });

    // 3. RDS PostgreSQL Instance (db.t4g.micro, Single-AZ)
    const dbInstance = new rds.DatabaseInstance(this, 'AdvitiyansRDS', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      allocatedStorage: 20,
      maxAllocatedStorage: 50,
      credentials: rds.Credentials.fromSecret(dbSecret),
      databaseName: 'advitiyans',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoMinorVersionUpgrade: true,
      publiclyAccessible: false,
    });

    // 4. Pre Sign-Up Lambda Trigger
    const preSignUpLambda = new lambda.Function(this, 'CognitoPreSignUpTrigger', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handlers/cognito-pre-signup.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
      environment: {
        DB_HOST: dbInstance.dbInstanceEndpointAddress,
        DB_NAME: 'advitiyans',
        DB_USER: 'postgres',
        DB_SECRET_ARN: dbSecret.secretArn,
      },
    });
    dbSecret.grantRead(preSignUpLambda);

    // 5. Cognito User Pool
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

    // 6. Backend API Lambda Function
    const apiLambda = new lambda.Function(this, 'AdvitiyansApiHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handlers/api.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
      timeout: cdk.Duration.seconds(15),
      environment: {
        DB_HOST: dbInstance.dbInstanceEndpointAddress,
        DB_NAME: 'advitiyans',
        DB_USER: 'postgres',
        DB_SECRET_ARN: dbSecret.secretArn,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
      },
    });
    dbSecret.grantRead(apiLambda);

    // 7. API Gateway REST API with Cognito Authorizer
    const api = new apigateway.RestApi(this, 'AdvitiyansRestApi', {
      restApiName: 'Advitiyans Placement Readiness API',
      description: 'API for Advitiyans Student 360 platform',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Authorization', 'Content-Type'],
      },
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'AdvitiyansCognitoAuthorizer', {
      cognitoUserPools: [userPool],
    });

    const lambdaIntegration = new apigateway.LambdaIntegration(apiLambda);
    const proxyResource = api.root.addProxy({
      defaultIntegration: lambdaIntegration,
      defaultMethodOptions: {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
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

    // 8. S3 Uploads Bucket
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
    uploadsBucket.grantReadWrite(apiLambda);

    // 9. S3 Frontend Hosting Bucket & CloudFront Distribution
    const frontendBucket = new s3.Bucket(this, 'AdvitiyansFrontendBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    const distribution = new cloudfront.Distribution(this, 'AdvitiyansCloudFront', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // Stack Outputs
    new cdk.CfnOutput(this, 'ApiGatewayUrl', { value: api.url });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'CloudFrontUrl', { value: `https://${distribution.distributionDomainName}` });
    new cdk.CfnOutput(this, 'FrontendBucketName', { value: frontendBucket.bucketName });
  }
}
