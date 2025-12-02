import * as path from "path";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { defineBackend } from "@aws-amplify/backend";
import { Stack } from "aws-cdk-lib";
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod,
} from "aws-cdk-lib/aws-apigatewayv2";
import {  HttpUserPoolAuthorizer} from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Policy, PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";
import { ffbProxy } from "./functions/ffb-proxy/resource";
import { sesMailing } from "./functions/ses-mailing/resource";
import { emailUnsubscribe } from "./functions/email-unsubscribe/resource";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { storage } from "./storage/resource";


const backend = defineBackend({
  auth,
  data,
  storage,
  ffbProxy,
  sesMailing,
  emailUnsubscribe,
});

// create a new API stack
const apiStack = backend.createStack("api-stack");

// create Lambda integrations
const httpLambdaIntegration = new HttpLambdaIntegration(
  "LambdaIntegration",
  backend.ffbProxy.resources.lambda
);

const sesMailingIntegration = new HttpLambdaIntegration(
  "SesMailingIntegration",
  backend.sesMailing.resources.lambda
);

const emailUnsubscribeIntegration = new HttpLambdaIntegration(
  "EmailUnsubscribeIntegration",
  backend.emailUnsubscribe.resources.lambda
);


// create a User Pool authorizer
const userPoolAuthorizer = new HttpUserPoolAuthorizer(
  "userPoolAuth",
  backend.auth.resources.userPool,
  { userPoolClients: [backend.auth.resources.userPoolClient] }
);

// create a new HTTP API with IAM as default authorizer
const httpApi = new HttpApi(apiStack, "HttpApi", {
  apiName: "ffbProxyApi",
  corsPreflight: {
    allowMethods: [
      CorsHttpMethod.GET,
      CorsHttpMethod.POST,
      CorsHttpMethod.PUT,
      CorsHttpMethod.DELETE,
    ],
    allowOrigins: ["*"],
    allowHeaders: ["*"],
  },
  createDefaultStage: true,
});

// add routes to the API

httpApi.addRoutes({
  path: "/api/send-email",
  methods: [HttpMethod.POST],
  integration: sesMailingIntegration,
  authorizer: userPoolAuthorizer,
});

// Public route for email unsubscribe (no auth required)
httpApi.addRoutes({
  path: "/api/unsubscribe",
  methods: [HttpMethod.GET],
  integration: emailUnsubscribeIntegration,
});

httpApi.addRoutes({
  path: "/v1/{proxy+}",
  methods: [ HttpMethod.PUT, HttpMethod.POST, HttpMethod.DELETE],
  integration: httpLambdaIntegration,
  authorizer: userPoolAuthorizer,
});
httpApi.addRoutes({
  path: "/v1/{proxy+}",
  methods: [HttpMethod.GET],
  integration: httpLambdaIntegration,
});

// create a new IAM policy to allow Invoke access to the API
const apiPolicy = new Policy(apiStack, "ApiPolicy", {
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["execute-api:Invoke"],
      resources: [
        `${httpApi.arnForExecuteApi("*", "/v1/*")}`,        // `${httpApi.arnForExecuteApi("*", "/items")}`,
      ],
    }),
  ],
});

// attach the policy to the authenticated and unauthenticated IAM roles
backend.auth.resources.authenticatedUserIamRole.attachInlinePolicy(apiPolicy);
backend.auth.resources.unauthenticatedUserIamRole.attachInlinePolicy(apiPolicy);

// Grant both email Lambdas access to Member table
const memberTable = backend.data.resources.tables['Member'];
memberTable.grantReadWriteData(backend.emailUnsubscribe.resources.lambda);
memberTable.grantReadData(backend.sesMailing.resources.lambda); // Read-only pour vérifier accept_mailing

// Grant SES permissions to sesMailing Lambda
const sesPolicy = new Policy(apiStack, "SesMailingPolicy", {
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["ses:SendEmail", "ses:SendRawEmail"],
      resources: ["*"], // Ou spécifier votre domaine vérifié
    }),
  ],
});
backend.sesMailing.resources.lambda.role?.attachInlinePolicy(sesPolicy);

// Set environment variable for table name
backend.emailUnsubscribe.addEnvironment('MEMBER_TABLE_NAME', memberTable.tableName);
backend.sesMailing.addEnvironment('MEMBER_TABLE_NAME', memberTable.tableName);

// add outputs to the configuration file
backend.addOutput({
  custom: {
    API: {
      [httpApi.httpApiName as string]: {
        endpoint: httpApi.url,
        region: Stack.of(httpApi).region,
        apiName: httpApi.httpApiName,
      },
    },
  },
});