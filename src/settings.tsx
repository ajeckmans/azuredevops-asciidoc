import * as React from "react";
import * as ReactDOM from "react-dom";
import * as SDK from "azure-devops-extension-sdk";
import SettingsApp from "./components/SettingsApp";

SDK.init({
    loaded: false,
    applyTheme: true
}).then(() => {
    SDK.ready().then(() => {
        ReactDOM.render(<SettingsApp />, document.getElementById("root"));
        SDK.notifyLoadSucceeded();
    });
});
