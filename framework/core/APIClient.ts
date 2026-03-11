import { APIRequestContext, APIResponse } from '@playwright/test';

export class APIClient {
    private request: APIRequestContext;
    private baseURL: string;

    constructor(request: APIRequestContext, baseURL: string = '') {
        this.request = request;
        this.baseURL = baseURL.replace(/\/$/, '');
    }

    async get(endpoint: string, options?: any): Promise<APIResponse> {
        return this.request.get(`${this.baseURL}/${endpoint.replace(/^\//, '')}`, options);
    }

    async post(endpoint: string, options?: any): Promise<APIResponse> {
        return this.request.post(`${this.baseURL}/${endpoint.replace(/^\//, '')}`, options);
    }
}
