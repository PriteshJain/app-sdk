import EventRegistry from "../src/EventRegistry";
import postRobot from "post-robot"; // This will be the mock from jest.mock
import { Subject } from "rxjs"; // Import Subject for spying if needed

jest.mock("post-robot"); // Mock postRobot at the top

describe("EventRegistry", () => {
    let eventRegistry: EventRegistry;
    // Use the mocked version of postRobot.sendToParent
    const mockSendToParent = postRobot.sendToParent as jest.Mock; 
    const mockConfig = {
        installationUID: "test-install-uid",
        appUID: "test-app-uid",
        locationType: "test-location",
    };
    // Define mockConnection using the mocked sendToParent
    const mockConnection = { sendToParent: mockSendToParent };


    beforeAll(() => {
        jest.useFakeTimers();
    });

    beforeEach(() => {
        // Reset mocks and timers before each test
        mockSendToParent.mockClear();
        jest.clearAllTimers(); 
        // Pass the correctly typed mockConnection
        eventRegistry = new EventRegistry({ ...mockConfig, connection: mockConnection as any });
    });
    
    afterEach(() => {
        // Clear all timers implicitly by jest.clearAllTimers() in beforeEach,
        // but explicit clear can be here if needed for specific scenarios.
        // jest.clearAllTimers(); 
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    describe("Constructor and Initialization", () => {
        it("should initialize properties correctly", () => {
            // Accessing private members via 'as any' for testing purposes
            expect((eventRegistry as any)._connection).toBe(mockConnection);
            expect((eventRegistry as any).installationUID).toBe(mockConfig.installationUID);
            expect((eventRegistry as any).appUID).toBe(mockConfig.appUID);
            expect((eventRegistry as any).locationType).toBe(mockConfig.locationType);
            expect((eventRegistry as any).events).toEqual([]);
            expect(mockSendToParent).not.toHaveBeenCalled();
        });
    });

    describe("register() method", () => {
        it("should add eventType to internal events array and prepare for debounced send", () => {
            const eventName = "testEvent1";
            
            eventRegistry.register(eventName);

            // Check if event is added to the internal array
            expect((eventRegistry as any).events).toContain(eventName);
            // sendToParent should not be called immediately due to debounce
            expect(mockSendToParent).not.toHaveBeenCalled();
        });
    });

    describe("Debounced sendRegisteredEvents()", () => {
        it("should call sendToParent with registered events after debounce interval", () => {
            eventRegistry.register("eventA");
            expect(mockSendToParent).not.toHaveBeenCalled();

            // Advance timers by the debounceTime (default is 350ms in EventRegistry) + a small buffer
            jest.advanceTimersByTime(400); 

            expect(mockSendToParent).toHaveBeenCalledTimes(1);
            expect(mockSendToParent).toHaveBeenCalledWith("eventRegistration", {
                appUID: mockConfig.appUID,
                installationUID: mockConfig.installationUID,
                locationType: mockConfig.locationType,
                events: ["eventA"],
            });
        });

        it("should batch multiple events registered within debounce interval", () => {
            eventRegistry.register("eventX");
            eventRegistry.register("eventY");
            
            // Advance timer but not enough to trigger debounce
            jest.advanceTimersByTime(300); 
            expect(mockSendToParent).not.toHaveBeenCalled();

            eventRegistry.register("eventZ");
            // At this point, the timer for eventX and eventY is at 300ms.
            // eventZ starts a new timer or resets the existing one depending on debounceTime behavior.
            // Assuming debounceTime means "wait 350ms after the *last* event in a burst".

            // Advance timers to pass the debounce interval for all events
            jest.advanceTimersByTime(400); 

            expect(mockSendToParent).toHaveBeenCalledTimes(1);
            expect(mockSendToParent).toHaveBeenCalledWith("eventRegistration", {
                appUID: mockConfig.appUID,
                installationUID: mockConfig.installationUID,
                locationType: mockConfig.locationType,
                events: ["eventX", "eventY", "eventZ"], // All events should be batched
            });
        });

        it("should make separate sendToParent calls for events registered after different debounce intervals", () => {
            eventRegistry.register("event1");
            jest.advanceTimersByTime(400); // Trigger first call

            expect(mockSendToParent).toHaveBeenCalledTimes(1);
            expect(mockSendToParent).toHaveBeenCalledWith("eventRegistration", {
                appUID: mockConfig.appUID,
                installationUID: mockConfig.installationUID,
                locationType: mockConfig.locationType,
                events: ["event1"],
            });

            mockSendToParent.mockClear(); // Clear mock for the next assertion

            eventRegistry.register("event2");
            // The 'events' array in EventRegistry is not reset after sendRegisteredEvents.
            // So the next call will include previous events.
            
            jest.advanceTimersByTime(400); // Trigger second call

            expect(mockSendToParent).toHaveBeenCalledTimes(1);
            expect(mockSendToParent).toHaveBeenCalledWith("eventRegistration", {
                appUID: mockConfig.appUID,
                installationUID: mockConfig.installationUID,
                locationType: mockConfig.locationType,
                events: ["event1", "event2"], // Events array accumulates
            });
        });
    });
});
