export default class CookieStore {
  get kind() {
    throw new Error('CookieStore is a contract; register an implementation');
  }
}
