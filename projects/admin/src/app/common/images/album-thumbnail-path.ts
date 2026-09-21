export function replaceImageExtensionWithWebp(path: string): string {
  return /\.[^./]+$/.test(path) ? path.replace(/\.[^./]+$/, '.webp') : `${path}.webp`;
}
