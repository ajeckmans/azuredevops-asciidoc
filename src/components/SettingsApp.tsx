import * as React from "react";
import { Page } from "azure-devops-ui/Page";
import { Surface, SurfaceBackground } from "azure-devops-ui/Surface";
import { TextField } from "azure-devops-ui/TextField";
import { Button } from "azure-devops-ui/Button";
import { Toggle } from "azure-devops-ui/Toggle";
import { DevOpsService } from "../services/DevOpsService";

const SettingsApp: React.FC = () => {
    const [renderPlantUML, setRenderPlantUML] = React.useState<boolean>(false);
    const [krokiServerUrl, setKrokiServerUrl] = React.useState<string>("");
    const [isSaving, setIsSaving] = React.useState<boolean>(false);
    const [loading, setLoading] = React.useState<boolean>(true);
    const [message, setMessage] = React.useState<{text: string, type: 'success' | 'error'} | null>(null);

    React.useEffect(() => {
        const loadSettings = async () => {
            try {
                const settings = await DevOpsService.getKrokiSettings();
                if (settings) {
                    setRenderPlantUML(settings.renderPlantUML || false);
                    setKrokiServerUrl(settings.krokiServerUrl || "");
                }
            } catch (e) {
                console.error("Failed to load settings:", e);
                setMessage({ text: "Failed to load settings", type: "error" });
            } finally {
                setLoading(false);
            }
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);
        try {
            await DevOpsService.setKrokiSettings({
                renderPlantUML,
                krokiServerUrl
            });
            setMessage({ text: "Settings saved successfully", type: "success" });
            setTimeout(() => setMessage(null), 3000);
        } catch (e) {
            console.error("Failed to save settings:", e);
            setMessage({ text: "Failed to save settings", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return <div style={{ padding: "20px" }}>Loading settings...</div>;
    }

    return (
        <Surface background={SurfaceBackground.neutral}>
            <Page className="flex-grow flex-column">
                <div style={{ padding: "32px", maxWidth: "800px", margin: "0 auto", width: "100%" }}>
                    <h1 style={{ fontSize: "24px", fontWeight: "600", marginBottom: "24px" }}>AsciiDoc Extension Settings</h1>
                    
                    <div style={{ marginBottom: "32px" }}>
                        <p style={{ color: "var(--text-secondary-color, #666)", marginBottom: "16px" }}>
                            Configure diagram rendering for AsciiDoc files across your organization.
                        </p>
                        
                        <div style={{ marginBottom: "24px", padding: "16px", border: "1px solid var(--palette-neutral-8, #eaeaea)", borderRadius: "4px", backgroundColor: "var(--background-color, #fff)" }}>
                            <div style={{ display: "flex", alignItems: "center", marginBottom: "16px" }}>
                                <Toggle
                                    checked={renderPlantUML}
                                    onChange={(e, val) => setRenderPlantUML(val)}
                                    text="Enable PlantUML and Diagram Rendering"
                                />
                            </div>
                            
                            <p style={{ fontSize: "12px", color: "var(--text-secondary-color, #666)", marginBottom: "16px" }}>
                                If disabled, PlantUML and other diagram blocks will be rendered as standard code blocks.
                            </p>

                            {renderPlantUML && (
                                <div style={{ marginTop: "16px" }}>
                                    <TextField
                                        label="Custom Internal Kroki Server URL"
                                        placeholder="https://kroki.internal.mycompany.com"
                                        value={krokiServerUrl}
                                        onChange={(e, val) => setKrokiServerUrl(val)}
                                        className="flex-grow"
                                        required
                                    />
                                    <p style={{ fontSize: "12px", color: "var(--text-secondary-color, #666)", marginTop: "8px" }}>
                                        To ensure no data leaves your organization, you must provide an internal URL to a Kroki or PlantUML server. 
                                        If left blank while rendering is enabled, diagrams will fall back to code blocks.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <Button
                                text={isSaving ? "Saving..." : "Save Settings"}
                                primary
                                disabled={isSaving}
                                onClick={handleSave}
                            />
                            {message && (
                                <span style={{ color: message.type === 'success' ? '#107c41' : '#a80000', fontWeight: '600', fontSize: '14px' }}>
                                    {message.text}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </Page>
        </Surface>
    );
};

export default SettingsApp;
