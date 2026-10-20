import { test as base, expect } from '@playwright/test';
import { FakeAgent } from './fake-agent';

/** `agent` conectado al hub del webServer; la página parte de la app limpia. */
export const test = base.extend<{ agent: FakeAgent }>({
  agent: async ({ baseURL }, use) => {
    const agent = await new FakeAgent(baseURL!).connect();
    await use(agent);
    await agent.close();
  },
});

export { expect };
