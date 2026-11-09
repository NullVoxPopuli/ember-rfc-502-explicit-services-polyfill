export default class Logger {
  messages = [];

  log(message) {
    this.messages.push(message);
  }
}
