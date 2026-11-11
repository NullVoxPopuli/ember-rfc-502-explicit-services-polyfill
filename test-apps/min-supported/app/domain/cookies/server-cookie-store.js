import CookieStore from './cookie-store';

export default class ServerCookieStore extends CookieStore {
  get kind() {
    return 'server';
  }
}
