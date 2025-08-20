export interface Page {
  id: string;
  title: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Page_input {
  title: string;
  content: string;
}
