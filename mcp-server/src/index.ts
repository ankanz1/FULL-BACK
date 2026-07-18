import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { sportsDb } from "./sportsDb.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config(); // also allow mcp-server/.env override

const server = new Server(
  {
    name: "fullback-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "hello_analyst",
        description: "A simple hello world test tool for the FULL BACK AI Analyst.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The name of the user to greet.",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "get_match_stats",
        description: "Retrieve comprehensive match statistics, events, lineups, and live/historical scores.",
        inputSchema: {
          type: "object",
          properties: {
            match_id: {
              type: "string",
              description: "The unique ID of the match (e.g., M001, M002).",
            },
          },
          required: ["match_id"],
        },
      },
      {
        name: "get_team_form",
        description: "Retrieve a team's recent form, last 5 match results, goals scored/conceded, and clean sheets count.",
        inputSchema: {
          type: "object",
          properties: {
            team_id: {
              type: "string",
              description: "The team ID (e.g., USA, COL, GER).",
            },
          },
          required: ["team_id"],
        },
      },
      {
        name: "get_standings",
        description: "Retrieve the current group stage standings for the World Cup.",
        inputSchema: {
          type: "object",
          properties: {
            group: {
              type: "string",
              description: "The group stage letter (e.g., A, B).",
            },
          },
          required: ["group"],
        },
      },
      {
        name: "predict_outcome",
        description: "Generate AI match outcome prediction.",
        inputSchema: {
          type: "object",
          properties: {
            match_id: {
              type: "string",
              description: "The unique ID of the match (e.g., M001, M002).",
            },
          },
          required: ["match_id"],
        },
      },
      {
        name: "tactical_breakdown",
        description: "Generate tactical match breakdown writeup.",
        inputSchema: {
          type: "object",
          properties: {
            match_id: {
              type: "string",
              description: "The unique ID of the match (e.g., M001, M002).",
            },
          },
          required: ["match_id"],
        },
      },
      {
        name: "player_style_cluster",
        description: "Access player similarity clustering data.",
        inputSchema: {
          type: "object",
          properties: {
            player_id: {
              type: "string",
              description: "The player ID (e.g., PL001, PL002).",
            },
          },
          required: ["player_id"],
        },
      },
      {
        name: "generate_highlights",
        description: "Generate match highlight clips from audio telemetry.",
        inputSchema: {
          type: "object",
          properties: {
            match_id: {
              type: "string",
              description: "The unique ID of the match (e.g., M001, M002).",
            },
          },
          required: ["match_id"],
        },
      },
    ],
  };
});

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

async function callPythonService(path: string): Promise<any> {
  const url = `${PYTHON_SERVICE_URL}${path}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Python service returned error ${response.status}: ${errText}`);
  }
  
  return await response.json();
}

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "hello_analyst") {
    const { name: userName } = args as { name: string };
    return {
      content: [
        {
          type: "text",
          text: `Hello ${userName}! FULL BACK AI Analyst is ready. Standing by for sports telemetry data.`,
        },
      ],
    };
  }

  if (name === "get_match_stats") {
    const { match_id } = args as { match_id: string };
    const match = await sportsDb.getMatchStats(match_id);
    if (!match) {
      throw new Error(`Match with ID ${match_id} not found.`);
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(match, null, 2),
        },
      ],
    };
  }

  if (name === "get_team_form") {
    const { team_id } = args as { team_id: string };
    const form = await sportsDb.getTeamForm(team_id);
    if (!form) {
      throw new Error(`Team form for ${team_id} not found.`);
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(form, null, 2),
        },
      ],
    };
  }

  if (name === "get_standings") {
    const { group } = args as { group: string };
    const standings = await sportsDb.getStandings(group);
    if (!standings) {
      throw new Error(`Group standings for Group ${group} not found. Available groups: A, B.`);
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(standings, null, 2),
        },
      ],
    };
  }

  if (name === "predict_outcome") {
    const { match_id } = args as { match_id: string };
    try {
      const data = await callPythonService(`/predict/match/${match_id}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to generate prediction: ${error.message}`);
    }
  }

  if (name === "tactical_breakdown") {
    const { match_id } = args as { match_id: string };
    try {
      const data = await callPythonService(`/tactical/match/${match_id}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to generate tactical breakdown: ${error.message}`);
    }
  }

  if (name === "player_style_cluster") {
    const { player_id } = args as { player_id: string };
    try {
      const data = await callPythonService(`/cluster/player/${player_id}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to cluster player: ${error.message}`);
    }
  }

  if (name === "generate_highlights") {
    const { match_id } = args as { match_id: string };
    try {
      const data = await callPythonService(`/highlights/match/${match_id}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to generate highlights: ${error.message}`);
    }
  }

  throw new Error(`Tool not found: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("FULL BACK MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error starting server:", error);
  process.exit(1);
});
