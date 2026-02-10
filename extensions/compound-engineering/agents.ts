import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseFrontmatter } from "@mariozechner/pi-coding-agent";

export type AgentScope = "user" | "project" | "both";
export type AgentSource = "package" | "user" | "project";

export interface AgentConfig {
	name: string;
	description: string;
	tools?: string[];
	model?: string;
	systemPrompt: string;
	source: AgentSource;
	filePath: string;
}

export interface AgentDiscoveryResult {
	agents: AgentConfig[];
	packageAgentsDir: string;
	projectAgentsDir: string | null;
	userAgentsDir: string;
}

function isDirectory(p: string): boolean {
	try {
		return fs.statSync(p).isDirectory();
	} catch {
		return false;
	}
}

function* walk(dir: string): Generator<string> {
	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return;
	}

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* walk(fullPath);
			continue;
		}
		if (!entry.isFile() && !entry.isSymbolicLink()) continue;
		if (!entry.name.endsWith(".md")) continue;
		yield fullPath;
	}
}

type FrontmatterScalar = string | number | boolean | null;

interface AgentFrontmatter {
	name?: FrontmatterScalar;
	description?: FrontmatterScalar;
	tools?: FrontmatterScalar;
	model?: FrontmatterScalar;
	[key: string]: FrontmatterScalar | undefined;
}

function parseTools(raw: FrontmatterScalar | undefined): string[] | undefined {
	if (typeof raw !== "string") return undefined;

	const tools = raw
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean)
		.map((t) => t.toLowerCase());

	return tools.length > 0 ? tools : undefined;
}

function normalizeModel(raw: FrontmatterScalar | undefined): string | undefined {
	if (typeof raw !== "string") return undefined;
	const m = raw.trim();
	if (!m || m === "inherit") return undefined;
	return m;
}

function loadAgentsFromDir(dir: string, source: AgentSource, recursive: boolean): AgentConfig[] {
	const agents: AgentConfig[] = [];
	if (!fs.existsSync(dir)) return agents;

	const files = recursive
		? Array.from(walk(dir))
		: fs
				.readdirSync(dir, { withFileTypes: true })
				.filter((e) => (e.isFile() || e.isSymbolicLink()) && e.name.endsWith(".md"))
				.map((e) => path.join(dir, e.name));

	for (const filePath of files) {
		let content: string;
		try {
			content = fs.readFileSync(filePath, "utf-8");
		} catch {
			continue;
		}

		const { frontmatter, body } = parseFrontmatter<AgentFrontmatter>(content);
		const name = typeof frontmatter.name === "string" ? frontmatter.name.trim() : "";
		const description = typeof frontmatter.description === "string" ? frontmatter.description.trim() : "";

		if (!name || !description) continue;

		agents.push({
			name,
			description,
			tools: parseTools(frontmatter.tools),
			model: normalizeModel(frontmatter.model),
			systemPrompt: body,
			source,
			filePath,
		});
	}

	return agents;
}

function findNearestProjectAgentsDir(cwd: string): string | null {
	let currentDir = cwd;
	while (true) {
		const candidate = path.join(currentDir, ".pi", "agents");
		if (isDirectory(candidate)) return candidate;

		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) return null;
		currentDir = parentDir;
	}
}

/**
 * Discover agents from:
 * - package agents dir (recursive)
 * - ~/.pi/agent/agents (non-recursive)
 * - nearest .pi/agents (non-recursive)
 *
 * Precedence when names collide: project > user > package.
 */
export function discoverAgents(cwd: string, packageAgentsDir: string, scope: AgentScope): AgentDiscoveryResult {
	const userAgentsDir = path.join(os.homedir(), ".pi", "agent", "agents");
	const projectAgentsDir = findNearestProjectAgentsDir(cwd);

	const packageAgents = loadAgentsFromDir(packageAgentsDir, "package", true);
	const userAgents = scope === "project" ? [] : loadAgentsFromDir(userAgentsDir, "user", false);
	const projectAgents = scope === "user" || !projectAgentsDir ? [] : loadAgentsFromDir(projectAgentsDir, "project", false);

	const agentMap = new Map<string, AgentConfig>();
	// Lowest precedence first
	for (const a of packageAgents) agentMap.set(a.name, a);
	for (const a of userAgents) agentMap.set(a.name, a);
	for (const a of projectAgents) agentMap.set(a.name, a);

	return {
		agents: Array.from(agentMap.values()),
		packageAgentsDir,
		projectAgentsDir,
		userAgentsDir,
	};
}

export function formatAgentList(agents: AgentConfig[], maxItems: number): { text: string; remaining: number } {
	if (agents.length === 0) return { text: "none", remaining: 0 };
	const listed = agents.slice(0, maxItems);
	const remaining = agents.length - listed.length;
	return {
		text: listed.map((a) => `${a.name} (${a.source}): ${a.description}`).join("; "),
		remaining,
	};
}
