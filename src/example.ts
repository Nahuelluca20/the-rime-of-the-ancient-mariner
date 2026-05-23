import { Console, Effect, Exit } from "effect";

const program = Effect.gen(function* () {
	yield* Console.log("Hello from Effect in pi package");
	return 42;
});

// Run with Node for extensions/skills
const main = Effect.runPromiseExit(program);

main.then((exit) => {
	if (Exit.isSuccess(exit)) {
		console.log("Result:", exit.value);
	} else {
		console.error("Failed:", exit.cause);
		process.exit(1);
	}
});
