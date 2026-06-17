import * as SDK from "azure-devops-extension-sdk";
import { CommonServiceIds, IHostNavigationService } from "azure-devops-extension-api";

SDK.init({ loaded: false });

const actionHandler = {
    execute: async (actionContext: any) => {
        let filePath = "";
        const navService = await SDK.getService<IHostNavigationService>(CommonServiceIds.HostNavigationService);

        if (actionContext && actionContext.item) {
            filePath = actionContext.item.path || actionContext.item.serverItem || "";
        }
        
        if (!filePath) {
            const queryParams = await navService.getQueryParams();
            if (queryParams && queryParams.path) {
                filePath = queryParams.path;
            }
        }
        
        if (!filePath) {
            return;
        }

        try {
            const route = await navService.getPageRoute();
            let isPullRequest = false;
            
            if ((actionContext && actionContext.pullRequest) || (route && route.id && route.id.toLowerCase().includes("pull-request"))) {
                isPullRequest = true;
            }

            const publisher = SDK.getExtensionContext().publisherId;
            const extensionId = SDK.getExtensionContext().extensionId;

            if (isPullRequest) {
                // We are on the PR page, change the tab parameter and set the hash
                const tabId = `${publisher}.${extensionId}.asciidoc-pr-tab`;
                await navService.setQueryParams({ _a: tabId });
                await navService.setHash(`path=${encodeURIComponent(filePath)}`);
            } else {
                // We are in the repo view, navigate to the hub
                const repo = actionContext?.gitRepository;
                const version = actionContext?.version;
                
                let isOnDefaultBranch = false;
                if (repo && version) {
                    const defaultBranchName = repo.defaultBranch ? repo.defaultBranch.replace('refs/heads/', '') : 'main';
                    if (version === defaultBranchName || version === repo.defaultBranch) {
                        isOnDefaultBranch = true;
                    }
                }
                
                if (isOnDefaultBranch && repo && repo.webUrl) {
                    const hubId = `${publisher}.${extensionId}.asciidoc-hub`;
                    const baseUrl = repo.webUrl.split('/_git/')[0];
                    const targetUrl = `${baseUrl}/_apps/hub/${hubId}?repoId=${repo.id}&path=${encodeURIComponent(filePath)}`;
                    navService.navigate(targetUrl);
                } else {
                    const globalMessages = await SDK.getService<any>(CommonServiceIds.GlobalMessagesService);
                    if (globalMessages && globalMessages.addToast) {
                        globalMessages.addToast({
                            duration: 3000,
                            message: "Preview is only supported on the default branch.",
                            forceOverrideExisting: true
                        });
                    }
                }
            }
        } catch (e) {
            console.error("Failed to navigate to AsciiDoc view", e);
        }
    }
};

SDK.register("asciidoc-preview-action", actionHandler);
SDK.register("AJeckmans.asciidoc.asciidoc-preview-action", actionHandler);
SDK.register("ajeckmans.asciidoc.asciidoc-preview-action", actionHandler);

SDK.notifyLoadSucceeded().then(() => {
    // We can also safely register the dynamic one here once loaded
    SDK.ready().then(() => {
        if (SDK.getContributionId()) {
            SDK.register(SDK.getContributionId(), actionHandler);
        }
    });
});
