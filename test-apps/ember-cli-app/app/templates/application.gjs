import { pageTitle } from 'ember-page-title';

import CounterDisplay from 'ember-cli-app/components/counter-display';

<template>
  {{pageTitle "EmberCliApp"}}
  <p data-test-greeting>{{@model.greeting}}</p>
  <p data-test-cookies>{{@model.cookies}}</p>
  <CounterDisplay />

  {{outlet}}
</template>
