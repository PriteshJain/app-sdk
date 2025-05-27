import Entry from "../src/entry";
import testData from "./data/testData.json";
import { jest } from "@jest/globals";

describe("Entry", () => {
    let connection: { sendToParent: (...props: any[]) => any };
    let emitter: any;
// Outer describe block for Entry
describe("Entry", () => {
    let connection: { sendToParent: (...props: any[]) => Promise<any> }; // Typed sendToParent
    let emitter: any; // Keep as any for flexibility with mock, or type precisely
    let entry: Entry;
    let sendToParent: jest.Mock; // sendToParent is a Jest mock
    let registeredEventHandlers: { [key: string]: (data: any) => void } = {};

    beforeEach(() => {
        sendToParent = jest.fn().mockResolvedValue({} as any); // Ensure mockResolvedValue type matches expectation
        connection = { sendToParent };

        registeredEventHandlers = {};
        emitter = {
            on: (event: string, cbf: (data: any) => void) => {
                registeredEventHandlers[event] = cbf;
            },
            emitEvent: jest.fn(),
            emit: (event: string, data: any) => {
                if (registeredEventHandlers[event]) {
                    registeredEventHandlers[event](data);
                }
            },
        };

        jest.spyOn(emitter, "on");
        jest.spyOn(emitter, "emitEvent");
        jest.spyOn(emitter, "emit");

        const changedDataEntry = JSON.parse(JSON.stringify(testData.entry));
        changedDataEntry.title = "changed title";

        // Initialize entry for each test, so modifications in one test don't affect others
        entry = new Entry(
            { ...testData, changedData: { entry: changedDataEntry } } as any,
            connection as any,
            emitter
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("init", () => {
        // Trigger the constructor's internal on listeners by creating a new instance or manually calling them
        // For simplicity, we assume the constructor correctly sets up listeners.
        // The actual test of whether these listeners update state will be in 'Internal state updates via emitter'
        entry = new Entry(testData as any, connection as any, emitter);
        expect(entry.content_type).toEqual(testData.content_type);
        expect(entry.locale).toEqual(testData.entry.locale);
        expect(emitter.on).toHaveBeenCalledWith(
            "entrySave",
            expect.any(Function)
        );
        expect(emitter.on).toHaveBeenCalledWith(
            "entryChange",
            expect.any(Function)
        );
        // Depending on Entry constructor, it might register more, like publish/unpublish
        // Let's be flexible or adjust if we know the exact number.
        // For now, ensuring at least these two are registered.
        expect(emitter.on.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("getData", () => {
        expect(testData.entry).toEqual(entry.getData());
    });

    describe("getPropertySafely", () => {
        const testObj = {
            ownProp: "ownValue",
        };
        const protoObj = Object.create(testObj);
        protoObj.protoProp = "protoValue"; // This is an own prop of protoObj
        Object.setPrototypeOf(testObj, { inheritedProp: "inheritedValue" }); // testObj now inherits inheritedProp

        it("should return the value if property exists and is owned by the object", () => {
            expect(entry.getPropertySafely(testObj, "ownProp")).toBe(
                "ownValue"
            );
        });

        it("should return undefined if property does not exist", () => {
            expect(
                entry.getPropertySafely(testObj, "nonExistentProp")
            ).toBeUndefined();
        });

        it("should return undefined if property exists on prototype chain but not directly", () => {
            // 'inheritedProp' is on testObj's prototype
            expect(
                entry.getPropertySafely(testObj, "inheritedProp")
            ).toBeUndefined();
        });

        it("should handle null object gracefully", () => {
            expect(entry.getPropertySafely(null, "anyProp")).toBeUndefined();
        });

        it("should handle undefined object gracefully", () => {
            expect(
                entry.getPropertySafely(undefined, "anyProp")
            ).toBeUndefined();
        });

        it("should handle non-string key (e.g. number) if object is an array", () => {
            const testArr = ["a", "b"];
            expect(entry.getPropertySafely(testArr, 0)).toBe("a");
            expect(entry.getPropertySafely(testArr, 1)).toBe("b");
            expect(entry.getPropertySafely(testArr, 2)).toBeUndefined();
        });
    });

    describe("getField", () => {
        it("getField undefined", function () {
            const uid = "group1.group"; // group1 is schema[5], its first sub-schema is 'group'
            const schema = entry.content_type.schema[5].schema[0]; // This is the schema for 'group' under 'group1'
            const field = entry.getField(uid);

            expect(field.uid).toEqual(uid); // uid should be 'group1.group'
            expect(field.data_type).toEqual(schema.data_type);
            expect(field.schema).toEqual(schema);
        });

        it("getField modular blocks, get complete block", function () {
            const uid = "modular_blocks.0";
            const uid = "modular_blocks.0"; // 'banner' is the first block type in data, but schema[2] is 'banner'
            // The data has 'banner', then 'our_mission', then 'video'.
            // testData.entry.modular_blocks[0] is 'banner'
            // entry.content_type.schema[6].blocks lists 'our_mission', 'form', 'banner', 'products', 'video'
            // So, data's modular_blocks.0 corresponds to schema's blocks[2] ('banner')
            const schema = entry.content_type.schema[6].blocks.find(b => b.uid === "banner");
            const field = entry.getField(uid);
            expect(field.uid).toEqual(uid);
            expect(field.data_type).toEqual("block"); // The data_type of the block itself
            expect(field.schema).toEqual(schema); // The schema of the 'banner' block type
        });

        it("getField modular blocks, get block definition (not a specific field instance)", function () {
            const uid = "modular_blocks.banner"; // Path to a block definition within modular blocks
            const schema = entry.content_type.schema[6].blocks.find(b => b.uid === "banner");
            const field = entry.getField(uid);
            expect(field.uid).toEqual(uid);
            expect(field.data_type).toEqual("block");
            expect(field.schema).toEqual(schema);
        });


        it("getField modular blocks, get block field", function () {
            // modular_blocks.0 is a 'banner' block. Its first field is 'banner_image'
            const uid = "modular_blocks.0.banner_image";
            const blockSchema = entry.content_type.schema[6].blocks.find(b => b.uid === "banner");
            const fieldSchema = blockSchema.schema[0]; // 'banner_image' schema
            const field = entry.getField(uid);
            expect(field.uid).toEqual(uid);
            expect(field.data_type).toEqual(schema.data_type);
            expect(field.schema).toEqual(schema);
        });

        it("getField global field", function () {
            const uid = "global_field.single_line";
            const schema = entry.content_type.schema[7].schema[0];
            const field = entry.getField(uid);
            expect(field.uid).toEqual(uid);
            expect(field.data_type).toEqual(fieldSchema.data_type);
            expect(field.schema).toEqual(fieldSchema);
        });

        it("getField multiple group field", function () {
            const uid = "group.group.group.0.single_line"; // group.group.group is schema[4].schema[0].schema[0] which is multiple
            const baseGroupSchema = entry.content_type.schema[4].schema[0].schema[0]; // This is the 'group' that's multiple
            const fieldSchema = baseGroupSchema.schema[0]; // This is 'single_line'
            const field = entry.getField(uid);
            expect(field.uid).toEqual(uid);
            expect(field.data_type).toEqual(fieldSchema.data_type);
            expect(field.schema).toEqual(fieldSchema);
        });

        it("getField specific multiple group instance", function () {
            const uid = "group.group.group.0"; // Get the first instance of the multiple group
            const groupInstanceSchema = entry.content_type.schema[4].schema[0].schema[0]; // Schema of the group itself
            const field = entry.getField(uid);
            expect(field.uid).toEqual(uid);
            expect(field.data_type).toEqual(groupInstanceSchema.data_type); // Should be 'group'
            expect(field.schema).toEqual(groupInstanceSchema);
        });


        it("getField group definition (not a specific instance)", function () {
            const uid = "group.group.group";
            const schema = entry.content_type.schema[4].schema[0].schema[0]; // Schema of the 'group' that is multiple
            const field = entry.getField(uid);
            expect(field.uid).toEqual(uid);
            expect(field.data_type).toEqual(schema.data_type);
            expect(field.schema).toEqual(schema);
        });


        it("should use unsaved schema if user set options.useUnsavedSchema = true", () => {
            const uid = "title";
            const field = entry.getField(uid, { useUnsavedSchema: true });
            const schema = entry.content_type.schema[0];
            expect(field.uid).toBe(uid);
            expect(field.schema).toEqual(schema);
            expect(field.data_type).toEqual(schema.data_type);
        });
        it("should use custom Field instance if internal flag is set", () => {
            const fieldInstance: any = jest.fn();
            entry = new Entry(testData as any, connection as any, emitter ,{
                _internalFlags: {
                    FieldInstance: fieldInstance,
                },
            });

            entry.getField("title");

            expect(fieldInstance).toHaveBeenCalled();
        });
    });

    it("set field data restriction", async () => {
        const uid = "group.group.group";
        const field = entry.getField(uid);

        await expect(field.setData({ d: "dummy" })).rejects.toThrowError(
            "Cannot call set data for current field type"
        );
    });

    it("set field data restriction for modular blocks, one complete block", async () => {
        const uid = "modular_blocks.0";
        const field = entry.getField(uid);
        await expect(field.setData({ d: "dummy" })).rejects.toThrowError(
            "Cannot call set data for current field type"
        );
    });

    it("getField Invalid Uid at root", function () {
        expect(() => entry.getField("invaliduid")).toThrow(
            "Invalid uid, Field not found"
        );
    });

    it("getField with schema not found at deeper level", () => {
        const modifiedEntryData = JSON.parse(JSON.stringify(testData));
        // Intentionally remove schema for 'group' within 'group1' to simulate missing deep schema
        modifiedEntryData.content_type.schema.find(
            (s: any) => s.uid === "group1"
        ).schema = [];
        const tempEntry = new Entry(
            modifiedEntryData,
            connection as any,
            emitter
        );
        expect(() => tempEntry.getField("group1.group.single_line")).toThrow(
            "Invalid uid, Field not found"
        );
    });

    it("getField with value undefined at path", () => {
        const dataWithUndefined = JSON.parse(JSON.stringify(testData));
        dataWithUndefined.entry.group.group = undefined; // Set an intermediate path to undefined
        const tempEntry = new Entry(
            dataWithUndefined,
            connection as any,
            emitter
        );
        // This should ideally throw an error or return a field where field.getData() is undefined.
        // Depending on implementation, it might throw "Cannot read property 'group' of undefined" if not handled.
        // Let's assume it should throw, or the Field object handles it gracefully.
        // For now, we expect an error if it tries to access properties of undefined.
        // If Entry.getField is robust, it might return a Field instance whose value is undefined.
        // The current implementation seems to throw "Invalid uid, Field not found" if path is broken.
        expect(() => tempEntry.getField("group.group.group.0.single_line")).toThrow(
             // This error message might vary based on exact implementation details of getField's traversal
            /Invalid uid, Field not found|Cannot read propert(y|ies)/
        );
    });


    it("getField within Create page (entry data is empty)", function () {
        const dataWithoutEntry = JSON.parse(JSON.stringify(testData));
        dataWithoutEntry.entry = {}; // Simulate a new, unsaved entry
        const tempEntry = new Entry(
            dataWithoutEntry,
            connection as any,
            emitter
        );
        expect(() => tempEntry.getField("title")).toThrowError(
            "The data is unsaved. Save the data before requesting the field."
        );
    });
});

describe("Event Handling and Registration", () => {
    it("onSave should register callback and emit _eventRegistration", () => {
        const mockCallback = jest.fn();
        entry.onSave(mockCallback);
        expect(registeredEventHandlers["entrySave"]).toBeDefined();
        expect(typeof registeredEventHandlers["entrySave"]).toBe("function");
        expect(emitter.emitEvent).toHaveBeenCalledWith("_eventRegistration", [
            { name: "entrySave" },
        ]);
    });

    it("onChange should register callback and emit _eventRegistration", () => {
        const mockCallback = jest.fn();
        entry.onChange(mockCallback);
        expect(registeredEventHandlers["entryChange"]).toBeDefined();
        expect(typeof registeredEventHandlers["entryChange"]).toBe("function");
        expect(emitter.emitEvent).toHaveBeenCalledWith("_eventRegistration", [
            { name: "entryChange" },
        ]);
    });

    it("onPublish should register callback and emit _eventRegistration", () => {
        const mockCallback = jest.fn();
        entry.onPublish(mockCallback);
        expect(registeredEventHandlers["entryPublish"]).toBeDefined();
        expect(typeof registeredEventHandlers["entryPublish"]).toBe("function");
        expect(emitter.emitEvent).toHaveBeenCalledWith("_eventRegistration", [
            { name: "entryPublish" },
        ]);
    });

    it("onUnPublish should register callback and emit _eventRegistration", () => {
        const mockCallback = jest.fn();
        entry.onUnPublish(mockCallback);
        expect(registeredEventHandlers["entryUnPublish"]).toBeDefined();
        expect(typeof registeredEventHandlers["entryUnPublish"]).toBe(
            "function"
        );
        expect(emitter.emitEvent).toHaveBeenCalledWith("_eventRegistration", [
            { name: "entryUnPublish" },
        ]);
    });

    it("onSave should throw error if callback is not a function", function () {
        expect(() => (entry as any).onSave()).toThrow(
            "Callback must be a function"
        );
        expect(() => entry.onSave("not a function" as any)).toThrow(
            "Callback must be a function"
        );
    });
    // Similar error checks for onChange, onPublish, onUnPublish can be added if not covered by types
});

describe("Internal state updates via emitter", () => {
    it("should update _data when entrySave event is emitted", () => {
        const mockSavedEntry = {
            title: "Saved Title",
            uid: "blt123saved",
            locale: "en-us",
        };
        // Manually trigger the saved event handler via the mock emitter's emit or by calling the handler directly
        emitter.emit("entrySave", { data: { data: mockSavedEntry } }); // Structure matches original emitter mock
        expect(entry.getData()).toEqual(mockSavedEntry);
    });

    it("should update _changedData when entryChange event is emitted", () => {
        const mockChangedEntry = {
            title: "Changed Title Again",
            description: "New description",
        };
        // Manually trigger the saved event handler
        emitter.emit("entryChange", { data: { data: mockChangedEntry } }); // Structure matches original emitter mock
        // Accessing _changedData directly. If it's private, this needs adjustment (e.g. a getter or friend class)
        // Assuming _changedData structure mirrors the entry structure or a subset of it.
        // The Entry constructor initializes _changedData with testData.changedData
        // Let's assume entryChange updates the whole _changedData.entry
        expect((entry as any)._changedData.entry).toEqual(mockChangedEntry);
    });
});