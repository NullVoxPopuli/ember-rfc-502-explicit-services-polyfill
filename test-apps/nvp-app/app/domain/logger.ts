export default class Logger {
  messages: string[] = [];

  log(message: string): void {
    this.messages.push(message);
  }
}
