// Common utility functions for file manager

export function isS3Item(obj: any): obj is { path: string, size: number } {
  return obj && typeof obj === 'object' && typeof obj.path === 'string' && typeof obj.size === 'number';
}

// Add more shared helpers as needed
