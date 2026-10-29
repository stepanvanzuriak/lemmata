export class ArxivError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArxivError";
  }
}
