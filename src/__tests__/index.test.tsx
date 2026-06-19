/// <reference types="jest" />
import * as SDK from "azure-devops-extension-sdk";
import { waitFor } from "@testing-library/react";
import * as ReactDOM from "react-dom";
import * as React from "react";

jest.mock("azure-devops-extension-sdk", () => ({
    init: jest.fn(),
    ready: jest.fn().mockResolvedValue(true)
}));

jest.mock("react-dom", () => ({
    render: jest.fn()
}));

jest.mock("../App", () => {
    return function MockApp() {
        return <div data-testid="mock-app">Mock App</div>;
    };
});

describe("index.tsx", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Setup a mock root element
        document.body.innerHTML = '<div id="root"></div>';
    });

    it("initializes SDK and renders App", async () => {
        // Isolate module to ensure it runs fresh
        jest.isolateModules(() => {
            require("../index");
        });

        expect(SDK.init).toHaveBeenCalledWith({ applyTheme: true });
        
        // Wait for promise resolution from SDK.ready()
        await new Promise(resolve => setTimeout(resolve, 0));
        
        expect(ReactDOM.render).toHaveBeenCalled();
    });
});
