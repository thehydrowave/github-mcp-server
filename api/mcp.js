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
        path: { type: "string", description: "Directory path (default: root)" }
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
        content: { type: "string", description: "File content" },
        message: { type: "string", description: "Commit message" },
        branch: { type: "string", description: "Branch (default: main)" }
      },
      required: ["owner", "repo", "path", "content", "message"]
    }
  }
];

async function callTool(name, args) {
  if (name === "list_repos") {
    const { data } = await octokit.repos.listForAuthenticatedUser({ per_page: 50 });
    return data.map(r => ({ name: r.name, url: r.html_url, private: r.private }));
  }
  if (name === "list_files") {
    const { data } = await octokit.repos.getContent({
      owner: args.owner, repo: args.repo, path: args.path || ""
    });
    return Array.isArray(data) ? data.map(f => ({ name: f.name, type: f.type, path: f.path })) : [data];
  }
  if (name === "get_file") {
    const { data } = await octokit.repos.getContent({
      owner: args.owner, repo: args.repo, path: args.path
    });
    const content = Buffer.from(data.content, "base64").toString("utf-8");
    return { path: args.path, content, sha: data.sha };
  }
  if (name === "push_file") {
    let sha;
    try {
      const { data } = await octokit.repos.getContent({
        owner: args.owner, repo: args.repo, path: args.path, ref: args.branch || "main"
      });
      sha = data.sha;
    } catch {}
    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner: args.owner, repo: args.repo, path: args.path,
      message: args.message,
      content: Buffer.from(args.content).toString("base64"),
      branch: args.branch || "main",
      ...(sha ? { sha } : {})
    });
    return { committed: true, sha: data.commit.sha, url: data.content.html_url };
  }
  throw new Error(`Unknown tool: ${name}`);
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.json({ status: "ok", server: "github-mcp" });

  const { method, params, id } = req.body;

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
    try {
      const result = await callTool(params.name, params.arguments || {});
      return res.json({ jsonrpc: "2.0", id, result: {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      }});
    } catch (e) {
      return res.json({ jsonrpc: "2.0", id, error: { code: -32000, message: e.message } });
    }
  }
  return res.json({ jsonrpc: "2.0", id, result: {} });
};
