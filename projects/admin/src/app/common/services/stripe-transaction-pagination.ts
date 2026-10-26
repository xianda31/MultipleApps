export interface StripeTransactionPage<T> {
  data: T[] | null;
  errors?: readonly unknown[];
  nextToken?: string | null;
}

export async function collectStripeTransactionPages<T>(
  listPage: (nextToken?: string) => Promise<StripeTransactionPage<T>>,
  onPartialErrors: (errors: readonly unknown[]) => void,
): Promise<T[]> {
  const transactions: T[] = [];
  let nextToken: string | undefined;

  do {
    const page = await listPage(nextToken);
    if (page.errors?.length) {
      onPartialErrors(page.errors);
    }
    transactions.push(...(page.data ?? []).filter((transaction): transaction is T => transaction != null));
    nextToken = page.nextToken ?? undefined;
  } while (nextToken);

  return transactions;
}
