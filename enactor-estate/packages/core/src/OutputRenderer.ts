export interface OutputRenderer {
  write(text: string): void;
  writeError(text: string): void;
  clear(): void;
}
