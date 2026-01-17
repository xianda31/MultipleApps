import { Handler } from "aws-lambda";
// const url = "https://jsonplaceholder.typicode.com/users";
const ffbUrl = "https://api.ffbridge.fr/api/v1/";
const token = "Bearer eyJhbGciOiJSUzI1NiJ9.eyJyb2xlcyI6WyJST0xFX1dPUktBUkVBX1VTRVIiLCJST0xFX1VTRVIiXSwidXNlcm5hbWUiOiIyNDM5NzUyIiwicGluIjoiMDAwMCIsIm1lZGlhIjoxLCJkZWZhdWx0X2xhbmRpbmdwYWdlIjoibGljZW5zZWUiLCJlbWFpbCI6ImNocnJlbm91eEB5YWhvby5mciIsInBob25lIjoiMDc0OTE5NDAxOCIsInRva2VuX3NlY3VyaXplciI6bnVsbCwic2lnbl9pbl9zZWNvbmRfZmFjdG9yIjpmYWxzZSwiaXNfYWRtaW5fdXNlciI6ZmFsc2UsImlzX3ZhbGlkX2xpY2Vuc2UiOnRydWUsImlhdCI6MTY3NjgxOTQxNiwiZXhwIjozMTU1Mjc2ODE5NDE2LCJpc19mcm9tX2V4dGVybmFsX2FwaSI6ZmFsc2UsImd0bWNsaWVudGlkIjoiMCJ9.APMJKiStZDgkLTESRvJpS6cz67ZLLZXaHLMZoyqbEDTG7hs2NnI8HZZ6Kl8eZxjMt-TOZgYfiHnaX93zXUXFQ0b3BikSlbTJOl9bSZ56cnlGrKVeW39faW-JoUiXYHsg2UIwaiZfCCbDzKJhM4Bs2L3r0tlOV3ONxgNmbeRXEkafY7-VSTiq7NDU4HEPUNMjCNLU16a8H4N92WGykTntfgS81IJGswmtH3FkfKjvoncV_4Ph32Ik8JezqhO_SDKXFu4jnFHOr98W61KKrvgZsUb7ZjSnCS8WPHv60yor8xMJmV-Bl9YbydG0BRnn-NNvZvNPQkP047CGaLCqLQHNl0qmh3Hf6n4E5BGZ3yivtXtVqhGM3uITOiajoy8hBcku0s4fFnYf1pIExrA8NF9T5NVcaJMutNBPMop82IUThgiVFS1wAGhnubQCT3Qz9kvpB1hCRRtJHRBVxDU9wBodKX6QdjfbKA8InW-AiM2hlhNG-fuMU5nQGj-CGzPrriTST4UVKEST6sSFEBIdOiygYPgVwIXS1BCZz3NzBm36H7spu4TUf1nQj9F4QS7P8AoglakIuTcpxx2RzrJgEY5CVlwdTwuHfPw1x5Xqdd11-cABpV7X3aMKYaf4WM84WNUVuvyl4LtiNMO3zUaSk-mSqSTn2HsGbr9IR3S4WKF89EE";

export const handler: Handler = async (event) => {
    try {
        let path = event.pathParameters?.proxy || "";
        switch (path) {
            case "members":
                path = "members/207656";
                break;
            case "search-members":
                // traitement search-members&search=...
                if (event.queryStringParameters?.search) {
                    try {
                        const res = await fetch(
                            ffbUrl + path + "?search=" + event.queryStringParameters.search,
                            { headers: { Authorization: token }, },
                        );
                        return res.json();
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
                        const res = await fetch(
                            ffbUrl + path +
                            "?search=" + event.queryStringParameters.search
                            + "&alive=1&bbo=false",
                            { headers: { Authorization: token }, },
                        );
                        return res.json();
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
                    const res = await fetch(
                        ffbUrl + path,
                        { headers: { Authorization: token }, },
                    );
                    return res.json();
                } catch (e) {
                    return {
                        'statusCode': 500,
                        'body': 'remote server error :' + e
                    };
                }



            case "organizations/all":
                try {
                    const res = await fetch(
                        ffbUrl + path,
                        { headers: { Authorization: token }, },
                    );
                    return res.json();
                } catch (e) {
                    return {
                        'statusCode': 500,
                        'body': 'remote server error :' + e
                    };
                }

            case "competitions/organizations/1":
                // Supporte ?search=... et/ou ?season_id=...
                const params = [];
                if (event.queryStringParameters?.search) {
                    params.push("search=" + encodeURIComponent(event.queryStringParameters.search));
                }
                if (event.queryStringParameters?.season_id) {
                    params.push("season_id=" + encodeURIComponent(event.queryStringParameters.season_id));
                }
                const url = params.length > 0 ? ffbUrl + path + "?" + params.join("&") : ffbUrl + path;
                try {
                    const res = await fetch(
                        url,
                        { headers: { Authorization: token }, },
                    );
                    return res.json();
                } catch (e) {
                    return {
                        'statusCode': 500,
                        'body': 'remote server error :' + e
                    };
                }

                case "competitions/final-ranking":
                    // attend queryStringParameters.competition_id et .season_id
                    if (event.queryStringParameters?.competition_id ) {
                        const competition_id = event.queryStringParameters.competition_id;
                        const finalRankingPath = `competitions/${competition_id}/organizations/1/final-ranking`;
                        try {
                            const res = await fetch(
                                ffbUrl + finalRankingPath,
                                { headers: { Authorization: token }, },
                            );
                            return res.json();
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
                    // attend queryStringParameters.competition_id et .season_id
                    if (event.queryStringParameters?.competition_id ) {
                        const competition_id = event.queryStringParameters.competition_id;
                        const finalRankingPath = `competitions/${competition_id}/organizations/1/stades`;
                        try {
                            const res = await fetch(
                                ffbUrl + finalRankingPath,
                                { headers: { Authorization: token }, },
                            );
                            return res.json();
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
            case "organizations/1438/club_tournament":
            case "organizations/1438/members":
                try {
                    const res = await fetch(
                        ffbUrl + path,
                        { headers: { Authorization: token }, },
                    );
                    return res.json();
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
                        const res = await fetch(
                            ffbUrl + path + "/" + event.queryStringParameters.id,
                            {
                                method: "GET",
                                headers: { Authorization: token },
                            },
                        );
                        return res.json();
                    } catch (e) {
                        return {
                            'statusCode': 500,
                            'body': 'remote server error :' + e
                        };
                    }
                }

                if (method === "DELETE" && event.queryStringParameters?.id && event.queryStringParameters?.team_id) {
                    try {
                        const res = await fetch(
                            ffbUrl + path
                            + "/" + event.queryStringParameters.id
                            + "/subscription" + "/" + event.queryStringParameters.team_id,
                            {
                                method: "DELETE",
                                headers: { Authorization: token },
                            },
                        );
                        return res.json();
                    } catch (e) {
                        return {
                            'statusCode': 500,
                            'body': 'remote server error :' + e
                        };
                    }
                }



                if (method === "POST"
                    && event.queryStringParameters?.id
                    && event.body !== null) {
                    try {
                        const res = await fetch(
                            ffbUrl + path + "/" + event.queryStringParameters.id + "/subscription",
                            {
                                method: "POST",
                                headers: { Authorization: token, "Content-Type": "application/json" },
                                body: event.body || "{}",
                            }
                        );
                        return res.json();
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
