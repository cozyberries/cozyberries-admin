export async function sendActivity(type: string, title: string, metadata: string) {
    try {
        const response = await fetch("/api/activities", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, title, metadata }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
            const errorMessage = errorData.error || `Failed to send activity: ${response.status} ${response.statusText}`;
            console.error("Activity API error:", errorMessage);
            throw new Error(errorMessage);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error sending activity:", error);
        throw error;
    }
}