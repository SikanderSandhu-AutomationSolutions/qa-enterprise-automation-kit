import { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * A wrapper around Playwright's APIRequestContext to simplify API interactions.
 * Provides generic methods for common HTTP verbs and can be extended for specific API services.
 */
export class APIClient {
    private request: APIRequestContext;
    private baseURL: string;

    /**
     * Creates an instance of APIClient.
     * 
     * @param request - Playwright's APIRequestContext instance.
     * @param baseURL - The base URL for the API (optional, defaults to empty string).
     */
    constructor(request: APIRequestContext, baseURL: string = '') {
        this.request = request;
        // Ensure baseURL doesn't have a trailing slash for consistent concatenation
        this.baseURL = baseURL.replace(/\/$/, '');
    }

    /**
     * Authenticates with the application's API.
     * Use this method to establish a session or retrieve a token before making authenticated requests.
     * Note: The current implementation sends form data to 'api/method/login'. 
     * You may need to adapt or override this mechanism depending on the target application's auth scheme.
     * 
     * @param usr - The username or identifier of the user to authenticate as.
     * @param pwd - The password or secret for the user.
     * @returns A promise that resolves to the APIResponse from the login request.
     * @throws If the login request fails (e.g., incorrect credentials).
     */
    async login(usr: string, pwd: string): Promise<APIResponse> {
        const response = await this.post('api/method/login', {
            form: {
                usr: usr,
                pwd: pwd
            }
        });
        
        if (!response.ok()) {
            throw new Error(`Login failed: ${response.status()} ${response.statusText()}`);
        }
        
        return response;
    }

    /**
     * Performs a GET request.
     * 
     * @param endpoint - The API endpoint to send the request to (e.g., '/api/users' or 'data/records').
     * @param options - Optional configuration for the request (headers, params, etc.).
     * @returns A promise that resolves to the Playwright APIResponse object.
     */
    async get(endpoint: string, options?: any): Promise<APIResponse> {
        const url = this.baseURL ? `${this.baseURL}/${endpoint.replace(/^\//, '')}` : endpoint;
        return this.request.get(url, options);
    }

    /**
     * Performs a POST request.
     * 
     * @param endpoint - The API endpoint to send the request to.
     * @param options - Optional configuration for the request containing data, headers, etc.
     * @returns A promise that resolves to the Playwright APIResponse object.
     */
    async post(endpoint: string, options?: any): Promise<APIResponse> {
        const url = this.baseURL ? `${this.baseURL}/${endpoint.replace(/^\//, '')}` : endpoint;
        return this.request.post(url, options);
    }
}
