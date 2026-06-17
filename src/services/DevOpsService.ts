import * as SDK from "azure-devops-extension-sdk";
import { getClient } from "azure-devops-extension-api";
import { GitRestClient } from "azure-devops-extension-api/Git";

export class DevOpsService {
    public static async getRepositoryId(): Promise<string> {
        const config = SDK.getConfiguration();
        return config.repositoryId;
    }

    public static async getPullRequestId(): Promise<number> {
        const config = SDK.getConfiguration();
        return config.pullRequestId;
    }

    public static async getProjectName(): Promise<string> {
        const cfg: any = SDK.getConfiguration();
        const host: any = SDK.getHost();
        return cfg.project ? cfg.project.name : (host.project ? host.project.name : "");
    }

    public static async getAsciiDocFiles(repositoryId: string, projectName: string): Promise<any[]> {
        const gitClient = getClient(GitRestClient);
        const prId = await this.getPullRequestId();
        const pr = await gitClient.getPullRequestById(prId, projectName);
        
        const commitId = pr.lastMergeSourceCommit ? pr.lastMergeSourceCommit.commitId : pr.lastMergeTargetCommit.commitId;
        
        const items = await gitClient.getItems(
            repositoryId,
            projectName,
            "/",
            120 as any, // recursionLevel (Full)
            true, // includeContentMetadata
            false, // latestProcessedChange
            false, // download
            true, // includeLinks
            { versionType: 2, version: commitId, versionOptions: 0 } as any // versionDescriptor
        );

        return items.filter(item => 
            !item.isFolder && 
            (item.path.endsWith(".adoc") || item.path.endsWith(".asciidoc"))
        );
    }

    public static async getFileContent(repositoryId: string, projectName: string, path: string): Promise<string> {
        const gitClient = getClient(GitRestClient);
        const prId = await this.getPullRequestId();
        const pr = await gitClient.getPullRequestById(prId, projectName);
        const commitId = pr.lastMergeSourceCommit ? pr.lastMergeSourceCommit.commitId : pr.lastMergeTargetCommit.commitId;

        const contentStream = await gitClient.getItemText(
            repositoryId,
            path,
            projectName,
            undefined, // scopePath
            undefined, // recursionLevel
            undefined, // includeContentMetadata
            undefined, // latestProcessedChange
            undefined, // download
            { versionType: 2, version: commitId, versionOptions: 0 } as any // versionDescriptor
        );
        
        return contentStream;
    }

    public static async createThread(repositoryId: string, projectName: string, filePath: string, content: string): Promise<void> {
        const gitClient = getClient(GitRestClient);
        const prId = await this.getPullRequestId();
        
        const thread: any = {
            comments: [
                {
                    parentCommentId: 0,
                    content: content,
                    commentType: 1 // text
                }
            ],
            status: 1, // active
            threadContext: {
                filePath: filePath
            }
        };

        await gitClient.createThread(thread, repositoryId, prId, projectName);
    }

    public static async getThreads(repositoryId: string, projectName: string): Promise<any[]> {
        const gitClient = getClient(GitRestClient);
        const prId = await this.getPullRequestId();
        const threads = await gitClient.getThreads(repositoryId, prId, projectName);
        // Filter out deleted/closed/resolved threads. Status 1 is Active, Status 2 is Fixed, 3 is WontFix, 4 is Closed, 5 is ByDesign, 6 is Pending.
        // We only want Active (1) or Pending (6).
        return threads.filter(t => (t.status === 1 || t.status === 6) && t.threadContext && t.threadContext.filePath);
    }

    public static async createComment(repositoryId: string, projectName: string, threadId: number, content: string): Promise<void> {
        const gitClient = getClient(GitRestClient);
        const prId = await this.getPullRequestId();
        
        const comment: any = {
            content: content,
            commentType: 1 // text
        };

        await gitClient.createComment(comment, repositoryId, prId, threadId, projectName);
    }

    public static async getRepositories(projectName: string): Promise<any[]> {
        const gitClient = getClient(GitRestClient);
        return await gitClient.getRepositories(projectName);
    }

    public static async getGlobalRepoState(): Promise<any> {
        try {
            const dataService = await SDK.getService<any>("ms.vss-features.extension-data-service");
            const dataManager = await dataService.getExtensionDataManager(SDK.getExtensionContext().id, await SDK.getAccessToken());
            return await dataManager.getValue("global-repo-state-v1", { scopeType: "Default" });
        } catch (e) {
            return null;
        }
    }

    public static async setGlobalRepoState(state: any): Promise<void> {
        try {
            const dataService = await SDK.getService<any>("ms.vss-features.extension-data-service");
            const dataManager = await dataService.getExtensionDataManager(SDK.getExtensionContext().id, await SDK.getAccessToken());
            await dataManager.setValue("global-repo-state-v1", state, { scopeType: "Default" });
        } catch (e) {
            // Ignore write errors
        }
    }

    public static async getRepoAsciiDocFiles(repositoryId: string, projectName: string, defaultBranch: string): Promise<any[]> {
        if (!defaultBranch) {
            // Empty repo
            return [];
        }

        const gitClient = getClient(GitRestClient);
        const branchName = defaultBranch.replace("refs/heads/", "");
        
        let commitId = "";
        try {
            const branches = await gitClient.getBranches(repositoryId, projectName);
            const branchStat = branches.find(b => b.name === branchName || b.name === `refs/heads/${branchName}` || b.name.endsWith(branchName));
            if (!branchStat) {
                return [];
            }
            commitId = branchStat.commit.commitId;
        } catch (e: any) {
            return [];
        }

        const cacheKey = `asciidoc-tree-v2-${repositoryId}`;
        let dataManager: any = null;
        try {
            const dataService = await SDK.getService<any>("ms.vss-features.extension-data-service");
            dataManager = await dataService.getExtensionDataManager(SDK.getExtensionContext().id, await SDK.getAccessToken());
            const cached = await dataManager.getValue(cacheKey, { scopeType: "Default" });
            if (cached && cached.commitId === commitId && commitId !== "") {
                return cached.items;
            }
        } catch (e) {
            // Ignore cache read errors (404 expected on first run)
        }

        try {
            const items = await gitClient.getItems(
                repositoryId,
                projectName,
                "/",
                120 as any, // Full
                true,
                false,
                false,
                true,
                { versionType: 2, version: commitId, versionOptions: 0 } as any // Commit
            );

            const adocItems = items.filter(item => 
                !item.isFolder && 
                (item.path.toLowerCase().endsWith(".adoc") || item.path.toLowerCase().endsWith(".asciidoc"))
            );

            if (dataManager && commitId !== "") {
                try {
                    await dataManager.setValue(cacheKey, { commitId, items: adocItems }, { scopeType: "Default" });
                } catch (e) {
                    // Ignore cache write errors
                }
            }

            return adocItems;
        } catch (e: any) {
            return [];
        }
    }

    public static async getRepoFileContent(repositoryId: string, projectName: string, path: string, branchName: string = "main"): Promise<string> {
        const gitClient = getClient(GitRestClient);
        try {
            return await gitClient.getItemText(repositoryId, path, projectName, undefined, undefined, undefined, undefined, undefined, { versionType: 0, version: branchName, versionOptions: 0 } as any);
        } catch (e) {
            try {
                return await gitClient.getItemText(repositoryId, path, projectName, undefined, undefined, undefined, undefined, undefined, { versionType: 0, version: "master", versionOptions: 0 } as any);
            } catch (e2) {
                return "Error loading file content.";
            }
        }
    }
}
