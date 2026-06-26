import { Handler } from "aws-lambda";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssmClient = new SSMClient({ region: process.env.AWS_REGION || "eu-west-3" });

interface FFBApiConfig {
  baseUrl: string;
  token: string;
  responseTransformer?: (data: any) => any; // Optional response transformation
}

function isProxyDebugEnabled(): boolean {
        return (process.env.FFB_PROXY_DEBUG || "false").toLowerCase() === "true";
}

function asBearerToken(token: string): string {
        const trimmed = (token || "").trim();
        if (!trimmed) {
                console.warn("[FFB API] asBearerToken: Empty token provided!");
                return "";
        }
        const result = trimmed.toLowerCase().startsWith("bearer ") ? trimmed : `Bearer ${trimmed}`;
        const preview = result.substring(0, 30) + "..." + result.substring(result.length - 10);
        console.log(`[FFB API] asBearerToken: Prepared token starting with: ${preview}`);
        return result;
}

// V1 API (default)
const FFB_API_V1: FFBApiConfig = {
    baseUrl: process.env.FFB_API_V1_BASE_URL || "https://api.ffbridge.fr/api/v1/",
    token: asBearerToken(
            process.env.FFB_API_V1_TOKEN ||
            "Bearer eyJhbGciOiJSUzI1NiJ9.eyJyb2xlcyI6WyJST0xFX1dPUktBUkVBX1VTRVIiLCJST0xFX1VTRVIiXSwidXNlcm5hbWUiOiIyNDM5NzUyIiwicGluIjoiMDAwMCIsIm1lZGlhIjoxLCJkZWZhdWx0X2xhbmRpbmdwYWdlIjoibGljZW5zZWUiLCJlbWFpbCI6ImNocnJlbm91eEB5YWhvby5mciIsInBob25lIjoiMDc0OTE5NDAxOCIsInRva2VuX3NlY3VyaXplciI6bnVsbCwic2lnbl9pbl9zZWNvbmRfZmFjdG9yIjpmYWxzZSwiaXNfYWRtaW5fdXNlciI6ZmFsc2UsImlzX3ZhbGlkX2xpY2Vuc2UiOnRydWUsImlhdCI6MTY3NjgxOTQxNiwiZXhwIjozMTU1Mjc2ODE5NDE2LCJpc19mcm9tX2V4dGVybmFsX2FwaSI6ZmFsc2UsImd0bWNsaWVudGlkIjoiMCJ9.APMJKiStZDgkLTESRvJpS6cz67ZLLZXaHLMZoyqbEDTG7hs2NnI8HZZ6Kl8eZxjMt-TOZgYfiHnaX93zXUXFQ0b3BikSlbTJOl9bSZ56cnlGrKVeW39faW-JoUiXYHsg2UIwaiZfCCbDzKJhM4Bs2L3r0tlOV3ONxgNmbeRXEkafY7-VSTiq7NDU4HEPUNMjCNLU16a8H4N92WGykTntfgS81IJGswmtH3FkfKjvoncV_4Ph32Ik8JezqhO_SDKXFu4jnFHOr98W61KKrvgZsUb7ZjSnCS8WPHv60yor8xMJmV-Bl9YbydG0BRnn-NNvZvNPQkP047CGaLCqLQHNl0qmh3Hf6n4E5BGZ3yivtXtVqhGM3uITOiajoy8hBcku0s4fFnYf1pIExrA8NF9T5NVcaJMutNBPMop82IUThgiVFS1wAGhnubQCT3Qz9kvpB1hCRRtJHRBVxDU9wBodKX6QdjfbKA8InW-AiM2hlhNG-fuMU5nQGj-CGzPrriTST4UVKEST6sSFEBIdOiygYPgVwIXS1BCZz3NzBm36H7spu4TUf1nQj9F4QS7P8AoglakIuTcpxx2RzrJgEY5CVlwdTwuHfPw1x5Xqdd11-cABpV7X3aMKYaf4WM84WNUVuvyl4LtiNMO3zUaSk-mSqSTn2HsGbr9IR3S4WKF89EE"
    ),
};

