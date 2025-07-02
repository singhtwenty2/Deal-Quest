import { VercelRequest, VercelResponse } from "@vercel/node";
import { readFileSync } from "fs";
import { join } from "path";
import QRCode from "qrcode";
import catalog from "./catalog.json";

interface QRData {
    whatsappUrl: string;
    phoneNumber: string;
    message: string;
    timestamp: string;
    qrSvg: string;
}

function getRandomMessage(): string {
    const messages = [
        "🍕 Hey! Show me the best pizza deals around",
        "☕ Looking for great coffee spots with offers",
        "🍔 Find me burger places with amazing deals",
        "🍣 Where can I get fresh sushi with discounts?",
        "🥤 Need smoothie bars with healthy options nearby",
        "🌮 Craving tacos! What deals are available?",
        "🍦 Show me ice cream places with sweet deals",
        "🍜 Looking for ramen spots with good offers",
        "🥪 Find sandwich places with lunch specials",
        "🍩 Need donut shops with fresh daily deals",
        "🍴 What's the best food deal near me right now?",
        "💰 Show me today's hottest restaurant discounts",
        "🔥 Looking for buy-one-get-one deals nearby",
        "⭐ Find me 5-star rated places with offers",
        "📍 What food deals are close to my location?",
        "🎉 Show me happy hour specials around here",
        "🛍️ Looking for combo meal deals and discounts",
        "👨‍🍳 Find gourmet food spots with great prices",
        "🌟 What are the top-rated deals today?",
        "🚀 Quick! I need the best food deals now",
    ];

    const categories = catalog.map((item) => item.category);
    const randomCategory =
        categories[Math.floor(Math.random() * categories.length)];

    const categoryMessages = messages.filter(
        (msg) =>
            msg.toLowerCase().includes(randomCategory) ||
            msg.includes("food deal") ||
            msg.includes("deals") ||
            msg.includes("discounts") ||
            msg.includes("specials"),
    );

    if (categoryMessages.length > 0) {
        return categoryMessages[
            Math.floor(Math.random() * categoryMessages.length)
        ];
    }

    return messages[Math.floor(Math.random() * messages.length)];
}

function generateQRPage(data: QRData): string {
    try {
        const templatePath = join(process.cwd(), "api", "qr-template.html");
        let template = readFileSync(templatePath, "utf-8");

        template = template
            .replace(/{{QR_SVG}}/g, data.qrSvg)
            .replace(/{{PHONE_NUMBER}}/g, data.phoneNumber)
            .replace(/{{MESSAGE}}/g, data.message)
            .replace(/{{WHATSAPP_URL}}/g, data.whatsappUrl)
            .replace(
                /{{TIMESTAMP}}/g,
                new Date(data.timestamp).toLocaleString(),
            );

        return template;
    } catch (error) {
        return getFallbackHtml(data);
    }
}

function getFallbackHtml(data: QRData): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Deal-Quest-Bot QR Code</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #1e293b;
        }
        .container {
            max-width: 500px;
            background: white;
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            margin: 20px;
        }
        .header h1 {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 8px;
            color: #0f172a;
        }
        .subtitle {
            color: #64748b;
            margin-bottom: 32px;
            font-size: 1.1rem;
        }
        .qr-container {
            background: #f8fafc;
            padding: 32px;
            border-radius: 16px;
            margin: 32px 0;
            border: 2px solid #e2e8f0;
        }
        .qr-container svg {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
        }
        .instructions {
            background: #f0f9ff;
            padding: 20px;
            border-radius: 12px;
            margin: 24px 0;
            border-left: 4px solid #0ea5e9;
        }
        .button {
            display: inline-block;
            background: #059669;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 20px;
            transition: all 0.2s;
        }
        .button:hover {
            background: #047857;
            transform: translateY(-2px);
        }
        .info {
            margin-top: 24px;
            font-size: 0.875rem;
            color: #64748b;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📱 Deal-Quest-Bot</h1>
            <p class="subtitle">Connect instantly via WhatsApp</p>
        </div>

        <div class="qr-container">
            ${data.qrSvg}
        </div>

        <div class="instructions">
            <h3 style="margin-bottom: 12px; color: #0f172a;">📋 How to Use</h3>
            <p>1. Open your phone's camera app</p>
            <p>2. Point it at the QR code above</p>
            <p>3. Tap the WhatsApp notification</p>
            <p>4. Start chatting with Deal-Quest-Bot!</p>
        </div>

        <a href="${data.whatsappUrl}" class="button">
            💬 Open WhatsApp Directly
        </a>

        <div class="info">
            <p><strong>Phone:</strong> +${data.phoneNumber}</p>
            <p><strong>Message:</strong> "${data.message}"</p>
            <p><strong>Generated:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
        </div>
    </div>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const whatsappNumber =
            process.env.WHATSAPP_NUMBER || "whatsapp:+15556440448";
        const phoneNumber = whatsappNumber.replace("whatsapp:+", "");
        const message = getRandomMessage();
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

        const svg = await QRCode.toString(whatsappUrl, {
            type: "svg",
            width: 300,
            margin: 2,
        });

        const format = req.query.format as string;

        if (format === "svg") {
            res.setHeader("Content-Type", "image/svg+xml");
            res.status(200).send(svg);
            return;
        }

        if (format === "json") {
            res.status(200).json({
                whatsappUrl,
                phoneNumber,
                message,
                qrCode: svg,
                timestamp: new Date().toISOString(),
            });
            return;
        }

        const qrData: QRData = {
            whatsappUrl,
            phoneNumber,
            message,
            timestamp: new Date().toISOString(),
            qrSvg: svg,
        };

        const html = generateQRPage(qrData);
        res.setHeader("Content-Type", "text/html");
        res.status(200).send(html);
    } catch (error) {
        res.status(500).json({ error: "Failed to generate QR code" });
    }
}
