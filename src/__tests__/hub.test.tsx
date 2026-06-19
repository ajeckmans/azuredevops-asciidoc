/// <reference types="jest" />
import * as SDK from "azure-devops-extension-sdk";
import { waitFor } from '@testing-library/react';
import * as ReactDOM from "react-dom";
import * as React from "react";

jest.mock("azure-devops-extension-sdk", () => ({
    init: jest.fn(),
    ready: jest.fn().mockResolvedValue(true)
}));

jest.mock("react-dom", () => ({
    render: jest.fn()
}));

jest.mock("../HubApp", () => {
    return function MockHubApp() {
        return <div data-testid="mock-hub-app">Mock Hub App</div>;
    };
});

describe("hub.tsx", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Setup a mock root element
        document.body.innerHTML = '<div id="root"></div>';
    });

    it("initializes SDK and renders HubApp", async () => {
        // Isolate module to ensure it runs fresh
        jest.isolateModules(() => {
            require("../hub");
        });

        expect(SDK.init).toHaveBeenCalledWith({ applyTheme: true });
        
        // Wait for promise resolution from SDK.ready()
        await new Promise(resolve => setTimeout(resolve, 0));
        
        expect(ReactDOM.render).toHaveBeenCalled();
    });
});