// V2 API - token loaded dynamically from SSM
let FFB_API_V2: FFBApiConfig = {
    baseUrl: process.env.FFB_API_V2_BASE_URL || "https://api-lancelot.ffbridge.fr/",
    token: "",
    responseTransformer: (data: any) => data,
};

async function loadV2Token(): Promise<void> {
    if (FFB_API_V2.token) return; // Already loaded - keep it for the Lambda lifetime
    
    try {
        console.log("[FFB API] Loading V2 token from SSM Parameter Store...");
        const response = await ssmClient.send(
            new GetParameterCommand({
                Name: "FFB_API_V2_TOKEN",
                WithDecryption: true,
            })
        );
        const tokenValue = response.Parameter?.Value || "";
        FFB_API_V2.token = asBearerToken(tokenValue);
        const preview = FFB_API_V2.token.substring(0, 30) + "..." + FFB_API_V2.token.substring(FFB_API_V2.token.length - 20);
        console.log(`[FFB API] ✅ V2 token loaded from SSM (stable token, expires July 2027): ${preview}`);
    } catch (error) {
        console.warn(`[FFB API] ⚠️ Failed to fetch from SSM: ${error}. Using fallback token.`);
        // Fallback to hardcoded token if SSM fails
        FFB_API_V2.token = asBearerToken("Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJMYW5jZWxvdCBUb2tlbiIsImlhdCI6MTc4MjIyNDQ4NSwiZXhwIjoxODEzNzYwNDg1LCJmaXJlYmFzZVVpZCI6IndySWc4cVJlRFVpeWF4dGtCOVpFdWh2blBYQVYifQ.T0OZi1GM2TcLHIkNN5JhPu_M9bv1A_V09VYiT6sMPuM");
        const fallback = FFB_API_V2.token.substring(0, 30) + "..." + FFB_API_V2.token.substring(FFB_API_V2.token.length - 20);
        console.log(`[FFB API] 🔄 Using fallback token: ${fallback}`);
    }
}

const CLUB_TOURNAMENT_V2_GROUP_ID = process.env.FFB_V2_GROUP_ID || "21334";
const CLUB_TOURNAMENT_V2_MAX_PER_PAGE = "80";
const CLUB_TOURNAMENT_V2_CURRENT_PAGE = "1";

function isMigrationEnabled(): boolean {
    return (process.env.FFB_MIGRATION_ENABLED || "false").toLowerCase() === "true";
}

function formatDateYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
}

function mapEndpointForVersion(endpoint: string, version: "v1" | "v2"): string {
    if (version === "v1") {
        return endpoint;
    }

    const [pathPart, queryPart] = endpoint.split("?", 2);
    let mappedPath = pathPart;

    // V2 seasons endpoint changed from /seasons to /seasons/current
    if (pathPart === "seasons") {
        mappedPath = "seasons/current";
    }

    if (pathPart === "organizations/1438/club_tournament") {
        const now = new Date();
        const dateFrom = formatDateYYYYMMDD(now);
        const dateTo = formatDateYYYYMMDD(addDays(now, 28));

        const params = new URLSearchParams();
        params.set("dateFrom", dateFrom);
        params.set("dateTo", dateTo);
        params.set("currentPage", CLUB_TOURNAMENT_V2_CURRENT_PAGE);
        params.set("maxPerPage", CLUB_TOURNAMENT_V2_MAX_PER_PAGE);
        params.set("groupId", CLUB_TOURNAMENT_V2_GROUP_ID);
        params.append("context[]", "groupSession.entryCount");

        mappedPath = `competitions/groupSessions/search?${params.toString()}`;
    }

    // V2 club members endpoint: map to persons/search with seasonId
    if (pathPart === "organizations/1438/members") {
        const params = new URLSearchParams();
        params.set("ffbCode", "5500020"); // Club code
        
        // Extract seasonId from query string if provided
        if (queryPart) {
            const queryParams = new URLSearchParams(queryPart);
            const seasonId = queryParams.get("seasonId");
            if (seasonId) {
                params.set("seasonId", seasonId);
            }
        }
        
        params.set("currentPage", "1");
        params.set("maxPerPage", "80");
        params.set("sortField", "lastName");

        mappedPath = `persons/search?${params.toString()}`;
    }

    return queryPart && !mappedPath.includes("?") ? `${mappedPath}?${queryPart}` : mappedPath;
}

