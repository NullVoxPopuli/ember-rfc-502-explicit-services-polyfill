import { tracked } from '@glimmer/tracking';
import { registerDestructor } from '@ember/destroyable';

export default class Counter {
  static constructed = 0;

  @tracked count = 0;
  destroyed = false;

  constructor() {
    Counter.constructed++;
    registerDestructor(this, () => (this.destroyed = true));
  }

  increment = () => this.count++;
}
