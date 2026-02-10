import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerQuestionTool } from "./question.js";
import { registerSubagentTool } from "./subagent.js";
import { registerTodoTool } from "./todo.js";

export default function compoundEngineering(pi: ExtensionAPI) {
	registerSubagentTool(pi);
	registerTodoTool(pi);
	registerQuestionTool(pi);
}
