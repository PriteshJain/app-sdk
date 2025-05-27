import ContentTypeSidebarWidget from "../src/ContentTypeSidebarWidget";
import EventEmitter from "wolfy87-eventemitter";
// Corrected import: ContentType is imported directly from its source file
import { IContentTypeSidebarInitData, LocationType } from "../src/types"; 
import { ContentType } from "../src/types/stack.types"; // Import ContentType directly

jest.mock("post-robot", () => ({
    __esModule: true,
    default: {
        sendToParent: jest.fn(),
    },
}));

describe("ContentTypeSidebarWidget", () => {
    let contentTypeSidebarWidget: ContentTypeSidebarWidget;
    let mockInitData: IContentTypeSidebarInitData;
    let connection: { sendToParent: jest.Mock };
    let emitter: EventEmitter;
    // Revert to simpler registeredEventHandlers for now to isolate issue
    let registeredEventHandlers: { [key: string]: (data: any) => void }; 

    beforeEach(() => {
        mockInitData = {
            type: LocationType.CONTENT_TYPE_SIDEBAR_WIDGET,
            currentContentType: { 
                uid: "test_ct_uid", 
                title: "Test Content Type", 
                schema: [], 
                description: "Test CT desc",
                created_at: new Date(), 
                updated_at: new Date(),
                SYS_ACL: {},
                options: { is_page: false, singleton: false, title: "title", sub_title: []},
                maintain_revisions: true,
                abilities: { get: true, create: true, update: true, delete: true, publish: true, unpublish: true, version: true } 
            } as ContentType,
            config: {},
            app_id: "mock_app_uid",
            installation_uid: "mock_installation_uid",
            extension_uid: "mock_extension_uid",
            stack: {} as any, 
            user: {} as any,
            currentBranch: "main",
            region: "NA" as any, 
            endpoints: { CMA: "cma_endpoint", APP: "app_endpoint", DEVELOPER_HUB: "devhub_endpoint" },
        };

        registeredEventHandlers = {}; 
        const mockEmitterInstance = new EventEmitter();
        
        emitter = {
            ...mockEmitterInstance, 
            on: jest.fn((event: string, cbf: (data: any) => void) => {
                // This simple version overwrites if the same event is registered multiple times.
                // The constructor registers 'contentTypeSave'. If onSave calls emitter.on for 'contentTypeSave' again,
                // this will store the onSave's callback.
                registeredEventHandlers[event] = cbf;
            }),
            emitEvent: jest.fn(),
            // Basic emit for single stored handler
            emit: jest.fn((event: string, ...dataArgs: any[]) => { 
                if (registeredEventHandlers[event] && typeof registeredEventHandlers[event] === 'function') {
                    registeredEventHandlers[event](dataArgs[0]); 
                }
            }),
        } as unknown as EventEmitter;

        connection = { sendToParent: jest.fn().mockResolvedValue({ data: {} }) };

        contentTypeSidebarWidget = new ContentTypeSidebarWidget(
            mockInitData,
            connection as any, // postRobot is complex, cast if full mock is too much
            emitter
        );
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("should set instance properties in constructor", () => {
        expect(contentTypeSidebarWidget.currentContentType).toBe(mockInitData.currentContentType);
        // Accessing private members for testing purposes (consider if there are public getters)
        expect((contentTypeSidebarWidget as any)._emitter).toBe(emitter);
        expect((contentTypeSidebarWidget as any)._connection).toBe(connection);
        // Check that the constructor registered the 'contentTypeSave' event listener
        expect(emitter.on).toHaveBeenCalledWith("contentTypeSave", expect.any(Function));
        expect(registeredEventHandlers["contentTypeSave"]).toBeDefined();
    });

    describe("getData", () => {
        it("should return the current content type", () => {
            const data = contentTypeSidebarWidget.getData();
            expect(data).toBe(mockInitData.currentContentType);
        });
    });

    describe("onSave", () => {
        it("should only accept functions as a callback", () => {
            expect(() => contentTypeSidebarWidget.onSave("not a function" as any)).toThrow("Callback must be a function");
            expect(() => (contentTypeSidebarWidget as any).onSave()).toThrow("Callback must be a function");
        });

        it("should setup a listener for contentTypeSave event and emit _eventRegistration", () => {
            const mockCallback = jest.fn();
            contentTypeSidebarWidget.onSave(mockCallback);

            expect(emitter.on).toHaveBeenCalledWith("contentTypeSave", expect.any(Function));
            // The actual handler passed to emitter.on would be different from mockCallback due to internal wrapping.
            // We check if our mockCallback is called later.
            // For now, check if our custom handler capture worked for the external onSave registration.
            const mockSaveCallback = jest.fn(); // Renamed to avoid potential conflict if any
            contentTypeSidebarWidget.onSave(mockSaveCallback);

            // After onSave, registeredEventHandlers["contentTypeSave"] should hold the handler that wraps mockSaveCallback.
            expect(registeredEventHandlers["contentTypeSave"]).toBeDefined();
            expect(typeof registeredEventHandlers["contentTypeSave"]).toBe("function");
            
            expect(emitter.emitEvent).toHaveBeenCalledWith("_eventRegistration", [{ name: "contentTypeSave" }]);
        });

        it("should invoke the callback provided when contentTypeSave event occurs", () => {
            const mockUserCallback = jest.fn(); // Renamed for clarity
            contentTypeSidebarWidget.onSave(mockUserCallback); 

            const mockContentTypeData = { 
                uid: "ct123", 
                title: "Saved Content Type",
                schema: [], 
                description: "Saved CT desc",
                created_at: new Date(), 
                updated_at: new Date(),
                SYS_ACL: {},
                options: { is_page: false, singleton: false, title: "title", sub_title: []},
                maintain_revisions: true,
                abilities: { get: true, create: true, update: true, delete: true, publish: true, unpublish: true, version: true }
            } as ContentType;
            
            // Simulate the event system emitting "contentTypeSave".
            // The emitter.on mock now stores the latest handler.
            // If onSave internally calls emitter.on('contentTypeSave', someInternalWrapper),
            // then that someInternalWrapper is what's in registeredEventHandlers['contentTypeSave'].
            // We need to ensure this internalWrapper calls the mockUserCallback.
            if (registeredEventHandlers["contentTypeSave"]) {
                 // The actual event payload from Contentstack SDK might be wrapped, e.g., { data: actualPayload }
                registeredEventHandlers["contentTypeSave"]({ data: mockContentTypeData });
            } else {
                throw new Error("contentTypeSave handler not registered by onSave as expected.");
            }
            
            expect(mockUserCallback).toHaveBeenCalledWith(mockContentTypeData);
        });
    });

    describe("Internal state updates via emitter", () => {
        it("should update currentContentType when _emitter triggers contentTypeSave (constructor's listener)", () => {
            // This test assumes that the constructor's listener for 'contentTypeSave' is the one
            // currently in registeredEventHandlers["contentTypeSave"] because onSave() hasn't been called
            // in *this specific test's* "arrange" phase to overwrite it.
            // This relies on beforeEach re-initializing everything.

            const newMockContentTypeData = { 
                uid: "ct_new_uid", 
                title: "New Content Type Title",
                schema: [], 
                description: "New CT desc",
                created_at: new Date(), 
                updated_at: new Date(),
                SYS_ACL: {},
                options: { is_page: false, singleton: false, title: "title", sub_title: []},
                maintain_revisions: true,
                abilities: { get: true, create: true, update: true, delete: true, publish: true, unpublish: true, version: true }
            } as ContentType;
            
            expect(registeredEventHandlers["contentTypeSave"]).toBeDefined();
            
            // Manually invoke the 'contentTypeSave' handler (assumed to be the constructor's at this point)
            // The actual event payload from Contentstack SDK might be wrapped, e.g., { data: actualPayload }
            if (typeof registeredEventHandlers["contentTypeSave"] === 'function') {
                 registeredEventHandlers["contentTypeSave"]({ data: newMockContentTypeData });
            }
            
            expect(contentTypeSidebarWidget.currentContentType).toEqual(newMockContentTypeData);
        });
    });
});