/**
 * Gradual rollout helper:
 * FFB_API_V2_ENDPOINTS accepts comma-separated endpoint prefixes.
 * Examples: "members,seasons,competitions"
 */
function shouldUseV2ForEndpoint(endpoint: string): boolean {
    if (!isMigrationEnabled()) {
        return false;
    }

    const raw = (process.env.FFB_API_V2_ENDPOINTS || "").trim();
    if (!raw) {
        return false;
    }

    const prefixes = raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

    if (prefixes.includes("*") || prefixes.includes("all")) {
        return true;
    }

    return prefixes.some(
        (prefix) =>
            endpoint === prefix ||
            endpoint.startsWith(prefix + "/") ||
            endpoint.startsWith(prefix + "?")
    );
}

/**
 * Select API version by environment flags.
 * - FFB_API_VERSION=v2: all endpoints on V2
 * - FFB_API_VERSION=v1 (default): V1, except endpoints listed in FFB_API_V2_ENDPOINTS
 */
function getFFBApiConfig(endpoint: string): FFBApiConfig {
    // Club tournaments are explicitly migrated to V2.
    if (endpoint === "organizations/1438/club_tournament") {
        console.log("[FFB API] 🎯 getFFBApiConfig: Forcing V2 for club_tournament endpoint");
        const preview = FFB_API_V2.token.substring(0, 30) + "..." + FFB_API_V2.token.substring(FFB_API_V2.token.length - 10);
        console.log(`[FFB API] V2 Token configured: ${preview} (length=${FFB_API_V2.token.length})`);
        return FFB_API_V2;
    }

    // Seasons endpoint migrated to V2
    if (endpoint === "seasons") {
        console.log("[FFB API] 🎯 getFFBApiConfig: Forcing V2 for seasons endpoint");
        const preview = FFB_API_V2.token.substring(0, 30) + "..." + FFB_API_V2.token.substring(FFB_API_V2.token.length - 10);
        console.log(`[FFB API] V2 Token configured: ${preview} (length=${FFB_API_V2.token.length})`);
        return FFB_API_V2;
    }

    // Club members endpoint migrated to V2
    if (endpoint.startsWith("organizations/1438/members")) {
        console.log("[FFB API] 🎯 getFFBApiConfig: Forcing V2 for club members endpoint");
        const preview = FFB_API_V2.token.substring(0, 30) + "..." + FFB_API_V2.token.substring(FFB_API_V2.token.length - 10);
        console.log(`[FFB API] V2 Token configured: ${preview} (length=${FFB_API_V2.token.length})`);
        return FFB_API_V2;
    }

    if (!isMigrationEnabled()) {
        return FFB_API_V1;
    }

    const forcedVersion = (process.env.FFB_API_VERSION || "v1").toLowerCase();

    if (forcedVersion === "v2") {
        return FFB_API_V2;
    }

    if (forcedVersion !== "v1") {
        console.warn(`[FFB API] Unknown FFB_API_VERSION='${forcedVersion}', fallback to v1 strategy.`);
    }

    return shouldUseV2ForEndpoint(endpoint) ? FFB_API_V2 : FFB_API_V1;
}

/**
 * Make a fetch request to FFB API with automatic error handling and response transformation
 * @param endpoint The API endpoint to call
 * @param options RequestInit options (headers, method, body, etc)
 * @param clientV2Token Optional V2 token from client (takes priority over SSM)
 */
