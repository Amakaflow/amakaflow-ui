/**
 * Linear GraphQL client.
 * Handles: fetching todo tickets, checking blockers, updating status, adding comments.
 */

import type { Config } from "./config.js";

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string;
  number: number;
  url: string;
  state: { id: string; name: string; type: string };
  assignee: { id: string; displayName: string } | null;
  parent: { id: string; identifier: string } | null;
  children: { nodes: Array<{ id: string; identifier: string; state: { name: string } }> };
  relations: {
    nodes: Array<{
      type: string;
      relatedIssue: { id: string; identifier: string; state: { name: string; type: string } };
    }>;
  };
}

export interface ReadyIssue {
  id: string;
  identifier: string;
  title: string;
  description: string;
  number: number;
  url: string;
  blockedByUnresolved: string[];  // identifiers of unresolved blockers
}

export class LinearClient {
  private apiUrl = "https://api.linear.app/graphql";

  constructor(private config: Config) {}

  private async query<T>(gql: string, variables: Record<string, unknown> = {}): Promise<T> {
    const res = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.config.linearApiKey,
      },
      body: JSON.stringify({ query: gql, variables }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Linear API ${res.status}: ${text}`);
    }

    const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
    if (json.errors?.length) {
      throw new Error(`Linear GraphQL: ${json.errors.map((e) => e.message).join(", ")}`);
    }
    return json.data as T;
  }

  /**
   * Fetch all issues assigned to the agent in "Todo" status.
   * Includes blocker relations so we can filter.
   */
  async fetchTodoIssues(): Promise<ReadyIssue[]> {
    const data = await this.query<{
      issues: {
        nodes: LinearIssue[];
      };
    }>(
      `query($assigneeId: ID!, $teamId: String!, $statusName: String!) {
        issues(
          filter: {
            assignee: { id: { eq: $assigneeId } }
            team: { id: { eq: $teamId } }
            state: { name: { eq: $statusName } }
          }
          first: 50
          orderBy: createdAt
        ) {
          nodes {
            id
            identifier
            title
            description
            number
            url
            state { id name type }
            assignee { id displayName }
            parent { id identifier }
            children {
              nodes { id identifier state { name } }
            }
            relations {
              nodes {
                type
                relatedIssue {
                  id identifier
                  state { name type }
                }
              }
            }
          }
        }
      }`,
      {
        assigneeId: this.config.linearAssigneeId,
        teamId: this.config.linearTeamId,
        statusName: this.config.linearPickupStatus,
      }
    );

    return data.issues.nodes.map((issue) => {
      // Check "blocks" relations where this issue is blocked BY another
      const blockedByUnresolved = issue.relations.nodes
        .filter((r) => {
          // Linear relation types: "blocks" means relatedIssue blocks this issue
          // We want to find issues that block THIS issue and aren't done/canceled
          return (
            r.type === "blocks" &&
            r.relatedIssue.state.type !== "completed" &&
            r.relatedIssue.state.type !== "canceled"
          );
        })
        .map((r) => r.relatedIssue.identifier);

      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description || "",
        number: issue.number,
        url: issue.url,
        blockedByUnresolved,
      };
    });
  }

  /**
   * Fetch a single issue to verify its current state before acting.
   * Prevents race conditions (ticket moved/unassigned while we were deciding).
   */
  async fetchIssue(issueId: string): Promise<{
    id: string;
    identifier: string;
    state: { id: string; name: string; type: string };
    assignee: { id: string } | null;
  } | null> {
    try {
      const data = await this.query<{
        issue: {
          id: string;
          identifier: string;
          state: { id: string; name: string; type: string };
          assignee: { id: string } | null;
        };
      }>(
        `query($id: String!) {
          issue(id: $id) {
            id
            identifier
            state { id name type }
            assignee { id }
          }
        }`,
        { id: issueId }
      );
      return data.issue;
    } catch {
      return null;
    }
  }

  /**
   * Move issue to In Progress.
   */
  async moveToInProgress(issueId: string): Promise<void> {
    await this.query(
      `mutation($id: String!, $stateId: String!) {
        issueUpdate(id: $id, input: { stateId: $stateId }) {
          success
        }
      }`,
      { id: issueId, stateId: this.config.linearInProgressStatusId }
    );
  }

  /**
   * Move issue to Done.
   */
  async moveToDone(issueId: string): Promise<void> {
    await this.query(
      `mutation($id: String!, $stateId: String!) {
        issueUpdate(id: $id, input: { stateId: $stateId }) {
          success
        }
      }`,
      { id: issueId, stateId: this.config.linearDoneStatusId }
    );
  }

  /**
   * Move issue back to Todo (on failure, for retry).
   */
  async moveToTodo(issueId: string): Promise<void> {
    await this.query(
      `mutation($id: String!, $stateId: String!) {
        issueUpdate(id: $id, input: { stateId: $stateId }) {
          success
        }
      }`,
      { id: issueId, stateId: this.config.linearTodoStatusId }
    );
  }

  /**
   * Add a comment to an issue.
   */
  async addComment(issueId: string, body: string): Promise<void> {
    await this.query(
      `mutation($issueId: String!, $body: String!) {
        commentCreate(input: { issueId: $issueId, body: $body }) {
          success
        }
      }`,
      { issueId, body }
    );
  }
}
