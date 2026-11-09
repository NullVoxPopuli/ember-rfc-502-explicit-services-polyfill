import CookieStore from 'ember-cli-app/domain/cookies/cookie-store';
import BrowserCookieStore from 'ember-cli-app/domain/cookies/browser-cookie-store';
import ServerCookieStore from 'ember-cli-app/domain/cookies/server-cookie-store';

export function initialize(appInstance) {
  const fastboot = appInstance.lookup('service:fastboot');

  if (fastboot?.isFastBoot) {
    appInstance.register(CookieStore, ServerCookieStore);
  } else {
    appInstance.register(CookieStore, BrowserCookieStore);
  }
}

export default { initialize };
