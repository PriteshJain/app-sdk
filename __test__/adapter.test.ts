import { dispatchAdapter, dispatchApiRequest } from "../src/utils/adapter"; // Corrected path
import { fetchToAxiosConfig, axiosToFetchResponse } from "../src/utils/utils"; // Corrected path
import postRobot from "post-robot";
import { AxiosRequestConfig, AxiosResponse, AxiosError, InternalAxiosRequestConfig, AxiosHeaders } from "axios"; 

// Mock post-robot
jest.mock("post-robot");

// Mock utils.ts for fetchToAxiosConfig and axiosToFetchResponse
jest.mock("../src/utils/utils", () => ({ 
    ...jest.requireActual("../src/utils/utils"), 
    fetchToAxiosConfig: jest.fn(),
    axiosToFetchResponse: jest.fn(),
}));

// Basic mock for global Response object if not provided by test environment (e.g., Jest default Node env)
// This block should be outside jest.mock for utils
if (typeof global.Response === 'undefined') {
    // @ts-ignore
    global.Response = class ResponseMock { // Renamed to avoid conflict if Response is ever imported
        public status: number;
        public statusText: string;
        public headers: any; // Simplified for mock
        private _body: any;

        constructor(body?: any, init?: ResponseInit) {
            this._body = body;
            this.status = init?.status ?? 200;
            this.statusText = init?.statusText ?? "OK";
            this.headers = new (global as any).HeadersMock(init?.headers); 
        }
        json() { return Promise.resolve(this._body ? JSON.parse(this._body) : {}); } // Handle empty body for JSON
        text() { return Promise.resolve(String(this._body)); } // Handle various body types for text
    };
    // @ts-ignore
    global.HeadersMock = class HeadersMock { // Renamed to avoid conflict
        private _headers: Record<string, string> = {};
        constructor(init?: HeadersInit) {
            if (init) {
                if (Array.isArray(init)) {
                    init.forEach(([key, value]) => this._headers[key.toLowerCase()] = value);
                } else if (init instanceof (global as any).HeadersMock) {
                    // If it's already a HeadersMock instance, copy its internal headers
                    Object.assign(this._headers, (init as any)._headers);
                }
                 else if (typeof init === 'object') {
                    for (const key in init) {
                         if (Object.prototype.hasOwnProperty.call(init, key)) {
                            this._headers[key.toLowerCase()] = (init as Record<string,string>)[key];
                        }
                    }
                }
            }
        }
        get(name: string) { return this._headers[name.toLowerCase()] || null; }
        forEach(callback: (value: string, key: string, parent: any) => void) {
            for (const key in this._headers) {
                callback(this._headers[key], key, this);
            }
        }
    };
}

// Type assertion for the mocked functions
const mockPostRobotSendToParent = postRobot.sendToParent as jest.Mock;
const mockFetchToAxiosConfig = fetchToAxiosConfig as jest.Mock;
const mockAxiosToFetchResponse = axiosToFetchResponse as jest.Mock;

