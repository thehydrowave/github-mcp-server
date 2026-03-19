# GitHub MCP Server

Custom MCP server deployed on Vercel to connect Claude to GitHub.

## Tools

- **git_read** - Read a file or list a directory
- **git_push** - Create or update a file
- **git_delete** - Delete a file
- **git_list_repos** - List repositories

## Setup

Set `GITHUB_PAT` environment variable in Vercel with a GitHub Personal Access Token.

## MCP Endpoint

`https://<your-domain>/api/mcp/mcp`
