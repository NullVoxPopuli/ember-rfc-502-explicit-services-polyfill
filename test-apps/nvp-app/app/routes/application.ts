import Route from "@ember/routing/route";
import { service } from "@ember/service";

import CookieStore from "#app/domain/cookies/cookie-store.ts";
import Greeter from "#app/domain/greeter.ts";

export interface ApplicationModel {
  greeting: string;
  cookies: string;
}

export default class ApplicationRoute extends Route<ApplicationModel> {
  @service(Greeter) declare greeter: Greeter;
  @service(CookieStore) declare cookies: CookieStore;

  model(): ApplicationModel {
    return { greeting: this.greeter.greet(), cookies: this.cookies.kind };
  }
}
