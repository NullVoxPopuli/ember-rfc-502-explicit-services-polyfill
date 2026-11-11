import { service } from "@ember/service";

import Logger from "./logger.ts";

export default class Broken {
  logger = service(this, Logger);
}
