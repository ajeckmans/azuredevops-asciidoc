/// <reference types="jest" />
import { DevOpsService } from '../DevOpsService';
import * as SDK from "azure-devops-extension-sdk";
import { getClient } from "azure-devops-extension-api";

jest.mock("azure-devops-extension-sdk", () => ({
    getConfiguration: jest.fn(),
    getHost: jest.fn(),
    getService: jest.fn(),
    getExtensionContext: jest.fn(),
    getAccessToken: jest.fn()
}));

jest.mock("azure-devops-extension-api", () => ({
    getClient: jest.fn()
}));

describe("DevOpsService", () => {
    let mockGitClient: any;
    let mockDataManager: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockGitClient = {
            getPullRequestById: jest.fn(),
            getPullRequestIterations: jest.fn(),
            getPullRequestIterationChanges: jest.fn(),
            getItemText: jest.fn(),
            createThread: jest.fn(),
            getThreads: jest.fn(),
            createComment: jest.fn(),
            getRepositories: jest.fn(),
            getBranches: jest.fn(),
            getItems: jest.fn()
        };

        (getClient as jest.Mock).mockReturnValue(mockGitClient);

        mockDataManager = {
            getValue: jest.fn(),
            setValue: jest.fn(),
            getExtensionDataManager: jest.fn().mockResolvedValue(this)
        };

        (SDK.getService as jest.Mock).mockResolvedValue({
            getExtensionDataManager: jest.fn().mockResolvedValue(mockDataManager)
        });

        (SDK.getExtensionContext as jest.Mock).mockReturnValue({ id: "test-ext" });
        (SDK.getAccessToken as jest.Mock).mockResolvedValue("token");

        // Clear cached instances in DevOpsService via reflection or just resetting
        (DevOpsService as any).dataManagerInstance = null;
        (DevOpsService as any).cachedPrId = null;
        (DevOpsService as any).cachedPr = null;
    });

    describe("Context Methods", () => {
        it("should get repository ID", async () => {
            (SDK.getConfiguration as jest.Mock).mockReturnValue({ repositoryId: "repo-123" });
            const id = await DevOpsService.getRepositoryId();
            expect(id).toBe("repo-123");
        });

        it("should get pull request ID", async () => {
            (SDK.getConfiguration as jest.Mock).mockReturnValue({ pullRequestId: 456 });
            const id = await DevOpsService.getPullRequestId();
            expect(id).toBe(456);
        });

        it("should get project name from config project", async () => {
            (SDK.getConfiguration as jest.Mock).mockReturnValue({ project: { name: "ProjectA" } });
            (SDK.getHost as jest.Mock).mockReturnValue({});
            const name = await DevOpsService.getProjectName();
            expect(name).toBe("ProjectA");
        });

        it("should get project name from host", async () => {
            (SDK.getConfiguration as jest.Mock).mockReturnValue({});
            (SDK.getHost as jest.Mock).mockReturnValue({ project: { name: "ProjectB" } });
            const name = await DevOpsService.getProjectName();
            expect(name).toBe("ProjectB");
        });
    });

    describe("getFileContent", () => {
        it("should fetch file content when in a PR context", async () => {
            (SDK.getConfiguration as jest.Mock).mockReturnValue({ pullRequestId: 123 });
            mockGitClient.getPullRequestById.mockResolvedValue({
                lastMergeSourceCommit: null,
                lastMergeTargetCommit: { commitId: "target-commit-123" }
            });
            mockGitClient.getItemText.mockResolvedValue("File content from PR");

            const content = await DevOpsService.getFileContent("repo-1", "proj-1", "/docs/test.adoc");

            expect(mockGitClient.getPullRequestById).toHaveBeenCalledWith(123, "proj-1");
            expect(mockGitClient.getItemText).toHaveBeenCalledWith(
                "repo-1", "/docs/test.adoc", "proj-1", undefined, undefined, undefined, undefined, undefined,
                { versionType: 2, version: "target-commit-123", versionOptions: 0 }
            );
            expect(content).toBe("File content from PR");
        });

        it("should fallback to getRepoFileContent when not in PR and no datamanager version", async () => {
            // Throw error for PR ID
            (SDK.getConfiguration as jest.Mock).mockReturnValue({});
            mockDataManager.getValue.mockResolvedValue(null);

            mockGitClient.getItemText.mockResolvedValue("Repo file content fallback");

            const content = await DevOpsService.getFileContent("repo-1", "proj-1", "/docs/test.adoc");
            expect(content).toBe("Repo file content fallback");
        });
    });

    describe("getPreviousFileContent", () => {
        it("should get previous file content in PR", async () => {
            (SDK.getConfiguration as jest.Mock).mockReturnValue({ pullRequestId: 123 });
            mockGitClient.getPullRequestById.mockResolvedValue({
                lastMergeTargetCommit: { commitId: "target-commit-123" }
            });
            mockGitClient.getItemText.mockResolvedValue("Old content");

            const content = await DevOpsService.getPreviousFileContent("repo-1", "proj-1", "/docs/test.adoc");
            expect(content).toBe("Old content");
        });

        it("should return empty string if not in PR", async () => {
            (SDK.getConfiguration as jest.Mock).mockReturnValue({});
            const content = await DevOpsService.getPreviousFileContent("repo-1", "proj-1", "/docs/test.adoc");
            expect(content).toBe("");
        });
    });

    describe("getAsciiDocFiles", () => {
        it("should return empty array if no iterations", async () => {
            (SDK.getConfiguration as jest.Mock).mockReturnValue({ pullRequestId: 123 });
            mockGitClient.getPullRequestIterations.mockResolvedValue([]);
            const files = await DevOpsService.getAsciiDocFiles("repo-1", "proj-1");
            expect(files).toEqual([]);
        });

        it("should filter out deleted files and return unique adoc files", async () => {
            (SDK.getConfiguration as jest.Mock).mockReturnValue({ pullRequestId: 123 });
            mockGitClient.getPullRequestIterations.mockResolvedValue([{ id: 1 }, { id: 2 }]);
            
            mockGitClient.getPullRequestIterationChanges.mockResolvedValue({
                changeEntries: [
                    { changeType: 1, item: { path: "/docs/new.adoc", isFolder: false } },
                    { changeType: 16, item: { path: "/docs/deleted.adoc", isFolder: false } },
                    { changeType: 2, item: { path: "/docs/new.adoc", isFolder: false } }, // duplicate
                    { changeType: 2, item: { path: "/src/code.ts", isFolder: false } } // not adoc
                ]
            });

            const files = await DevOpsService.getAsciiDocFiles("repo-1", "proj-1");
            expect(files.length).toBe(1);
            expect(files[0].path).toBe("/docs/new.adoc");
        });
    });

    describe("getRepoAsciiDocFiles", () => {
        it("should handle empty default branch", async () => {
            const files = await DevOpsService.getRepoAsciiDocFiles("repo-1", "proj-1", "");
            expect(files).toEqual([]);
        });

        it("should fetch and cache repo files", async () => {
            mockGitClient.getBranches.mockResolvedValue([{ name: "main", commit: { commitId: "commit-123" } }]);
            mockDataManager.getValue.mockResolvedValue(null);
            
            mockGitClient.getItems.mockResolvedValue([
                { isFolder: true, path: "/docs" },
                { isFolder: false, path: "/docs/test.adoc" },
                { isFolder: false, path: "/docs/test.txt" }
            ]);

            const files = await DevOpsService.getRepoAsciiDocFiles("repo-1", "proj-1", "refs/heads/main");
            expect(files.length).toBe(1);
            expect(files[0].path).toBe("/docs/test.adoc");
        });
    });

    describe("Thread Methods", () => {
        it("should create a thread", async () => {
            (SDK.getConfiguration as jest.Mock).mockReturnValue({ pullRequestId: 123 });
            await DevOpsService.createThread("repo-1", "proj-1", "/test.adoc", "comment");
            expect(mockGitClient.createThread).toHaveBeenCalled();
        });

        it("should filter threads correctly", async () => {
            (SDK.getConfiguration as jest.Mock).mockReturnValue({ pullRequestId: 123 });
            mockGitClient.getThreads.mockResolvedValue([
                { status: 1, threadContext: { filePath: "/test.adoc" } }, // active
                { status: 6, threadContext: { filePath: "/test.adoc" } }, // pending
                { status: 4, threadContext: { filePath: "/test.adoc" } }, // closed
                { status: 1, threadContext: null } // no context
            ]);
            
            const threads = await DevOpsService.getThreads("repo-1", "proj-1");
            expect(threads.length).toBe(2);
        });

        it("should create comment", async () => {
            (SDK.getConfiguration as jest.Mock).mockReturnValue({ pullRequestId: 123 });
            await DevOpsService.createComment("repo-1", "proj-1", 10, "reply");
            expect(mockGitClient.createComment).toHaveBeenCalled();
        });
    });
});
