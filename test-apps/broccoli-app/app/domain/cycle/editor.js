import { service } from '@ember/service';

import History from './history';

export default class Editor {
  @service(() => History) history;

  text = '';

  type(text) {
    this.history.push(this.text);
    this.text = text;
  }
}