async function fetchFFBApi(
  endpoint: string,
  options?: RequestInit,
  clientV2Token?: string
): Promise<any> {
    // If client provided a V2 token, use it immediately (always fresh)
    if (clientV2Token) {
        FFB_API_V2.token = clientV2Token;
        console.log("[FFB API] Using client-provided V2 token");
    } else {
        // Otherwise, load from SSM (only once per Lambda lifetime)
        await loadV2Token();
    }
    
    const config = getFFBApiConfig(endpoint);
    const version = config === FFB_API_V2 ? "v2" : "v1";
        const mappedEndpoint = mapEndpointForVersion(endpoint, version);
        const baseUrl = config.baseUrl.endsWith("/") ? config.baseUrl : `${config.baseUrl}/`;
        const url = baseUrl + mappedEndpoint;
        const method = options?.method || "GET";

        if (isProxyDebugEnabled()) {
                const tokenSource = version === "v2"
                    ? (process.env.FFB_API_V2_TOKEN ? "env:FFB_API_V2_TOKEN" : "missing:FFB_API_V2_TOKEN")
                    : (process.env.FFB_API_V1_TOKEN ? "env:FFB_API_V1_TOKEN" : "fallback:hardcoded");
                const hasBearer = config.token.toLowerCase().startsWith("bearer ");
                console.log(`[FFB API][REQ] version=${version} method=${method} endpoint=${endpoint} upstream=${url}`);
                console.log(`[FFB API][AUTH] version=${version} source=${tokenSource} hasBearer=${hasBearer} tokenLength=${config.token.length}`);
        }
  
  try {
        console.log(`[FFB API] ${version.toUpperCase()} ${method} ${endpoint}`);
        const tokenPreview = config.token.substring(0, 30) + "..." + config.token.substring(config.token.length - 10);
        console.log(`[FFB API] 🔑 Using token: ${tokenPreview} (length=${config.token.length})`);
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: config.token,
      },
    });

        if (isProxyDebugEnabled()) {
                console.log(`[FFB API][RES] version=${version} status=${response.status} ok=${response.ok} endpoint=${endpoint}`);
        }

        const rawBody = await response.text();
        let data: any = null;
        try {
            data = rawBody ? JSON.parse(rawBody) : null;
        } catch {
            data = {
                error: "Non-JSON upstream response",
                upstreamStatus: response.status,
                body: rawBody,
            };
        }

        if (!response.ok) {
            const sample = rawBody.length > 500 ? `${rawBody.slice(0, 500)}...` : rawBody;
            console.error(`[FFB API][ERR] Upstream non-OK status=${response.status} endpoint=${endpoint} body=${sample}`);

            // Return upstream error payload for clearer client-side diagnosis instead of opaque 500.
            if (data && typeof data === "object") {
                data.upstreamStatus = response.status;
                data.upstreamOk = false;
                data.endpoint = endpoint;
            }
            return data;
        }

        if (isProxyDebugEnabled() && data && typeof data === "object" && "error" in (data as any)) {
                console.warn(`[FFB API][RES] upstream payload contains error for endpoint=${endpoint}: ${(data as any).error}`);
        }

        // Handler acts as a transport proxy. Domain adaptation lives in frontend adapters.
        return config.responseTransformer ? config.responseTransformer(data) : data;
  } catch (error) {
    console.error(`[FFB API] Error fetching ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Internal semantic routes used by the front application.
 * Keep legacy aliases to avoid breaking existing clients.
 */
const INTERNAL_ROUTE_ALIASES: Record<string, string> = {
    "ffb/members/by-person-id": "members",
    "ffb/members/search": "subscription-search-members",
    "ffb/competitions/seasons": "seasons",
    "ffb/competitions/organizations": "organizations/all",
    "ffb/competitions/final-ranking": "competitions/final-ranking",
    "ffb/competitions/phases": "competitions/stades",
    "ffb/tournaments/club": "organizations/1438/club_tournament",
    "ffb/tournaments/club-members": "organizations/1438/members",
    "ffb/tournaments/team": "organizations/1438/tournament",
};

function normalizeInternalPath(path: string): string {
    return INTERNAL_ROUTE_ALIASES[path] ?? path;
}

function extractCompetitionOrganizationPath(path: string): string | null {
    const legacyMatch = path.match(/^competitions\/organizations\/(\d+)$/);
    if (legacyMatch) {
        return `competitions/organizations/${legacyMatch[1]}`;
    }

    const semanticMatch = path.match(/^ffb\/competitions\/by-organization\/(\d+)$/);
    if (semanticMatch) {
        return `competitions/organizations/${semanticMatch[1]}`;
    }

    return null;
}

export const handler: Handler = async (event) => {
    try {
        // Extract client-provided token for V2 API (always fresh, no SSM needed)
        // Try x-ffb-token first (custom header, not intercepted by AWS SigV4)
        // Then fallback to authorization (may be replaced by SigV4 signature)
        console.log("[FFB API] Available headers:", Object.keys(event.headers || {}));
        const xFfbToken = event.headers?.["x-ffb-token"];
        const authHeader = event.headers?.authorization;
        console.log("[FFB API] x-ffb-token:", xFfbToken ? "present" : "missing");
        console.log("[FFB API] authorization:", authHeader ? "present (may be SigV4)" : "missing");
        
        const clientAuthHeader = xFfbToken || authHeader;
        const clientV2Token = clientAuthHeader ? asBearerToken(clientAuthHeader) : undefined;
        if (clientV2Token) {
            const preview = clientV2Token.substring(0, 30) + "..." + clientV2Token.substring(clientV2Token.length - 10);
            console.log("[FFB API] ✅ Client token extracted:", preview);
        } else {
            console.log("[FFB API] ⚠️ No client token found in headers");
        }

        let path = normalizeInternalPath(event.pathParameters?.proxy || "");
        // Handle dynamic competitions/organizations/{organization_id}
        const dynamicCompetitionPath = extractCompetitionOrganizationPath(path);
        if (dynamicCompetitionPath) {
            const organization_id = dynamicCompetitionPath.split("/")[2];
            // Support ?search=... and/or ?season_id=...
            const params = [];
            if (event.queryStringParameters?.search) {
                params.push("search=" + encodeURIComponent(event.queryStringParameters.search));
            }
            if (event.queryStringParameters?.season_id) {
                params.push("season_id=" + encodeURIComponent(event.queryStringParameters.season_id));
            }
            const endpoint = `competitions/organizations/${organization_id}` + (params.length > 0 ? "?" + params.join("&") : "");
            try {
                const res = await fetchFFBApi(endpoint);
                return res;
            } catch (e) {
                return {
                    'statusCode': 500,
                    'body': 'remote server error :' + e
                };
            }
        }
        switch (path) {
            case "members":
                // recuperer le parametre person_id
                if (event.queryStringParameters?.person_id) {
                    const person_id = event.queryStringParameters.person_id;
                    try {
                        const res = await fetchFFBApi(`members/${person_id}`);
                        return res;
                    } catch (e) {
                        return {
                            'statusCode': 500,
                            'body': 'remote server error :' + e
                        };
                    }
                }
                return {
                    'statusCode': 400,
                    'body': 'proxy error : missing person_id'
                };



            case "search-members":
                // traitement search-members&search=...
                if (event.queryStringParameters?.search) {
                    try {
                        const res = await fetchFFBApi(
                            `search-members?search=${encodeURIComponent(event.queryStringParameters.search)}`
                        );
                        return res;
                    } catch (e) {
                        return {
                            'statusCode': 500,
                            'body': 'remote server error :' + e
                        };
                    }
                }
                return {
                    'statusCode': 400,
                    'body': 'proxy error : invalid path'
                }

            case "subscription-search-members":
                if (event.queryStringParameters?.search) {
                    try {
                        const res = await fetchFFBApi(
                            `subscription-search-members?search=${encodeURIComponent(event.queryStringParameters.search)}&alive=1&bbo=false`
                        );
                        return res;
                    } catch (e) {
                        return {
                            'statusCode': 500,
                            'body': 'remote server error :' + e
                        };
                    }
                }
                return {
                    'statusCode': 400,
                    'body': 'proxy error : invalid path'
                };
            // ----------------------------------------API Competitions 

            case "seasons":
                try {
                    const res = await fetchFFBApi("seasons");
                    return res;
                } catch (e) {
                    return {
                        'statusCode': 500,
                        'body': 'remote server error :' + e
                    };
                }



            case "organizations/all":
                try {
                    const res = await fetchFFBApi("organizations/all");
                    return res;
                } catch (e) {
                    return {
                        'statusCode': 500,
                        'body': 'remote server error :' + e
                    };
                }


            case "competitions/final-ranking":
                // attend queryStringParameters.competition_id et .organization_id
                if (event.queryStringParameters?.competition_id && event.queryStringParameters?.organization_id) {
                    const competition_id = event.queryStringParameters.competition_id;
                    const organization_id = event.queryStringParameters.organization_id;
                    const endpoint = `competitions/${competition_id}/organizations/${organization_id}/final-ranking`;
                    try {
                        const res = await fetchFFBApi(endpoint);
                        return res;
                    } catch (e) {
                        return {
                            'statusCode': 500,
                            'body': 'remote server error :' + e
                        };
                    }
                }
                return {
                    'statusCode': 400,
                    'body': 'proxy error : missing competition_id '
                };
            case "competitions/stades":
                // attend queryStringParameters.competition_id et .organization_id
                if (event.queryStringParameters?.competition_id && event.queryStringParameters?.organization_id) {
                    const competition_id = event.queryStringParameters.competition_id;
                    const organization_id = event.queryStringParameters.organization_id;
                    const endpoint = `competitions/${competition_id}/organizations/${organization_id}/stades`;
                    try {
                        const res = await fetchFFBApi(endpoint);
                        return res;
                    } catch (e) {
                        return {
                            'statusCode': 500,
                            'body': 'remote server error :' + e
                        };
                    }
                }
                // Fallback: use organization_id=1 if only competition_id provided
                if (event.queryStringParameters?.competition_id) {
                    const competition_id = event.queryStringParameters.competition_id;
                    const endpoint = `competitions/${competition_id}/organizations/1/stades`;
                    try {
                        const res = await fetchFFBApi(endpoint);
                        return res;
                    } catch (e) {
                        return {
                            'statusCode': 500,
                            'body': 'remote server error :' + e
                        };
                    }
                }
                return {
                    'statusCode': 400,
                    'body': 'proxy error : missing competition_id '
                };


            // ----------------------------------------API Tournament management for club 1438
            case "organizations/1438/members":
                try {
                    // Extract seasonId from query params
                    const seasonId = event.queryStringParameters?.seasonId;
                    const endpoint = seasonId 
                        ? `${path}?seasonId=${encodeURIComponent(seasonId)}`
                        : path;
                    const res = await fetchFFBApi(endpoint, undefined, clientV2Token);
                    return res;
                } catch (e) {
                    return {
                        'statusCode': 500,
                        'body': 'remote server error :' + e
                    };
                }
                
           case "organizations/1438/club_tournament":
                try {
                    const res = await fetchFFBApi(path, undefined, clientV2Token);
                    return res;
                } catch (e) {
                    return {
                        'statusCode': 500,
                        'body': 'remote server error :' + e
                    };
                }

            case "organizations/1438/tournament":

                let method = event.requestContext?.http.method || "GET";

                if (method === "GET" && event.queryStringParameters?.id) {
                    try {
                        const res = await fetchFFBApi(`${path}/${event.queryStringParameters.id}`, {
                            method: "GET",
                        });
                        return res;
                    } catch (e) {
                        return {
                            'statusCode': 500,
                            'body': 'remote server error :' + e
                        };
                    }
                }

                if (method === "DELETE" && event.queryStringParameters?.id && event.queryStringParameters?.team_id) {
                    try {
                        const res = await fetchFFBApi(
                            `${path}/${event.queryStringParameters.id}/subscription/${event.queryStringParameters.team_id}`,
                            {
                                method: "DELETE",
                            }
                        );
                        return res;
                    } catch (e) {
                        return {
                            'statusCode': 500,
                            'body': 'remote server error :' + e
                        };
                    }
                }

                if (method === "POST" && event.queryStringParameters?.id && event.body !== null) {
                    try {
                        const res = await fetchFFBApi(
                            `${path}/${event.queryStringParameters.id}/subscription`,
                            {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: event.body || "{}",
                            }
                        );
                        return res;
                    } catch (e) {
                        return {
                            'statusCode': 500,
                            'body': 'remote server error :' + e
                        };
                    }
                }


                return {
                    'statusCode': 400,
                    'body': 'proxy error : invalid path'
                };



            default:
                return {
                    'statusCode': 400,
                    'body': 'proxy error : invalid path'
                };
        }

    }
    catch (e) {
        return {
            'statusCode': 400,
            'body': 'proxy error' + e
        };
    }
};
