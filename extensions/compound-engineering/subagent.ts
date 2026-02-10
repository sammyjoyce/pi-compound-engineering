import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { Message } from "@mariozechner/pi-ai";
import { StringEnum } from "@mariozechner/pi-ai";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	getMarkdownTheme,
	keyHint,
	truncateHead,
	type ExtensionAPI,
	type Theme,
	type TruncationResult,
} from "@mariozechner/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { type AgentConfig, type AgentScope, discoverAgents } from "./agents.js";

const MAX_PARALLEL_TASKS = 8;
const MAX_CONCURRENCY = 4;
const COLLAPSED_ITEM_COUNT = 10;

const KNOWN_TOOL_NAMES = new Set([
	"read",
	"write",
	"edit",
	"bash",
	"grep",
	"find",
	"ls",
	// extension tools (only present if an extension providing them is installed in the subagent process)
	"subagent",
	"compound_subagent",
	"todo",
	"question",
	"compound_todo",
	"compound_question",
]);

function normalizePathArg(raw: string | undefined): string | undefined {
	if (typeof raw !== "string") return undefined;
	const trimmed = raw.trim();
	if (!trimmed) return undefined;
	return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
}

function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	return `${(count / 1000000).toFixed(1)}M`;
}

function formatUsageStats(
	usage: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		cost: number;
		contextTokens?: number;
		turns?: number;
	},
	model?: string,
): string {
	const parts: string[] = [];
	if (usage.turns) parts.push(`${usage.turns} turn${usage.turns > 1 ? "s" : ""}`);
	if (usage.input) parts.push(`↑${formatTokens(usage.input)}`);
	if (usage.output) parts.push(`↓${formatTokens(usage.output)}`);
	if (usage.cacheRead) parts.push(`R${formatTokens(usage.cacheRead)}`);
	if (usage.cacheWrite) parts.push(`W${formatTokens(usage.cacheWrite)}`);
	if (usage.cost) parts.push(`$${usage.cost.toFixed(4)}`);
	if (usage.contextTokens && usage.contextTokens > 0) parts.push(`ctx:${formatTokens(usage.contextTokens)}`);
	if (model) parts.push(model);
	return parts.join(" ");
}

function writePromptToTempFile(agentName: string, prompt: string): { dir: string; filePath: string } {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-ce-subagent-"));
	const safeName = agentName.replace(/[^\w.-]+/g, "_");
	const filePath = path.join(tmpDir, `prompt-${safeName}.md`);
	fs.writeFileSync(filePath, prompt, { encoding: "utf-8", mode: 0o600 });
	return { dir: tmpDir, filePath };
}

interface UsageStats {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	contextTokens: number;
	turns: number;
}

interface ToolCallSummary {
	name: string;
	args: JsonObject;
}

interface OutputSummary {
	text: string;
	truncated: boolean;
	truncation?: TruncationResult;
	fullTextPath?: string;
}

interface SingleResult {
	agent: string;
	agentSource: "package" | "user" | "project" | "unresolved";
	task: string;
	exitCode: number;
	stderr: string;
	usage: UsageStats;
	model?: string;
	stopReason?: string;
	errorMessage?: string;
	step?: number;
	toolCalls: ToolCallSummary[];
	output: OutputSummary;
}

