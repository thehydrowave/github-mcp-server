import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "mcp-handler/nextjs";
import { z } from "zod";
import { Octokit } from "@octokit/rest";

const handler = createMcpHandler(
  (server: McpServer) => {
    const octokit = new Octokit({ auth: process.env.GITHUB_PAT });

    server.tool(
      "git_read",
      "Read a file or list a directory from a GitHub repo",
      {
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        path: z.string().describe("File or directory path"),
        branch: z.string().default("main").describe("Branch name"),
      },
      async ({ owner, repo, path, branch }) => {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path,
          ref: branch,
        });
        if (Array.isArray(data)) {
          const listing = data
            .map((f) => `${f.type === "dir" ? "\u{1F4C1}" : "\u{1F4C4}"} ${f.name}`)
            .join("\n");
          return { content: [{ type: "text", text: listing }] };
        }
        if ("content" in data && data.content) {
          return {
            content: [
              {
                type: "text",
                text: Buffer.from(data.content, "base64").toString("utf-8"),
              },
            ],
          };
        }
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      }
    );

    server.tool(
      "git_push",
      "Create or update a file in a GitHub repo",
      {
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        path: z.string().describe("File path to create or update"),
        content: z.string().describe("File content"),
        message: z.string().describe("Commit message"),
        branch: z.string().default("main").describe("Branch name"),
      },
      async ({ owner, repo, path, content, message, branch }) => {
        let sha: string | undefined;
        try {
          const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path,
            ref: branch,
          });
          if (!Array.isArray(data) && "sha" in data) sha = data.sha;
        } catch {
          // File does not exist yet
        }
        const { data } = await octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path,
          branch,
          message,
          content: Buffer.from(content).toString("base64"),
          sha,
          committer: {
            name: "thehydrowave",
            email: "thehydrowave@users.noreply.github.com",
          },
        });
        return {
          content: [
            {
              type: "text",
              text: `Committed: ${data.commit.sha?.slice(0, 7)} - ${message}`,
            },
          ],
        };
      }
    );

    server.tool(
      "git_delete",
      "Delete a file from a GitHub repo",
      {
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        path: z.string().describe("File path to delete"),
        message: z.string().describe("Commit message"),
        branch: z.string().default("main").describe("Branch name"),
      },
      async ({ owner, repo, path, message, branch }) => {
        const { data: fileData } = await octokit.repos.getContent({
          owner,
          repo,
          path,
          ref: branch,
        });
        if (Array.isArray(fileData)) {
          return {
            content: [{ type: "text", text: "Cannot delete a directory" }],
          };
        }
        await octokit.repos.deleteFile({
          owner,
          repo,
          path,
          message,
          sha: fileData.sha,
          branch,
          committer: {
            name: "thehydrowave",
            email: "thehydrowave@users.noreply.github.com",
          },
        });
        return {
          content: [{ type: "text", text: `Deleted: ${path}` }],
        };
      }
    );

    server.tool(
      "git_list_repos",
      "List repositories for a user or organization",
      {
        owner: z.string().describe("GitHub username or org"),
      },
      async ({ owner }) => {
        const { data } = await octokit.repos.listForUser({
          username: owner,
          sort: "updated",
          per_page: 30,
        });
        const list = data
          .map((r) => `${r.full_name} ${r.private ? "private" : "public"} stars:${r.stargazers_count}`)
          .join("\n");
        return { content: [{ type: "text", text: list }] };
      }
    );
  },
  {
    capabilities: { tools: {} },
  }
);

export { handler as GET, handler as POST, handler as DELETE };
