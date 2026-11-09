import CookieStore from "#app/domain/cookies/cookie-store.ts";
import BrowserCookieStore from "#app/domain/cookies/browser-cookie-store.ts";
import ServerCookieStore from "#app/domain/cookies/server-cookie-store.ts";

import { register } from "ember-rfc-502-explicit-services-polyfill";

import type ApplicationInstance from "@ember/application/instance";

export function initialize(appInstance: ApplicationInstance): void {
  const fastboot = appInstance.lookup("service:fastboot") as { isFastBoot?: boolean } | undefined;

  if (fastboot?.isFastBoot) {
    register(appInstance, CookieStore, ServerCookieStore);
  } else {
    register(appInstance, CookieStore, BrowserCookieStore);
  }
}

export default { name: "register-cookie-store", initialize };
