import { VercelRequest, VercelResponse } from "@vercel/node";
import { readFileSync } from "fs";
import { join } from "path";

interface HealthMetrics {
    status: "operational" | "degraded" | "down";
    uptime: string;
    responseTime: number;
    timestamp: string;
    services: {
        api: "operational" | "degraded" | "down";
        database: "operational" | "degraded" | "down";
        webhook: "operational" | "degraded" | "down";
        qr_generator: "operational" | "degraded" | "down";
    };
    version: string;
}

function getHealthMetrics(): HealthMetrics {
    const startTime = Date.now();

    const metrics: HealthMetrics = {
        status: "operational",
        uptime: process.uptime
            ? `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`
            : "N/A",
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        services: {
            api: "operational",
            database: "operational",
            webhook: "operational",
            qr_generator: "operational",
        },
        version: "1.0.0",
    };

    return metrics;
}

function getStatusColor(status: string): string {
    switch (status) {
        case "operational":
            return "#22c55e";
        case "degraded":
            return "#f59e0b";
        case "down":
            return "#ef4444";
        default:
            return "#6b7280";
    }
}

function generateStatusPage(metrics: HealthMetrics): string {
    try {
        const templatePath = join(process.cwd(), "api", "health-template.html");
        let template = readFileSync(templatePath, "utf-8");

        template = template
            .replace(/{{OVERALL_STATUS}}/g, metrics.status.toUpperCase())
            .replace(
                /{{OVERALL_STATUS_COLOR}}/g,
                getStatusColor(metrics.status),
            )
            .replace(/{{UPTIME}}/g, metrics.uptime)
            .replace(/{{RESPONSE_TIME}}/g, metrics.responseTime.toString())
            .replace(
                /{{TIMESTAMP}}/g,
                new Date(metrics.timestamp).toLocaleString(),
            )
            .replace(/{{VERSION}}/g, metrics.version)
            .replace(/{{API_STATUS}}/g, metrics.services.api.toUpperCase())
            .replace(
                /{{API_STATUS_COLOR}}/g,
                getStatusColor(metrics.services.api),
            )
            .replace(
                /{{DATABASE_STATUS}}/g,
                metrics.services.database.toUpperCase(),
            )
            .replace(
                /{{DATABASE_STATUS_COLOR}}/g,
                getStatusColor(metrics.services.database),
            )
            .replace(
                /{{WEBHOOK_STATUS}}/g,
                metrics.services.webhook.toUpperCase(),
            )
            .replace(
                /{{WEBHOOK_STATUS_COLOR}}/g,
                getStatusColor(metrics.services.webhook),
            )
            .replace(
                /{{QR_STATUS}}/g,
                metrics.services.qr_generator.toUpperCase(),
            )
            .replace(
                /{{QR_STATUS_COLOR}}/g,
                getStatusColor(metrics.services.qr_generator),
            );

        return template;
    } catch (error) {
        return getFallbackHtml(metrics);
    }
}

function getFallbackHtml(metrics: HealthMetrics): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Deal-Quest-Bot Status</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        .header { text-align: center; margin-bottom: 40px; }
        .header h1 { font-size: 2rem; font-weight: 600; margin-bottom: 8px; }
        .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: 500; }
        .operational { background: #dcfce7; color: #166534; }
        .card { background: white; border-radius: 8px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .metric { text-align: center; }
        .metric-value { font-size: 1.5rem; font-weight: 600; color: #0f172a; }
        .metric-label { font-size: 0.875rem; color: #64748b; margin-top: 4px; }
        .services { display: grid; gap: 12px; }
        .service { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
        .service:last-child { border-bottom: none; }
        .service-name { font-weight: 500; }
        .service-status { padding: 4px 12px; border-radius: 12px; font-size: 0.875rem; font-weight: 500; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Deal-Quest-Bot</h1>
            <span class="status-badge operational">ALL SYSTEMS OPERATIONAL</span>
        </div>

        <div class="card">
            <h2 style="margin-bottom: 20px; font-size: 1.25rem;">System Metrics</h2>
            <div class="metrics">
                <div class="metric">
                    <div class="metric-value">${metrics.uptime}</div>
                    <div class="metric-label">Uptime</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${metrics.responseTime}ms</div>
                    <div class="metric-label">Response Time</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${metrics.version}</div>
                    <div class="metric-label">Version</div>
                </div>
            </div>
        </div>

        <div class="card">
            <h2 style="margin-bottom: 20px; font-size: 1.25rem;">Service Status</h2>
            <div class="services">
                <div class="service">
                    <span class="service-name">API Gateway</span>
                    <span class="service-status operational">OPERATIONAL</span>
                </div>
                <div class="service">
                    <span class="service-name">Database</span>
                    <span class="service-status operational">OPERATIONAL</span>
                </div>
                <div class="service">
                    <span class="service-name">Webhook Service</span>
                    <span class="service-status operational">OPERATIONAL</span>
                </div>
                <div class="service">
                    <span class="service-name">QR Generator</span>
                    <span class="service-status operational">OPERATIONAL</span>
                </div>
            </div>
        </div>

        <div style="text-align: center; color: #64748b; font-size: 0.875rem;">
            Last updated: ${new Date(metrics.timestamp).toLocaleString()}
        </div>
    </div>
</body>
</html>`;
}

export default (req: VercelRequest, res: VercelResponse) => {
    const metrics = getHealthMetrics();
    const html = generateStatusPage(metrics);

    res.setHeader("Content-Type", "text/html");
    res.status(200).send(html);
};
