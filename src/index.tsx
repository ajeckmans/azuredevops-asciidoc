import * as SDK from "azure-devops-extension-sdk";
import * as React from "react";
import * as ReactDOM from "react-dom";
import App from "./App";
import "azure-devops-ui/Core/override.css";

SDK.init({ applyTheme: true });

SDK.ready().then(() => {
    ReactDOM.render(<App />, document.getElementById("root"));
});
