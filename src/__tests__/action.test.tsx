/// <reference types="jest" />
import * as SDK from "azure-devops-extension-sdk";
import { CommonServiceIds } from "azure-devops-extension-api";

jest.mock("azure-devops-extension-sdk", () => ({
    init: jest.fn(),
    register: jest.fn(),
    notifyLoadSucceeded: jest.fn().mockResolvedValue(true),
    ready: jest.fn().mockResolvedValue(true),
    getContributionId: jest.fn().mockReturnValue("dynamic-contribution"),
    getService: jest.fn(),
    getExtensionContext: jest.fn().mockReturnValue({
        publisherId: "test-publisher",
        extensionId: "test-extension"
    })
}));

describe("action.tsx", () => {
    let mockNavService: any;
    let mockGlobalMessages: any;
    let actionHandler: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockNavService = {
            getQueryParams: jest.fn().mockResolvedValue({}),
            getPageRoute: jest.fn().mockResolvedValue({ id: "repos" }),
            setQueryParams: jest.fn(),
            setHash: jest.fn(),
            navigate: jest.fn()
        };

        mockGlobalMessages = {
            addToast: jest.fn()
        };

        (SDK.getService as jest.Mock).mockImplementation((serviceId: string) => {
            if (serviceId === CommonServiceIds.HostNavigationService) return Promise.resolve(mockNavService);
            if (serviceId === CommonServiceIds.GlobalMessagesService) return Promise.resolve(mockGlobalMessages);
            return Promise.resolve({});
        });

        // Isolate modules so action.tsx runs fresh each time
        jest.isolateModules(() => {
            require("../action");
            // Find the registered handler
            const calls = (SDK.register as jest.Mock).mock.calls;
            const call = calls.find(c => c[0] === "asciidoc-preview-action");
            actionHandler = call ? call[1] : null;
        });
    });

    it("registers the action handler", () => {
        expect(actionHandler).toBeDefined();
    });

    it("does nothing if filePath is not found", async () => {
        await actionHandler.execute({});
        expect(mockNavService.getPageRoute).not.toHaveBeenCalled();
    });

    it("extracts filePath from actionContext.item", async () => {
        await actionHandler.execute({ item: { path: "/docs/test.adoc" } });
        expect(mockNavService.getPageRoute).toHaveBeenCalled();
    });

    it("navigates to PR tab if context indicates pull request", async () => {
        mockNavService.getPageRoute.mockResolvedValue({ id: "pull-request" });
        await actionHandler.execute({ item: { path: "/docs/test.adoc" } });
        
        expect(mockNavService.setQueryParams).toHaveBeenCalledWith({ _a: "test-publisher.test-extension.asciidoc-pr-tab" });
        expect(mockNavService.setHash).toHaveBeenCalledWith("path=%2Fdocs%2Ftest.adoc");
    });

    it("navigates to hub if on default branch in repo view", async () => {
        const actionContext = {
            item: { path: "/docs/test.adoc" },
            gitRepository: {
                id: "repo-1",
                defaultBranch: "refs/heads/main",
                webUrl: "https://dev.azure.com/org/proj/_git/repo-1"
            },
            version: "main"
        };
        
        await actionHandler.execute(actionContext);
        
        expect(mockNavService.navigate).toHaveBeenCalledWith(
            "https://dev.azure.com/org/proj/_apps/hub/test-publisher.test-extension.asciidoc-hub?repoId=repo-1&path=%2Fdocs%2Ftest.adoc"
        );
    });

    it("shows toast if not on default branch in repo view", async () => {
        const actionContext = {
            item: { path: "/docs/test.adoc" },
            gitRepository: {
                id: "repo-1",
                defaultBranch: "refs/heads/main",
                webUrl: "https://dev.azure.com/org/proj/_git/repo-1"
            },
            version: "feature-branch"
        };
        
        await actionHandler.execute(actionContext);
        
        expect(mockGlobalMessages.addToast).toHaveBeenCalledWith({
            duration: 3000,
            message: "Preview is only supported on the default branch.",
            forceOverrideExisting: true
        });
        expect(mockNavService.navigate).not.toHaveBeenCalled();
    });
});
