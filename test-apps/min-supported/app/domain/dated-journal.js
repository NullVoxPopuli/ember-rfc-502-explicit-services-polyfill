import { service } from '@ember/service';

import Counter from './counter';
import Journal from './journal';

export default class DatedJournal extends Journal {
  counter = service(this, Counter);
  opened;

  constructor(owner) {
    super(owner);
    this.opened = this.counter.count;
  }
}
