import EventEmitter from "wolfy87-eventemitter";
import AssetSidebarWidget from "../src/AssetSidebarWidget";
import { IAssetSidebarInitData, LocationType } from "../src/types";
import Asset from "../src/stack/api/asset";

jest.mock("post-robot", () => ({
    __esModule: true,
    default: {
        sendToParent: jest.fn(),
    },
}));

jest.mock("../src/stack/api/asset");

describe("AssetSidebarWidget", () => {
    let assetSidebarWidget: AssetSidebarWidget;
    let mockInitData: IAssetSidebarInitData = {
        type: LocationType.ASSET_SIDEBAR_WIDGET,
        currentAsset: {} as any,
        config: {},
        app_id: "mock_app_uid",
        installation_uid: "mock_installation_uid",
        extension_uid: "mock_extension_uid",
        stack: {} as any,
        user: {} as any,
        currentBranch: "mock_branch",
        region: "region",
        endpoints: { CMA: "", APP: "",DEVELOPER_HUB:"" },
    };

    let connection: { sendToParent: (...props: any[]) => any };
    let sendToParent;
    let emitter: EventEmitter;
    let registeredEventHandlers: { [key: string]: (data: any) => void } = {};

    beforeEach(function () {
        sendToParent = function () {
            return Promise.resolve({ data: {} });
        };

        // Reset registered handlers for each test
        registeredEventHandlers = {};

        emitter = {
            // Capture the event handler passed to emitter.on
            on: (event: string, cbf: (data: any) => void) => {
                registeredEventHandlers[event] = cbf;
            },
            // Mock emitEvent
            emitEvent: jest.fn(),
        } as unknown as EventEmitter;

        // Spy on the actual 'on' method if needed for other tests, but for capturing, the above mock is direct.
        // jest.spyOn(emitter, "on"); // This would spy on the mocked 'on'
        jest.spyOn(emitter, "emitEvent"); // Spy on the mocked emitEvent

        connection = { sendToParent };
        jest.spyOn(connection, "sendToParent");

        assetSidebarWidget = new AssetSidebarWidget(
            mockInitData as IAssetSidebarInitData,
            connection as any,
            emitter
        );
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("should set instance properties in constructor", () => {
        expect(assetSidebarWidget.currentAsset).toBe(mockInitData.currentAsset);
        expect(assetSidebarWidget._emitter).toBe(emitter);
        expect(assetSidebarWidget._connection).toBe(connection);
    });

    describe("getData", () => {
        it("should return the current asset", () => {
            const currentAsset = assetSidebarWidget.getData();
            expect(currentAsset).toBe(mockInitData.currentAsset);
        });
    });

    describe("setData", () => {
        it("should set the current asset with the one provided", async () => {
            const asset = {};
            const result = await assetSidebarWidget.setData(asset);
            expect(connection.sendToParent).toHaveBeenCalledWith(
                "setData",
                asset
            );
            expect(result).toEqual(undefined);
        });
    });

    describe("syncAsset", () => {
        it("should sync the upstream asset with the current", async () => {
            const result = await assetSidebarWidget.syncAsset();
            expect(connection.sendToParent).toHaveBeenCalledWith("syncAsset");
            expect(result).toEqual(undefined);
        });
    });

    describe("updateWidth", () => {
        it("should throw an error if width is invalid", () => {
            const error = new Error("Width must be a number");
            expect(
                assetSidebarWidget.updateWidth("500" as any)
            ).rejects.toThrowError(error);
        });

        it("should update the width with the one provided", async () => {
            const mockWidth = 500;
            const result = await assetSidebarWidget.updateWidth(mockWidth);
            expect(connection.sendToParent).toHaveBeenCalledWith(
                "updateAssetSidebarWidth",
                mockWidth
            );
            expect(result).toEqual(undefined);
        });
    });

    describe("replaceAsset", () => {
        it("should call Asset(emitter).handleUpload with the file and 'replace' action", async () => {
            const mockHandleUpload = jest.fn().mockResolvedValue({});
            (Asset as jest.Mock).mockReturnValue({
                handleUpload: mockHandleUpload,
            });
            const file = { name: "test.jpg", type: "image/jpeg" } as File;
            await assetSidebarWidget.replaceAsset(file);
            expect(Asset).toHaveBeenLastCalledWith(emitter);
            expect(mockHandleUpload).toHaveBeenCalledWith([file], "replace");
        });

        it("should reject with an error if Asset(emitter).handleUpload fails", async () => {
            const uploadError = new Error("Upload failed");
            const mockHandleUpload = jest.fn().mockRejectedValue(uploadError);
            (Asset as jest.Mock).mockReturnValue({
                handleUpload: mockHandleUpload,
            });
            const file = { name: "test.jpg", type: "image/jpeg" } as File;
            await expect(assetSidebarWidget.replaceAsset(file)).rejects.toThrow(
                uploadError
            );
            expect(Asset).toHaveBeenLastCalledWith(emitter);
            expect(mockHandleUpload).toHaveBeenCalledWith([file], "replace");
        });
    });

    describe("onSave", () => {
        it("should only accept functions as a callback", () => {
            const mockCallback: any = {};
            const error = new Error("Callback must be a function");
            expect(() => assetSidebarWidget.onSave(mockCallback)).toThrow(
                error
            );
        });

        it("should setup a listener for assetSave event and emit _eventRegistration", () => {
            const mockCallback = jest.fn();
            assetSidebarWidget.onSave(mockCallback);
            // Check if emitter.on was called to register for 'assetSave'
            expect(registeredEventHandlers["assetSave"]).toBeDefined();
            expect(typeof registeredEventHandlers["assetSave"]).toBe(
                "function"
            );
            expect(assetSidebarWidget._emitter.emitEvent).toHaveBeenCalledWith(
                "_eventRegistration",
                [{ name: "assetSave" }]
            );
        });

        it("should invoke the callback provided when assetSave event occurs", () => {
            const mockCallback = jest.fn();
            assetSidebarWidget.onSave(mockCallback);

            // Manually trigger the saved event handler
            const mockEventData = { data: { uid: "asset123" } };
            if (registeredEventHandlers["assetSave"]) {
                registeredEventHandlers["assetSave"](mockEventData);
            }
            expect(mockCallback).toHaveBeenCalledWith(mockEventData.data);
        });
    });

    describe("onChange", () => {
        it("should only accept functions as a callback", () => {
            const mockCallback: any = {};
            const error = new Error("Callback must be a function");
            expect(() => assetSidebarWidget.onChange(mockCallback)).toThrow(
                error
            );
        });

        it("should setup a listener for assetChange event and emit _eventRegistration", () => {
            const mockCallback = jest.fn();
            assetSidebarWidget.onChange(mockCallback);
            expect(registeredEventHandlers["assetChange"]).toBeDefined();
            expect(typeof registeredEventHandlers["assetChange"]).toBe(
                "function"
            );
            expect(assetSidebarWidget._emitter.emitEvent).toHaveBeenCalledWith(
                "_eventRegistration",
                [{ name: "assetChange" }] // Corrected expectation
            );
        });

        it("should invoke the callback provided when assetChange event occurs", () => {
            const mockCallback = jest.fn();
            assetSidebarWidget.onChange(mockCallback);

            const mockEventData = { data: { uid: "asset456" } };
            if (registeredEventHandlers["assetChange"]) {
                registeredEventHandlers["assetChange"](mockEventData);
            }
            expect(mockCallback).toHaveBeenCalledWith(mockEventData.data);
        });
    });

    describe("onPublish", () => {
        it("should only accept functions as a callback", () => {
            const mockCallback: any = {};
            const error = new Error("Callback must be a function");
            expect(() => assetSidebarWidget.onPublish(mockCallback)).toThrow(
                error
            );
        });

        it("should setup a listener for assetPublish event and emit _eventRegistration", () => {
            const mockCallback = jest.fn();
            assetSidebarWidget.onPublish(mockCallback);
            expect(registeredEventHandlers["assetPublish"]).toBeDefined();
            expect(typeof registeredEventHandlers["assetPublish"]).toBe(
                "function"
            );
            expect(assetSidebarWidget._emitter.emitEvent).toHaveBeenCalledWith(
                "_eventRegistration",
                [{ name: "assetPublish" }]
            );
        });

        it("should invoke the callback provided when assetPublish event occurs", () => {
            const mockCallback = jest.fn();
            assetSidebarWidget.onPublish(mockCallback);

            const mockEventData = { data: { uid: "asset789" } };
            if (registeredEventHandlers["assetPublish"]) {
                registeredEventHandlers["assetPublish"](mockEventData);
            }
            expect(mockCallback).toHaveBeenCalledWith(mockEventData.data);
        });
    });

    describe("onUnPublish", () => {
        it("should only accept functions as a callback", () => {
            const mockCallback: any = {};
            const error = new Error("Callback must be a function");
            expect(() => assetSidebarWidget.onUnPublish(mockCallback)).toThrow(
                error
            );
        });

        it("should setup a listener for assetUnPublish event and emit _eventRegistration", () => {
            const mockCallback = jest.fn();
            assetSidebarWidget.onUnPublish(mockCallback);
            expect(registeredEventHandlers["assetUnPublish"]).toBeDefined();
            expect(typeof registeredEventHandlers["assetUnPublish"]).toBe(
                "function"
            );
            expect(assetSidebarWidget._emitter.emitEvent).toHaveBeenCalledWith(
                "_eventRegistration",
                [{ name: "assetUnPublish" }]
            );
        });

        it("should invoke the callback provided when assetUnPublish event occurs", () => {
            const mockCallback = jest.fn();
            assetSidebarWidget.onUnPublish(mockCallback);

            const mockEventData = { data: { uid: "asset101" } };
            if (registeredEventHandlers["assetUnPublish"]) {
                registeredEventHandlers["assetUnPublish"](mockEventData);
            }
            expect(mockCallback).toHaveBeenCalledWith(mockEventData.data);
        });
    });

    describe("Internal state updates via emitter", () => {
        it("should update currentAsset when _emitter triggers assetSave", () => {
            const mockAsset = {
                uid: "new-asset-uid",
                title: "New Asset",
            } as any;
            // Directly call the handler registered in the constructor for 'assetSave'
            if (registeredEventHandlers["assetSave"]) {
                registeredEventHandlers["assetSave"]({ data: mockAsset });
            } else {
                throw new Error(
                    "assetSave handler was not registered on emitter"
                );
            }
            expect(assetSidebarWidget.currentAsset).toEqual(mockAsset);
        });

        it("should update _changedData when _emitter triggers assetChange", () => {
            const mockAsset = {
                uid: "changed-asset-uid",
                title: "Changed Asset",
            } as any;
            // Directly call the handler registered in the constructor for 'assetChange'
            if (registeredEventHandlers["assetChange"]) {
                registeredEventHandlers["assetChange"]({ data: mockAsset });
            } else {
                throw new Error(
                    "assetChange handler was not registered on emitter"
                );
            }
            // Accessing _changedData might require making it public or adding a getter if it's private
            // For this test, assuming it's accessible or a getter like getChangedData() exists.
            // If it is a private member, this test as written would fail.
            // Let's assume the actual implementation updates a public `currentAsset` or similar for `assetChange` too,
            // or that `_changedData` is a property we intend to test directly.
            // Based on the task, we are to check `_changedData`.
            // If `_changedData` is private and not exposed, this test needs reconsideration.
            // For now, proceeding with the assumption it's testable.
            expect((assetSidebarWidget as any)._changedData).toEqual(
                mockAsset
            );
        });
    });
});
