import Window from "../src/window";
import { LocationType, DashboardWidth } from "../src/types";
import EventEmitter from "wolfy87-eventemitter";
import postRobot from "post-robot"; // This will be the mock from jest.mock

// Global MutationObserver Mocking
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();
const mockMutationObserver = jest.fn(() => ({
    observe: mockObserve,
    disconnect: mockDisconnect,
}));
// @ts-ignore
global.MutationObserver = mockMutationObserver;

jest.mock("post-robot"); // Mock postRobot at the top

describe("Window", () => {
    let windowInstance: Window; // General instance for tests that don't need specific constructor states
    const mockSendToParent = postRobot.sendToParent as jest.Mock;
    let mockConnection: { sendToParent: jest.Mock };
    let mockEmitter: EventEmitter;

    // Helper for getBoundingClientRect
    const mockBoundingClientRect = (height: number, width: number) => {
        // @ts-ignore
        global.document.documentElement.getBoundingClientRect = jest.fn(() => ({
            height,
            width,
            top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0, toJSON: () => {}
        }));
    };

    beforeEach(() => {
        mockObserve.mockClear();
        mockDisconnect.mockClear();
        (global.MutationObserver as jest.Mock).mockClear(); 
        
        mockSendToParent.mockClear();
        mockSendToParent.mockResolvedValue(undefined); 
        mockConnection = { sendToParent: mockSendToParent };

        const actualEmitter = new EventEmitter();
        mockEmitter = {
            ...actualEmitter, 
            on: jest.fn(actualEmitter.on.bind(actualEmitter)),
            emitEvent: jest.fn(actualEmitter.emitEvent.bind(actualEmitter)), 
            emit: jest.fn(actualEmitter.emit.bind(actualEmitter)), 
        } as any; 
    });

    afterEach(() => {
        // @ts-ignore
        if (global.document.documentElement.getBoundingClientRect && 
            typeof (global.document.documentElement.getBoundingClientRect as jest.Mock).mockClear === 'function') {
            // @ts-ignore
            (global.document.documentElement.getBoundingClientRect as jest.Mock).mockClear();
        }
    });

    describe("Constructor", () => {
        it("should initialize properties correctly for DASHBOARD type", () => {
            const dashboardInitialState = DashboardWidth.FULL_WIDTH;
            // Use localWindowInstance to avoid state leakage from other tests
            const localWindowInstance = new Window(mockConnection as any, LocationType.DASHBOARD, mockEmitter, dashboardInitialState);
            expect(localWindowInstance.type).toBe(LocationType.DASHBOARD);
            expect(localWindowInstance.state).toBe(dashboardInitialState);
            expect((localWindowInstance as any)._connection).toBe(mockConnection);
            expect((localWindowInstance as any)._emitter).toBe(mockEmitter);
        });

        it("should initialize properties correctly for FIELD type", () => {
            // Use localWindowInstance and pass undefined for state
            const localWindowInstance = new Window(mockConnection as any, LocationType.FIELD, mockEmitter, undefined);
            expect(localWindowInstance.type).toBe(LocationType.FIELD);
            expect(localWindowInstance.state).toBeUndefined(); 
            expect((localWindowInstance as any)._connection).toBe(mockConnection);
            expect((localWindowInstance as any)._emitter).toBe(mockEmitter);
        });
    });

    describe("enableResizing()", () => {
        it("should send 'enableResizing' action if type is DASHBOARD", async () => {
            windowInstance = new Window(mockConnection as any, LocationType.DASHBOARD, mockEmitter, DashboardWidth.FULL_WIDTH);
            await windowInstance.enableResizing();
            expect(mockSendToParent).toHaveBeenCalledWith("window", { action: "enableResizing" });
            expect((windowInstance as any)._resizingEnabled).toBe(true);
        });

        it("should NOT send 'enableResizing' action if type is FIELD and set _resizingEnabled to false", async () => {
            windowInstance = new Window(mockConnection as any, LocationType.FIELD, mockEmitter);
            await windowInstance.enableResizing();
            expect(mockSendToParent).not.toHaveBeenCalled();
            expect((windowInstance as any)._resizingEnabled).toBe(false); 
        });
        
        it("enableResizing should propagate rejection from sendToParent", async () => {
            windowInstance = new Window(mockConnection as any, LocationType.DASHBOARD, mockEmitter, DashboardWidth.FULL_WIDTH);
            const expectedError = new Error("Send failed");
            mockSendToParent.mockRejectedValueOnce(expectedError);
            await expect(windowInstance.enableResizing()).rejects.toThrow(expectedError);
        });
    });

    describe("onDashboardResize()", () => {
        let dashboardWindowInstance: Window; 
        beforeEach(() => {
            dashboardWindowInstance = new Window(mockConnection as any, LocationType.DASHBOARD, mockEmitter, DashboardWidth.FULL_WIDTH);
        });

        it("should register callback and update state on 'dashboardResize' event for DASHBOARD", () => {
            const mockDashboardCallback = jest.fn(); 
            dashboardWindowInstance.onDashboardResize(mockDashboardCallback);

            expect(mockEmitter.on).toHaveBeenCalledWith("dashboardResize", expect.any(Function));
            
            const newState = DashboardWidth.HALF_WIDTH;
            const onCall = (mockEmitter.on as jest.Mock).mock.calls.find(call => call[0] === "dashboardResize");
            const eventHandler = onCall ? onCall[1] : null;
            expect(eventHandler).not.toBeNull();
            
            if (eventHandler) { 
                eventHandler({ state: newState }); 
            }

            expect(mockDashboardCallback).toHaveBeenCalledWith(newState);
            expect(dashboardWindowInstance.state).toBe(newState);
        });

        it("should throw error for invalid callback for DASHBOARD", () => {
            expect(() => dashboardWindowInstance.onDashboardResize("not-a-function" as any)).toThrow("Callback must be a function");
        });

        it("should return false and not register listener if type is FIELD", () => {
            const fieldWindowInstance = new Window(mockConnection as any, LocationType.FIELD, mockEmitter);
            const mockFieldCallback = jest.fn(); 
            const result = fieldWindowInstance.onDashboardResize(mockFieldCallback);
            
            expect(result).toBe(false);
        });
    });

    describe("updateHeight()", () => {
        it("should send calculated height if no height is provided (FIELD type)", async () => {
            windowInstance = new Window(mockConnection as any, LocationType.FIELD, mockEmitter);
            mockBoundingClientRect(150, 300);
            await windowInstance.updateHeight();
            expect(mockSendToParent).toHaveBeenCalledWith("resize", 150);
        });

        it("should send provided height (FIELD type)", async () => {
            windowInstance = new Window(mockConnection as any, LocationType.FIELD, mockEmitter);
            await windowInstance.updateHeight(250);
            expect(mockSendToParent).toHaveBeenCalledWith("resize", 250);
        });

        it("should not send if height is same (FIELD type)", async () => {
            windowInstance = new Window(mockConnection as any, LocationType.FIELD, mockEmitter);
            (windowInstance as any)._height = 200; 
            await windowInstance.updateHeight(200);
            expect(mockSendToParent).not.toHaveBeenCalled();
        });

        it("should send calculated height if no height (DASHBOARD - FULL_WIDTH)", async () => {
            windowInstance = new Window(mockConnection as any, LocationType.DASHBOARD, mockEmitter, DashboardWidth.FULL_WIDTH);
            mockBoundingClientRect(180, 300);
            await windowInstance.updateHeight();
            expect(mockSendToParent).toHaveBeenCalledWith("resize", 180);
        });
        
        it("should send provided height (DASHBOARD - FULL_WIDTH)", async () => {
            windowInstance = new Window(mockConnection as any, LocationType.DASHBOARD, mockEmitter, DashboardWidth.FULL_WIDTH);
            await windowInstance.updateHeight(280);
            expect(mockSendToParent).toHaveBeenCalledWith("resize", 280);
        });

        it("should NOT send anything if DASHBOARD and state is HALF_WIDTH", async () => {
            windowInstance = new Window(mockConnection as any, LocationType.DASHBOARD, mockEmitter, DashboardWidth.HALF_WIDTH);
            await windowInstance.updateHeight(300);
            expect(mockSendToParent).not.toHaveBeenCalled();
        });
    });

    describe("enableAutoResizing()", () => {
        it("should enable auto resizing, set up MutationObserver (FIELD type)", () => {
            windowInstance = new Window(mockConnection as any, LocationType.FIELD, mockEmitter);
            windowInstance.enableAutoResizing();
            expect((windowInstance as any)._autoResizingEnabled).toBe(true);
            expect(mockMutationObserver).toHaveBeenCalledTimes(1);
            // Removed characterData from expected options
            expect(mockObserve).toHaveBeenCalledWith(expect.any(HTMLElement), {
                attributes: true, childList: true, subtree: true,
            });
        });

        it("should enable auto resizing (DASHBOARD - FULL_WIDTH)", () => {
            windowInstance = new Window(mockConnection as any, LocationType.DASHBOARD, mockEmitter, DashboardWidth.FULL_WIDTH);
            windowInstance.enableAutoResizing();
            expect((windowInstance as any)._autoResizingEnabled).toBe(true);
            expect(mockMutationObserver).toHaveBeenCalledTimes(1);
            // Removed characterData from expected options
            expect(mockObserve).toHaveBeenCalledWith(expect.any(HTMLElement), {
                attributes: true, childList: true, subtree: true,
            });
        });

        it("should NOT enable if already enabled", () => {
            windowInstance = new Window(mockConnection as any, LocationType.FIELD, mockEmitter);
            windowInstance.enableAutoResizing(); 
            (global.MutationObserver as jest.Mock).mockClear(); 
            mockObserve.mockClear(); 
            
            windowInstance.enableAutoResizing(); 
            expect(mockMutationObserver).not.toHaveBeenCalled();
        });

        it("should NOT enable if DASHBOARD and state is HALF_WIDTH", () => {
            windowInstance = new Window(mockConnection as any, LocationType.DASHBOARD, mockEmitter, DashboardWidth.HALF_WIDTH);
            windowInstance.enableAutoResizing();
            expect((windowInstance as any)._autoResizingEnabled).toBe(false);
            expect(mockMutationObserver).not.toHaveBeenCalled();
        });
    });

    describe("disableAutoResizing()", () => {
        it("should disable auto resizing and disconnect observer", () => {
            windowInstance = new Window(mockConnection as any, LocationType.FIELD, mockEmitter);
            windowInstance.enableAutoResizing(); 
            
            windowInstance.disableAutoResizing();
            expect((windowInstance as any)._autoResizingEnabled).toBe(false);
            expect(mockDisconnect).toHaveBeenCalledTimes(1);
        });

        it("should NOT disable if not enabled", () => {
            windowInstance = new Window(mockConnection as any, LocationType.FIELD, mockEmitter);
            windowInstance.disableAutoResizing();
            expect(mockDisconnect).not.toHaveBeenCalled();
        });
    });

    describe("enablePaddingTop() / disablePaddingTop()", () => {
        it("should send 'dashboardEnableTopPadding' action", async () => {
            windowInstance = new Window(mockConnection as any, LocationType.DASHBOARD, mockEmitter, DashboardWidth.FULL_WIDTH);
            await windowInstance.enablePaddingTop();
            expect(mockSendToParent).toHaveBeenCalledWith("window", { action: "dashboardEnableTopPadding" });
        });

        it("should send 'dashboardDisableTopPadding' action", async () => {
            windowInstance = new Window(mockConnection as any, LocationType.DASHBOARD, mockEmitter, DashboardWidth.FULL_WIDTH);
            await windowInstance.disablePaddingTop();
            expect(mockSendToParent).toHaveBeenCalledWith("window", { action: "dashboardDisableTopPadding" });
        });

        it("should not send enablePaddingTop if type is not DASHBOARD", async () => {
            windowInstance = new Window(mockConnection as any, LocationType.FIELD, mockEmitter);
            await windowInstance.enablePaddingTop();
            expect(mockSendToParent).not.toHaveBeenCalled();
        });

        it("should not send disablePaddingTop if type is not DASHBOARD", async () => {
            windowInstance = new Window(mockConnection as any, LocationType.FIELD, mockEmitter);
            await windowInstance.disablePaddingTop();
            expect(mockSendToParent).not.toHaveBeenCalled();
        });
    });
});