interface SubagentDetails {
	mode: "single" | "parallel" | "chain";
	agentScope: AgentScope;
	packageAgentsDir: string;
	projectAgentsDir: string | null;
	results: SingleResult[];
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

function isJsonObject(value: JsonValue): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asJsonObject(value: JsonValue): JsonObject {
	return isJsonObject(value) ? value : {};
}

function formatTruncationNotice(truncation: TruncationResult, fullTextPath: string): string {
	const truncatedLines = truncation.totalLines - truncation.outputLines;
	const truncatedBytes = truncation.totalBytes - truncation.outputBytes;

	let text = `\n\n[Output truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines`;
	text += ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).`;
	if (truncatedLines > 0 || truncatedBytes > 0) {
		text += ` ${truncatedLines} lines (${formatSize(truncatedBytes)}) omitted.`;
	}
	text += ` Full output saved to: ${fullTextPath}]`;
	return text;
}

function truncateOutputToLimits(text: string, tempPrefix: string): OutputSummary {
	const truncation = truncateHead(text, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
	if (!truncation.truncated) return { text: truncation.content, truncated: false };

	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `pi-ce-${tempPrefix}-`));
	const filePath = path.join(tmpDir, "output.md");
	fs.writeFileSync(filePath, text, { encoding: "utf-8", mode: 0o600 });

	return { text: truncation.content, truncated: true, truncation, fullTextPath: filePath };
}

function formatOutputForLLM(output: OutputSummary): string {
	const base = output.text && output.text.trim() ? output.text : "(no output)";
	if (!output.truncated || !output.truncation || !output.fullTextPath) return base;
	return base + formatTruncationNotice(output.truncation, output.fullTextPath);
}

function getStringArg(args: JsonObject, key: string): string | undefined {
	const value = args[key];
	return typeof value === "string" ? value : undefined;
}

function getNumberArg(args: JsonObject, key: string): number | undefined {
	const value = args[key];
	return typeof value === "number" ? value : undefined;
}

function formatToolCall(toolName: string, args: JsonObject, theme: Theme): string {
	const shortenPath = (p: string) => {
		const home = os.homedir();
		return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
	};

	switch (toolName) {
		case "bash": {
			const command = getStringArg(args, "command") ?? "...";
			const preview = command.length > 60 ? `${command.slice(0, 60)}...` : command;
			return theme.fg("muted", "$ ") + theme.fg("toolOutput", preview);
		}
		case "read": {
			const rawPath = getStringArg(args, "file_path") ?? getStringArg(args, "path") ?? "...";
			const filePath = shortenPath(rawPath);
			const offset = getNumberArg(args, "offset");
			const limit = getNumberArg(args, "limit");
			let text = theme.fg("accent", filePath);
			if (offset !== undefined || limit !== undefined) {
				const startLine = offset ?? 1;
				const endLine = limit !== undefined ? startLine + limit - 1 : "";
				text += theme.fg("warning", `:${startLine}${endLine ? `-${endLine}` : ""}`);
			}
			return theme.fg("muted", "read ") + text;
		}
		case "write": {
			const rawPath = getStringArg(args, "file_path") ?? getStringArg(args, "path") ?? "...";
			const filePath = shortenPath(rawPath);
			const content = getStringArg(args, "content") ?? "";
			const contentLines = getNumberArg(args, "content_lines") ?? content.split("\n").length;
			let text = theme.fg("muted", "write ") + theme.fg("accent", filePath);
			if (contentLines > 1) text += theme.fg("dim", ` (${contentLines} lines)`);
			return text;
		}
		case "edit": {
			const rawPath = getStringArg(args, "file_path") ?? getStringArg(args, "path") ?? "...";
			return theme.fg("muted", "edit ") + theme.fg("accent", shortenPath(rawPath));
		}
		case "ls": {
			const rawPath = getStringArg(args, "path") ?? ".";
			return theme.fg("muted", "ls ") + theme.fg("accent", shortenPath(rawPath));
		}
		case "find": {
			const pattern = getStringArg(args, "pattern") ?? "*";
			const rawPath = getStringArg(args, "path") ?? ".";
			return theme.fg("muted", "find ") + theme.fg("accent", pattern) + theme.fg("dim", ` in ${shortenPath(rawPath)}`);
		}
		case "grep": {
			const pattern = getStringArg(args, "pattern") ?? "";
			const rawPath = getStringArg(args, "path") ?? ".";
			return theme.fg("muted", "grep ") + theme.fg("accent", `/${pattern}/`) + theme.fg("dim", ` in ${shortenPath(rawPath)}`);
		}
		default: {
			const argsStr = JSON.stringify(args);
			const preview = argsStr.length > 50 ? `${argsStr.slice(0, 50)}...` : argsStr;
			return theme.fg("accent", toolName) + theme.fg("dim", ` ${preview}`);
		}
	}
}

const MAX_TOOL_CALLS_STORED = 200;
const MAX_TOOL_ARG_STRING_CHARS = 200;
const MAX_TOOL_ARG_ARRAY_ITEMS = 20;
const MAX_TOOL_ARG_OBJECT_KEYS = 50;

function truncateArgString(value: string, maxChars = MAX_TOOL_ARG_STRING_CHARS): string {
	if (value.length <= maxChars) return value;
	const head = value.slice(0, Math.max(0, maxChars - 1));
	return `${head}… (${value.length} chars)`;
}

function compactJsonObject(obj: JsonObject): JsonObject {
	const out: JsonObject = {};
	const keys = Object.keys(obj);
	for (const key of keys.slice(0, MAX_TOOL_ARG_OBJECT_KEYS)) {
		out[key] = compactJsonValue(obj[key]);
	}
	if (keys.length > MAX_TOOL_ARG_OBJECT_KEYS) {
		out["__truncated_keys"] = `… (${keys.length - MAX_TOOL_ARG_OBJECT_KEYS} more keys)`;
	}
	return out;
}

function compactJsonValue(value: JsonValue): JsonValue {
	if (typeof value === "string") return truncateArgString(value);
	if (Array.isArray(value)) {
		const sliced = value.slice(0, MAX_TOOL_ARG_ARRAY_ITEMS).map(compactJsonValue);
		if (value.length > MAX_TOOL_ARG_ARRAY_ITEMS) {
			sliced.push(`… (${value.length - MAX_TOOL_ARG_ARRAY_ITEMS} more items)`);
		}
		return sliced;
	}
	if (isJsonObject(value)) return compactJsonObject(value);
	return value;
}

function compactToolCallArgs(toolName: string, rawArgs: JsonObject): JsonObject {
	const out = compactJsonObject(rawArgs);

	if (toolName === "write") {
		const content = getStringArg(rawArgs, "content");
		if (content !== undefined) {
			out["content_lines"] = content.split("\n").length;
			out["content_bytes"] = Buffer.byteLength(content, "utf-8");
			delete out["content"];
		}
	}

	if (toolName === "edit") {
		const oldText = getStringArg(rawArgs, "oldText");
		const newText = getStringArg(rawArgs, "newText");
		if (oldText !== undefined) {
			out["oldText_lines"] = oldText.split("\n").length;
			out["oldText_bytes"] = Buffer.byteLength(oldText, "utf-8");
			delete out["oldText"];
		}
		if (newText !== undefined) {
			out["newText_lines"] = newText.split("\n").length;
			out["newText_bytes"] = Buffer.byteLength(newText, "utf-8");
			delete out["newText"];
		}
	}

	if (toolName === "bash") {
		const command = getStringArg(rawArgs, "command");
		if (command !== undefined) {
			out["command_bytes"] = Buffer.byteLength(command, "utf-8");
			out["command"] = truncateArgString(command, 500);
		}
	}

	return out;
}

async function mapWithConcurrencyLimit<TIn, TOut>(
	items: TIn[],
	concurrency: number,
	fn: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
	if (items.length === 0) return [];
	const limit = Math.max(1, Math.min(concurrency, items.length));
	const results: TOut[] = new Array(items.length);
	let nextIndex = 0;
	const workers = new Array(limit).fill(null).map(async () => {
		while (true) {
			const current = nextIndex++;
			if (current >= items.length) return;
			results[current] = await fn(items[current], current);
		}
	});
	await Promise.all(workers);
	return results;
}

type OnUpdateCallback = (partial: AgentToolResult<SubagentDetails>) => void;

async function runSingleAgent(
	defaultCwd: string,
	agents: AgentConfig[],
	agentName: string,
	task: string,
	cwd: string | undefined,
	step: number | undefined,
	signal: AbortSignal | undefined,
	onUpdate: OnUpdateCallback | undefined,
	makeDetails: (results: SingleResult[]) => SubagentDetails,
): Promise<SingleResult> {
	const agent = agents.find((a) => a.name === agentName);

	if (!agent) {
		const available = agents.map((a) => `"${a.name}"`).join(", ") || "none";
		return {
			agent: agentName,
			agentSource: "unresolved",
			task,
			exitCode: 1,
			stderr: `Unknown agent: "${agentName}". Available agents: ${available}.`,
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
			step,
			toolCalls: [],
			output: { text: "", truncated: false },
		};
	}

	const safeAgentName = agentName.replace(/[^\w.-]+/g, "_");

	const args: string[] = ["--mode", "json", "-p", "--no-session"];
	if (agent.model) args.push("--model", agent.model);

	// Optional tool filtering. If nothing remains, omit the flag to keep defaults.
	if (agent.tools && agent.tools.length > 0) {
		const filtered = agent.tools.filter((t) => KNOWN_TOOL_NAMES.has(t));
		if (filtered.length > 0) args.push("--tools", filtered.join(","));
	}

	let tmpPromptDir: string | null = null;
	let tmpPromptPath: string | null = null;

	const currentResult: SingleResult = {
		agent: agentName,
		agentSource: agent.source,
		task,
		exitCode: 0,
		stderr: "",
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
		model: agent.model,
		step,
		toolCalls: [],
		output: { text: "", truncated: false },
	};

	const emitUpdate = () => {
		if (!onUpdate) return;
		const text = currentResult.output.text && currentResult.output.text.trim() ? currentResult.output.text : "(running...)";
		onUpdate({
			content: [{ type: "text", text }],
			details: makeDetails([currentResult]),
		});
	};

	try {
		if (agent.systemPrompt.trim()) {
			const tmp = writePromptToTempFile(agent.name, agent.systemPrompt);
			tmpPromptDir = tmp.dir;
			tmpPromptPath = tmp.filePath;
			args.push("--append-system-prompt", tmpPromptPath);
		}

		args.push(`Task: ${task}`);

		let wasAborted = false;

		const exitCode = await new Promise<number>((resolve) => {
			const proc = spawn("pi", args, {
				cwd: normalizePathArg(cwd) ?? defaultCwd,
				shell: false,
				stdio: ["ignore", "pipe", "pipe"],
			});
			let buffer = "";

			const processLine = (line: string) => {
				if (!line.trim()) return;

				let parsed: JsonValue;
				try {
					parsed = JSON.parse(line);
				} catch {
					return;
				}

				if (!isJsonObject(parsed)) return;
				const type = parsed["type"];
				if (typeof type !== "string") return;

				const msgValue = parsed["message"];
				const msg =
					msgValue !== undefined &&
					isJsonObject(msgValue) &&
					typeof msgValue["role"] === "string"
						? (msgValue as Message)
						: undefined;

				if (type === "message_end" && msg) {
					if (msg.role === "assistant") {
						currentResult.usage.turns++;
						const usage = msg.usage;
						if (usage) {
							currentResult.usage.input += usage.input || 0;
							currentResult.usage.output += usage.output || 0;
							currentResult.usage.cacheRead += usage.cacheRead || 0;
							currentResult.usage.cacheWrite += usage.cacheWrite || 0;
							currentResult.usage.cost += usage.cost?.total || 0;
							currentResult.usage.contextTokens = usage.totalTokens || 0;
						}
						if (!currentResult.model && msg.model) currentResult.model = msg.model;
						if (msg.stopReason) currentResult.stopReason = msg.stopReason;
						if (msg.errorMessage) currentResult.errorMessage = msg.errorMessage;

						const textParts: string[] = [];
						for (const part of msg.content) {
							if (part.type === "toolCall") {
								const rawArgs: JsonValue = part.arguments;
								const args = compactToolCallArgs(part.name, asJsonObject(rawArgs));
								currentResult.toolCalls.push({ name: part.name, args });
								if (currentResult.toolCalls.length > MAX_TOOL_CALLS_STORED) currentResult.toolCalls.shift();
							} else if (part.type === "text") {
								textParts.push(part.text);
							}
						}
						if (textParts.length > 0) {
							currentResult.output = { text: textParts.join("\n"), truncated: false };
						}
					}
					emitUpdate();
				}

				if (type === "tool_result_end") {
					emitUpdate();
				}
			};

			proc.stdout.on("data", (data) => {
				buffer += data.toString();
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";
				for (const line of lines) processLine(line);
			});

			proc.stderr.on("data", (data) => {
				currentResult.stderr += data.toString();
			});

			proc.on("close", (code) => {
				if (buffer.trim()) processLine(buffer);
				resolve(code ?? 0);
			});

			proc.on("error", () => resolve(1));

			if (signal) {
				const killProc = () => {
					wasAborted = true;
					proc.kill("SIGTERM");
					setTimeout(() => {
						if (!proc.killed) proc.kill("SIGKILL");
					}, 5000);
				};
				if (signal.aborted) killProc();
				else signal.addEventListener("abort", killProc, { once: true });
			}
		});

		currentResult.exitCode = exitCode;
		currentResult.output = truncateOutputToLimits(currentResult.output.text, `subagent-${safeAgentName}`);
		if (wasAborted) throw new Error("Subagent was aborted");
		return currentResult;
	} finally {
		if (tmpPromptPath) {
			try {
				fs.unlinkSync(tmpPromptPath);
			} catch {
				// ignore
			}
		}
		if (tmpPromptDir) {
			try {
				fs.rmdirSync(tmpPromptDir);
			} catch {
				// ignore
			}
		}
	}
}

const TaskItem = Type.Object({
	agent: Type.String({ description: "Name of the agent to invoke" }),
	task: Type.String({ description: "Task to delegate to the agent" }),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
});

const ChainItem = Type.Object({
	agent: Type.String({ description: "Name of the agent to invoke" }),
	task: Type.String({ description: "Task with optional {previous} placeholder for prior output" }),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
});

const AgentScopeSchema = StringEnum(["user", "project", "both"] as const, {
	description: 'Which extra agent directories to use in addition to packaged agents. Default: "user".',
	default: "user",
});

const SubagentParams = Type.Object({
	agent: Type.Optional(Type.String({ description: "Name of the agent to invoke (for single mode)" })),
	task: Type.Optional(Type.String({ description: "Task to delegate (for single mode)" })),
	tasks: Type.Optional(Type.Array(TaskItem, { description: "Array of {agent, task} for parallel execution" })),
	chain: Type.Optional(Type.Array(ChainItem, { description: "Array of {agent, task} for sequential execution" })),
	agentScope: Type.Optional(AgentScopeSchema),
	confirmProjectAgents: Type.Optional(
		Type.Boolean({ description: "Prompt before running project-local agents. Default: true.", default: true }),
	),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process (single mode)" })),
});

export function registerSubagentTool(pi: ExtensionAPI): void {
	const extensionDir = path.dirname(fileURLToPath(import.meta.url));
	const packageAgentsDir = path.join(extensionDir, "resources", "agents");

	pi.registerTool({
		name: "compound_subagent",
		label: "Compound Subagent",
		description: [
			"Delegate tasks to specialized subagents with isolated context.",
			"Modes: single (agent + task), parallel (tasks array), chain (sequential with {previous} placeholder).",
			`Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)} (whichever is hit first). If truncated, full output is saved to a temp file and the path is included in the result.`,
			"Packaged agents from this extension are always available.",
			"To enable project-local agents in .pi/agents, set agentScope: \"both\" (or \"project\").",
		].join(" "),
		parameters: SubagentParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const agentScope: AgentScope = params.agentScope ?? "user";
			const discovery = discoverAgents(ctx.cwd, packageAgentsDir, agentScope);
			const agents = discovery.agents;
			const confirmProjectAgents = params.confirmProjectAgents ?? true;

			const hasChain = (params.chain?.length ?? 0) > 0;
			const hasTasks = (params.tasks?.length ?? 0) > 0;
			const hasSingle = Boolean(params.agent && params.task);
			const modeCount = Number(hasChain) + Number(hasTasks) + Number(hasSingle);

			const makeDetails =
				(mode: "single" | "parallel" | "chain") =>
				(results: SingleResult[]): SubagentDetails => ({
					mode,
					agentScope,
					packageAgentsDir,
					projectAgentsDir: discovery.projectAgentsDir,
					results,
				});

			if (modeCount !== 1) {
				const available = agents.map((a) => `${a.name} (${a.source})`).join(", ") || "none";
				return {
					content: [{ type: "text", text: `Invalid parameters. Provide exactly one mode.\nAvailable agents: ${available}` }],
					details: makeDetails("single")([]),
				};
			}

			if ((agentScope === "project" || agentScope === "both") && confirmProjectAgents && ctx.hasUI) {
				const requestedAgentNames = new Set<string>();
				if (params.chain) for (const step of params.chain) requestedAgentNames.add(step.agent);
				if (params.tasks) for (const t of params.tasks) requestedAgentNames.add(t.agent);
				if (params.agent) requestedAgentNames.add(params.agent);

				const projectAgentsRequested = Array.from(requestedAgentNames)
					.map((name) => agents.find((a) => a.name === name))
					.filter((a): a is AgentConfig => a?.source === "project");

				if (projectAgentsRequested.length > 0) {
					const names = projectAgentsRequested.map((a) => a.name).join(", ");
					const dir = discovery.projectAgentsDir ?? "(unresolved)";
					const ok = await ctx.ui.confirm(
						"Run project-local agents?",
						`Agents: ${names}\nSource: ${dir}\n\nProject agents are repo-controlled. Only continue for trusted repositories.`,
					);
					if (!ok) {
						return {
							content: [{ type: "text", text: "Canceled: project-local agents not approved." }],
							details: makeDetails(hasChain ? "chain" : hasTasks ? "parallel" : "single")([]),
						};
					}
				}
			}

			if (params.chain && params.chain.length > 0) {
				const results: SingleResult[] = [];
				let previousOutput = "";

				for (let i = 0; i < params.chain.length; i++) {
					const step = params.chain[i];
					const taskWithContext = step.task.replace(/\{previous\}/g, previousOutput);

					const chainUpdate: OnUpdateCallback | undefined = onUpdate
						? (partial) => {
								const currentResult = partial.details?.results[0];
								if (!currentResult) return;
								const allResults = [...results, currentResult];
								onUpdate({ content: partial.content, details: makeDetails("chain")(allResults) });
							}
						: undefined;

					const result = await runSingleAgent(
						ctx.cwd,
						agents,
						step.agent,
						taskWithContext,
						step.cwd,
						i + 1,
						signal,
						chainUpdate,
						makeDetails("chain"),
					);
					results.push(result);

					const isError = result.exitCode !== 0 || result.stopReason === "error" || result.stopReason === "aborted";
					if (isError) {
						const errorMsg = result.errorMessage || result.stderr || formatOutputForLLM(result.output) || "(no output)";
						return {
							content: [{ type: "text", text: `Chain stopped at step ${i + 1} (${step.agent}): ${errorMsg}` }],
							details: makeDetails("chain")(results),
							isError: true,
						};
					}
					previousOutput = formatOutputForLLM(result.output);
				}

				const last = results[results.length - 1];
				return {
					content: [{ type: "text", text: formatOutputForLLM(last.output) }],
					details: makeDetails("chain")(results),
				};
			}

			if (params.tasks && params.tasks.length > 0) {
				if (params.tasks.length > MAX_PARALLEL_TASKS) {
					return {
						content: [{ type: "text", text: `Too many parallel tasks (${params.tasks.length}). Max is ${MAX_PARALLEL_TASKS}.` }],
						details: makeDetails("parallel")([]),
					};
				}

				const allResults: SingleResult[] = new Array(params.tasks.length);
				for (let i = 0; i < params.tasks.length; i++) {
					allResults[i] = {
						agent: params.tasks[i].agent,
						agentSource: "unresolved",
						task: params.tasks[i].task,
						exitCode: -1,
						stderr: "",
						usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
						toolCalls: [],
						output: { text: "", truncated: false },
					};
				}

				const emitParallelUpdate = () => {
					if (!onUpdate) return;
					const running = allResults.filter((r) => r.exitCode === -1).length;
					const done = allResults.filter((r) => r.exitCode !== -1).length;
					onUpdate({
						content: [{ type: "text", text: `Parallel: ${done}/${allResults.length} done, ${running} running...` }],
						details: makeDetails("parallel")([...allResults]),
					});
				};

				const results = await mapWithConcurrencyLimit(params.tasks, MAX_CONCURRENCY, async (t, index) => {
					const result = await runSingleAgent(
						ctx.cwd,
						agents,
						t.agent,
						t.task,
						t.cwd,
						undefined,
						signal,
						(partial) => {
							if (!partial.details?.results[0]) return;
							allResults[index] = partial.details.results[0];
							emitParallelUpdate();
						},
						makeDetails("parallel"),
					);
					allResults[index] = result;
					emitParallelUpdate();
					return result;
				});

				const successCount = results.filter((r) => r.exitCode === 0).length;
				const summaries = results.map((r) => {
					const output = r.output.text;
					const preview = output.slice(0, 100) + (output.length > 100 ? "..." : "");
					const trunc = r.output.truncated ? " (truncated)" : "";
					return `[${r.agent}] ${r.exitCode === 0 ? "completed" : "failed"}${trunc}: ${preview || "(no output)"}`;
				});

				return {
					content: [{ type: "text", text: `Parallel: ${successCount}/${results.length} succeeded\n\n${summaries.join("\n\n")}` }],
					details: makeDetails("parallel")(results),
				};
			}

			if (params.agent && params.task) {
				const result = await runSingleAgent(
					ctx.cwd,
					agents,
					params.agent,
					params.task,
					params.cwd,
					undefined,
					signal,
					onUpdate,
					makeDetails("single"),
				);

				const isError = result.exitCode !== 0 || result.stopReason === "error" || result.stopReason === "aborted";
				if (isError) {
					const errorMsg = result.errorMessage || result.stderr || formatOutputForLLM(result.output) || "(no output)";
					return {
						content: [{ type: "text", text: `Agent ${result.stopReason || "failed"}: ${errorMsg}` }],
						details: makeDetails("single")([result]),
						isError: true,
					};
				}

				return {
					content: [{ type: "text", text: formatOutputForLLM(result.output) }],
					details: makeDetails("single")([result]),
				};
			}

			const available = agents.map((a) => `${a.name} (${a.source})`).join(", ") || "none";
			return {
				content: [{ type: "text", text: `Invalid parameters. Available agents: ${available}` }],
				details: makeDetails("single")([]),
			};
		},

		renderCall(args, theme) {
			const scope: AgentScope = args.agentScope ?? "user";
			if (args.chain && args.chain.length > 0) {
				let text =
					theme.fg("toolTitle", theme.bold("compound_subagent ")) +
					theme.fg("accent", `chain (${args.chain.length} steps)`) +
					theme.fg("muted", ` [${scope}]`);
				for (let i = 0; i < Math.min(args.chain.length, 3); i++) {
					const step = args.chain[i];
					const cleanTask = step.task.replace(/\{previous\}/g, "").trim();
					const preview = cleanTask.length > 40 ? `${cleanTask.slice(0, 40)}...` : cleanTask;
					text +=
						"\n  " +
						theme.fg("muted", `${i + 1}.`) +
						" " +
						theme.fg("accent", step.agent) +
						theme.fg("dim", ` ${preview}`);
				}
				if (args.chain.length > 3) text += `\n  ${theme.fg("muted", `... +${args.chain.length - 3} more`)}`;
				return new Text(text, 0, 0);
			}

			if (args.tasks && args.tasks.length > 0) {
				let text =
					theme.fg("toolTitle", theme.bold("compound_subagent ")) +
					theme.fg("accent", `parallel (${args.tasks.length} tasks)`) +
					theme.fg("muted", ` [${scope}]`);
				for (const t of args.tasks.slice(0, 3)) {
					const preview = t.task.length > 40 ? `${t.task.slice(0, 40)}...` : t.task;
					text += `\n  ${theme.fg("accent", t.agent)}${theme.fg("dim", ` ${preview}`)}`;
				}
				if (args.tasks.length > 3) text += `\n  ${theme.fg("muted", `... +${args.tasks.length - 3} more`)}`;
				return new Text(text, 0, 0);
			}

			const agentName = args.agent || "...";
			const preview = args.task ? (args.task.length > 60 ? `${args.task.slice(0, 60)}...` : args.task) : "...";
			let text =
				theme.fg("toolTitle", theme.bold("compound_subagent ")) +
				theme.fg("accent", agentName) +
				theme.fg("muted", ` [${scope}]`);
			text += `\n  ${theme.fg("dim", preview)}`;
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded }, theme) {
			const details = result.details as SubagentDetails | undefined;
			if (!details || details.results.length === 0) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
			}

			const mdTheme = getMarkdownTheme();
			const expandHint = keyHint("expandTools", "to expand");

			const renderToolCalls = (calls: ToolCallSummary[], limit?: number): { text: string; skipped: number } => {
				const toShow = limit ? calls.slice(-limit) : calls;
				const skipped = limit && calls.length > toShow.length ? calls.length - toShow.length : 0;

				let text = "";
				if (skipped > 0) text += theme.fg("muted", `... ${skipped} earlier tool call(s)\n`);
				for (const c of toShow) {
					text += theme.fg("muted", "→ ") + formatToolCall(c.name, c.args, theme) + "\n";
				}
				return { text: text.trimEnd(), skipped };
			};

			const renderOutputPreview = (output: string, maxLines: number): { text: string; hiddenLines: number } => {
				if (!output.trim()) return { text: theme.fg("muted", "(no output)"), hiddenLines: 0 };
				const lines = output.split("\n");
				const shown = lines.slice(0, maxLines);
				const hiddenLines = Math.max(0, lines.length - shown.length);
				return { text: theme.fg("toolOutput", shown.join("\n")), hiddenLines };
			};

			const aggregateUsage = (results: SingleResult[]) => {
				const total = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 };
				for (const r of results) {
					total.input += r.usage.input;
					total.output += r.usage.output;
					total.cacheRead += r.usage.cacheRead;
					total.cacheWrite += r.usage.cacheWrite;
					total.cost += r.usage.cost;
					total.turns += r.usage.turns;
				}
				return total;
			};

			const formatTruncatedBadge = (r: SingleResult): string => (r.output.truncated ? " " + theme.fg("warning", "[truncated]") : "");

			if (details.mode === "single" && details.results.length === 1) {
				const r = details.results[0];
				const isError = r.exitCode !== 0 || r.stopReason === "error" || r.stopReason === "aborted";
				const icon = isError ? theme.fg("error", "✗") : theme.fg("success", "✓");

				if (expanded) {
					const container = new Container();
					let header =
						`${icon} ` +
						theme.fg("toolTitle", theme.bold(r.agent)) +
						theme.fg("muted", ` (${r.agentSource})`) +
						formatTruncatedBadge(r);
					if (isError && r.stopReason) header += ` ${theme.fg("error", `[${r.stopReason}]`)}`;
					container.addChild(new Text(header, 0, 0));
					if (isError && r.errorMessage) container.addChild(new Text(theme.fg("error", `Error: ${r.errorMessage}`), 0, 0));

					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "─── Task ───"), 0, 0));
					container.addChild(new Text(theme.fg("dim", r.task), 0, 0));

					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "─── Output ───"), 0, 0));

					for (const c of r.toolCalls) {
						container.addChild(new Text(theme.fg("muted", "→ ") + formatToolCall(c.name, c.args, theme), 0, 0));
					}

					if (r.output.text.trim()) {
						container.addChild(new Spacer(1));
						container.addChild(new Markdown(r.output.text.trim(), 0, 0, mdTheme));
					} else {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("muted", "(no output)"), 0, 0));
					}

					if (r.output.truncated && r.output.fullTextPath) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", `Full output: ${r.output.fullTextPath}`), 0, 0));
					}

					const usageStr = formatUsageStats(r.usage, r.model);
					if (usageStr) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", usageStr), 0, 0));
					}
					return container;
				}

				let text =
					`${icon} ` + theme.fg("toolTitle", theme.bold(r.agent)) + theme.fg("muted", ` (${r.agentSource})`) + formatTruncatedBadge(r);
				if (isError && r.stopReason) text += ` ${theme.fg("error", `[${r.stopReason}]`)}`;
				if (isError && r.errorMessage) text += `\n${theme.fg("error", `Error: ${r.errorMessage}`)}`;

				const { text: toolCallText } = renderToolCalls(r.toolCalls, COLLAPSED_ITEM_COUNT);
				const { text: outputPreview, hiddenLines } = renderOutputPreview(r.output.text, 3);

				if (!toolCallText && !r.output.text.trim()) {
					text += `\n${theme.fg("muted", "(no output)")}`;
				} else {
					if (toolCallText) text += `\n${toolCallText}`;
					if (r.output.text.trim()) {
						text += `\n${outputPreview}`;
						if (hiddenLines > 0) text += `\n${theme.fg("muted", `... +${hiddenLines} more line(s)`)}`;
					}
				}

				const showHint = !expanded && (r.toolCalls.length > COLLAPSED_ITEM_COUNT || hiddenLines > 0 || r.output.truncated);
				if (showHint) text += `\n${theme.fg("muted", `(${expandHint})`)}`;

				const usageStr = formatUsageStats(r.usage, r.model);
				if (usageStr) text += `\n${theme.fg("dim", usageStr)}`;
				return new Text(text, 0, 0);
			}

			if (details.mode === "chain") {
				const successCount = details.results.filter((r) => r.exitCode === 0).length;
				const icon = successCount === details.results.length ? theme.fg("success", "✓") : theme.fg("error", "✗");

				if (expanded) {
					const container = new Container();
					container.addChild(
						new Text(
							icon + " " + theme.fg("toolTitle", theme.bold("chain ")) + theme.fg("accent", `${successCount}/${details.results.length} steps`),
							0,
							0,
						),
					);

					for (const r of details.results) {
						const rIcon = r.exitCode === 0 ? theme.fg("success", "✓") : theme.fg("error", "✗");

						container.addChild(new Spacer(1));
						container.addChild(
							new Text(
								`${theme.fg("muted", `─── Step ${r.step}: `) + theme.fg("accent", r.agent)} ${rIcon}${formatTruncatedBadge(r)}`,
								0,
								0,
							),
						);
						container.addChild(new Text(theme.fg("muted", "Task: ") + theme.fg("dim", r.task), 0, 0));

						for (const c of r.toolCalls) {
							container.addChild(new Text(theme.fg("muted", "→ ") + formatToolCall(c.name, c.args, theme), 0, 0));
						}

						if (r.output.text.trim()) {
							container.addChild(new Spacer(1));
							container.addChild(new Markdown(r.output.text.trim(), 0, 0, mdTheme));
						} else {
							container.addChild(new Spacer(1));
							container.addChild(new Text(theme.fg("muted", "(no output)"), 0, 0));
						}

						if (r.output.truncated && r.output.fullTextPath) {
							container.addChild(new Spacer(1));
							container.addChild(new Text(theme.fg("dim", `Full output: ${r.output.fullTextPath}`), 0, 0));
						}

						const stepUsage = formatUsageStats(r.usage, r.model);
						if (stepUsage) container.addChild(new Text(theme.fg("dim", stepUsage), 0, 0));
					}

					const usageStr = formatUsageStats(aggregateUsage(details.results));
					if (usageStr) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", `Total: ${usageStr}`), 0, 0));
					}
					return container;
				}

				let text = icon + " " + theme.fg("toolTitle", theme.bold("chain ")) + theme.fg("accent", `${successCount}/${details.results.length} steps`);
				for (const r of details.results) {
					const rIcon = r.exitCode === 0 ? theme.fg("success", "✓") : theme.fg("error", "✗");
					text += `\n\n${theme.fg("muted", `─── Step ${r.step}: `)}${theme.fg("accent", r.agent)} ${rIcon}${formatTruncatedBadge(r)}`;

					const { text: toolCallText } = renderToolCalls(r.toolCalls, 3);
					const { text: outputPreview, hiddenLines } = renderOutputPreview(r.output.text, 2);

					if (!toolCallText && !r.output.text.trim()) {
						text += `\n${theme.fg("muted", "(no output)")}`;
					} else {
						if (toolCallText) text += `\n${toolCallText}`;
						if (r.output.text.trim()) {
							text += `\n${outputPreview}`;
							if (hiddenLines > 0) text += `\n${theme.fg("muted", `... +${hiddenLines} more line(s)`)}`;
						}
					}
				}

				const usageStr = formatUsageStats(aggregateUsage(details.results));
				if (usageStr) text += `\n\n${theme.fg("dim", `Total: ${usageStr}`)}`;
				text += `\n${theme.fg("muted", `(${expandHint})`)}`;
				return new Text(text, 0, 0);
			}

			if (details.mode === "parallel") {
				const running = details.results.filter((r) => r.exitCode === -1).length;
				const successCount = details.results.filter((r) => r.exitCode === 0).length;
				const failCount = details.results.filter((r) => r.exitCode > 0).length;
				const isRunning = running > 0;
				const icon = isRunning ? theme.fg("warning", "⏳") : failCount > 0 ? theme.fg("warning", "◐") : theme.fg("success", "✓");
				const status = isRunning ? `${successCount + failCount}/${details.results.length} done, ${running} running` : `${successCount}/${details.results.length} tasks`;

				if (expanded && !isRunning) {
					const container = new Container();
					container.addChild(new Text(`${icon} ${theme.fg("toolTitle", theme.bold("parallel "))}${theme.fg("accent", status)}`, 0, 0));

					for (const r of details.results) {
						const rIcon = r.exitCode === 0 ? theme.fg("success", "✓") : theme.fg("error", "✗");

						container.addChild(new Spacer(1));
						container.addChild(new Text(`${theme.fg("muted", "─── ") + theme.fg("accent", r.agent)} ${rIcon}${formatTruncatedBadge(r)}`, 0, 0));
						container.addChild(new Text(theme.fg("muted", "Task: ") + theme.fg("dim", r.task), 0, 0));

						for (const c of r.toolCalls) {
							container.addChild(new Text(theme.fg("muted", "→ ") + formatToolCall(c.name, c.args, theme), 0, 0));
						}

						if (r.output.text.trim()) {
							container.addChild(new Spacer(1));
							container.addChild(new Markdown(r.output.text.trim(), 0, 0, mdTheme));
						} else {
							container.addChild(new Spacer(1));
							container.addChild(new Text(theme.fg("muted", "(no output)"), 0, 0));
						}

						if (r.output.truncated && r.output.fullTextPath) {
							container.addChild(new Spacer(1));
							container.addChild(new Text(theme.fg("dim", `Full output: ${r.output.fullTextPath}`), 0, 0));
						}

						const taskUsage = formatUsageStats(r.usage, r.model);
						if (taskUsage) container.addChild(new Text(theme.fg("dim", taskUsage), 0, 0));
					}

					const usageStr = formatUsageStats(aggregateUsage(details.results));
					if (usageStr) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", `Total: ${usageStr}`), 0, 0));
					}
					return container;
				}

				let text = `${icon} ${theme.fg("toolTitle", theme.bold("parallel "))}${theme.fg("accent", status)}`;
				for (const r of details.results) {
					const rIcon =
						r.exitCode === -1 ? theme.fg("warning", "⏳") : r.exitCode === 0 ? theme.fg("success", "✓") : theme.fg("error", "✗");
					text += `\n\n${theme.fg("muted", "─── ")}${theme.fg("accent", r.agent)} ${rIcon}${formatTruncatedBadge(r)}`;

					const { text: toolCallText } = renderToolCalls(r.toolCalls, 3);
					const { text: outputPreview, hiddenLines } = renderOutputPreview(r.output.text, 2);

					if (!toolCallText && !r.output.text.trim()) {
						text += `\n${theme.fg("muted", r.exitCode === -1 ? "(running...)" : "(no output)")}`;
					} else {
						if (toolCallText) text += `\n${toolCallText}`;
						if (r.output.text.trim()) {
							text += `\n${outputPreview}`;
							if (hiddenLines > 0) text += `\n${theme.fg("muted", `... +${hiddenLines} more line(s)`)}`;
						}
					}
				}

				if (!isRunning) {
					const usageStr = formatUsageStats(aggregateUsage(details.results));
					if (usageStr) text += `\n\n${theme.fg("dim", `Total: ${usageStr}`)}`;
				}
				text += `\n${theme.fg("muted", `(${expandHint})`)}`;
				return new Text(text, 0, 0);
			}

			const text = result.content[0];
			return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
		},
	});

}
