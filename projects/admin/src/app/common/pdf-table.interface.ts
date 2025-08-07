export interface PDF_table  {
  title: string;
  headers: string[];
  alignments: HorizontalAlignment[];
  rows: any[][];
  
  }
  export type HorizontalAlignment =  'left' | 'center' | 'right' | 'justify';