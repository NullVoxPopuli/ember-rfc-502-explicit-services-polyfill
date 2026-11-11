import CookieStore from "./cookie-store.ts";

export default class ServerCookieStore extends CookieStore {
  get kind() {
    return "server";
  }
}
