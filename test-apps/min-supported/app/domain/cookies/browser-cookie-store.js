import CookieStore from './cookie-store';

export default class BrowserCookieStore extends CookieStore {
  get kind() {
    return 'browser';
  }
}
