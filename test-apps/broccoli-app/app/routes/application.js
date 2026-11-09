import Route from '@ember/routing/route';
import { service } from '@ember/service';

import CookieStore from 'broccoli-app/domain/cookies/cookie-store';
import Greeter from 'broccoli-app/domain/greeter';

export default class ApplicationRoute extends Route {
  @service(Greeter) greeter;
  @service(CookieStore) cookies;

  model() {
    return { greeting: this.greeter.greet(), cookies: this.cookies.kind };
  }
}
