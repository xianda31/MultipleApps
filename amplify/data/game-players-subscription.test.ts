import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { App, Duration, Stack } from 'aws-cdk-lib';
import { CfnFunctionConfiguration, CfnResolver } from 'aws-cdk-lib/aws-appsync';
import { AmplifyData, AmplifyDataDefinition } from '@aws-amplify/data-construct';
import { configureGamePlayersSubscription } from './game-players-subscription';

test('game players subscription synthesizes without cross-stack dangling dependencies', context => {
  const outdir = mkdtempSync(join(tmpdir(), 'game-players-subscription-'));
  context.after(() => rmSync(outdir, { recursive: true }));
  const app = new App({ autoSynth: false, outdir });
  const stack = new Stack(app, 'SubscriptionTest');
  const api = new AmplifyData(stack, 'Data', {
    definition: AmplifyDataDefinition.fromString(`
      type Game @model @auth(rules: [{allow: public}]) { id: ID! }
      type Mutation { mutateGamePlayers(gameId: ID!): Game }
      type Subscription {
        onGamePlayersChanged(gameId: ID!): Game @aws_subscribe(mutations: ["mutateGamePlayers"])
      }
    `),
    authorizationModes: {
      defaultAuthorizationMode: 'API_KEY',
      apiKeyConfig: { expires: Duration.days(7) },
    },
  });
  const fn = new CfnFunctionConfiguration(stack, 'Fn_Subscription_onGamePlayersChanged_1', {
    apiId: api.apiId, dataSourceName: 'NONE_DS', name: 'onGamePlayersChanged',
    functionVersion: '2018-05-29',
    requestMappingTemplate: '{"version":"2018-05-29","payload":null}',
    responseMappingTemplate: '$util.toJson($ctx.result)',
  });
  const resolver = new CfnResolver(stack, 'Resolver_Subscription_onGamePlayersChanged', {
    apiId: api.apiId, typeName: 'Subscription', fieldName: 'onGamePlayersChanged',
    kind: 'PIPELINE', pipelineConfig: { functions: [fn.attrFunctionId] },
    requestMappingTemplate: '{}', responseMappingTemplate: '$util.toJson($ctx.prev.result)',
  });
  // Reproduce backend-data's convertJsResolverDefinition dependency wiring.
  fn.node.addDependency(api);
  resolver.node.addDependency(api);
  configureGamePlayersSubscription(api);

  const assembly = app.synth();
  const template = assembly.getStackArtifact(stack.artifactId).template;
  const resources = template.Resources;
  for (const [id, resource] of Object.entries(resources)) {
    assert.ok(typeof resource === 'object' && resource !== null);
    const dependencies = Reflect.get(resource, 'DependsOn') ?? [];
    for (const dependency of Array.isArray(dependencies) ? dependencies : [dependencies]) {
      assert.ok(dependency in resources, `${id} depends on missing resource ${dependency}`);
    }
  }
  const schemaId = stack.getLogicalId(api.resources.cfnResources.cfnGraphqlSchema);
  const dataSourceId = stack.getLogicalId(api.resources.cfnResources.cfnDataSources['NONE_DS']);
  for (const resource of [fn, resolver]) {
    const dependencies: string[] = resources[stack.getLogicalId(resource)].DependsOn;
    assert.ok(dependencies.includes(schemaId));
    assert.ok(dependencies.includes(dataSourceId));
  }
  assert.ok(Object.keys(api.resources.nestedStacks).length > 0);
});