describe("dispatchAdapter", () => {
    beforeEach(() => {
        mockPostRobotSendToParent.mockReset();
    });

    // Added headers to mockAxiosConfig
    const mockAxiosConfig: AxiosRequestConfig = { url: "/test", method: "GET", headers: {} };

    it("should call postRobot.sendToParent with 'apiAdapter' and config, and resolve on success", async () => {
        const mockApiResponse: Partial<AxiosResponse> = { 
            status: 200, 
            data: { success: true }, 
            headers: { "content-type": "application/json" }, 
            statusText: "OK",
        };
        mockPostRobotSendToParent.mockResolvedValueOnce({ data: mockApiResponse });

        const result = await dispatchAdapter(postRobot)(mockAxiosConfig);

        expect(mockPostRobotSendToParent).toHaveBeenCalledTimes(1);
        expect(mockPostRobotSendToParent).toHaveBeenCalledWith("apiAdapter", mockAxiosConfig);
        expect(result).toEqual(expect.objectContaining({
            status: mockApiResponse.status,
            data: mockApiResponse.data,
            headers: mockApiResponse.headers,
            statusText: mockApiResponse.statusText,
            // Cast config to InternalAxiosRequestConfig for matching
            config: mockAxiosConfig as InternalAxiosRequestConfig, 
        }));
    });

    it("should reject with response data if status is >= 400", async () => {
        const mockErrorResponse: Partial<AxiosResponse> = {
            status: 404,
            data: { error: "Not Found" },
            headers: { "content-type": "application/json" },
            statusText: "Not Found",
        };
        mockPostRobotSendToParent.mockResolvedValueOnce({ data: mockErrorResponse });

        try {
            await dispatchAdapter(postRobot)(mockAxiosConfig);
        } catch (error: any) {
            expect(mockPostRobotSendToParent).toHaveBeenCalledWith("apiAdapter", mockAxiosConfig);
            // Corrected: dispatchAdapter throws the response directly, not an AxiosError here
            expect(error.status).toBe(mockErrorResponse.status);
            expect(error.data).toEqual(mockErrorResponse.data);
            expect(error.headers).toEqual(mockErrorResponse.headers);
            expect(error.statusText).toBe(mockErrorResponse.statusText);
            expect(error.config).toEqual(mockAxiosConfig as InternalAxiosRequestConfig);
        }
    });

    it("should reject with a generic AxiosError if sendToParent fails", async () => {
        const postRobotFailureError = new Error("PostRobot failed");
        mockPostRobotSendToParent.mockRejectedValueOnce(postRobotFailureError);

        try {
            await dispatchAdapter(postRobot)(mockAxiosConfig);
        } catch (error: any) {
            expect(mockPostRobotSendToParent).toHaveBeenCalledWith("apiAdapter", mockAxiosConfig);
            expect(error.isAxiosError).toBe(true);
            // Corrected: Expecting the message as observed from AxiosError behavior
            expect(error.message).toBe("Something went wrong with the request"); 
            expect(error.config).toEqual(mockAxiosConfig as InternalAxiosRequestConfig); 
            expect(error.response).toBeUndefined();
        }
    });
});

