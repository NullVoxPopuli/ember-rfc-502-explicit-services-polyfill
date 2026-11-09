import Route from '@ember/routing/route';
import { service } from '@ember/service';

import CookieStore from 'ember-cli-app/domain/cookies/cookie-store';
import Greeter from 'ember-cli-app/domain/greeter';

export default class ApplicationRoute extends Route {
  @service(Greeter) greeter;
  @service(CookieStore) cookies;

  model() {
    return { greeting: this.greeter.greet(), cookies: this.cookies.kind };
  }
}
