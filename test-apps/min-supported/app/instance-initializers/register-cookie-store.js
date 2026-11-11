import CookieStore from 'min-supported/domain/cookies/cookie-store';
import BrowserCookieStore from 'min-supported/domain/cookies/browser-cookie-store';
import ServerCookieStore from 'min-supported/domain/cookies/server-cookie-store';

export function initialize(appInstance) {
  const fastboot = appInstance.lookup('service:fastboot');

  if (fastboot?.isFastBoot) {
    appInstance.register(CookieStore, ServerCookieStore);
  } else {
    appInstance.register(CookieStore, BrowserCookieStore);
  }
}

export default { initialize };
