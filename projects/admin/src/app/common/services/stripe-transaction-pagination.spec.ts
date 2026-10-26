import { collectStripeTransactionPages } from './stripe-transaction-pagination';

describe('Stripe transaction pagination', () => {
  it('loads transactions beyond the first page', async () => {
    const listPage = jasmine.createSpy('listPage').and.callFake(async (nextToken?: string) => {
      if (!nextToken) {
        return {
          data: [{ id: 'first-page' }],
          nextToken: 'second-page-token',
        };
      }
      return {
        data: [{ id: 'paid-transaction' }],
        nextToken: null,
      };
    });

    const transactions = await collectStripeTransactionPages(listPage, fail);

    expect(listPage).toHaveBeenCalledTimes(2);
    expect(listPage.calls.argsFor(0)).toEqual([undefined]);
    expect(listPage.calls.argsFor(1)).toEqual(['second-page-token']);
    expect(transactions).toEqual([
      { id: 'first-page' },
      { id: 'paid-transaction' },
    ]);
  });

  it('keeps valid data while reporting partial GraphQL errors', async () => {
    const errors = [{ message: 'Corrupted legacy item' }];
    const onPartialErrors = jasmine.createSpy('onPartialErrors');

    const transactions = await collectStripeTransactionPages(
      async () => ({
        data: [null, { id: 'valid-transaction' }] as ({ id: string } | null)[],
        errors,
        nextToken: null,
      }),
      onPartialErrors,
    );

    expect(onPartialErrors).toHaveBeenCalledOnceWith(errors);
    expect(transactions).toEqual([{ id: 'valid-transaction' }]);
  });
});
