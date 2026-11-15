import { extensions, util } from '@aws-appsync/utils';

export function request() {
  return { payload: null };
}

export function response(ctx) {
  extensions.setSubscriptionFilter(util.transform.toSubscriptionFilter({
    gameId: { eq: ctx.args.gameId },
  }));
  return null;
}
