export async function sendNotification(title: string, message: string, type = "info") {
    try {
        const response = await fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, message, type }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
            const errorMessage = errorData.error || `Failed to send notification: ${response.status} ${response.statusText}`;
            console.error("Notification API error:", errorMessage);
            throw new Error(errorMessage);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error sending notification:", error);
        throw error;
    }
}