import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { Octokit } from "@octokit/rest";

const handler = createMcpHandler(
  (server) => {
    const octokit = new Octokit({ auth: process.env.GITHUB_PAT });

    server.registerTool(
      "git_read",
      {
        title: "Read File",
        description: "Read a file or list a directory from a GitHub repo",
        inputSchema: {
          owner: z.string().describe("Repository owner"),
          repo: z.string().describe("Repository name"),
          path: z.string().describe("File or directory path"),
          branch: z.string().default("main").describe("Branch name"),
        },
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
            .map((f: any) => `${f.type === "dir" ? "[dir]" : "[file]"} ${f.name}`)
            .join("\n");
          return { content: [{ type: "text" as const, text: listing }] };
        }
        if ("content" in data && data.content) {
          return {
            content: [
              {
                type: "text" as const,
                text: Buffer.from(data.content, "base64").toString("utf-8"),
              },
            ],
          };
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
      }
    );

    server.registerTool(
      "git_push",
      {
        title: "Push File",
        description: "Create or update a file in a GitHub repo",
        inputSchema: {
          owner: z.string().describe("Repository owner"),
          repo: z.string().describe("Repository name"),
          path: z.string().describe("File path to create or update"),
          content: z.string().describe("File content"),
          message: z.string().describe("Commit message"),
          branch: z.string().default("main").describe("Branch name"),
        },
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
              type: "text" as const,
              text: `Committed: ${data.commit.sha?.slice(0, 7)} - ${message}`,
            },
          ],
        };
      }
    );

    server.registerTool(
      "git_delete",
      {
        title: "Delete File",
        description: "Delete a file from a GitHub repo",
        inputSchema: {
          owner: z.string().describe("Repository owner"),
          repo: z.string().describe("Repository name"),
          path: z.string().describe("File path to delete"),
          message: z.string().describe("Commit message"),
          branch: z.string().default("main").describe("Branch name"),
        },
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
            content: [{ type: "text" as const, text: "Cannot delete a directory" }],
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
          content: [{ type: "text" as const, text: `Deleted: ${path}` }],
        };
      }
    );

    server.registerTool(
      "git_list_repos",
      {
        title: "List Repos",
        description: "List repositories for a user or organization",
        inputSchema: {
          owner: z.string().describe("GitHub username or org"),
        },
      },
      async ({ owner }) => {
        const { data } = await octokit.repos.listForUser({
          username: owner,
          sort: "updated",
          per_page: 30,
        });
        const list = data
          .map((r: any) => `${r.full_name} ${r.private ? "(private)" : "(public)"} stars:${r.stargazers_count}`)
          .join("\n");
        return { content: [{ type: "text" as const, text: list }] };
      }
    );
  },
  {},
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: true,
  }
);

export { handler as GET, handler as POST };
