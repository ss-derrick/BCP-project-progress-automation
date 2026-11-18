// Run-mode values handed to the shared page code: RUN_MODE in
// common/config/testConfig.ts builds this from DEMO / slowness settings.
export interface RunMode {
  demoMode: boolean;      // DEMO = headed, slow, watchable
  typingDelay: number;    // ms between key presses (DEMO only, else 0)
  stepPause: number;      // ms pause between steps (DEMO only, else 0)
  viewPage: number;       // ms to keep a result page open (DEMO only, else 0)
}
