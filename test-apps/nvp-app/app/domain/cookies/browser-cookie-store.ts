import CookieStore from "./cookie-store.ts";

export default class BrowserCookieStore extends CookieStore {
  get kind() {
    return "browser";
  }
}
