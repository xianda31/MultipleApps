import * as path from "path";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { defineBackend } from "@aws-amplify/backend";
import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod,
} from "aws-cdk-lib/aws-apigatewayv2";
import {  HttpUserPoolAuthorizer} from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Policy, PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";
import { CfnTable } from "aws-cdk-lib/aws-dynamodb";
import { ffbProxy } from "./functions/ffb-proxy/resource";
import { sesMailing } from "./functions/ses-mailing/resource";
import { emailUnsubscribe } from "./functions/email-unsubscribe/resource";
import { stripeCheckout } from "./functions/stripe-checkout/resource";
import { stripeWebhooks } from "./functions/stripe-webhooks/resource";
import { stripeConnectionToken } from "./functions/stripe-connection-token/resource";
import { surveyRespond } from "./functions/survey-respond/resource";
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
  stripeCheckout,
  stripeWebhooks,
  stripeConnectionToken,
  surveyRespond,
});

// Add SSM GetParameter permission to ffbProxy Lambda function
backend.ffbProxy.resources.lambda.role?.addToPrincipalPolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["ssm:GetParameter"],
    resources: ["arn:aws:ssm:eu-west-3:*:parameter/FFB_API_V2_TOKEN"],
  })
);

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

const stripeCheckoutIntegration = new HttpLambdaIntegration(
  "StripeCheckoutIntegration",
  backend.stripeCheckout.resources.lambda
);

const stripeWebhooksIntegration = new HttpLambdaIntegration(
  "StripeWebhooksIntegration",
  backend.stripeWebhooks.resources.lambda
);

const stripeConnectionTokenIntegration = new HttpLambdaIntegration(
  "StripeConnectionTokenIntegration",
  backend.stripeConnectionToken.resources.lambda
);

const surveyRespondIntegration = new HttpLambdaIntegration(
  "SurveyRespondIntegration",
  backend.surveyRespond.resources.lambda
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

// Public routes for survey response (token = auth mechanism)
httpApi.addRoutes({
  path: "/api/survey/respond",
  methods: [HttpMethod.GET, HttpMethod.POST, HttpMethod.PATCH],
  integration: surveyRespondIntegration,
});

// 🔒 Stripe Checkout - Autorisation optionnelle (visiteur peut acheter sans compte)
httpApi.addRoutes({
  path: "/api/stripe/checkout",
  methods: [HttpMethod.POST],
  integration: stripeCheckoutIntegration,
  // PAS de authorization -> permet achat anonyme ET connecté
});

// Stripe Receipt - Récupération du reçu de paiement
httpApi.addRoutes({
  path: "/api/stripe/receipt",
  methods: [HttpMethod.POST],
  integration: stripeCheckoutIntegration,
});

// 🔒 Stripe Payout Lookup - Admin uniquement (réconciliation payout)
httpApi.addRoutes({
  path: "/api/stripe/payout-lookup",
  methods: [HttpMethod.POST],
  integration: stripeCheckoutIntegration,
  authorizer: userPoolAuthorizer,
});

// 🔒 Stripe Payout List - liste les virements récents (Admin)
httpApi.addRoutes({
  path: "/api/stripe/payout-list",
  methods: [HttpMethod.GET],
  integration: stripeCheckoutIntegration,
  authorizer: userPoolAuthorizer,
});

// 🔒 Stripe Webhook Health - santé des webhooks Stripe (Admin)
httpApi.addRoutes({
  path: "/api/stripe/webhook-health",
  methods: [HttpMethod.GET],
  integration: stripeCheckoutIntegration,
  authorizer: userPoolAuthorizer,
});

// 🔒 Stripe Webhooks - Pas d'autorisation (Stripe appel en webhook)
httpApi.addRoutes({
  path: "/api/stripe/webhooks",
  methods: [HttpMethod.POST],
  integration: stripeWebhooksIntegration,
  // PAS de authorization -> Stripe doit pouvoir appeler
});

// 🔒 Stripe Terminal - Connection Token (staff uniquement)
httpApi.addRoutes({
  path: "/api/stripe/connection-token",
  methods: [HttpMethod.POST],
  integration: stripeConnectionTokenIntegration,
  authorizer: userPoolAuthorizer,
});

// 🔒 Stripe Terminal - PaymentIntent card_present (staff uniquement)
httpApi.addRoutes({
  path: "/api/stripe/terminal-payment-intent",
  methods: [HttpMethod.POST],
  integration: stripeCheckoutIntegration,
  authorizer: userPoolAuthorizer,
});

// FFB V2 routes (canonical namespace)
httpApi.addRoutes({
  path: "/api/ffb/v2/{proxy+}",
  methods: [ HttpMethod.PUT, HttpMethod.POST, HttpMethod.DELETE],
  integration: httpLambdaIntegration,
  authorizer: userPoolAuthorizer,
});
httpApi.addRoutes({
  path: "/api/ffb/v2/{proxy+}",
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

// Grant stripeCheckout access to SaleItem table
const saleItemTable = backend.data.resources.tables['SaleItem'];
saleItemTable.grantReadData(backend.stripeCheckout.resources.lambda);
backend.stripeCheckout.addEnvironment('SALE_ITEM_TABLE_NAME', saleItemTable.tableName);

// Grant stripeWebhooks write access to StripeTransaction table (data recording only)
const stripeTransactionTable = backend.data.resources.tables['StripeTransaction'];
stripeTransactionTable.grantReadWriteData(backend.stripeWebhooks.resources.lambda);
backend.stripeWebhooks.addEnvironment('STRIPE_TRANSACTION_TABLE_NAME', stripeTransactionTable.tableName);
backend.stripeWebhooks.resources.lambda.role?.addToPrincipalPolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['ses:SendEmail', 'ses:SendRawEmail'],
    resources: ['*'],
  })
);

