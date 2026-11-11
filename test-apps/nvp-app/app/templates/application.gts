import type { TOC } from "@ember/component/template-only";

import CounterDisplay from "#app/components/counter-display.gts";
import type { ApplicationModel } from "#app/routes/application.ts";

export default <template>
  <p data-test-greeting>{{@model.greeting}}</p>
  <p data-test-cookies>{{@model.cookies}}</p>
  <CounterDisplay />

  {{outlet}}
</template> satisfies TOC<{ Args: { model: ApplicationModel } }>;
