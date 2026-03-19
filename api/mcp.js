import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "mcp-handler/nextjs";
import { z } from "zod";
import { Octokit } from "@octokit/rest";

const handler = createMcpHandler(
(server: McpServer) => {
const octokit = new Octokit({ auth: process.env.GITHUB_PAT });

server.tool("git_read", "Read a file or list a directory",
{
owner: z.string(),
repo: z.string(),
path: z.string(),
branch: z.string().default("main"),
},
async ({ owner, repo, path, branch }) => {
const { data } = await octokit.repos.getContent({ owner, repo, path, ref: branch });
if (Array.isArray(data)) {
return { content: [{ type: "text", text: data.map(f => `${f.type === "dir" ? "📁" : "📄"} ${f.name}`).join("\n") }] };
}
if ("content" in data && data.content) {
return { content: [{ type: "text", text: Buffer.from(data.content, "base64").toString("utf-8") }] };
}
return { content: [{ type: "text", text: JSON.stringify(data) }] };
}
);

server.tool("git_push", "Create or update a file",
{
owner: z.string(),
repo: z.string(),
path: z.string(),
content: z.string(),
message: z.string(),
branch: z.string().default("main"),
},
async ({ owner, repo, path, content, message, branch }) => {
let sha: string | undefined;
try {
const { data } = await octokit.repos.getContent({ owner, repo, path, ref: branch });
if (!Array.isArray(data) && "sha" in data) sha = data.sha;
} catch {}
const { data } = await octokit.repos.createOrUpdateFileContents({
owner, repo, path, branch, message,
content: Buffer.from(content).toString("base64"),
sha,
committer: { name: "thehydrowave", email: "thehydrowave@users.noreply.github.com" },
});
return { content: [{ type: "text", text: `Committed: ${data.commit.sha?.slice(0, 7)}` }] };
}
);
},
{ capabilities: { tools: {} } }
);

export { handler as GET, handler as POST, handler as DELETE };