// Activer TTL DynamoDB sur le champ 'ttl' (purge auto 3 ans)
// Amplify Gen 2 imbrique la table dans un construct enfant — on cherche le CfnTable en profondeur
const cfnStripeTransactionTable = stripeTransactionTable.node.tryFindChild('Resource') as CfnTable
  ?? stripeTransactionTable.node.children.find((c: Construct): c is CfnTable => c instanceof CfnTable);
if (cfnStripeTransactionTable) {
  cfnStripeTransactionTable.timeToLiveSpecification = { enabled: true, attributeName: 'ttl' };
}

// Grant both email Lambdas access to Member table
const memberTable = backend.data.resources.tables['Member'];
memberTable.grantReadWriteData(backend.emailUnsubscribe.resources.lambda);
memberTable.grantReadData(backend.sesMailing.resources.lambda);

// Grant sesMailing access to SurveyToken table (mode survey)
const surveyTokenTable = backend.data.resources.tables['SurveyToken'];
surveyTokenTable.grantReadWriteData(backend.sesMailing.resources.lambda);
backend.sesMailing.addEnvironment('SURVEY_TOKEN_TABLE_NAME', surveyTokenTable.tableName);

// Grant surveyRespond access to all survey tables (public Lambda — token-based auth)
const surveyResponseTable = backend.data.resources.tables['SurveyResponse'];
const surveyTable = backend.data.resources.tables['Survey'];
const surveyQuestionTable = backend.data.resources.tables['SurveyQuestion'];

surveyTokenTable.grantReadWriteData(backend.surveyRespond.resources.lambda);
surveyResponseTable.grantReadWriteData(backend.surveyRespond.resources.lambda);
surveyTable.grantReadData(backend.surveyRespond.resources.lambda);
surveyQuestionTable.grantReadData(backend.surveyRespond.resources.lambda);

backend.surveyRespond.addEnvironment('SURVEY_TOKEN_TABLE_NAME', surveyTokenTable.tableName);
backend.surveyRespond.addEnvironment('SURVEY_RESPONSE_TABLE_NAME', surveyResponseTable.tableName);
backend.surveyRespond.addEnvironment('SURVEY_TABLE_NAME', surveyTable.tableName);
backend.surveyRespond.addEnvironment('SURVEY_QUESTION_TABLE_NAME', surveyQuestionTable.tableName);

// FFB proxy migration flags (gradual V2 rollout)
backend.ffbProxy.addEnvironment('FFB_MIGRATION_ENABLED', 'true');
backend.ffbProxy.addEnvironment('FFB_API_VERSION', 'v1');
backend.ffbProxy.addEnvironment('FFB_API_V2_ENDPOINTS', 'organizations/1438/club_tournament');
backend.ffbProxy.addEnvironment('FFB_API_V2_BASE_URL', 'https://api-lancelot.ffbridge.fr/');
backend.ffbProxy.addEnvironment('FFB_V2_GROUP_ID', '21334');
backend.ffbProxy.addEnvironment('FFB_API_V1_TOKEN', '');
backend.ffbProxy.addEnvironment('FFB_PROXY_DEBUG', 'true');

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

// Grant Systeme group DynamoDB access for book-backup tool
// ARN en wildcard pour éviter toute référence cross-stack (pas de grantReadWriteData)
const bookBackupStack = backend.createStack('book-backup-stack');
const systemeGroupRole = backend.auth.resources.groups['Systeme'].role;
const bookBackupPolicy = new Policy(bookBackupStack, 'BookBackupPolicy', {
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['dynamodb:ListTables'],
      resources: ['*'],
    }),
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['dynamodb:DescribeTable', 'dynamodb:Scan', 'dynamodb:BatchWriteItem', 'dynamodb:DeleteItem', 'dynamodb:GetItem', 'dynamodb:PutItem'],
      resources: ['arn:aws:dynamodb:*:*:table/BookEntry-*'],
    }),
  ],
});
systemeGroupRole.attachInlinePolicy(bookBackupPolicy);

// Grant Systeme group DynamoDB access for cloneDB tool (all app tables)
const cloneDbPolicy = new Policy(bookBackupStack, 'CloneDbPolicy', {
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['dynamodb:DescribeTable', 'dynamodb:Scan', 'dynamodb:BatchWriteItem', 'dynamodb:DeleteItem', 'dynamodb:GetItem', 'dynamodb:PutItem'],
      resources: ['arn:aws:dynamodb:*:*:table/*'],
    }),
  ],
});
systemeGroupRole.attachInlinePolicy(cloneDbPolicy);

// Grant Systeme group S3 access for clone-S3 maintenance tool (cross-bucket list/copy/delete)
const cloneS3BucketArns = [
  'arn:aws:s3:::amplify-d129hzsf6g08ma-*-bcstodrivebucket*',
  'arn:aws:s3:::amplify-multipleapps-toto-bcstodrivebucket*',
];

const cloneS3Policy = new Policy(bookBackupStack, 'CloneS3Policy', {
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['s3:ListBucket'],
      resources: cloneS3BucketArns,
    }),
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
      resources: cloneS3BucketArns.map((arn) => `${arn}/*`),
    }),
  ],
});
systemeGroupRole.attachInlinePolicy(cloneS3Policy);

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