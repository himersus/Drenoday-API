import axios from "axios"

export const getAppyPayToken = async () => {
    try {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', process.env.PG_API_CLIENT_ID!);
        params.append('client_secret', process.env.PG_API_SECRET!);
        params.append('resource', process.env.PG_RESOURCE_ID!);

        const response = await axios.post(
            `https://login.microsoftonline.com/auth.appypay.co.ao/oauth2/token`,
            params,
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            }
        );

        const data = response.data

        return {
            token: data.access_token
        }

    } catch (error: any) {
        return {
            token: ""
        }
    }
};