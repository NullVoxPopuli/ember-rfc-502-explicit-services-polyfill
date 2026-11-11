export default {
  scenarios: [
    {
      name: 'ember-latest',
      npm: { dependencies: { 'ember-source': 'latest' } },
    },
    {
      name: 'ember-beta',
      npm: { dependencies: { 'ember-source': 'beta' } },
    },
  ],
};
