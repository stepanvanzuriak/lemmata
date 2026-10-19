import type {
  RunEvent,
  RunHandle,
  AgentAdapter,
  StartOptions,
} from "../runner.js";

/** Replays a fixed script of events; records the options of every start. */
export class FakeAdapter implements AgentAdapter {
  readonly name = "fake";
  readonly starts: StartOptions[] = [];

  constructor(private readonly script: RunEvent[]) {}

  start(options: StartOptions): RunHandle {
    this.starts.push(options);
    let aborted = false;
    const script = this.script;

    async function* events(): AsyncGenerator<RunEvent> {
      for (const event of script) {
        if (aborted) {
          yield { type: "done", reason: "aborted" };
          return;
        }
        await Promise.resolve();
        yield event;
      }
    }

    return {
      events: events(),
      abort: async () => {
        aborted = true;
      },
    };
  }
}
