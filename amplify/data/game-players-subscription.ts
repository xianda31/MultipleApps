import { Stack } from 'aws-cdk-lib';
import type { IConstruct } from 'constructs';
import type { data } from './resource';

export function configureGamePlayersSubscription(api: IConstruct & Pick<ReturnType<typeof data.getInstance>, 'resources'>): void {
  const resources = api.resources.cfnResources;
  const noneDataSource = resources.cfnDataSources['NONE_DS'];
  if (!noneDataSource) throw new Error('The game players subscription requires the NONE data source.');

  for (const id of ['Fn_Subscription_onGamePlayersChanged_1', 'Resolver_Subscription_onGamePlayersChanged']) {
    const resource = Stack.of(api).node.findChild(id);
    // Amplify's whole-API dependency incorrectly includes resources inside nested model stacks.
    resource.node.removeDependency(api);
    resource.node.addDependency(resources.cfnGraphqlSchema, noneDataSource);
  }
}
