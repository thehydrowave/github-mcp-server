const { Octokit } = require("@octokit/rest");

const octokit = new Octokit({ auth: process.env.GITHUB_PAT });

const tools = [
{
name: "list_repos",
description: "List all repositories for the authenticated user",
inputSchema: { type: "object", properties: {}, required: [] }
},
{
name: "list_files",
description: "List files in a repository directory",
inputSchema: {
type: "object",
properties: {
owner: { type: "string" },
repo: { type: "string" },
path: { type: "string" }
},
required: ["owner", "repo"]
}
},
{
name: "get_file",
description: "Get the content of a file in a repository",
inputSchema: {
type: "object",
properties: {
owner: { type: "string" },
repo: { type: "string" },
path: { type: "string" }
},
required: ["owner", "repo", "path"]
}
},
{
name: "push_file",
description: "Create or update a file in a repository and commit it",
inputSchema: {
type: "object",
properties: {
owner: { type: "string" },
repo: { type: "string" },
path: { type: "string" },
content: { type: "string" },
message: { type: "string" },
branch: { type: "string" }
},
try {
const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
const { method, params, id } = body;

if (method === "initialize") {
return res.json({ jsonrpc: "2.0", id, result: {
protocolVersion: "2024-11-05",
capabilities: { tools: {} },
serverInfo: { name: "github-mcp", version: "1.0.0" }
}});
}
if (method === "tools/list") {
return res.json({ jsonrpc: "2.0", id, result: { tools } });
}
if (method === "tools/call") {
const result = await callTool(params.name, params.arguments || {});
return res.json({ jsonrpc: "2.0", id, result: {
content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
}});
}
return res.json({ jsonrpc: "2.0", id, result: {} });
} catch (e) {
return res.status(500).json({ error: e.message });
}
};
