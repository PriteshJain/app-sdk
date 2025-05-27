import EventEmitter from "wolfy87-eventemitter";
import { AppConfig } from "../src/appConfig";
import { ERROR_MESSAGES } from "../src/utils/errorMessages";

describe("app config", () => {
    const mockConnection = {
        sendToParent: jest.fn(), // Removed global mockReturnValue
    };
    const mockEmitter: EventEmitter = new EventEmitter();
    const mockData = {
        stack: {},
    };
    const appConfig: AppConfig = new AppConfig(
        mockData as any,
        mockConnection as any,
        mockEmitter,
        { currentBranch: "master" }
    );

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("stack method should return stack object", () => {
        expect(appConfig.stack()).toBeDefined();
    });

    describe("setInstallationData", () => {
        it("should send data to parent and resolve with processed data on success", async () => {
            const data = {
                configuration: {},
                serverConfiguration: {},
            };
            const mockResponseData = { status: "installed" };
            // Configure sendToParent to resolve with a structure that onData expects
            mockConnection.sendToParent.mockResolvedValueOnce({
                data: mockResponseData,
            });

            await expect(
                appConfig.setInstallationData(data)
            ).resolves.toEqual(mockResponseData);
            expect(mockConnection.sendToParent).toHaveBeenLastCalledWith(
                "setInstallationData",
                data
            );
        });

        it("should reject with error from onError on failure", async () => {
            const mockError = new Error("Failed to set data");
            mockConnection.sendToParent.mockRejectedValueOnce(mockError);

            const data = {
                configuration: {},
                serverConfiguration: {},
            };
            await expect(
                appConfig.setInstallationData(data)
            ).rejects.toThrow("Failed to set data");
            expect(mockConnection.sendToParent).toHaveBeenLastCalledWith(
                "setInstallationData",
                data
            );
        });
    });

    describe("getInstallationData", () => {
        it("should send request to parent for data and resolve with processed data on success", async () => {
            const mockResponseData = {
                configuration: { key: "value" },
                serverConfiguration: { serverKey: "serverValue" },
            };
            mockConnection.sendToParent.mockResolvedValueOnce({
                data: mockResponseData,
            });
            await expect(
                appConfig.getInstallationData()
            ).resolves.toEqual(mockResponseData);
            expect(mockConnection.sendToParent).toHaveBeenLastCalledWith(
                "getInstallationData"
            );
        });

        it("should reject with error from onError on failure", async () => {
            const mockError = new Error("Failed to get data");
            mockConnection.sendToParent.mockRejectedValueOnce(mockError);

            await expect(
                appConfig.getInstallationData()
            ).rejects.toThrow("Failed to get data");
            expect(mockConnection.sendToParent).toHaveBeenLastCalledWith(
                "getInstallationData"
            );
        });
    });

    describe("setValidity", () => {
        it("should throw error if isValid is not a boolean", async () => {
            await expect(appConfig.setValidity("true" as any)).rejects.toThrow(
                ERROR_MESSAGES.configPage.setValidity.isValidTypeBoolean
            );
        });

        it("should throw error if message is not a string", async () => {
            await expect(
                appConfig.setValidity(true, { message: 123 as any })
            ).rejects.toThrow(
                ERROR_MESSAGES.configPage.setValidity.messageTypeString
            );
        });

        it("should work when options parameter is not provided", async () => {
            mockConnection.sendToParent.mockResolvedValueOnce({ data: {} });
            await appConfig.setValidity(true);

            expect(mockConnection.sendToParent).toHaveBeenLastCalledWith(
                "setValidity",
                { isValid: true }
            );
        });

        it("should send data to parent and resolve on success", async () => {
            mockConnection.sendToParent.mockResolvedValueOnce({ data: {} });
            await appConfig.setValidity(true);

            expect(mockConnection.sendToParent).toHaveBeenLastCalledWith(
                "setValidity",
                { isValid: true }
            );

            mockConnection.sendToParent.mockResolvedValueOnce({ data: {} });
            await appConfig.setValidity(false, { message: "message" });

            expect(mockConnection.sendToParent).toHaveBeenLastCalledWith(
                "setValidity",
                { isValid: false, options: { message: "message" } }
            );
        });

        it("should reject with error from onError on failure", async () => {
            const mockError = new Error("Failed to set validity");
            mockConnection.sendToParent.mockRejectedValueOnce(mockError);

            await expect(appConfig.setValidity(true)).rejects.toThrow(
                "Failed to set validity"
            );
            expect(mockConnection.sendToParent).toHaveBeenLastCalledWith(
                "setValidity",
                { isValid: true }
            );
        });
    });
});
