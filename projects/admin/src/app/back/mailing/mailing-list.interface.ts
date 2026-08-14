export interface MailingListInput {
  title: string;
  owner: string;
  members: string[];
}

export interface MailingList extends MailingListInput {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}