describe("dispatchApiRequest", () => {
    beforeEach(() => {
        mockFetchToAxiosConfig.mockReset();
        mockAxiosToFetchResponse.mockReset();
        mockPostRobotSendToParent.mockReset(); // dispatchApiRequest uses dispatchAdapter which uses postRobot
    });

    it("should correctly convert fetch args, call dispatchAdapter, and convert response back", async () => {
        const mockUrl = "/test-url";
        const mockFetchOptions: RequestInit = { method: "POST", body: JSON.stringify({ data: "payload" }) };
        
        // Ensure generatedAxiosConfig also has headers
        const generatedAxiosConfig: AxiosRequestConfig = { url: mockUrl, method: "POST", data: { data: "payload" }, headers: {} };
        mockFetchToAxiosConfig.mockReturnValue(generatedAxiosConfig);

        const mockAdapterResponse: AxiosResponse = {
            data: { result: "success" },
            status: 201,
            statusText: "Created",
            headers: { "x-test-header": "value" },
            config: generatedAxiosConfig as InternalAxiosRequestConfig, // Cast here
        };
        mockPostRobotSendToParent.mockResolvedValueOnce({ data: mockAdapterResponse }); // Simulate successful dispatchAdapter call

        const mockFinalResponse = new Response(JSON.stringify({ result: "success" }), {
            status: 201,
            statusText: "Created",
            headers: { "x-test-header": "value" },
        });
        mockAxiosToFetchResponse.mockReturnValue(mockFinalResponse);

        const response = await dispatchApiRequest(mockUrl, mockFetchOptions);

        expect(mockFetchToAxiosConfig).toHaveBeenCalledTimes(1);
        expect(mockFetchToAxiosConfig).toHaveBeenCalledWith(mockUrl, mockFetchOptions);
        
        expect(mockPostRobotSendToParent).toHaveBeenCalledTimes(1); // dispatchAdapter was called
        expect(mockPostRobotSendToParent).toHaveBeenCalledWith("apiAdapter", generatedAxiosConfig);
        
        expect(mockAxiosToFetchResponse).toHaveBeenCalledTimes(1);
        // The config in mockAdapterResponse will have the generatedAxiosConfig.
        // dispatchAdapter adds the original config to the response it resolves with.
        const expectedAdapterResponseWithConfig = { ...mockAdapterResponse, config: generatedAxiosConfig as InternalAxiosRequestConfig };
        expect(mockAxiosToFetchResponse).toHaveBeenCalledWith(expectedAdapterResponseWithConfig);
        
        expect(response).toBe(mockFinalResponse);
    });

    it("should handle error from dispatchAdapter (with err.response) and return a Response", async () => {
        const mockUrl = "/error-url";
        // Ensure generatedAxiosConfig also has headers, including the one we want to check
        const generatedAxiosConfig: AxiosRequestConfig = { url: mockUrl, method: "GET", headers: { "x-error": "true" } };
        mockFetchToAxiosConfig.mockReturnValue(generatedAxiosConfig);

        const errorData = { message: "Bad Request" };
        const errorStatusText = "Bad Request";
        const errorHeaders = { "x-error": "true" };
        const errorStatus = 400;

        // This is the object dispatchAdapter will throw in this scenario
        const thrownErrorObject = {
            status: errorStatus,
            data: errorData,
            statusText: errorStatusText,
            headers: errorHeaders,
            config: generatedAxiosConfig as InternalAxiosRequestConfig,
            stack: "mock stack for plain object error" // For the new Response(err.stack,...)
        };
        
        // Simulate dispatchAdapter rejecting due to a >=400 status from postRobot by resolving with the error-like structure
        mockPostRobotSendToParent.mockResolvedValueOnce({ data: thrownErrorObject });
        
        const response = await dispatchApiRequest(mockUrl);

        expect(mockFetchToAxiosConfig).toHaveBeenCalledWith(mockUrl, undefined);
        expect(mockPostRobotSendToParent).toHaveBeenCalledWith("apiAdapter", generatedAxiosConfig);
        expect(mockAxiosToFetchResponse).not.toHaveBeenCalled(); // Not called in error path
        
        // Assertions based on the 'else' block in dispatchApiRequest's catch, as thrownErrorObject has no 'response' property
        expect(response.status).toBe(errorStatus); 
        // err.message is undefined for thrownErrorObject, so it defaults to "Internal Server Error"
        expect(response.statusText).toBe("Internal Server Error"); 
        const responseText = await response.text();
        expect(responseText).toBe(thrownErrorObject.stack); // Body is err.stack
        // Headers are taken from err.config.headers in this path
        expect(response.headers.get('x-error')).toBe('true'); 
    });

    it("should handle other errors from dispatchAdapter and return a generic error Response", async () => {
        const mockUrl = "/network-error-url";
        const generatedAxiosConfig: AxiosRequestConfig = { url: mockUrl, method: "GET", headers: { "Custom-Header": "test" } };
        mockFetchToAxiosConfig.mockReturnValue(generatedAxiosConfig);

        // This is the error that postRobot.sendToParent().catch() receives
        const originalPostRobotError = new Error("Original postRobot failure"); 
        mockPostRobotSendToParent.mockRejectedValueOnce(originalPostRobotError);
        
        // This is the AxiosError that dispatchAdapter constructs and throws
        const expectedAxiosErrorThrownByDispatchAdapter = new AxiosError(
            "Something went wrong with the request", // Actual message used by dispatchAdapter
            "ERR_INTERNAL_SERVER", // Error code used by dispatchAdapter
            generatedAxiosConfig as InternalAxiosRequestConfig,
            null,      
            undefined  
        );
        // We need its stack for assertion
        expectedAxiosErrorThrownByDispatchAdapter.stack = "mock stack for AxiosError";


        const response = await dispatchApiRequest(mockUrl);

        expect(mockFetchToAxiosConfig).toHaveBeenCalledWith(mockUrl, undefined);
        expect(mockPostRobotSendToParent).toHaveBeenCalledWith("apiAdapter", generatedAxiosConfig);
        expect(mockAxiosToFetchResponse).not.toHaveBeenCalled();
        
        // Assertions based on the 'else' block in dispatchApiRequest's catch, as the AxiosError has no 'response' property
        // err.status is undefined for this AxiosError, so defaults to 500
        expect(response.status).toBe(500); 
        // err.message is "Something went wrong with the request"
        expect(response.statusText).toBe("Something went wrong with the request"); 
        
        const responseText = await response.text();
         // The body is err.stack. We check if it contains the message part.
        expect(responseText).toContain("Something went wrong with the request");
        // More specific check if we mock the stack:
        // To make this deterministic, we'd have to mock the stack property of the error thrown by dispatchAdapter.
        // For now, checking containment of the message is reasonable.
        // If we were to mock the stack:
        // const errThrownByAdapter = new AxiosError(...); errThrownByAdapter.stack = "mock stack for test";
        // mockPostRobotSendToParent.mockImplementation(() => Promise.reject(errThrownByAdapter));
        // Then: expect(responseText).toBe("mock stack for test");
        
        expect(response.headers.get("Custom-Header")).toBe("test"); // Headers from err.config.headers
    });
});
