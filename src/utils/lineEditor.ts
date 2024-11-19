export default class LineEditor {
  private isChanged = true;
  private lines: string[] = [];
  private currentCache: string = '';

  constructor(
    private content: string,
    private eol: string = '\n',
  ) {
    this.lines = content.split(/\r?\n|\r/);
  }

  get current() {
    if (this.isChanged) {
      this.currentCache = this.lines.join(this.eol);
      this.isChanged = false;
    }
    return this.currentCache;
  }

  delete(start: number, count: number) {
    this.lines.splice(start, count);
    this.isChanged = true;
  }

  add(start: number, lines: string[] | string) {
    this.lines.splice(
      start,
      0,
      ...(Array.isArray(lines) ? lines : lines.split(this.eol)),
    );
    this.isChanged = true;
  }
}
